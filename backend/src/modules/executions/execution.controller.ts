import type { FastifyReply, FastifyRequest } from 'fastify';
import { ValidationError, NotFoundError } from '../../common/errors/index.js';
import { logger } from '../../common/utils/logger.js';
import { generateId } from '../../common/utils/id-generator.js';
import { WorkflowExecutionService } from '../workflows/workflow-execution.service.js';
import { WorkflowRepository } from '../workflows/workflow.repository.js';
import { AssetRepository } from '../assets/asset.repository.js';
import { createStorageAdapter } from '../../storage/storage.factory.js';
import type { IStorageAdapter } from '../../storage/storage.interface.js';
import type { WorkflowEngine } from '../../engine/engine.js';
import { config } from '../../config/index.js';
import { socketManager } from '../../realtime/socket.manager.js';
import { SERVER_EVENTS } from '../../realtime/socket.events.js';
import {
  startExecutionSchema,
  listExecutionsSchema,
  overrideNodeSchema,
} from './execution.schema.js';
import WorkflowExecutionModel from '../workflows/workflow-execution.model.js';

export class ExecutionController {
  private readonly executionService: WorkflowExecutionService;
  private readonly workflowRepository: WorkflowRepository;
  private readonly assetRepository: AssetRepository;
  private readonly storageAdapter: IStorageAdapter;

  constructor(private readonly engine: WorkflowEngine) {
    this.executionService = new WorkflowExecutionService();
    this.workflowRepository = new WorkflowRepository();
    this.assetRepository = new AssetRepository();
    this.storageAdapter = createStorageAdapter(config.STORAGE_DRIVER, config.STORAGE_PATH);
  }

  async start(
    request: FastifyRequest<{ Body: { workflowId: string } }>,
    reply: FastifyReply,
  ): Promise<void> {
    const parsed = startExecutionSchema.safeParse(request.body);
    if (!parsed.success) {
      throw new ValidationError('Invalid request body', {
        errors: parsed.error.flatten().fieldErrors,
      });
    }

    const userId = request.user!.userId;
    const { workflowId } = parsed.data;

    const workflow = await this.workflowRepository.findById(workflowId);
    if (!workflow) {
      throw new NotFoundError('Workflow');
    }

    // Verify ownership
    if (workflow.userId.toString() !== userId) {
      throw new NotFoundError('Workflow');
    }

    // Create execution record
    const execution = await this.executionService.create(workflow, userId);
    const executionId = execution._id.toString();

    // Start execution asynchronously
    this.engine.start(executionId).catch(async (err) => {
      logger.error({ err, executionId }, 'Engine start failed');

      try {
        await this.executionService.setError(
          executionId,
          '',
          err instanceof Error ? err.message : 'Unknown engine error',
          0,
        );
      } catch (dbErr) {
        logger.error({ err: dbErr, executionId }, 'Failed to mark execution as failed');
      }

      socketManager.emitToExecution(executionId, SERVER_EVENTS.EXECUTION_FAILED, {
        workflowId,
        executionId,
        error: err instanceof Error ? err.message : 'Unknown engine error',
        timestamp: new Date().toISOString(),
      });
      socketManager.emitToUser(userId, SERVER_EVENTS.EXECUTION_FAILED, {
        workflowId,
        executionId,
        error: err instanceof Error ? err.message : 'Unknown engine error',
        timestamp: new Date().toISOString(),
      });
    });

    reply.status(201).send({
      data: {
        executionId,
        status: 'pending',
        workflowId,
      },
    });
  }

  async list(
    request: FastifyRequest<{ Querystring: Record<string, string> }>,
    reply: FastifyReply,
  ): Promise<void> {
    const parsed = listExecutionsSchema.safeParse(request.query);
    if (!parsed.success) {
      throw new ValidationError('Invalid query parameters', {
        errors: parsed.error.flatten().fieldErrors,
      });
    }

    const userId = request.user!.userId;
    const { page, limit, status, workflowId, projectId } = parsed.data;

    const filter: Record<string, unknown> = { userId };
    if (status) filter.status = status;
    if (workflowId) filter.workflowId = workflowId;
    if (projectId) filter.projectId = projectId;

    const skip = (page - 1) * limit;

    const [executions, total] = await Promise.all([
      WorkflowExecutionModel.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .exec(),
      WorkflowExecutionModel.countDocuments(filter).exec(),
    ]);

    reply.send({
      data: executions,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    });
  }

  async getById(
    request: FastifyRequest<{ Params: { executionId: string } }>,
    reply: FastifyReply,
  ): Promise<void> {
    const userId = request.user!.userId;
    const { executionId } = request.params;

    const execution = await this.executionService.findByIdAndUser(
      executionId,
      userId,
    );

    reply.send({ data: execution });
  }

  async pause(
    request: FastifyRequest<{ Params: { executionId: string } }>,
    reply: FastifyReply,
  ): Promise<void> {
    const userId = request.user!.userId;
    const { executionId } = request.params;

    // Verify ownership
    await this.executionService.findByIdAndUser(executionId, userId);

    await this.engine.pause(executionId);

    reply.send({
      data: { executionId, status: 'paused' },
    });
  }

  async resume(
    request: FastifyRequest<{ Params: { executionId: string } }>,
    reply: FastifyReply,
  ): Promise<void> {
    const userId = request.user!.userId;
    const { executionId } = request.params;

    await this.executionService.findByIdAndUser(executionId, userId);

    await this.engine.resume(executionId);

    reply.send({
      data: { executionId, status: 'running' },
    });
  }

  async cancel(
    request: FastifyRequest<{ Params: { executionId: string } }>,
    reply: FastifyReply,
  ): Promise<void> {
    const userId = request.user!.userId;
    const { executionId } = request.params;

    await this.executionService.findByIdAndUser(executionId, userId);

    await this.engine.cancel(executionId);

    reply.send({
      data: { executionId, status: 'cancelled' },
    });
  }

  async retry(
    request: FastifyRequest<{ Params: { executionId: string } }>,
    reply: FastifyReply,
  ): Promise<void> {
    const userId = request.user!.userId;
    const { executionId } = request.params;

    await this.executionService.findByIdAndUser(executionId, userId);

    const newExecutionId = await this.engine.retry(executionId);

    reply.status(201).send({
      data: {
        executionId: newExecutionId,
        originalExecutionId: executionId,
        status: 'pending',
      },
    });
  }

  async getNodeState(
    request: FastifyRequest<{
      Params: { executionId: string; nodeId: string };
    }>,
    reply: FastifyReply,
  ): Promise<void> {
    const userId = request.user!.userId;
    const { executionId, nodeId } = request.params;

    const execution = await this.executionService.findByIdAndUser(
      executionId,
      userId,
    );

    const nodeState = execution.nodeStates.get(nodeId);
    const nodeOutput = execution.nodeOutputs.get(nodeId);

    if (!nodeState) {
      throw new NotFoundError(`Node "${nodeId}" in execution`);
    }

    const stateObj = typeof nodeState.toObject === 'function'
      ? nodeState.toObject()
      : nodeState;

    reply.send({
      data: {
        ...stateObj,
        output: nodeOutput ?? null,
      },
    });
  }

  async overrideNode(
    request: FastifyRequest<{
      Params: { executionId: string; nodeId: string };
      Body?: { assetId?: string };
    }>,
    reply: FastifyReply,
  ): Promise<void> {
    const userId = request.user!.userId;
    const { executionId, nodeId } = request.params;

    // Verify ownership
    await this.executionService.findByIdAndUser(executionId, userId);

    let assetUrl: string;

    // Check if this is a multipart file upload
    const isMultipart = request.isMultipart?.();

    if (isMultipart) {
      // Handle file upload
      const file = await request.file();
      if (!file) {
        throw new ValidationError('File upload required when using multipart');
      }

      const fileBuffer = await file.toBuffer();
      const mimeType = file.mimetype;
      const originalName = file.filename;

      // Generate unique filename and upload to storage
      const ext = originalName.split('.').pop()?.toLowerCase() ?? 'bin';
      const filename = `${generateId()}.${ext}`;
      const storagePath = `overrides/${filename}`;

      await this.storageAdapter.upload(fileBuffer, storagePath, mimeType);
      assetUrl = this.storageAdapter.getUrl(storagePath);

      logger.info(
        { executionId, nodeId, storagePath },
        'Override file uploaded',
      );
    } else {
      // Handle JSON body with assetId reference
      const parsed = overrideNodeSchema.safeParse(request.body);
      if (!parsed.success) {
        throw new ValidationError('Request must include a file upload or JSON body with assetId', {
          errors: parsed.error.flatten().fieldErrors,
        });
      }

      const { assetId } = parsed.data;
      const asset = await this.assetRepository.findById(assetId);

      if (!asset) {
        throw new NotFoundError('Asset');
      }

      if (asset.userId.toString() !== userId) {
        throw new NotFoundError('Asset');
      }

      assetUrl = asset.url ?? this.storageAdapter.getUrl(asset.storagePath);
    }

    const updatedExecution = await this.engine.overrideNode(
      executionId,
      nodeId,
      assetUrl,
    );

    reply.send({
      data: {
        executionId,
        nodeId,
        status: 'completed',
        overridden: true,
        assetUrl,
        executionStatus: updatedExecution.status,
      },
    });
  }

  async retryNode(
    request: FastifyRequest<{
      Params: { executionId: string; nodeId: string };
    }>,
    reply: FastifyReply,
  ): Promise<void> {
    const userId = request.user!.userId;
    const { executionId, nodeId } = request.params;

    // Verify ownership
    await this.executionService.findByIdAndUser(executionId, userId);

    const updatedExecution = await this.engine.retryNode(executionId, nodeId);

    reply.send({
      data: {
        executionId,
        nodeId,
        status: 'pending',
        executionStatus: updatedExecution.status,
      },
    });
  }
}

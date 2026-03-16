import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest';
import { Types } from 'mongoose';

import type { IWorkflowExecution, INodeExecutionState, ExecutionStatus } from '../../../src/modules/workflows/workflow.types.js';
import type { IWorkflowNode, IWorkflowEdge } from '../../../src/engine/engine.types.js';
import { QUEUES, NODE_TYPE_TO_QUEUE } from '../../../src/queue/queue.types.js';
import { SERVER_EVENTS } from '../../../src/realtime/socket.events.js';

// ── Mock external dependencies before importing the class under test ──

vi.mock('../../../src/common/utils/logger.js', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

const mockEmitToExecution = vi.fn();
const mockEmitToProject = vi.fn();
const mockEmitToUser = vi.fn();

vi.mock('../../../src/realtime/socket.manager.js', () => ({
  socketManager: {
    emitToExecution: (...args: unknown[]) => mockEmitToExecution(...args),
    emitToProject: (...args: unknown[]) => mockEmitToProject(...args),
    emitToUser: (...args: unknown[]) => mockEmitToUser(...args),
  },
}));

const mockFindById = vi.fn();
const mockSetError = vi.fn();
const mockUpdateStatus = vi.fn();
const mockUpdateNodeStatus = vi.fn();
const mockUpdateNodeState = vi.fn();
const mockSetNodeOutput = vi.fn();
const mockUpdateProgress = vi.fn();
const mockCreate = vi.fn();

vi.mock('../../../src/modules/workflows/workflow-execution.service.js', () => ({
  WorkflowExecutionService: vi.fn().mockImplementation(() => ({
    findById: mockFindById,
    setError: mockSetError,
    updateStatus: mockUpdateStatus,
    updateNodeStatus: mockUpdateNodeStatus,
    updateNodeState: mockUpdateNodeState,
    setNodeOutput: mockSetNodeOutput,
    updateProgress: mockUpdateProgress,
    create: mockCreate,
  })),
}));

const mockValidate = vi.fn();

vi.mock('../../../src/engine/graph.resolver.js', () => ({
  GraphResolver: vi.fn().mockImplementation(() => ({
    validate: mockValidate,
  })),
}));

const mockCreateInitialFlow = vi.fn();

vi.mock('../../../src/queue/flows/workflow-flow.producer.js', () => ({
  WorkflowFlowProducer: vi.fn().mockImplementation(() => ({
    createInitialFlow: mockCreateInitialFlow,
  })),
}));

// ── Import the class under test after mocks are defined ──

const { WorkflowEngine } = await import('../../../src/engine/engine.js');

// ── Test helpers ───────────────────────────────────────────────────────

function createNode(id: string, type: IWorkflowNode['type']): IWorkflowNode {
  return { id, type, position: { x: 0, y: 0 }, config: {} };
}

function createEdge(
  id: string,
  sourceNodeId: string,
  sourcePort: string,
  targetNodeId: string,
  targetPort: string,
): IWorkflowEdge {
  return { id, sourceNodeId, sourcePort, targetNodeId, targetPort };
}

function objectId(hex?: string): Types.ObjectId {
  return new Types.ObjectId(hex);
}

function buildExecution(overrides: Partial<IWorkflowExecution> = {}): IWorkflowExecution {
  const nodes: IWorkflowNode[] = [
    createNode('n1', 'script-input'),
    createNode('n2', 'output'),
  ];
  const edges: IWorkflowEdge[] = [
    createEdge('e1', 'n1', 'script', 'n2', 'video'),
  ];

  const nodeStates = new Map<string, INodeExecutionState>();
  for (const node of nodes) {
    nodeStates.set(node.id, {
      nodeId: node.id,
      status: 'pending',
      attempts: 0,
    });
  }

  return {
    _id: objectId(),
    workflowId: objectId(),
    projectId: objectId(),
    userId: objectId(),
    status: 'pending',
    workflowSnapshot: { nodes, edges },
    nodeStates,
    nodeOutputs: new Map(),
    progress: { totalNodes: 2, completedNodes: 0, percentage: 0 },
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

// ── Mock QueueManager ──────────────────────────────────────────────────

function createMockQueueManager() {
  const mockAdd = vi.fn();
  const mockRemove = vi.fn();
  const mockGetJobs = vi.fn().mockResolvedValue([]);
  const mockPause = vi.fn();
  const mockResume = vi.fn();

  const mockQueue = {
    add: mockAdd,
    getJobs: mockGetJobs,
    pause: mockPause,
    resume: mockResume,
  };

  return {
    getQueue: vi.fn().mockReturnValue(mockQueue),
    getFlowProducer: vi.fn().mockReturnValue({ add: vi.fn() }),
    pauseQueue: vi.fn(),
    resumeQueue: vi.fn(),
    mockQueue,
    mockAdd,
    mockRemove,
    mockGetJobs,
  };
}

// ── Tests ──────────────────────────────────────────────────────────────

describe('WorkflowEngine', () => {
  let engine: InstanceType<typeof WorkflowEngine>;
  let queueManager: ReturnType<typeof createMockQueueManager>;

  beforeEach(() => {
    vi.clearAllMocks();

    queueManager = createMockQueueManager();
    engine = new WorkflowEngine(queueManager as never);
  });

  // ── start ──────────────────────────────────────────────────────────

  describe('start', () => {
    it('should validate DAG, mark nodes as queued, and create flow', async () => {
      const execution = buildExecution();
      mockFindById.mockResolvedValue(execution);
      mockValidate.mockReturnValue({ isValid: true, errors: [] });
      mockUpdateStatus.mockResolvedValue(execution);
      mockUpdateNodeStatus.mockResolvedValue(execution);
      mockCreateInitialFlow.mockResolvedValue(undefined);

      await engine.start(execution._id.toString());

      // Graph was validated
      expect(mockValidate).toHaveBeenCalledWith(
        execution.workflowSnapshot.nodes,
        execution.workflowSnapshot.edges,
      );

      // Status updated to running
      expect(mockUpdateStatus).toHaveBeenCalledWith(
        execution._id.toString(),
        'running',
      );

      // Each node marked as queued
      for (const node of execution.workflowSnapshot.nodes) {
        expect(mockUpdateNodeStatus).toHaveBeenCalledWith(
          execution._id.toString(),
          node.id,
          'queued',
        );
      }

      // BullMQ flow was created with correct context
      expect(mockCreateInitialFlow).toHaveBeenCalledWith(
        execution.workflowSnapshot.nodes,
        execution.workflowSnapshot.edges,
        {
          executionId: execution._id.toString(),
          workflowId: execution.workflowId.toString(),
          projectId: execution.projectId.toString(),
          userId: execution.userId.toString(),
        },
      );
    });

    it('should set error and throw on invalid graph', async () => {
      const execution = buildExecution();
      mockFindById.mockResolvedValue(execution);
      mockValidate.mockReturnValue({
        isValid: false,
        errors: ['Cycle detected', 'Disconnected nodes'],
      });
      mockSetError.mockResolvedValue(execution);

      await expect(engine.start(execution._id.toString())).rejects.toThrow(
        'Invalid workflow graph',
      );

      // Error stored on execution with joined message
      expect(mockSetError).toHaveBeenCalledWith(
        execution._id.toString(),
        '',
        'Invalid workflow graph: Cycle detected, Disconnected nodes',
        0,
      );

      // Flow was NOT created
      expect(mockCreateInitialFlow).not.toHaveBeenCalled();
    });

    it('should emit socket events on start', async () => {
      const execution = buildExecution();
      mockFindById.mockResolvedValue(execution);
      mockValidate.mockReturnValue({ isValid: true, errors: [] });
      mockUpdateStatus.mockResolvedValue(execution);
      mockUpdateNodeStatus.mockResolvedValue(execution);
      mockCreateInitialFlow.mockResolvedValue(undefined);

      await engine.start(execution._id.toString());

      // Emits to execution room
      expect(mockEmitToExecution).toHaveBeenCalledWith(
        execution._id.toString(),
        SERVER_EVENTS.EXECUTION_STARTED,
        expect.objectContaining({
          executionId: execution._id.toString(),
          workflowId: execution.workflowId.toString(),
          timestamp: expect.any(String),
        }),
      );

      // Emits to project room
      expect(mockEmitToProject).toHaveBeenCalledWith(
        execution.projectId.toString(),
        SERVER_EVENTS.EXECUTION_STARTED,
        expect.objectContaining({ executionId: execution._id.toString() }),
      );

      // Emits to user room
      expect(mockEmitToUser).toHaveBeenCalledWith(
        execution.userId.toString(),
        SERVER_EVENTS.EXECUTION_STARTED,
        expect.objectContaining({ executionId: execution._id.toString() }),
      );
    });
  });

  // ── pause ──────────────────────────────────────────────────────────

  describe('pause', () => {
    it('should pause all queues and update status', async () => {
      const execution = buildExecution({ status: 'running' });
      mockFindById.mockResolvedValue(execution);
      mockUpdateStatus.mockResolvedValue(execution);

      await engine.pause(execution._id.toString());

      // Status set to paused
      expect(mockUpdateStatus).toHaveBeenCalledWith(
        execution._id.toString(),
        'paused',
      );

      // Each queue was paused
      const queueNames = Object.values(QUEUES);
      for (const queueName of queueNames) {
        expect(queueManager.pauseQueue).toHaveBeenCalledWith(queueName);
      }

      // Socket events emitted
      expect(mockEmitToExecution).toHaveBeenCalledWith(
        execution._id.toString(),
        SERVER_EVENTS.EXECUTION_PAUSED,
        expect.objectContaining({ executionId: execution._id.toString() }),
      );
      expect(mockEmitToUser).toHaveBeenCalledWith(
        execution.userId.toString(),
        SERVER_EVENTS.EXECUTION_PAUSED,
        expect.objectContaining({ executionId: execution._id.toString() }),
      );
    });

    it('should throw if execution not in running state', async () => {
      const execution = buildExecution({ status: 'completed' });
      mockFindById.mockResolvedValue(execution);

      await expect(engine.pause(execution._id.toString())).rejects.toThrow(
        'Cannot pause execution in "completed" state',
      );

      // Queue was not paused
      expect(queueManager.pauseQueue).not.toHaveBeenCalled();
    });
  });

  // ── resume ─────────────────────────────────────────────────────────

  describe('resume', () => {
    it('should resume all queues and update status', async () => {
      const execution = buildExecution({ status: 'paused' });
      mockFindById.mockResolvedValue(execution);
      mockUpdateStatus.mockResolvedValue(execution);

      await engine.resume(execution._id.toString());

      // Status set to running
      expect(mockUpdateStatus).toHaveBeenCalledWith(
        execution._id.toString(),
        'running',
      );

      // Each queue was resumed
      const queueNames = Object.values(QUEUES);
      for (const queueName of queueNames) {
        expect(queueManager.resumeQueue).toHaveBeenCalledWith(queueName);
      }

      // Socket events emitted (uses EXECUTION_STARTED on resume)
      expect(mockEmitToExecution).toHaveBeenCalledWith(
        execution._id.toString(),
        SERVER_EVENTS.EXECUTION_STARTED,
        expect.objectContaining({ executionId: execution._id.toString() }),
      );
      expect(mockEmitToUser).toHaveBeenCalledWith(
        execution.userId.toString(),
        SERVER_EVENTS.EXECUTION_STARTED,
        expect.objectContaining({ executionId: execution._id.toString() }),
      );
    });

    it('should throw if execution not paused', async () => {
      const execution = buildExecution({ status: 'running' });
      mockFindById.mockResolvedValue(execution);

      await expect(engine.resume(execution._id.toString())).rejects.toThrow(
        'Cannot resume execution in "running" state',
      );

      expect(queueManager.resumeQueue).not.toHaveBeenCalled();
    });
  });

  // ── cancel ─────────────────────────────────────────────────────────

  describe('cancel', () => {
    it('should remove pending jobs and mark nodes as skipped', async () => {
      const executionId = objectId().toString();

      const nodeStates = new Map<string, INodeExecutionState>();
      nodeStates.set('n1', { nodeId: 'n1', status: 'completed', attempts: 1 });
      nodeStates.set('n2', { nodeId: 'n2', status: 'queued', attempts: 0 });
      nodeStates.set('n3', { nodeId: 'n3', status: 'pending', attempts: 0 });

      const execution = buildExecution({
        _id: new Types.ObjectId(executionId),
        status: 'running',
        nodeStates,
      });

      mockFindById.mockResolvedValue(execution);
      mockUpdateNodeStatus.mockResolvedValue(execution);
      mockUpdateStatus.mockResolvedValue(execution);

      // Simulate a waiting job that belongs to this execution
      const mockJobForExecution = {
        data: { executionId },
        remove: vi.fn(),
      };
      const mockJobOther = {
        data: { executionId: 'other-id' },
        remove: vi.fn(),
      };
      queueManager.mockGetJobs.mockResolvedValue([
        mockJobForExecution,
        mockJobOther,
      ]);

      await engine.cancel(executionId);

      // Jobs belonging to this execution were removed
      expect(mockJobForExecution.remove).toHaveBeenCalled();
      // Jobs belonging to other executions were NOT removed
      expect(mockJobOther.remove).not.toHaveBeenCalled();

      // Queued/pending nodes marked as skipped; completed node left alone
      expect(mockUpdateNodeStatus).toHaveBeenCalledWith(
        executionId,
        'n2',
        'skipped',
      );
      expect(mockUpdateNodeStatus).toHaveBeenCalledWith(
        executionId,
        'n3',
        'skipped',
      );
      // n1 was completed, so should NOT be called for it
      const skippedCalls = (mockUpdateNodeStatus as Mock).mock.calls.filter(
        (call: unknown[]) => call[2] === 'skipped',
      );
      expect(skippedCalls.every((c: unknown[]) => c[1] !== 'n1')).toBe(true);

      // Execution status updated to cancelled
      expect(mockUpdateStatus).toHaveBeenCalledWith(executionId, 'cancelled');

      // Socket events emitted
      expect(mockEmitToExecution).toHaveBeenCalledWith(
        executionId,
        SERVER_EVENTS.EXECUTION_CANCELLED,
        expect.objectContaining({ executionId }),
      );
    });

    it('should throw if execution already completed', async () => {
      const execution = buildExecution({ status: 'completed' });
      mockFindById.mockResolvedValue(execution);

      await expect(engine.cancel(execution._id.toString())).rejects.toThrow(
        'Cannot cancel execution in "completed" state',
      );
    });
  });

  // ── retry ──────────────────────────────────────────────────────────

  describe('retry', () => {
    it('should create new execution from snapshot and start it', async () => {
      const failedExecution = buildExecution({ status: 'failed' });
      mockFindById.mockResolvedValue(failedExecution);

      const newExecutionId = objectId();
      const newExecution = buildExecution({
        _id: newExecutionId,
        status: 'pending',
      });
      mockCreate.mockResolvedValue(newExecution);

      // The start() flow needs to succeed for the new execution
      mockValidate.mockReturnValue({ isValid: true, errors: [] });
      mockUpdateStatus.mockResolvedValue(newExecution);
      mockUpdateNodeStatus.mockResolvedValue(newExecution);
      mockCreateInitialFlow.mockResolvedValue(undefined);

      // Override findById to return the new execution on the second call
      mockFindById
        .mockResolvedValueOnce(failedExecution) // retry() fetches original
        .mockResolvedValue(newExecution); // start() fetches new

      const resultId = await engine.retry(failedExecution._id.toString());

      expect(resultId).toBe(newExecutionId.toString());

      // New execution was created from the failed execution's snapshot
      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          _id: failedExecution.workflowId,
          projectId: failedExecution.projectId,
          userId: failedExecution.userId,
          nodes: failedExecution.workflowSnapshot.nodes,
          edges: failedExecution.workflowSnapshot.edges,
        }),
        failedExecution.userId.toString(),
      );
    });

    it('should throw if execution not failed', async () => {
      const execution = buildExecution({ status: 'running' });
      mockFindById.mockResolvedValue(execution);

      await expect(engine.retry(execution._id.toString())).rejects.toThrow(
        'Cannot retry execution in "running" state',
      );

      expect(mockCreate).not.toHaveBeenCalled();
    });
  });

  // ── overrideNode ───────────────────────────────────────────────────

  describe('overrideNode', () => {
    it('should set output, mark completed, and resume execution', async () => {
      const nodeStates = new Map<string, INodeExecutionState>();
      nodeStates.set('n1', { nodeId: 'n1', status: 'completed', attempts: 1 });
      nodeStates.set('n2', { nodeId: 'n2', status: 'failed', attempts: 2 });

      const execution = buildExecution({
        status: 'failed',
        nodeStates,
        progress: { totalNodes: 2, completedNodes: 1, percentage: 50 },
      });

      mockFindById.mockResolvedValue(execution);
      mockSetNodeOutput.mockResolvedValue(execution);
      mockUpdateNodeStatus.mockResolvedValue(execution);
      mockUpdateProgress.mockResolvedValue(execution);
      mockUpdateStatus.mockResolvedValue(execution);

      await engine.overrideNode(
        execution._id.toString(),
        'n2',
        'https://cdn.example.com/override.png',
      );

      // Output set with override marker
      expect(mockSetNodeOutput).toHaveBeenCalledWith(
        execution._id.toString(),
        'n2',
        { overridden: true, assetUrl: 'https://cdn.example.com/override.png' },
      );

      // Node marked as completed
      expect(mockUpdateNodeStatus).toHaveBeenCalledWith(
        execution._id.toString(),
        'n2',
        'completed',
      );

      // Progress incremented
      expect(mockUpdateProgress).toHaveBeenCalledWith(
        execution._id.toString(),
        2, // completedNodes + 1
        2, // totalNodes
        'n2',
      );

      // Execution resumed to running
      expect(mockUpdateStatus).toHaveBeenCalledWith(
        execution._id.toString(),
        'running',
      );

      // Socket events for node completion emitted
      expect(mockEmitToExecution).toHaveBeenCalledWith(
        execution._id.toString(),
        SERVER_EVENTS.NODE_COMPLETED,
        expect.objectContaining({
          nodeId: 'n2',
          overridden: true,
          assetUrl: 'https://cdn.example.com/override.png',
        }),
      );

      // Execution resumed event emitted
      expect(mockEmitToExecution).toHaveBeenCalledWith(
        execution._id.toString(),
        SERVER_EVENTS.EXECUTION_STARTED,
        expect.objectContaining({ executionId: execution._id.toString() }),
      );
    });

    it('should throw if execution not failed/paused', async () => {
      const execution = buildExecution({ status: 'running' });
      mockFindById.mockResolvedValue(execution);

      await expect(
        engine.overrideNode(execution._id.toString(), 'n1', 'https://example.com/asset.png'),
      ).rejects.toThrow('Cannot override node in "running" execution');
    });

    it('should throw if node not in failed state', async () => {
      const nodeStates = new Map<string, INodeExecutionState>();
      nodeStates.set('n1', { nodeId: 'n1', status: 'completed', attempts: 1 });

      const execution = buildExecution({ status: 'failed', nodeStates });
      mockFindById.mockResolvedValue(execution);

      await expect(
        engine.overrideNode(execution._id.toString(), 'n1', 'https://example.com/asset.png'),
      ).rejects.toThrow('Cannot override node in "completed" state');
    });

    it('should re-queue downstream nodes', async () => {
      // Build a pipeline: n1 -> n2 -> n3
      const nodes: IWorkflowNode[] = [
        createNode('n1', 'script-input'),
        createNode('n2', 'image-generator'),
        createNode('n3', 'output'),
      ];
      const edges: IWorkflowEdge[] = [
        createEdge('e1', 'n1', 'script', 'n2', 'text'),
        createEdge('e2', 'n2', 'images', 'n3', 'video'),
      ];

      const nodeStates = new Map<string, INodeExecutionState>();
      nodeStates.set('n1', { nodeId: 'n1', status: 'completed', attempts: 1 });
      nodeStates.set('n2', { nodeId: 'n2', status: 'failed', attempts: 2 });
      nodeStates.set('n3', { nodeId: 'n3', status: 'pending', attempts: 0 });

      const execution = buildExecution({
        status: 'failed',
        nodeStates,
        workflowSnapshot: { nodes, edges },
        progress: { totalNodes: 3, completedNodes: 1, percentage: 33 },
      });

      mockFindById.mockResolvedValue(execution);
      mockSetNodeOutput.mockResolvedValue(execution);
      mockUpdateNodeStatus.mockResolvedValue(execution);
      mockUpdateProgress.mockResolvedValue(execution);
      mockUpdateStatus.mockResolvedValue(execution);

      await engine.overrideNode(
        execution._id.toString(),
        'n2',
        'https://cdn.example.com/override.png',
      );

      // Downstream node n3 was marked as queued
      expect(mockUpdateNodeStatus).toHaveBeenCalledWith(
        execution._id.toString(),
        'n3',
        'queued',
      );

      // Job added to appropriate queue for n3
      const outputQueue = NODE_TYPE_TO_QUEUE['output'];
      expect(queueManager.getQueue).toHaveBeenCalledWith(outputQueue);
      expect(queueManager.mockQueue.add).toHaveBeenCalledWith(
        'output:n3',
        expect.objectContaining({
          executionId: execution._id.toString(),
          nodeId: 'n3',
          nodeType: 'output',
        }),
        expect.objectContaining({
          jobId: expect.stringContaining(`${execution._id.toString()}:n3:resume-`),
        }),
      );

      // Socket event for downstream node queued
      expect(mockEmitToExecution).toHaveBeenCalledWith(
        execution._id.toString(),
        SERVER_EVENTS.NODE_QUEUED,
        expect.objectContaining({ nodeId: 'n3' }),
      );
    });
  });

  // ── retryNode ──────────────────────────────────────────────────────

  describe('retryNode', () => {
    it('should reset node state and re-queue single job', async () => {
      const nodes: IWorkflowNode[] = [
        createNode('n1', 'script-input'),
        createNode('n2', 'image-generator'),
      ];
      const edges: IWorkflowEdge[] = [
        createEdge('e1', 'n1', 'script', 'n2', 'text'),
      ];

      const nodeStates = new Map<string, INodeExecutionState>();
      nodeStates.set('n1', { nodeId: 'n1', status: 'completed', attempts: 1 });
      nodeStates.set('n2', { nodeId: 'n2', status: 'failed', attempts: 2 });

      const execution = buildExecution({
        status: 'failed',
        nodeStates,
        workflowSnapshot: { nodes, edges },
      });

      mockFindById.mockResolvedValue(execution);
      mockUpdateNodeState.mockResolvedValue(execution);
      mockUpdateStatus.mockResolvedValue(execution);

      await engine.retryNode(execution._id.toString(), 'n2');

      // Node state reset to pending with incremented attempts
      expect(mockUpdateNodeState).toHaveBeenCalledWith(
        execution._id.toString(),
        'n2',
        {
          status: 'pending',
          attempts: 3, // original attempts (2) + 1
          error: undefined,
          completedAt: undefined,
        },
      );

      // Job added to the correct queue for image-generator
      const expectedQueue = NODE_TYPE_TO_QUEUE['image-generator'];
      expect(queueManager.getQueue).toHaveBeenCalledWith(expectedQueue);
      expect(queueManager.mockQueue.add).toHaveBeenCalledWith(
        'image-generator:n2',
        expect.objectContaining({
          executionId: execution._id.toString(),
          nodeId: 'n2',
          nodeType: 'image-generator',
          workflowId: execution.workflowId.toString(),
          projectId: execution.projectId.toString(),
          userId: execution.userId.toString(),
        }),
        { jobId: `${execution._id.toString()}:n2:retry-3` },
      );

      // Socket event emitted for node retrying
      expect(mockEmitToExecution).toHaveBeenCalledWith(
        execution._id.toString(),
        SERVER_EVENTS.NODE_RETRYING,
        expect.objectContaining({
          nodeId: 'n2',
          attempt: 3,
        }),
      );
    });

    it('should throw if execution not failed/paused', async () => {
      const execution = buildExecution({ status: 'running' });
      mockFindById.mockResolvedValue(execution);

      await expect(
        engine.retryNode(execution._id.toString(), 'n1'),
      ).rejects.toThrow('Cannot retry node in "running" execution');
    });

    it('should throw if node not in failed state', async () => {
      const nodeStates = new Map<string, INodeExecutionState>();
      nodeStates.set('n1', { nodeId: 'n1', status: 'completed', attempts: 1 });

      const execution = buildExecution({ status: 'failed', nodeStates });
      mockFindById.mockResolvedValue(execution);

      await expect(
        engine.retryNode(execution._id.toString(), 'n1'),
      ).rejects.toThrow('Cannot retry node in "completed" state');
    });

    it('should throw if node already completed (400)', async () => {
      const nodeStates = new Map<string, INodeExecutionState>();
      nodeStates.set('n1', { nodeId: 'n1', status: 'completed', attempts: 1 });

      const execution = buildExecution({ status: 'paused', nodeStates });
      mockFindById.mockResolvedValue(execution);

      try {
        await engine.retryNode(execution._id.toString(), 'n1');
        expect.fail('Expected to throw');
      } catch (error: unknown) {
        const appError = error as { statusCode?: number; message: string };
        expect(appError.message).toContain('Cannot retry node');
        expect(appError.statusCode).toBe(400);
      }
    });

    it('should transition execution from failed to running', async () => {
      const nodes: IWorkflowNode[] = [
        createNode('n1', 'script-input'),
      ];

      const nodeStates = new Map<string, INodeExecutionState>();
      nodeStates.set('n1', { nodeId: 'n1', status: 'failed', attempts: 1 });

      const execution = buildExecution({
        status: 'failed',
        nodeStates,
        workflowSnapshot: { nodes, edges: [] },
      });

      mockFindById.mockResolvedValue(execution);
      mockUpdateNodeState.mockResolvedValue(execution);
      mockUpdateStatus.mockResolvedValue(execution);

      await engine.retryNode(execution._id.toString(), 'n1');

      // Execution status should transition to running because it was failed
      expect(mockUpdateStatus).toHaveBeenCalledWith(
        execution._id.toString(),
        'running',
      );

      // Execution resumed event should also be emitted when transitioning from failed
      expect(mockEmitToExecution).toHaveBeenCalledWith(
        execution._id.toString(),
        SERVER_EVENTS.EXECUTION_STARTED,
        expect.objectContaining({ executionId: execution._id.toString() }),
      );
    });

    it('should NOT transition execution to running if already paused', async () => {
      const nodes: IWorkflowNode[] = [
        createNode('n1', 'script-input'),
      ];

      const nodeStates = new Map<string, INodeExecutionState>();
      nodeStates.set('n1', { nodeId: 'n1', status: 'failed', attempts: 1 });

      const execution = buildExecution({
        status: 'paused',
        nodeStates,
        workflowSnapshot: { nodes, edges: [] },
      });

      mockFindById.mockResolvedValue(execution);
      mockUpdateNodeState.mockResolvedValue(execution);

      await engine.retryNode(execution._id.toString(), 'n1');

      // Should not update to running because it was paused (only failed -> running)
      expect(mockUpdateStatus).not.toHaveBeenCalled();
    });
  });
});

import type { FastifyRequest, FastifyReply } from 'fastify';

import { UnauthorizedError, ValidationError } from '../../common/errors/index.js';
import type { AssetService } from './asset.service.js';
import { listAssetsSchema } from './asset.schema.js';

export class AssetController {
  constructor(private readonly assetService: AssetService) {}

  async upload(
    request: FastifyRequest<{ Params: { projectId: string } }>,
    reply: FastifyReply,
  ): Promise<void> {
    if (!request.user) {
      throw new UnauthorizedError('Authentication required');
    }

    const parts = request.parts();
    const assets = [];

    for await (const part of parts) {
      if (part.type === 'file') {
        const buffer = await part.toBuffer();

        if (buffer.length === 0) {
          throw new ValidationError('Empty file uploaded');
        }

        const asset = await this.assetService.upload(
          request.params.projectId,
          request.user.userId,
          buffer,
          part.filename,
          part.mimetype,
        );
        assets.push(asset);
      }
    }

    if (assets.length === 0) {
      throw new ValidationError('No files uploaded');
    }

    const statusCode = assets.length === 1 ? 201 : 200;
    reply.status(statusCode).send({ data: assets.length === 1 ? assets[0] : assets });
  }

  async listByProject(
    request: FastifyRequest<{ Params: { projectId: string } }>,
    reply: FastifyReply,
  ): Promise<void> {
    if (!request.user) {
      throw new UnauthorizedError('Authentication required');
    }

    const parsed = listAssetsSchema.safeParse(request.query);
    if (!parsed.success) {
      throw new ValidationError('Invalid query parameters', {
        fields: parsed.error.flatten().fieldErrors,
      });
    }

    const result = await this.assetService.listByProject(
      request.params.projectId,
      request.user.userId,
      parsed.data,
    );

    reply.status(200).send(result);
  }

  async getById(
    request: FastifyRequest<{ Params: { assetId: string } }>,
    reply: FastifyReply,
  ): Promise<void> {
    if (!request.user) {
      throw new UnauthorizedError('Authentication required');
    }

    const asset = await this.assetService.getById(
      request.params.assetId,
      request.user.userId,
    );

    reply.status(200).send({ data: asset });
  }

  async download(
    request: FastifyRequest<{ Params: { assetId: string } }>,
    reply: FastifyReply,
  ): Promise<void> {
    if (!request.user) {
      throw new UnauthorizedError('Authentication required');
    }

    const { buffer, asset } = await this.assetService.download(
      request.params.assetId,
      request.user.userId,
    );

    reply
      .header('Content-Type', asset.mimeType)
      .header('Content-Disposition', `attachment; filename="${asset.originalName}"`)
      .header('Content-Length', buffer.length)
      .send(buffer);
  }

  async deleteAsset(
    request: FastifyRequest<{ Params: { assetId: string } }>,
    reply: FastifyReply,
  ): Promise<void> {
    if (!request.user) {
      throw new UnauthorizedError('Authentication required');
    }

    await this.assetService.deleteAsset(
      request.params.assetId,
      request.user.userId,
    );

    reply.status(200).send({ message: 'Asset deleted successfully' });
  }
}

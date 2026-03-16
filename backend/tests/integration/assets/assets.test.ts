import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import mongoose from 'mongoose';

import { buildTestApp } from '../../helpers/app.helper.js';
import { createUser, createProject, createAsset } from '../../helpers/db.helper.js';
import { generateAccessToken, authHeader } from '../../helpers/auth.helper.js';

describe('Assets API', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  // ── GET /api/v1/projects/:projectId/assets ──

  describe('GET /api/v1/projects/:projectId/assets', () => {
    it('should list assets in a project', async () => {
      const user = await createUser();
      const token = generateAccessToken({ userId: user.id, email: user.email });
      const project = await createProject(user.id);

      await createAsset(project.id, user.id, { filename: 'asset-1.png', originalName: 'asset-1.png' });
      await createAsset(project.id, user.id, { filename: 'asset-2.png', originalName: 'asset-2.png' });
      await createAsset(project.id, user.id, { filename: 'asset-3.png', originalName: 'asset-3.png' });

      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/projects/${project.id}/assets`,
        headers: authHeader(token),
      });

      expect(response.statusCode).toBe(200);

      const body = response.json();
      expect(body).toHaveProperty('data');
      expect(body).toHaveProperty('pagination');
      expect(body.data).toHaveLength(3);
      expect(body.pagination.total).toBe(3);
    });

    it('should list assets with pagination', async () => {
      const user = await createUser();
      const token = generateAccessToken({ userId: user.id, email: user.email });
      const project = await createProject(user.id);

      await createAsset(project.id, user.id, { filename: 'page-1.png', originalName: 'page-1.png' });
      await createAsset(project.id, user.id, { filename: 'page-2.png', originalName: 'page-2.png' });
      await createAsset(project.id, user.id, { filename: 'page-3.png', originalName: 'page-3.png' });
      await createAsset(project.id, user.id, { filename: 'page-4.png', originalName: 'page-4.png' });
      await createAsset(project.id, user.id, { filename: 'page-5.png', originalName: 'page-5.png' });

      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/projects/${project.id}/assets?page=1&limit=2`,
        headers: authHeader(token),
      });

      expect(response.statusCode).toBe(200);

      const body = response.json();
      expect(body.data).toHaveLength(2);
      expect(body.pagination.total).toBe(5);
      expect(body.pagination.page).toBe(1);
      expect(body.pagination.limit).toBe(2);
      expect(body.pagination.totalPages).toBe(3);

      // Verify second page
      const page2Response = await app.inject({
        method: 'GET',
        url: `/api/v1/projects/${project.id}/assets?page=2&limit=2`,
        headers: authHeader(token),
      });

      const page2Body = page2Response.json();
      expect(page2Body.data).toHaveLength(2);
      expect(page2Body.pagination.page).toBe(2);
    });

    it('should filter assets by type', async () => {
      const user = await createUser();
      const token = generateAccessToken({ userId: user.id, email: user.email });
      const project = await createProject(user.id);

      await createAsset(project.id, user.id, {
        type: 'image',
        filename: 'photo.png',
        originalName: 'photo.png',
        mimeType: 'image/png',
      });
      await createAsset(project.id, user.id, {
        type: 'video',
        filename: 'clip.mp4',
        originalName: 'clip.mp4',
        mimeType: 'video/mp4',
      });
      await createAsset(project.id, user.id, {
        type: 'image',
        filename: 'another-photo.png',
        originalName: 'another-photo.png',
        mimeType: 'image/png',
      });

      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/projects/${project.id}/assets?type=image`,
        headers: authHeader(token),
      });

      expect(response.statusCode).toBe(200);

      const body = response.json();
      expect(body.data).toHaveLength(2);
      expect(body.data.every((asset: Record<string, unknown>) => asset.type === 'image')).toBe(true);
      expect(body.pagination.total).toBe(2);
    });

    it('should return empty list when no assets exist', async () => {
      const user = await createUser();
      const token = generateAccessToken({ userId: user.id, email: user.email });
      const project = await createProject(user.id);

      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/projects/${project.id}/assets`,
        headers: authHeader(token),
      });

      expect(response.statusCode).toBe(200);

      const body = response.json();
      expect(body.data).toHaveLength(0);
      expect(body.pagination.total).toBe(0);
    });

    it('should reject without auth', async () => {
      const user = await createUser();
      const project = await createProject(user.id);

      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/projects/${project.id}/assets`,
      });

      expect(response.statusCode).toBe(401);

      const body = response.json();
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('UNAUTHORIZED');
    });

    it('should reject for other user\'s project', async () => {
      const ownerUser = await createUser({ email: 'asset-owner@test.com' });
      const otherUser = await createUser({ email: 'asset-other@test.com' });
      const project = await createProject(ownerUser.id);

      await createAsset(project.id, ownerUser.id);

      const otherToken = generateAccessToken({ userId: otherUser.id, email: otherUser.email });

      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/projects/${project.id}/assets`,
        headers: authHeader(otherToken),
      });

      expect(response.statusCode).toBe(403);

      const body = response.json();
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('FORBIDDEN');
    });

    it('should return 404 for non-existent project', async () => {
      const user = await createUser();
      const token = generateAccessToken({ userId: user.id, email: user.email });
      const fakeProjectId = new mongoose.Types.ObjectId().toString();

      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/projects/${fakeProjectId}/assets`,
        headers: authHeader(token),
      });

      expect(response.statusCode).toBe(404);

      const body = response.json();
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('NOT_FOUND');
    });
  });

  // ── GET /api/v1/assets/:assetId ──

  describe('GET /api/v1/assets/:assetId', () => {
    it('should return an asset by id', async () => {
      const user = await createUser();
      const token = generateAccessToken({ userId: user.id, email: user.email });
      const project = await createProject(user.id);
      const asset = await createAsset(project.id, user.id, {
        filename: 'specific-asset.png',
        originalName: 'specific-asset.png',
        type: 'image',
        mimeType: 'image/png',
        size: 2048,
      });

      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/assets/${asset.id}`,
        headers: authHeader(token),
      });

      expect(response.statusCode).toBe(200);

      const body = response.json();
      expect(body).toHaveProperty('data');
      expect(body.data._id).toBe(asset.id);
      expect(body.data.filename).toBe('specific-asset.png');
      expect(body.data.originalName).toBe('specific-asset.png');
      expect(body.data.type).toBe('image');
      expect(body.data.mimeType).toBe('image/png');
      expect(body.data.size).toBe(2048);
      expect(body.data.projectId.toString()).toBe(project.id);
      expect(body.data.userId.toString()).toBe(user.id);
      expect(body.data).toHaveProperty('createdAt');
      expect(body.data).toHaveProperty('updatedAt');
    });

    it('should return 404 for non-existent asset', async () => {
      const user = await createUser();
      const token = generateAccessToken({ userId: user.id, email: user.email });
      const fakeAssetId = new mongoose.Types.ObjectId().toString();

      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/assets/${fakeAssetId}`,
        headers: authHeader(token),
      });

      expect(response.statusCode).toBe(404);

      const body = response.json();
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('NOT_FOUND');
    });

    it('should return 403 for other user\'s asset', async () => {
      const ownerUser = await createUser({ email: 'getasset-owner@test.com' });
      const otherUser = await createUser({ email: 'getasset-other@test.com' });
      const project = await createProject(ownerUser.id);
      const asset = await createAsset(project.id, ownerUser.id);

      const otherToken = generateAccessToken({ userId: otherUser.id, email: otherUser.email });

      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/assets/${asset.id}`,
        headers: authHeader(otherToken),
      });

      expect(response.statusCode).toBe(403);

      const body = response.json();
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('FORBIDDEN');
    });

    it('should reject without auth', async () => {
      const user = await createUser();
      const project = await createProject(user.id);
      const asset = await createAsset(project.id, user.id);

      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/assets/${asset.id}`,
      });

      expect(response.statusCode).toBe(401);

      const body = response.json();
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('UNAUTHORIZED');
    });
  });

  // ── DELETE /api/v1/assets/:assetId ──

  describe('DELETE /api/v1/assets/:assetId', () => {
    it('should delete an asset', async () => {
      const user = await createUser();
      const token = generateAccessToken({ userId: user.id, email: user.email });
      const project = await createProject(user.id);
      const asset = await createAsset(project.id, user.id);

      const response = await app.inject({
        method: 'DELETE',
        url: `/api/v1/assets/${asset.id}`,
        headers: authHeader(token),
      });

      expect(response.statusCode).toBe(200);

      const body = response.json();
      expect(body.message).toBe('Asset deleted successfully');

      // Verify the asset is no longer retrievable
      const getResponse = await app.inject({
        method: 'GET',
        url: `/api/v1/assets/${asset.id}`,
        headers: authHeader(token),
      });

      expect(getResponse.statusCode).toBe(404);
    });

    it('should return 404 for non-existent asset', async () => {
      const user = await createUser();
      const token = generateAccessToken({ userId: user.id, email: user.email });
      const fakeAssetId = new mongoose.Types.ObjectId().toString();

      const response = await app.inject({
        method: 'DELETE',
        url: `/api/v1/assets/${fakeAssetId}`,
        headers: authHeader(token),
      });

      expect(response.statusCode).toBe(404);

      const body = response.json();
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('NOT_FOUND');
    });

    it('should return 403 for other user\'s asset', async () => {
      const ownerUser = await createUser({ email: 'delasset-owner@test.com' });
      const otherUser = await createUser({ email: 'delasset-other@test.com' });
      const project = await createProject(ownerUser.id);
      const asset = await createAsset(project.id, ownerUser.id);

      const otherToken = generateAccessToken({ userId: otherUser.id, email: otherUser.email });

      const response = await app.inject({
        method: 'DELETE',
        url: `/api/v1/assets/${asset.id}`,
        headers: authHeader(otherToken),
      });

      expect(response.statusCode).toBe(403);

      const body = response.json();
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('FORBIDDEN');
    });

    it('should reject without auth', async () => {
      const user = await createUser();
      const project = await createProject(user.id);
      const asset = await createAsset(project.id, user.id);

      const response = await app.inject({
        method: 'DELETE',
        url: `/api/v1/assets/${asset.id}`,
      });

      expect(response.statusCode).toBe(401);

      const body = response.json();
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('UNAUTHORIZED');
    });
  });
});

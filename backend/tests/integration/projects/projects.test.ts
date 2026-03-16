import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import mongoose from 'mongoose';

import { buildTestApp } from '../../helpers/app.helper.js';
import { createUser, createProject } from '../../helpers/db.helper.js';
import { generateAccessToken, createTestUser, authHeader } from '../../helpers/auth.helper.js';

describe('Projects API', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  // ── POST /api/v1/projects ──

  describe('POST /api/v1/projects', () => {
    it('should create a project', async () => {
      const user = await createUser();
      const token = generateAccessToken({ userId: user.id, email: user.email });

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/projects',
        headers: authHeader(token),
        payload: {
          name: 'My New Project',
          description: 'A project description',
        },
      });

      expect(response.statusCode).toBe(201);

      const body = response.json();
      expect(body).toHaveProperty('data');
      expect(body.data.name).toBe('My New Project');
      expect(body.data.description).toBe('A project description');
      expect(body.data.status).toBe('draft');
      expect(body.data.userId.toString()).toBe(user.id);
      expect(body.data).toHaveProperty('_id');
      expect(body.data).toHaveProperty('createdAt');
      expect(body.data).toHaveProperty('updatedAt');
    });

    it('should create a project with settings', async () => {
      const user = await createUser();
      const token = generateAccessToken({ userId: user.id, email: user.email });

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/projects',
        headers: authHeader(token),
        payload: {
          name: 'Project With Settings',
          settings: {
            outputResolution: '1280x720',
            outputFormat: 'webm',
            frameRate: 60,
          },
        },
      });

      expect(response.statusCode).toBe(201);

      const body = response.json();
      expect(body.data.settings.outputResolution).toBe('1280x720');
      expect(body.data.settings.outputFormat).toBe('webm');
      expect(body.data.settings.frameRate).toBe(60);
    });

    it('should reject without auth', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/projects',
        payload: { name: 'Unauthorized Project' },
      });

      expect(response.statusCode).toBe(401);

      const body = response.json();
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('UNAUTHORIZED');
    });

    it('should reject with missing name', async () => {
      const user = await createUser();
      const token = generateAccessToken({ userId: user.id, email: user.email });

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/projects',
        headers: authHeader(token),
        payload: { description: 'No name provided' },
      });

      expect(response.statusCode).toBe(400);

      const body = response.json();
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should reject with empty name', async () => {
      const user = await createUser();
      const token = generateAccessToken({ userId: user.id, email: user.email });

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/projects',
        headers: authHeader(token),
        payload: { name: '' },
      });

      expect(response.statusCode).toBe(400);

      const body = response.json();
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should reject with name exceeding max length', async () => {
      const user = await createUser();
      const token = generateAccessToken({ userId: user.id, email: user.email });

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/projects',
        headers: authHeader(token),
        payload: { name: 'x'.repeat(201) },
      });

      expect(response.statusCode).toBe(400);

      const body = response.json();
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  // ── GET /api/v1/projects ──

  describe('GET /api/v1/projects', () => {
    it('should list user projects with pagination', async () => {
      const user = await createUser();
      const token = generateAccessToken({ userId: user.id, email: user.email });

      // Create multiple projects
      await createProject(user.id, { name: 'Project A' });
      await createProject(user.id, { name: 'Project B' });
      await createProject(user.id, { name: 'Project C' });

      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/projects?page=1&limit=2',
        headers: authHeader(token),
      });

      expect(response.statusCode).toBe(200);

      const body = response.json();
      expect(body).toHaveProperty('data');
      expect(body).toHaveProperty('pagination');
      expect(body.data).toHaveLength(2);
      expect(body.pagination.total).toBe(3);
      expect(body.pagination.page).toBe(1);
      expect(body.pagination.limit).toBe(2);
      expect(body.pagination.totalPages).toBe(2);
    });

    it('should not return other users projects', async () => {
      const userA = await createUser({ email: 'user-a@test.com' });
      const userB = await createUser({ email: 'user-b@test.com' });

      await createProject(userA.id, { name: 'User A Project' });
      await createProject(userB.id, { name: 'User B Project' });

      const tokenA = generateAccessToken({ userId: userA.id, email: userA.email });

      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/projects',
        headers: authHeader(tokenA),
      });

      expect(response.statusCode).toBe(200);

      const body = response.json();
      expect(body.data).toHaveLength(1);
      expect(body.data[0].name).toBe('User A Project');
    });

    it('should filter projects by status', async () => {
      const user = await createUser();
      const token = generateAccessToken({ userId: user.id, email: user.email });

      await createProject(user.id, { name: 'Draft Project', status: 'draft' });
      await createProject(user.id, { name: 'Active Project', status: 'active' });
      await createProject(user.id, { name: 'Archived Project', status: 'archived' });

      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/projects?status=active',
        headers: authHeader(token),
      });

      expect(response.statusCode).toBe(200);

      const body = response.json();
      expect(body.data).toHaveLength(1);
      expect(body.data[0].name).toBe('Active Project');
    });

    it('should exclude archived projects by default', async () => {
      const user = await createUser();
      const token = generateAccessToken({ userId: user.id, email: user.email });

      await createProject(user.id, { name: 'Active Project', status: 'draft' });
      await createProject(user.id, { name: 'Archived Project', status: 'archived' });

      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/projects',
        headers: authHeader(token),
      });

      expect(response.statusCode).toBe(200);

      const body = response.json();
      expect(body.data).toHaveLength(1);
      expect(body.data[0].name).toBe('Active Project');
    });

    it('should return empty list when user has no projects', async () => {
      const user = await createUser();
      const token = generateAccessToken({ userId: user.id, email: user.email });

      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/projects',
        headers: authHeader(token),
      });

      expect(response.statusCode).toBe(200);

      const body = response.json();
      expect(body.data).toHaveLength(0);
      expect(body.pagination.total).toBe(0);
    });
  });

  // ── GET /api/v1/projects/:projectId ──

  describe('GET /api/v1/projects/:projectId', () => {
    it('should return a project by id', async () => {
      const user = await createUser();
      const token = generateAccessToken({ userId: user.id, email: user.email });
      const project = await createProject(user.id, { name: 'Specific Project' });

      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/projects/${project.id}`,
        headers: authHeader(token),
      });

      expect(response.statusCode).toBe(200);

      const body = response.json();
      expect(body).toHaveProperty('data');
      expect(body.data.name).toBe('Specific Project');
      expect(body.data._id).toBe(project.id);
    });

    it('should return 404 for non-existent project', async () => {
      const user = await createUser();
      const token = generateAccessToken({ userId: user.id, email: user.email });
      const fakeId = new mongoose.Types.ObjectId().toString();

      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/projects/${fakeId}`,
        headers: authHeader(token),
      });

      expect(response.statusCode).toBe(404);

      const body = response.json();
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('NOT_FOUND');
    });

    it('should return 403 for other users project', async () => {
      const ownerUser = await createUser({ email: 'owner@test.com' });
      const otherUser = await createUser({ email: 'other@test.com' });
      const project = await createProject(ownerUser.id, { name: 'Owner Project' });

      const otherToken = generateAccessToken({ userId: otherUser.id, email: otherUser.email });

      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/projects/${project.id}`,
        headers: authHeader(otherToken),
      });

      expect(response.statusCode).toBe(403);

      const body = response.json();
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('FORBIDDEN');
    });
  });

  // ── PATCH /api/v1/projects/:projectId ──

  describe('PATCH /api/v1/projects/:projectId', () => {
    it('should update project name', async () => {
      const user = await createUser();
      const token = generateAccessToken({ userId: user.id, email: user.email });
      const project = await createProject(user.id, { name: 'Original Name' });

      const response = await app.inject({
        method: 'PATCH',
        url: `/api/v1/projects/${project.id}`,
        headers: authHeader(token),
        payload: { name: 'Updated Name' },
      });

      expect(response.statusCode).toBe(200);

      const body = response.json();
      expect(body.data.name).toBe('Updated Name');
      expect(body.data._id).toBe(project.id);
    });

    it('should update project description', async () => {
      const user = await createUser();
      const token = generateAccessToken({ userId: user.id, email: user.email });
      const project = await createProject(user.id);

      const response = await app.inject({
        method: 'PATCH',
        url: `/api/v1/projects/${project.id}`,
        headers: authHeader(token),
        payload: { description: 'Updated description text' },
      });

      expect(response.statusCode).toBe(200);

      const body = response.json();
      expect(body.data.description).toBe('Updated description text');
    });

    it('should update project settings partially', async () => {
      const user = await createUser();
      const token = generateAccessToken({ userId: user.id, email: user.email });
      const project = await createProject(user.id);

      const response = await app.inject({
        method: 'PATCH',
        url: `/api/v1/projects/${project.id}`,
        headers: authHeader(token),
        payload: {
          settings: { frameRate: 60 },
        },
      });

      expect(response.statusCode).toBe(200);

      const body = response.json();
      expect(body.data.settings.frameRate).toBe(60);
    });

    it('should update project status', async () => {
      const user = await createUser();
      const token = generateAccessToken({ userId: user.id, email: user.email });
      const project = await createProject(user.id, { status: 'draft' });

      const response = await app.inject({
        method: 'PATCH',
        url: `/api/v1/projects/${project.id}`,
        headers: authHeader(token),
        payload: { status: 'active' },
      });

      expect(response.statusCode).toBe(200);

      const body = response.json();
      expect(body.data.status).toBe('active');
    });

    it('should reject update on other users project', async () => {
      const ownerUser = await createUser({ email: 'patch-owner@test.com' });
      const otherUser = await createUser({ email: 'patch-other@test.com' });
      const project = await createProject(ownerUser.id, { name: 'Not Yours' });

      const otherToken = generateAccessToken({ userId: otherUser.id, email: otherUser.email });

      const response = await app.inject({
        method: 'PATCH',
        url: `/api/v1/projects/${project.id}`,
        headers: authHeader(otherToken),
        payload: { name: 'Hijacked Name' },
      });

      expect(response.statusCode).toBe(403);

      const body = response.json();
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('FORBIDDEN');
    });

    it('should return 404 for non-existent project', async () => {
      const user = await createUser();
      const token = generateAccessToken({ userId: user.id, email: user.email });
      const fakeId = new mongoose.Types.ObjectId().toString();

      const response = await app.inject({
        method: 'PATCH',
        url: `/api/v1/projects/${fakeId}`,
        headers: authHeader(token),
        payload: { name: 'Ghost Project' },
      });

      expect(response.statusCode).toBe(404);

      const body = response.json();
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('NOT_FOUND');
    });

    it('should reject invalid status value', async () => {
      const user = await createUser();
      const token = generateAccessToken({ userId: user.id, email: user.email });
      const project = await createProject(user.id);

      const response = await app.inject({
        method: 'PATCH',
        url: `/api/v1/projects/${project.id}`,
        headers: authHeader(token),
        payload: { status: 'invalid-status' },
      });

      expect(response.statusCode).toBe(400);

      const body = response.json();
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  // ── DELETE /api/v1/projects/:projectId ──

  describe('DELETE /api/v1/projects/:projectId', () => {
    it('should archive a project (soft delete)', async () => {
      const user = await createUser();
      const token = generateAccessToken({ userId: user.id, email: user.email });
      const project = await createProject(user.id, { name: 'To Be Archived' });

      const response = await app.inject({
        method: 'DELETE',
        url: `/api/v1/projects/${project.id}`,
        headers: authHeader(token),
      });

      expect(response.statusCode).toBe(200);

      const body = response.json();
      expect(body.message).toBe('Project archived successfully');

      // Verify the project is now archived (not visible in default list)
      const listResponse = await app.inject({
        method: 'GET',
        url: '/api/v1/projects',
        headers: authHeader(token),
      });

      const listBody = listResponse.json();
      expect(listBody.data).toHaveLength(0);
    });

    it('should return 404 for non-existent project', async () => {
      const user = await createUser();
      const token = generateAccessToken({ userId: user.id, email: user.email });
      const fakeId = new mongoose.Types.ObjectId().toString();

      const response = await app.inject({
        method: 'DELETE',
        url: `/api/v1/projects/${fakeId}`,
        headers: authHeader(token),
      });

      expect(response.statusCode).toBe(404);

      const body = response.json();
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('NOT_FOUND');
    });

    it('should reject delete on other users project', async () => {
      const ownerUser = await createUser({ email: 'del-owner@test.com' });
      const otherUser = await createUser({ email: 'del-other@test.com' });
      const project = await createProject(ownerUser.id);

      const otherToken = generateAccessToken({ userId: otherUser.id, email: otherUser.email });

      const response = await app.inject({
        method: 'DELETE',
        url: `/api/v1/projects/${project.id}`,
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

      const response = await app.inject({
        method: 'DELETE',
        url: `/api/v1/projects/${project.id}`,
      });

      expect(response.statusCode).toBe(401);

      const body = response.json();
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('UNAUTHORIZED');
    });
  });
});

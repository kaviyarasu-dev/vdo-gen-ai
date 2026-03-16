import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import mongoose from 'mongoose';

import { buildTestApp } from '../../helpers/app.helper.js';
import {
  createUser,
  createProject,
  createWorkflow,
  createExecution,
} from '../../helpers/db.helper.js';
import { generateAccessToken, authHeader } from '../../helpers/auth.helper.js';

describe('Execution API', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  // ── POST /api/v1/executions ──

  describe('POST /api/v1/executions', () => {
    it('should reject without auth', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/executions',
        payload: { workflowId: new mongoose.Types.ObjectId().toString() },
      });

      expect(response.statusCode).toBe(401);

      const body = response.json();
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('UNAUTHORIZED');
    });

    it('should reject with missing workflowId', async () => {
      const user = await createUser();
      const token = generateAccessToken({ userId: user.id, email: user.email });

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/executions',
        headers: authHeader(token),
        payload: {},
      });

      expect(response.statusCode).toBe(400);

      const body = response.json();
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('VALIDATION_ERROR');
    });

    it('should reject with non-existent workflow', async () => {
      const user = await createUser();
      const token = generateAccessToken({ userId: user.id, email: user.email });
      const fakeWorkflowId = new mongoose.Types.ObjectId().toString();

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/executions',
        headers: authHeader(token),
        payload: { workflowId: fakeWorkflowId },
      });

      expect(response.statusCode).toBe(404);

      const body = response.json();
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('NOT_FOUND');
    });

    it('should reject when workflow belongs to another user', async () => {
      const ownerUser = await createUser({ email: 'exec-owner@test.com' });
      const otherUser = await createUser({ email: 'exec-other@test.com' });
      const project = await createProject(ownerUser.id);
      const workflow = await createWorkflow(project.id, ownerUser.id);

      const otherToken = generateAccessToken({
        userId: otherUser.id,
        email: otherUser.email,
      });

      const response = await app.inject({
        method: 'POST',
        url: '/api/v1/executions',
        headers: authHeader(otherToken),
        payload: { workflowId: workflow.id },
      });

      // Controller throws NotFoundError for security (does not reveal existence)
      expect(response.statusCode).toBe(404);

      const body = response.json();
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('NOT_FOUND');
    });
  });

  // ── GET /api/v1/executions ──

  describe('GET /api/v1/executions', () => {
    it('should list user executions', async () => {
      const user = await createUser();
      const token = generateAccessToken({ userId: user.id, email: user.email });
      const project = await createProject(user.id);
      const workflow = await createWorkflow(project.id, user.id);

      await createExecution(workflow.id, project.id, user.id);
      await createExecution(workflow.id, project.id, user.id);

      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/executions',
        headers: authHeader(token),
      });

      expect(response.statusCode).toBe(200);

      const body = response.json();
      expect(body).toHaveProperty('data');
      expect(body).toHaveProperty('pagination');
      expect(body.data).toHaveLength(2);
      expect(body.pagination.total).toBe(2);
    });

    it('should list with pagination', async () => {
      const user = await createUser();
      const token = generateAccessToken({ userId: user.id, email: user.email });
      const project = await createProject(user.id);
      const workflow = await createWorkflow(project.id, user.id);

      await createExecution(workflow.id, project.id, user.id);
      await createExecution(workflow.id, project.id, user.id);
      await createExecution(workflow.id, project.id, user.id);

      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/executions?page=1&limit=2',
        headers: authHeader(token),
      });

      expect(response.statusCode).toBe(200);

      const body = response.json();
      expect(body.data).toHaveLength(2);
      expect(body.pagination.total).toBe(3);
      expect(body.pagination.page).toBe(1);
      expect(body.pagination.limit).toBe(2);
      expect(body.pagination.totalPages).toBe(2);
    });

    it('should filter by status', async () => {
      const user = await createUser();
      const token = generateAccessToken({ userId: user.id, email: user.email });
      const project = await createProject(user.id);
      const workflow = await createWorkflow(project.id, user.id);

      await createExecution(workflow.id, project.id, user.id, { status: 'pending' });
      await createExecution(workflow.id, project.id, user.id, { status: 'running' });
      await createExecution(workflow.id, project.id, user.id, { status: 'completed' });

      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/executions?status=running',
        headers: authHeader(token),
      });

      expect(response.statusCode).toBe(200);

      const body = response.json();
      expect(body.data).toHaveLength(1);
      expect(body.data[0].status).toBe('running');
      expect(body.pagination.total).toBe(1);
    });

    it('should return empty list when user has no executions', async () => {
      const user = await createUser();
      const token = generateAccessToken({ userId: user.id, email: user.email });

      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/executions',
        headers: authHeader(token),
      });

      expect(response.statusCode).toBe(200);

      const body = response.json();
      expect(body.data).toHaveLength(0);
      expect(body.pagination.total).toBe(0);
    });

    it('should reject without auth', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/v1/executions',
      });

      expect(response.statusCode).toBe(401);

      const body = response.json();
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('UNAUTHORIZED');
    });
  });

  // ── GET /api/v1/executions/:executionId ──

  describe('GET /api/v1/executions/:executionId', () => {
    it('should return an execution by id', async () => {
      const user = await createUser();
      const token = generateAccessToken({ userId: user.id, email: user.email });
      const project = await createProject(user.id);
      const workflow = await createWorkflow(project.id, user.id);
      const execution = await createExecution(workflow.id, project.id, user.id);

      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/executions/${execution.id}`,
        headers: authHeader(token),
      });

      expect(response.statusCode).toBe(200);

      const body = response.json();
      expect(body).toHaveProperty('data');
      expect(body.data._id).toBe(execution.id);
      expect(body.data.status).toBe('pending');
      expect(body.data.workflowId).toBe(workflow.id);
      expect(body.data.projectId).toBe(project.id);
    });

    it('should return 404 for non-existent execution', async () => {
      const user = await createUser();
      const token = generateAccessToken({ userId: user.id, email: user.email });
      const fakeExecutionId = new mongoose.Types.ObjectId().toString();

      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/executions/${fakeExecutionId}`,
        headers: authHeader(token),
      });

      expect(response.statusCode).toBe(404);

      const body = response.json();
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('NOT_FOUND');
    });

    it('should return 403 for other user execution', async () => {
      const ownerUser = await createUser({ email: 'getexec-owner@test.com' });
      const otherUser = await createUser({ email: 'getexec-other@test.com' });
      const project = await createProject(ownerUser.id);
      const workflow = await createWorkflow(project.id, ownerUser.id);
      const execution = await createExecution(workflow.id, project.id, ownerUser.id);

      const otherToken = generateAccessToken({
        userId: otherUser.id,
        email: otherUser.email,
      });

      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/executions/${execution.id}`,
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
      const workflow = await createWorkflow(project.id, user.id);
      const execution = await createExecution(workflow.id, project.id, user.id);

      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/executions/${execution.id}`,
      });

      expect(response.statusCode).toBe(401);

      const body = response.json();
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('UNAUTHORIZED');
    });
  });

  // ── GET /api/v1/executions/:executionId/nodes/:nodeId ──

  describe('GET /api/v1/executions/:executionId/nodes/:nodeId', () => {
    it('should return node state for a valid node', async () => {
      const user = await createUser();
      const token = generateAccessToken({ userId: user.id, email: user.email });
      const project = await createProject(user.id);
      const workflow = await createWorkflow(project.id, user.id);
      const execution = await createExecution(workflow.id, project.id, user.id);

      // 'node-input' is the first node created by buildSimplePipelineNodes
      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/executions/${execution.id}/nodes/node-input`,
        headers: authHeader(token),
      });

      expect(response.statusCode).toBe(200);

      const body = response.json();
      expect(body).toHaveProperty('data');
      expect(body.data.nodeId).toBe('node-input');
      expect(body.data.status).toBe('pending');
      expect(body.data.attempts).toBe(0);
      expect(body.data).toHaveProperty('output');
    });

    it('should return 404 for non-existent node', async () => {
      const user = await createUser();
      const token = generateAccessToken({ userId: user.id, email: user.email });
      const project = await createProject(user.id);
      const workflow = await createWorkflow(project.id, user.id);
      const execution = await createExecution(workflow.id, project.id, user.id);

      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/executions/${execution.id}/nodes/non-existent-node`,
        headers: authHeader(token),
      });

      expect(response.statusCode).toBe(404);

      const body = response.json();
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('NOT_FOUND');
    });

    it('should reject without auth', async () => {
      const user = await createUser();
      const project = await createProject(user.id);
      const workflow = await createWorkflow(project.id, user.id);
      const execution = await createExecution(workflow.id, project.id, user.id);

      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/executions/${execution.id}/nodes/node-input`,
      });

      expect(response.statusCode).toBe(401);

      const body = response.json();
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('UNAUTHORIZED');
    });

    it('should reject for other user execution', async () => {
      const ownerUser = await createUser({ email: 'nodestate-owner@test.com' });
      const otherUser = await createUser({ email: 'nodestate-other@test.com' });
      const project = await createProject(ownerUser.id);
      const workflow = await createWorkflow(project.id, ownerUser.id);
      const execution = await createExecution(workflow.id, project.id, ownerUser.id);

      const otherToken = generateAccessToken({
        userId: otherUser.id,
        email: otherUser.email,
      });

      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/executions/${execution.id}/nodes/node-input`,
        headers: authHeader(otherToken),
      });

      expect(response.statusCode).toBe(403);

      const body = response.json();
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('FORBIDDEN');
    });
  });

  // ── POST /api/v1/executions/:executionId/nodes/:nodeId/retry ──

  describe('POST /api/v1/executions/:executionId/nodes/:nodeId/retry', () => {
    it('should reject without auth', async () => {
      const user = await createUser();
      const project = await createProject(user.id);
      const workflow = await createWorkflow(project.id, user.id);
      const execution = await createExecution(workflow.id, project.id, user.id);

      const response = await app.inject({
        method: 'POST',
        url: `/api/v1/executions/${execution.id}/nodes/node-input/retry`,
      });

      expect(response.statusCode).toBe(401);

      const body = response.json();
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('UNAUTHORIZED');
    });

    it('should reject for other user execution', async () => {
      const ownerUser = await createUser({ email: 'retrynode-owner@test.com' });
      const otherUser = await createUser({ email: 'retrynode-other@test.com' });
      const project = await createProject(ownerUser.id);
      const workflow = await createWorkflow(project.id, ownerUser.id);
      const execution = await createExecution(workflow.id, project.id, ownerUser.id);

      const otherToken = generateAccessToken({
        userId: otherUser.id,
        email: otherUser.email,
      });

      const response = await app.inject({
        method: 'POST',
        url: `/api/v1/executions/${execution.id}/nodes/node-input/retry`,
        headers: authHeader(otherToken),
      });

      expect(response.statusCode).toBe(403);

      const body = response.json();
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('FORBIDDEN');
    });
  });
});

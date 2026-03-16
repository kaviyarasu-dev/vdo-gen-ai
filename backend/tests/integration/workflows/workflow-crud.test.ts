import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import mongoose from 'mongoose';

import { buildTestApp } from '../../helpers/app.helper.js';
import {
  createUser,
  createProject,
  createWorkflow,
  buildMinimalPipelineNodes,
  buildMinimalPipelineEdges,
  buildSimplePipelineNodes,
  buildSimplePipelineEdges,
} from '../../helpers/db.helper.js';
import { generateAccessToken, authHeader } from '../../helpers/auth.helper.js';

describe('Workflows API', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = await buildTestApp();
  });

  afterAll(async () => {
    await app.close();
  });

  // ── POST /api/v1/projects/:projectId/workflows ──

  describe('POST /api/v1/projects/:projectId/workflows', () => {
    it('should create a workflow in a project', async () => {
      const user = await createUser();
      const token = generateAccessToken({ userId: user.id, email: user.email });
      const project = await createProject(user.id);

      const response = await app.inject({
        method: 'POST',
        url: `/api/v1/projects/${project.id}/workflows`,
        headers: authHeader(token),
        payload: {
          name: 'My Workflow',
          description: 'A test workflow',
        },
      });

      expect(response.statusCode).toBe(201);

      const body = response.json();
      expect(body).toHaveProperty('data');
      expect(body.data.name).toBe('My Workflow');
      expect(body.data.description).toBe('A test workflow');
      expect(body.data.projectId.toString()).toBe(project.id);
      expect(body.data.userId.toString()).toBe(user.id);
      expect(body.data.nodes).toEqual([]);
      expect(body.data.edges).toEqual([]);
      expect(body.data.version).toBe(1);
      expect(body.data.isTemplate).toBe(false);
      expect(body.data).toHaveProperty('_id');
      expect(body.data).toHaveProperty('createdAt');
    });

    it('should create a workflow with nodes and edges', async () => {
      const user = await createUser();
      const token = generateAccessToken({ userId: user.id, email: user.email });
      const project = await createProject(user.id);

      const nodes = buildMinimalPipelineNodes();
      const edges = buildMinimalPipelineEdges();

      const response = await app.inject({
        method: 'POST',
        url: `/api/v1/projects/${project.id}/workflows`,
        headers: authHeader(token),
        payload: {
          name: 'Workflow With Pipeline',
          nodes,
          edges,
        },
      });

      expect(response.statusCode).toBe(201);

      const body = response.json();
      expect(body.data.nodes).toHaveLength(nodes.length);
      expect(body.data.edges).toHaveLength(edges.length);
      expect(body.data.nodes[0].id).toBe('n-input');
      expect(body.data.nodes[0].type).toBe('script-input');
    });

    it('should reject for non-existent project', async () => {
      const user = await createUser();
      const token = generateAccessToken({ userId: user.id, email: user.email });
      const fakeProjectId = new mongoose.Types.ObjectId().toString();

      const response = await app.inject({
        method: 'POST',
        url: `/api/v1/projects/${fakeProjectId}/workflows`,
        headers: authHeader(token),
        payload: { name: 'Orphan Workflow' },
      });

      expect(response.statusCode).toBe(404);

      const body = response.json();
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('NOT_FOUND');
    });

    it('should reject for other users project', async () => {
      const ownerUser = await createUser({ email: 'wf-owner@test.com' });
      const otherUser = await createUser({ email: 'wf-other@test.com' });
      const project = await createProject(ownerUser.id);

      const otherToken = generateAccessToken({ userId: otherUser.id, email: otherUser.email });

      const response = await app.inject({
        method: 'POST',
        url: `/api/v1/projects/${project.id}/workflows`,
        headers: authHeader(otherToken),
        payload: { name: 'Unauthorized Workflow' },
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
        method: 'POST',
        url: `/api/v1/projects/${project.id}/workflows`,
        payload: { name: 'No Auth Workflow' },
      });

      expect(response.statusCode).toBe(401);

      const body = response.json();
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('UNAUTHORIZED');
    });

    it('should reject with missing name', async () => {
      const user = await createUser();
      const token = generateAccessToken({ userId: user.id, email: user.email });
      const project = await createProject(user.id);

      const response = await app.inject({
        method: 'POST',
        url: `/api/v1/projects/${project.id}/workflows`,
        headers: authHeader(token),
        payload: { description: 'Nameless workflow' },
      });

      expect(response.statusCode).toBe(400);

      const body = response.json();
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  // ── GET /api/v1/projects/:projectId/workflows ──

  describe('GET /api/v1/projects/:projectId/workflows', () => {
    it('should list workflows in a project', async () => {
      const user = await createUser();
      const token = generateAccessToken({ userId: user.id, email: user.email });
      const project = await createProject(user.id);

      await createWorkflow(project.id, user.id, { name: 'Workflow A' });
      await createWorkflow(project.id, user.id, { name: 'Workflow B' });

      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/projects/${project.id}/workflows`,
        headers: authHeader(token),
      });

      expect(response.statusCode).toBe(200);

      const body = response.json();
      expect(body).toHaveProperty('data');
      expect(body).toHaveProperty('pagination');
      expect(body.data).toHaveLength(2);
      expect(body.pagination.total).toBe(2);
    });

    it('should list workflows with pagination', async () => {
      const user = await createUser();
      const token = generateAccessToken({ userId: user.id, email: user.email });
      const project = await createProject(user.id);

      await createWorkflow(project.id, user.id, { name: 'WF 1' });
      await createWorkflow(project.id, user.id, { name: 'WF 2' });
      await createWorkflow(project.id, user.id, { name: 'WF 3' });

      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/projects/${project.id}/workflows?page=1&limit=2`,
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

    it('should return empty list for project with no workflows', async () => {
      const user = await createUser();
      const token = generateAccessToken({ userId: user.id, email: user.email });
      const project = await createProject(user.id);

      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/projects/${project.id}/workflows`,
        headers: authHeader(token),
      });

      expect(response.statusCode).toBe(200);

      const body = response.json();
      expect(body.data).toHaveLength(0);
      expect(body.pagination.total).toBe(0);
    });

    it('should not list template workflows', async () => {
      const user = await createUser();
      const token = generateAccessToken({ userId: user.id, email: user.email });
      const project = await createProject(user.id);

      await createWorkflow(project.id, user.id, { name: 'Normal WF' });
      await createWorkflow(project.id, user.id, { name: 'Template WF', isTemplate: true });

      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/projects/${project.id}/workflows`,
        headers: authHeader(token),
      });

      expect(response.statusCode).toBe(200);

      const body = response.json();
      expect(body.data).toHaveLength(1);
      expect(body.data[0].name).toBe('Normal WF');
    });

    it('should reject for non-existent project', async () => {
      const user = await createUser();
      const token = generateAccessToken({ userId: user.id, email: user.email });
      const fakeProjectId = new mongoose.Types.ObjectId().toString();

      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/projects/${fakeProjectId}/workflows`,
        headers: authHeader(token),
      });

      expect(response.statusCode).toBe(404);

      const body = response.json();
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('NOT_FOUND');
    });
  });

  // ── GET /api/v1/projects/:projectId/workflows/:workflowId ──

  describe('GET /api/v1/projects/:projectId/workflows/:workflowId', () => {
    it('should return a single workflow', async () => {
      const user = await createUser();
      const token = generateAccessToken({ userId: user.id, email: user.email });
      const project = await createProject(user.id);
      const workflow = await createWorkflow(project.id, user.id, { name: 'Single WF' });

      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/projects/${project.id}/workflows/${workflow.id}`,
        headers: authHeader(token),
      });

      expect(response.statusCode).toBe(200);

      const body = response.json();
      expect(body).toHaveProperty('data');
      expect(body.data.name).toBe('Single WF');
      expect(body.data._id).toBe(workflow.id);
      expect(body.data.nodes).toBeDefined();
      expect(body.data.edges).toBeDefined();
    });

    it('should return 404 for non-existent workflow', async () => {
      const user = await createUser();
      const token = generateAccessToken({ userId: user.id, email: user.email });
      const project = await createProject(user.id);
      const fakeWorkflowId = new mongoose.Types.ObjectId().toString();

      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/projects/${project.id}/workflows/${fakeWorkflowId}`,
        headers: authHeader(token),
      });

      expect(response.statusCode).toBe(404);

      const body = response.json();
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('NOT_FOUND');
    });

    it('should return 404 for workflow in wrong project', async () => {
      const user = await createUser();
      const token = generateAccessToken({ userId: user.id, email: user.email });
      const projectA = await createProject(user.id, { name: 'Project A' });
      const projectB = await createProject(user.id, { name: 'Project B' });
      const workflow = await createWorkflow(projectA.id, user.id, { name: 'WF in A' });

      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/projects/${projectB.id}/workflows/${workflow.id}`,
        headers: authHeader(token),
      });

      expect(response.statusCode).toBe(404);

      const body = response.json();
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('NOT_FOUND');
    });

    it('should reject for other users project', async () => {
      const ownerUser = await createUser({ email: 'getbywf-owner@test.com' });
      const otherUser = await createUser({ email: 'getbywf-other@test.com' });
      const project = await createProject(ownerUser.id);
      const workflow = await createWorkflow(project.id, ownerUser.id);

      const otherToken = generateAccessToken({ userId: otherUser.id, email: otherUser.email });

      const response = await app.inject({
        method: 'GET',
        url: `/api/v1/projects/${project.id}/workflows/${workflow.id}`,
        headers: authHeader(otherToken),
      });

      expect(response.statusCode).toBe(403);

      const body = response.json();
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('FORBIDDEN');
    });
  });

  // ── PATCH /api/v1/projects/:projectId/workflows/:workflowId ──

  describe('PATCH /api/v1/projects/:projectId/workflows/:workflowId', () => {
    it('should update workflow name', async () => {
      const user = await createUser();
      const token = generateAccessToken({ userId: user.id, email: user.email });
      const project = await createProject(user.id);
      const workflow = await createWorkflow(project.id, user.id, { name: 'Old Name' });

      const response = await app.inject({
        method: 'PATCH',
        url: `/api/v1/projects/${project.id}/workflows/${workflow.id}`,
        headers: authHeader(token),
        payload: { name: 'New Name' },
      });

      expect(response.statusCode).toBe(200);

      const body = response.json();
      expect(body.data.name).toBe('New Name');
    });

    it('should update workflow description', async () => {
      const user = await createUser();
      const token = generateAccessToken({ userId: user.id, email: user.email });
      const project = await createProject(user.id);
      const workflow = await createWorkflow(project.id, user.id);

      const response = await app.inject({
        method: 'PATCH',
        url: `/api/v1/projects/${project.id}/workflows/${workflow.id}`,
        headers: authHeader(token),
        payload: { description: 'Updated description' },
      });

      expect(response.statusCode).toBe(200);

      const body = response.json();
      expect(body.data.description).toBe('Updated description');
    });

    it('should update workflow nodes and edges', async () => {
      const user = await createUser();
      const token = generateAccessToken({ userId: user.id, email: user.email });
      const project = await createProject(user.id);
      const workflow = await createWorkflow(project.id, user.id);

      const newNodes = buildMinimalPipelineNodes();
      const newEdges = buildMinimalPipelineEdges();

      const response = await app.inject({
        method: 'PATCH',
        url: `/api/v1/projects/${project.id}/workflows/${workflow.id}`,
        headers: authHeader(token),
        payload: { nodes: newNodes, edges: newEdges },
      });

      expect(response.statusCode).toBe(200);

      const body = response.json();
      expect(body.data.nodes).toHaveLength(newNodes.length);
      expect(body.data.edges).toHaveLength(newEdges.length);
      // Version should increment when nodes/edges change
      expect(body.data.version).toBeGreaterThan(workflow.version);
    });

    it('should return 404 for non-existent workflow', async () => {
      const user = await createUser();
      const token = generateAccessToken({ userId: user.id, email: user.email });
      const project = await createProject(user.id);
      const fakeWorkflowId = new mongoose.Types.ObjectId().toString();

      const response = await app.inject({
        method: 'PATCH',
        url: `/api/v1/projects/${project.id}/workflows/${fakeWorkflowId}`,
        headers: authHeader(token),
        payload: { name: 'Ghost Workflow' },
      });

      expect(response.statusCode).toBe(404);

      const body = response.json();
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('NOT_FOUND');
    });

    it('should reject update on other users project workflow', async () => {
      const ownerUser = await createUser({ email: 'patchwf-owner@test.com' });
      const otherUser = await createUser({ email: 'patchwf-other@test.com' });
      const project = await createProject(ownerUser.id);
      const workflow = await createWorkflow(project.id, ownerUser.id);

      const otherToken = generateAccessToken({ userId: otherUser.id, email: otherUser.email });

      const response = await app.inject({
        method: 'PATCH',
        url: `/api/v1/projects/${project.id}/workflows/${workflow.id}`,
        headers: authHeader(otherToken),
        payload: { name: 'Hijacked WF' },
      });

      expect(response.statusCode).toBe(403);

      const body = response.json();
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('FORBIDDEN');
    });

    it('should reject name exceeding max length', async () => {
      const user = await createUser();
      const token = generateAccessToken({ userId: user.id, email: user.email });
      const project = await createProject(user.id);
      const workflow = await createWorkflow(project.id, user.id);

      const response = await app.inject({
        method: 'PATCH',
        url: `/api/v1/projects/${project.id}/workflows/${workflow.id}`,
        headers: authHeader(token),
        payload: { name: 'x'.repeat(201) },
      });

      expect(response.statusCode).toBe(400);

      const body = response.json();
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  // ── DELETE /api/v1/projects/:projectId/workflows/:workflowId ──

  describe('DELETE /api/v1/projects/:projectId/workflows/:workflowId', () => {
    it('should delete a workflow', async () => {
      const user = await createUser();
      const token = generateAccessToken({ userId: user.id, email: user.email });
      const project = await createProject(user.id);
      const workflow = await createWorkflow(project.id, user.id, { name: 'To Delete' });

      const response = await app.inject({
        method: 'DELETE',
        url: `/api/v1/projects/${project.id}/workflows/${workflow.id}`,
        headers: authHeader(token),
      });

      expect(response.statusCode).toBe(200);

      const body = response.json();
      expect(body.message).toBe('Workflow deleted successfully');

      // Verify workflow is gone
      const getResponse = await app.inject({
        method: 'GET',
        url: `/api/v1/projects/${project.id}/workflows/${workflow.id}`,
        headers: authHeader(token),
      });

      expect(getResponse.statusCode).toBe(404);
    });

    it('should return 404 for non-existent workflow', async () => {
      const user = await createUser();
      const token = generateAccessToken({ userId: user.id, email: user.email });
      const project = await createProject(user.id);
      const fakeWorkflowId = new mongoose.Types.ObjectId().toString();

      const response = await app.inject({
        method: 'DELETE',
        url: `/api/v1/projects/${project.id}/workflows/${fakeWorkflowId}`,
        headers: authHeader(token),
      });

      expect(response.statusCode).toBe(404);

      const body = response.json();
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('NOT_FOUND');
    });

    it('should reject delete on other users project workflow', async () => {
      const ownerUser = await createUser({ email: 'delwf-owner@test.com' });
      const otherUser = await createUser({ email: 'delwf-other@test.com' });
      const project = await createProject(ownerUser.id);
      const workflow = await createWorkflow(project.id, ownerUser.id);

      const otherToken = generateAccessToken({ userId: otherUser.id, email: otherUser.email });

      const response = await app.inject({
        method: 'DELETE',
        url: `/api/v1/projects/${project.id}/workflows/${workflow.id}`,
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

      const response = await app.inject({
        method: 'DELETE',
        url: `/api/v1/projects/${project.id}/workflows/${workflow.id}`,
      });

      expect(response.statusCode).toBe(401);

      const body = response.json();
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('UNAUTHORIZED');
    });

    it('should return 404 when deleting workflow from wrong project', async () => {
      const user = await createUser();
      const token = generateAccessToken({ userId: user.id, email: user.email });
      const projectA = await createProject(user.id, { name: 'Project A' });
      const projectB = await createProject(user.id, { name: 'Project B' });
      const workflow = await createWorkflow(projectA.id, user.id);

      const response = await app.inject({
        method: 'DELETE',
        url: `/api/v1/projects/${projectB.id}/workflows/${workflow.id}`,
        headers: authHeader(token),
      });

      expect(response.statusCode).toBe(404);

      const body = response.json();
      expect(body.success).toBe(false);
      expect(body.error.code).toBe('NOT_FOUND');
    });
  });
});

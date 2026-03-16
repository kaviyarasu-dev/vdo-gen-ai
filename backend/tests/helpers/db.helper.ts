import mongoose from 'mongoose';
import * as argon2 from 'argon2';

// Import models
import UserModel from '../../src/modules/users/user.model.js';
import ProjectModel from '../../src/modules/projects/project.model.js';
import WorkflowModel from '../../src/modules/workflows/workflow.model.js';
import WorkflowExecutionModel from '../../src/modules/workflows/workflow-execution.model.js';
import AssetModel from '../../src/modules/assets/asset.model.js';

import type { IWorkflowNode, IWorkflowEdge } from '../../src/engine/engine.types.js';

export async function createUser(overrides: Record<string, unknown> = {}) {
  const passwordHash = await argon2.hash('password123');
  return UserModel.create({
    email: `user-${Date.now()}@test.com`,
    passwordHash,
    name: 'Test User',
    refreshTokens: [],
    defaultProviders: {},
    providerApiKeys: new Map(),
    ...overrides,
  });
}

export async function createProject(
  userId: string | mongoose.Types.ObjectId,
  overrides: Record<string, unknown> = {},
) {
  return ProjectModel.create({
    userId,
    name: 'Test Project',
    description: 'A test project',
    status: 'draft',
    settings: {
      outputResolution: '1920x1080',
      outputFormat: 'mp4',
      frameRate: 30,
    },
    ...overrides,
  });
}

export function buildSimplePipelineNodes(): IWorkflowNode[] {
  return [
    {
      id: 'node-input',
      type: 'script-input',
      position: { x: 0, y: 0 },
      config: { script: 'Once upon a time in a kingdom far away...' },
    },
    {
      id: 'node-analyzer',
      type: 'script-analyzer',
      position: { x: 200, y: 0 },
      config: {},
      providerConfig: { provider: 'openai', model: 'gpt-4o' },
    },
    {
      id: 'node-splitter',
      type: 'scene-splitter',
      position: { x: 400, y: 0 },
      config: {},
      providerConfig: { provider: 'openai', model: 'gpt-4o' },
    },
    {
      id: 'node-imggen',
      type: 'image-generator',
      position: { x: 600, y: 0 },
      config: { width: 1280, height: 720 },
      providerConfig: { provider: 'fal' },
    },
    {
      id: 'node-vidgen',
      type: 'video-generator',
      position: { x: 800, y: 0 },
      config: {},
      providerConfig: { provider: 'runway', model: 'gen3a_turbo' },
    },
    {
      id: 'node-output',
      type: 'output',
      position: { x: 1000, y: 0 },
      config: {},
    },
  ];
}

export function buildSimplePipelineEdges(): IWorkflowEdge[] {
  return [
    { id: 'e1', sourceNodeId: 'node-input', sourcePort: 'script', targetNodeId: 'node-analyzer', targetPort: 'script' },
    { id: 'e2', sourceNodeId: 'node-analyzer', sourcePort: 'script', targetNodeId: 'node-splitter', targetPort: 'script' },
    { id: 'e3', sourceNodeId: 'node-splitter', sourcePort: 'scenes', targetNodeId: 'node-imggen', targetPort: 'scenes' },
    { id: 'e4', sourceNodeId: 'node-imggen', sourcePort: 'images', targetNodeId: 'node-vidgen', targetPort: 'images' },
    { id: 'e5', sourceNodeId: 'node-vidgen', sourcePort: 'video', targetNodeId: 'node-output', targetPort: 'video' },
  ];
}

export function buildMinimalPipelineNodes(): IWorkflowNode[] {
  return [
    {
      id: 'n-input',
      type: 'script-input',
      position: { x: 0, y: 0 },
      config: { script: 'A short test script.' },
    },
    {
      id: 'n-output',
      type: 'output',
      position: { x: 200, y: 0 },
      config: {},
    },
  ];
}

export function buildMinimalPipelineEdges(): IWorkflowEdge[] {
  return [
    { id: 'e1', sourceNodeId: 'n-input', sourcePort: 'script', targetNodeId: 'n-output', targetPort: 'video' },
  ];
}

export async function createWorkflow(
  projectId: string | mongoose.Types.ObjectId,
  userId: string | mongoose.Types.ObjectId,
  overrides: Record<string, unknown> = {},
) {
  const nodes = buildSimplePipelineNodes();
  const edges = buildSimplePipelineEdges();

  return WorkflowModel.create({
    projectId,
    userId,
    name: 'Test Workflow',
    description: 'A test workflow',
    isTemplate: false,
    nodes,
    edges,
    version: 1,
    ...overrides,
  });
}

export async function createExecution(
  workflowId: string | mongoose.Types.ObjectId,
  projectId: string | mongoose.Types.ObjectId,
  userId: string | mongoose.Types.ObjectId,
  overrides: Record<string, unknown> = {},
) {
  const nodes = buildSimplePipelineNodes();
  const edges = buildSimplePipelineEdges();

  const nodeStates = new Map<string, Record<string, unknown>>();
  for (const node of nodes) {
    nodeStates.set(node.id, {
      nodeId: node.id,
      status: 'pending',
      attempts: 0,
    });
  }

  return WorkflowExecutionModel.create({
    workflowId,
    projectId,
    userId,
    status: 'pending',
    workflowSnapshot: { nodes, edges },
    nodeStates,
    nodeOutputs: new Map(),
    progress: {
      totalNodes: nodes.length,
      completedNodes: 0,
      percentage: 0,
    },
    ...overrides,
  });
}

export async function createAsset(
  projectId: string | mongoose.Types.ObjectId,
  userId: string | mongoose.Types.ObjectId,
  overrides: Record<string, unknown> = {},
) {
  return AssetModel.create({
    projectId,
    userId,
    type: 'image',
    source: 'upload',
    filename: 'test-image.png',
    originalName: 'test-image.png',
    mimeType: 'image/png',
    size: 1024,
    storagePath: '/uploads/test-image.png',
    url: '/assets/test-image.png',
    metadata: {},
    ...overrides,
  });
}

export async function clearDatabase() {
  const collections = mongoose.connection.collections;
  for (const key in collections) {
    await collections[key].deleteMany({});
  }
}

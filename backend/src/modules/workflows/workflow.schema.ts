import { z } from 'zod';
import type { NodeType } from '../nodes/node.types.js';

const NODE_TYPE_VALUES: readonly [NodeType, ...NodeType[]] = [
  'script-input',
  'script-analyzer',
  'character-extractor',
  'scene-splitter',
  'image-generator',
  'frame-composer',
  'video-generator',
  'video-combiner',
  'output',
];

const positionSchema = z.object({
  x: z.number(),
  y: z.number(),
});

const providerConfigSchema = z.object({
  provider: z.string().min(1, 'Provider is required'),
  model: z.string().optional(),
  params: z.record(z.unknown()).optional(),
});

const workflowNodeSchema = z.object({
  id: z.string().min(1, 'Node ID is required'),
  type: z.enum(NODE_TYPE_VALUES, {
    message: 'Invalid node type',
  }),
  position: positionSchema,
  config: z.record(z.unknown()).default({}),
  providerConfig: providerConfigSchema.optional(),
  label: z.string().max(200).optional(),
});

const workflowEdgeSchema = z.object({
  id: z.string().min(1, 'Edge ID is required'),
  sourceNodeId: z.string().min(1, 'Source node ID is required'),
  sourcePort: z.string().min(1, 'Source port is required'),
  targetNodeId: z.string().min(1, 'Target node ID is required'),
  targetPort: z.string().min(1, 'Target port is required'),
});

const definitionSchema = z.object({
  nodes: z.array(workflowNodeSchema).default([]),
  edges: z.array(workflowEdgeSchema).default([]),
  viewport: z.object({
    x: z.number(),
    y: z.number(),
    zoom: z.number(),
  }).optional(),
});

export const createWorkflowSchema = z.object({
  name: z
    .string()
    .min(1, 'Workflow name is required')
    .max(200, 'Workflow name must not exceed 200 characters')
    .trim(),
  description: z
    .string()
    .max(2000, 'Description must not exceed 2000 characters')
    .trim()
    .optional(),
  definition: definitionSchema.optional(),
  nodes: z.array(workflowNodeSchema).default([]),
  edges: z.array(workflowEdgeSchema).default([]),
}).transform((data) => {
  // Support both flat and definition-wrapped payloads
  const nodes = data.definition?.nodes ?? data.nodes;
  const edges = data.definition?.edges ?? data.edges;
  return {
    name: data.name,
    description: data.description,
    nodes,
    edges,
  };
});

export const updateWorkflowSchema = z.object({
  name: z
    .string()
    .min(1, 'Workflow name is required')
    .max(200, 'Workflow name must not exceed 200 characters')
    .trim()
    .optional(),
  description: z
    .string()
    .max(2000, 'Description must not exceed 2000 characters')
    .trim()
    .optional(),
  definition: definitionSchema.optional(),
  nodes: z.array(workflowNodeSchema).optional(),
  edges: z.array(workflowEdgeSchema).optional(),
}).transform((data) => {
  // Support both flat and definition-wrapped payloads
  const nodes = data.definition?.nodes ?? data.nodes;
  const edges = data.definition?.edges ?? data.edges;
  return {
    name: data.name,
    description: data.description,
    nodes,
    edges,
  };
});

export const listWorkflowsSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const createTemplateSchema = z.object({
  workflowId: z.string().min(1, 'Workflow ID is required'),
  name: z
    .string()
    .min(1, 'Template name is required')
    .max(200, 'Template name must not exceed 200 characters')
    .trim(),
  description: z
    .string()
    .max(2000, 'Description must not exceed 2000 characters')
    .trim()
    .optional(),
});

export const cloneTemplateSchema = z.object({
  projectId: z.string().min(1, 'Project ID is required'),
  name: z
    .string()
    .max(200, 'Name must not exceed 200 characters')
    .trim()
    .optional(),
});

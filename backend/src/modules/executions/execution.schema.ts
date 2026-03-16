import { z } from 'zod';

export const startExecutionSchema = z.object({
  workflowId: z.string().min(1, 'workflowId is required'),
});

export const listExecutionsSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z
    .enum(['pending', 'running', 'paused', 'completed', 'failed', 'cancelled'])
    .optional(),
  workflowId: z.string().optional(),
  projectId: z.string().optional(),
});

export const overrideNodeSchema = z.object({
  assetId: z.string().min(1, 'assetId is required'),
});

export type StartExecutionBody = z.infer<typeof startExecutionSchema>;
export type ListExecutionsQuery = z.infer<typeof listExecutionsSchema>;
export type OverrideNodeBody = z.infer<typeof overrideNodeSchema>;

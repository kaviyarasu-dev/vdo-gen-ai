import { z } from 'zod';

const projectSettingsSchema = z.object({
  outputResolution: z
    .string()
    .regex(/^\d{3,5}x\d{3,5}$/, 'Resolution must be in format WIDTHxHEIGHT')
    .optional(),
  outputFormat: z
    .enum(['mp4', 'webm'], { message: 'Output format must be mp4 or webm' })
    .optional(),
  frameRate: z
    .number()
    .int()
    .min(1, 'Frame rate must be at least 1')
    .max(120, 'Frame rate must not exceed 120')
    .optional(),
});

export const createProjectSchema = z.object({
  name: z
    .string()
    .min(1, 'Project name is required')
    .max(200, 'Project name must not exceed 200 characters')
    .trim(),
  description: z
    .string()
    .max(2000, 'Description must not exceed 2000 characters')
    .trim()
    .optional(),
  settings: projectSettingsSchema.optional(),
});

export const updateProjectSchema = z.object({
  name: z
    .string()
    .min(1, 'Project name is required')
    .max(200, 'Project name must not exceed 200 characters')
    .trim()
    .optional(),
  description: z
    .string()
    .max(2000, 'Description must not exceed 2000 characters')
    .trim()
    .optional(),
  settings: projectSettingsSchema.optional(),
  status: z
    .enum(['draft', 'active', 'archived'], { message: 'Invalid project status' })
    .optional(),
});

export const listProjectsSchema = z.object({
  status: z
    .enum(['draft', 'active', 'archived'])
    .optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

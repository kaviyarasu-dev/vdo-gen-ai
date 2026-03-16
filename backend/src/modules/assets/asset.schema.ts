import { z } from 'zod';

export const listAssetsSchema = z.object({
  type: z
    .enum(['image', 'video', 'script', 'audio'])
    .optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

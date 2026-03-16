import type { VdoNode } from './node.types';
import type { VdoEdge } from './edge.types';
import type { BackendSerializedWorkflow } from '@/services/workflowSerializer';

export const TemplateCategory = {
  VIDEO_PRODUCTION: 'video-production',
  SOCIAL_MEDIA: 'social-media',
  ADVERTISING: 'advertising',
  EDUCATION: 'education',
  CUSTOM: 'custom',
} as const;

export type TemplateCategory =
  (typeof TemplateCategory)[keyof typeof TemplateCategory];

export const TEMPLATE_CATEGORY_LABELS: Record<TemplateCategory, string> = {
  [TemplateCategory.VIDEO_PRODUCTION]: 'Video Production',
  [TemplateCategory.SOCIAL_MEDIA]: 'Social Media',
  [TemplateCategory.ADVERTISING]: 'Advertising',
  [TemplateCategory.EDUCATION]: 'Education',
  [TemplateCategory.CUSTOM]: 'Custom',
};

export type WorkflowTemplate = {
  _id: string;
  name: string;
  description: string;
  category: TemplateCategory;
  userId: string;
  definition: BackendSerializedWorkflow;
  isPublic: boolean;
  usageCount: number;
  thumbnail?: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
};

export type CreateTemplatePayload = {
  name: string;
  description?: string;
  category: TemplateCategory;
  nodes: VdoNode[];
  edges: VdoEdge[];
  isPublic: boolean;
  tags: string[];
};

export type UpdateTemplatePayload = Partial<
  Pick<WorkflowTemplate, 'name' | 'description' | 'category' | 'isPublic' | 'tags'>
>;

export type TemplateSortField = 'newest' | 'mostUsed' | 'alphabetical';

export type TemplateListFilters = {
  page?: number;
  limit?: number;
  search?: string;
  category?: TemplateCategory;
  sort?: TemplateSortField;
};

export type WorkflowExportData = {
  name: string;
  nodes: VdoNode[];
  edges: VdoEdge[];
  version: number;
  exportedAt: string;
};

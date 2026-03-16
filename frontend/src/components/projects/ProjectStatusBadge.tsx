import { Badge } from '@/components/ui/Badge';
import type { ProjectStatus } from '@/types/workflow.types';

type ProjectStatusBadgeProps = {
  status: ProjectStatus;
};

const STATUS_CONFIG: Record<ProjectStatus, { label: string; variant: 'default' | 'success' | 'warning' }> = {
  draft: { label: 'Draft', variant: 'default' },
  active: { label: 'Active', variant: 'success' },
  archived: { label: 'Archived', variant: 'warning' },
};

export function ProjectStatusBadge({ status }: ProjectStatusBadgeProps) {
  const config = STATUS_CONFIG[status];
  return <Badge variant={config.variant}>{config.label}</Badge>;
}

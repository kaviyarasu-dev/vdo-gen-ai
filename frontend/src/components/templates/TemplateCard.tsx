import { memo, useMemo } from 'react';
import { ReactFlow, Background, type Node, type Edge } from '@xyflow/react';
import { Users, Eye } from 'lucide-react';
import { cn } from '@/lib/cn';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import {
  TEMPLATE_CATEGORY_LABELS,
  type WorkflowTemplate,
  type TemplateCategory,
} from '@/types/template.types';

const CATEGORY_BADGE_VARIANT: Record<TemplateCategory, 'info' | 'success' | 'warning' | 'purple' | 'default'> = {
  'video-production': 'info',
  'social-media': 'success',
  advertising: 'warning',
  education: 'purple',
  custom: 'default',
};

type TemplateCardProps = {
  template: WorkflowTemplate;
  onUseTemplate: (template: WorkflowTemplate) => void;
  onPreview: (template: WorkflowTemplate) => void;
};

function MiniWorkflowPreview({
  nodes,
  edges,
}: {
  nodes: Node[];
  edges: Edge[];
}) {
  const miniNodes = useMemo(
    () =>
      nodes.map((n) => ({
        ...n,
        selectable: false,
        draggable: false,
        connectable: false,
      })),
    [nodes],
  );

  return (
    <div className="h-32 w-full overflow-hidden rounded-t-lg bg-gray-50 dark:bg-gray-900/50">
      <ReactFlow
        nodes={miniNodes}
        edges={edges}
        fitView
        fitViewOptions={{ padding: 0.4 }}
        panOnDrag={false}
        zoomOnScroll={false}
        zoomOnPinch={false}
        zoomOnDoubleClick={false}
        preventScrolling={false}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
        proOptions={{ hideAttribution: true }}
        className="pointer-events-none"
      >
        <Background gap={12} size={1} />
      </ReactFlow>
    </div>
  );
}

export const TemplateCard = memo(function TemplateCard({
  template,
  onUseTemplate,
  onPreview,
}: TemplateCardProps) {
  const categoryVariant = CATEGORY_BADGE_VARIANT[template.category];

  return (
    <div
      className={cn(
        'group flex flex-col overflow-hidden rounded-lg border border-gray-200 bg-white transition-shadow',
        'hover:shadow-md dark:border-gray-700 dark:bg-gray-800',
      )}
    >
      <button
        type="button"
        onClick={() => onPreview(template)}
        className="cursor-pointer"
      >
        <MiniWorkflowPreview nodes={template.nodes} edges={template.edges} />
      </button>

      <div className="flex flex-1 flex-col gap-2 p-4">
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white line-clamp-1">
            {template.name}
          </h3>
          <Badge variant={categoryVariant} className="shrink-0">
            {TEMPLATE_CATEGORY_LABELS[template.category]}
          </Badge>
        </div>

        {template.description && (
          <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2">
            {template.description}
          </p>
        )}

        <div className="mt-auto flex items-center justify-between pt-2">
          <span className="flex items-center gap-1 text-[11px] text-gray-400">
            <Users size={12} />
            {template.usageCount} uses
          </span>
          <div className="flex items-center gap-1.5">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onPreview(template)}
            >
              <Eye size={14} />
              Preview
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={() => onUseTemplate(template)}
            >
              Use
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
});

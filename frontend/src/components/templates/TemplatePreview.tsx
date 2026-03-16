import { useMemo } from 'react';
import { ReactFlow, Background, type Node, type Edge } from '@xyflow/react';
import { Users, Calendar, Tag } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import {
  TEMPLATE_CATEGORY_LABELS,
  type WorkflowTemplate,
} from '@/types/template.types';

type TemplatePreviewProps = {
  template: WorkflowTemplate | null;
  isOpen: boolean;
  onClose: () => void;
  onUseTemplate: (template: WorkflowTemplate) => void;
};

function PreviewWorkflow({
  nodes,
  edges,
}: {
  nodes: Node[];
  edges: Edge[];
}) {
  const readOnlyNodes = useMemo(
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
    <div className="h-64 w-full overflow-hidden rounded-lg border border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-900/50">
      <ReactFlow
        nodes={readOnlyNodes}
        edges={edges}
        fitView
        fitViewOptions={{ padding: 0.3 }}
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
        <Background gap={16} size={1} />
      </ReactFlow>
    </div>
  );
}

function formatDate(dateString: string): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(dateString));
}

export function TemplatePreview({
  template,
  isOpen,
  onClose,
  onUseTemplate,
}: TemplatePreviewProps) {
  if (!template) return null;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={template.name} size="xl">
      <div className="flex flex-col gap-4">
        <PreviewWorkflow nodes={template.nodes} edges={template.edges} />

        {template.description && (
          <p className="text-sm text-gray-600 dark:text-gray-300">
            {template.description}
          </p>
        )}

        <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500 dark:text-gray-400">
          <Badge>{TEMPLATE_CATEGORY_LABELS[template.category]}</Badge>
          <span className="flex items-center gap-1">
            <Users size={12} />
            {template.usageCount} uses
          </span>
          <span className="flex items-center gap-1">
            <Calendar size={12} />
            {formatDate(template.createdAt)}
          </span>
        </div>

        {template.tags.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5">
            <Tag size={12} className="text-gray-400" />
            {template.tags.map((tag) => (
              <Badge key={tag} variant="default">
                {tag}
              </Badge>
            ))}
          </div>
        )}

        <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-900/50">
          <p className="text-xs text-gray-500 dark:text-gray-400">
            <span className="font-medium text-gray-700 dark:text-gray-300">
              {template.nodes.length} nodes
            </span>{' '}
            and{' '}
            <span className="font-medium text-gray-700 dark:text-gray-300">
              {template.edges.length} connections
            </span>
          </p>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" onClick={onClose}>
            Close
          </Button>
          <Button
            variant="primary"
            onClick={() => onUseTemplate(template)}
          >
            Use Template
          </Button>
        </div>
      </div>
    </Modal>
  );
}

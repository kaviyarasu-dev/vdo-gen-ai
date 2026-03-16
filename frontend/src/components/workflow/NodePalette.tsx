import { memo, useCallback, useRef, type DragEvent, type KeyboardEvent } from 'react';
import {
  FileText,
  Search,
  Users,
  Scissors,
  Image,
  Layers,
  Film,
  Merge,
  Download,
  GripVertical,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/cn';
import { NODE_REGISTRY } from '@/config/nodeRegistry';
import { useWorkflowStore } from '@/stores/useWorkflowStore';
import {
  NodeCategory,
  CATEGORY_COLORS,
} from '@/types/node.types';

const ICON_MAP: Record<string, LucideIcon> = {
  FileText,
  Search,
  Users,
  Scissors,
  Image,
  Layers,
  Film,
  Merge,
  Download,
};

const CATEGORY_ORDER: NodeCategory[] = [
  NodeCategory.INPUT,
  NodeCategory.PROCESSING,
  NodeCategory.GENERATION,
  NodeCategory.OUTPUT,
];

const CATEGORY_LABELS: Record<NodeCategory, string> = {
  [NodeCategory.INPUT]: 'Input',
  [NodeCategory.PROCESSING]: 'Processing',
  [NodeCategory.GENERATION]: 'Generation',
  [NodeCategory.OUTPUT]: 'Output',
};

type NodePaletteProps = {
  className?: string;
};

export const NodePalette = memo(function NodePalette({
  className,
}: NodePaletteProps) {
  const listRef = useRef<HTMLDivElement>(null);
  const addNode = useWorkflowStore((s) => s.addNode);

  const handleDragStart = useCallback(
    (e: DragEvent, nodeType: string) => {
      e.dataTransfer.setData(
        'application/vdo-node-type',
        nodeType,
      );
      e.dataTransfer.effectAllowed = 'move';
    },
    [],
  );

  const handleKeyDown = useCallback(
    (e: KeyboardEvent<HTMLDivElement>, nodeType: string) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        // Add node at center of canvas
        addNode(nodeType, { x: 250, y: 250 });
      }

      // Arrow key navigation within the list
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        const items = listRef.current?.querySelectorAll<HTMLDivElement>('[data-palette-item]');
        if (!items) return;

        const currentIndex = Array.from(items).indexOf(e.currentTarget as HTMLDivElement);
        const nextIndex = e.key === 'ArrowDown'
          ? Math.min(currentIndex + 1, items.length - 1)
          : Math.max(currentIndex - 1, 0);

        items[nextIndex]?.focus();
      }
    },
    [addNode],
  );

  const nodesByCategory = CATEGORY_ORDER.map((category) => ({
    category,
    label: CATEGORY_LABELS[category],
    nodes: Object.values(NODE_REGISTRY).filter(
      (n) => n.category === category,
    ),
  }));

  return (
    <div
      className={cn(
        'flex h-full w-[220px] flex-col border-r border-gray-200 bg-white',
        'dark:border-gray-700 dark:bg-gray-800',
        // Responsive: hidden on mobile, icon-only support ready
        'max-sm:hidden',
        className,
      )}
    >
      <div className="border-b border-gray-200 px-4 py-3 dark:border-gray-700">
        <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
          Nodes
        </h3>
        <p className="mt-0.5 text-[10px] text-gray-500 dark:text-gray-400">
          Drag to add or press Enter
        </p>
      </div>

      <div
        ref={listRef}
        className="flex-1 overflow-y-auto p-3 scrollbar-thin"
        role="list"
        aria-label="Available nodes"
      >
        {nodesByCategory.map(({ category, label, nodes }) => (
          <div key={category} className="mb-2.5" role="group" aria-label={label}>
            <div className="mb-1.5 flex items-center gap-2">
              <span
                className="inline-block h-2.5 w-2.5 rounded-full"
                style={{
                  backgroundColor:
                    CATEGORY_COLORS[category].light,
                }}
                aria-hidden="true"
              />
              <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                {label}
              </span>
            </div>
            <div className="space-y-1">
              {nodes.map((nodeDef) => {
                const Icon = ICON_MAP[nodeDef.icon];
                return (
                  <div
                    key={nodeDef.type}
                    data-palette-item
                    draggable
                    tabIndex={0}
                    role="listitem"
                    aria-label={`${nodeDef.label} node: ${nodeDef.description}`}
                    onDragStart={(e) =>
                      handleDragStart(e, nodeDef.type)
                    }
                    onKeyDown={(e) =>
                      handleKeyDown(e, nodeDef.type)
                    }
                    className={cn(
                      'group flex cursor-grab items-center gap-2 rounded-md border border-gray-200 px-2.5 py-1.5',
                      'transition-all hover:border-gray-300 hover:shadow-sm',
                      'active:cursor-grabbing active:shadow-md',
                      'dark:border-gray-600 dark:hover:border-gray-500',
                      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1',
                      'dark:focus-visible:ring-offset-gray-800',
                    )}
                    title={nodeDef.description}
                  >
                    <GripVertical className="h-3 w-3 text-gray-300 group-hover:text-gray-400 dark:text-gray-600 dark:group-hover:text-gray-500" aria-hidden="true" />
                    {Icon && (
                      <Icon
                        className="h-4 w-4 shrink-0"
                        style={{
                          color:
                            CATEGORY_COLORS[category].light,
                        }}
                        aria-hidden="true"
                      />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-medium text-gray-700 dark:text-gray-200">
                        {nodeDef.label}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
});

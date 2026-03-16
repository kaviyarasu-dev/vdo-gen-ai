import { memo, useCallback, useEffect, useRef } from 'react';
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
  Trash2,
  Copy,
  RotateCcw,
  Layout,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/cn';
import { NODE_REGISTRY } from '@/config/nodeRegistry';
import {
  NodeCategory,
  CATEGORY_COLORS,
} from '@/types/node.types';
import { useWorkflowStore } from '@/stores/useWorkflowStore';
import { useNodeExecution } from '@/hooks/useNodeExecution';

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

type ContextMenuProps = {
  x: number;
  y: number;
  canvasPosition: { x: number; y: number };
  nodeId: string | null;
  onClose: () => void;
  onLoadTemplate?: () => void;
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

export const CanvasContextMenu = memo(function CanvasContextMenu({
  x,
  y,
  canvasPosition,
  nodeId,
  onClose,
  onLoadTemplate,
}: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const addNode = useWorkflowStore((s) => s.addNode);
  const removeNode = useWorkflowStore((s) => s.removeNode);
  const duplicateNode = useWorkflowStore((s) => s.duplicateNode);
  const { retryNode, isNodeRetryable } = useNodeExecution();

  const handleAddNode = useCallback(
    (type: string) => {
      addNode(type, canvasPosition);
      onClose();
    },
    [addNode, canvasPosition, onClose],
  );

  const handleDelete = useCallback(() => {
    if (nodeId) {
      removeNode(nodeId);
      onClose();
    }
  }, [nodeId, removeNode, onClose]);

  const handleDuplicate = useCallback(() => {
    if (nodeId) {
      duplicateNode(nodeId);
      onClose();
    }
  }, [nodeId, duplicateNode, onClose]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        menuRef.current &&
        !menuRef.current.contains(e.target as Node)
      ) {
        onClose();
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () =>
      document.removeEventListener('mousedown', handleClickOutside);
  }, [onClose]);

  const nodesByCategory = CATEGORY_ORDER.map((category) => ({
    category,
    label: CATEGORY_LABELS[category],
    nodes: Object.values(NODE_REGISTRY).filter(
      (n) => n.category === category,
    ),
  }));

  return (
    <div
      ref={menuRef}
      className={cn(
        'fixed z-50 min-w-[200px] rounded-lg border border-gray-200 bg-white py-1 shadow-xl',
        'dark:border-gray-600 dark:bg-gray-800',
      )}
      style={{ left: x, top: y }}
    >
      {nodeId ? (
        <>
          <button
            onClick={handleDuplicate}
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-700"
          >
            <Copy className="h-4 w-4" />
            Duplicate
          </button>
          {isNodeRetryable(nodeId) && (
            <button
              onClick={() => {
                retryNode(nodeId);
                onClose();
              }}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-orange-600 hover:bg-orange-50 dark:text-orange-400 dark:hover:bg-orange-900/20"
            >
              <RotateCcw className="h-4 w-4" />
              Retry Node
            </button>
          )}
          <div className="my-1 h-px bg-gray-200 dark:bg-gray-700" />
          <button
            onClick={handleDelete}
            className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20"
          >
            <Trash2 className="h-4 w-4" />
            Delete
          </button>
        </>
      ) : (
        <>
          {onLoadTemplate && (
            <>
              <button
                onClick={() => {
                  onLoadTemplate();
                  onClose();
                }}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-700"
              >
                <Layout className="h-4 w-4" />
                Load Template
              </button>
              <div className="my-1 h-px bg-gray-200 dark:bg-gray-700" />
            </>
          )}
          <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-gray-400">
            Add Node
          </div>
          {nodesByCategory.map(({ category, label, nodes }) => (
            <div key={category}>
              <div
                className="mt-1 flex items-center gap-2 px-3 py-1"
              >
                <span
                  className="inline-block h-2 w-2 rounded-full"
                  style={{
                    backgroundColor:
                      CATEGORY_COLORS[category].light,
                  }}
                />
                <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                  {label}
                </span>
              </div>
              {nodes.map((nodeDef) => {
                const Icon = ICON_MAP[nodeDef.icon];
                return (
                  <button
                    key={nodeDef.type}
                    onClick={() => handleAddNode(nodeDef.type)}
                    className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm text-gray-700 hover:bg-gray-100 dark:text-gray-200 dark:hover:bg-gray-700"
                  >
                    {Icon && (
                      <Icon
                        className="h-3.5 w-3.5"
                        style={{
                          color:
                            CATEGORY_COLORS[category].light,
                        }}
                      />
                    )}
                    {nodeDef.label}
                  </button>
                );
              })}
            </div>
          ))}
        </>
      )}
    </div>
  );
});

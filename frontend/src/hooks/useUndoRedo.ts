import { useWorkflowStore } from '@/stores/useWorkflowStore';

export function useUndoRedo() {
  const undo = useWorkflowStore((s) => s.undo);
  const redo = useWorkflowStore((s) => s.redo);
  const canUndo = useWorkflowStore((s) => s.past.length > 0);
  const canRedo = useWorkflowStore((s) => s.future.length > 0);

  return { undo, redo, canUndo, canRedo };
}

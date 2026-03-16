import { useEffect } from 'react';
import { useWorkflowStore } from '@/stores/useWorkflowStore';
import { useAutoLayout } from './useAutoLayout';

export function useKeyboardShortcuts() {
  const removeNode = useWorkflowStore((s) => s.removeNode);
  const duplicateNode = useWorkflowStore((s) => s.duplicateNode);
  const selectedNodeId = useWorkflowStore((s) => s.selectedNodeId);
  const setSelectedNode = useWorkflowStore((s) => s.setSelectedNode);
  const undo = useWorkflowStore((s) => s.undo);
  const redo = useWorkflowStore((s) => s.redo);
  const { applyLayout } = useAutoLayout();

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement;
      const isInput =
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.tagName === 'SELECT' ||
        target.isContentEditable;

      // Allow Escape in inputs
      if (e.key === 'Escape') {
        setSelectedNode(null);
        (document.activeElement as HTMLElement)?.blur();
        return;
      }

      // Skip shortcuts when typing in form fields
      if (isInput) return;

      const isMod = e.metaKey || e.ctrlKey;

      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedNodeId) {
          e.preventDefault();
          removeNode(selectedNodeId);
        }
        return;
      }

      if (isMod && e.key === 'd') {
        e.preventDefault();
        if (selectedNodeId) {
          duplicateNode(selectedNodeId);
        }
        return;
      }

      if (isMod && e.shiftKey && e.key === 'z') {
        e.preventDefault();
        redo();
        return;
      }

      if (isMod && e.key === 'z') {
        e.preventDefault();
        undo();
        return;
      }

      if (isMod && e.key === 'l') {
        e.preventDefault();
        applyLayout();
        return;
      }

      if (isMod && e.key === 'a') {
        e.preventDefault();
        const nodes = useWorkflowStore.getState().nodes;
        const updatedNodes = nodes.map((n) => ({
          ...n,
          selected: true,
        }));
        useWorkflowStore.setState({ nodes: updatedNodes });
        return;
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [
    selectedNodeId,
    removeNode,
    duplicateNode,
    setSelectedNode,
    undo,
    redo,
    applyLayout,
  ]);
}

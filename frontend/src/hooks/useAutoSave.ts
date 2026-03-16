import { useEffect, useRef, useCallback, useState } from 'react';
import { useWorkflowStore } from '@/stores/useWorkflowStore';
import { useNotificationStore } from '@/stores/useNotificationStore';
import { useSaveWorkflow } from '@/api/mutations/workflowMutations';
import { serializeWorkflow } from '@/services/workflowSerializer';

const AUTO_SAVE_DELAY = 2_000;

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

export function useAutoSave(projectId: string | undefined) {
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle');
  const timerRef = useRef<ReturnType<typeof setTimeout>>();
  const savedTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const prevDirtyRef = useRef(false);
  const saveMutation = useSaveWorkflow();
  const addNotification = useNotificationStore((s) => s.addNotification);

  const doSave = useCallback(async () => {
    const { nodes, edges, workflowId, workflowName, isDirty } = useWorkflowStore.getState();

    if (!projectId || !isDirty || nodes.length === 0) return;

    setSaveStatus('saving');

    try {
      const definition = serializeWorkflow(nodes, edges);
      const workflow = await saveMutation.mutateAsync({
        projectId,
        workflowId: workflowId ?? undefined,
        payload: {
          name: workflowName,
          definition,
        },
      });

      // Update workflow ID if this was a first save
      if (!workflowId) {
        useWorkflowStore.setState({
          workflowId: workflow._id,
          isDirty: false,
        });
      } else {
        useWorkflowStore.setState({ isDirty: false });
      }

      setSaveStatus('saved');

      // Reset to idle after 2 seconds
      savedTimerRef.current = setTimeout(() => {
        setSaveStatus('idle');
      }, 2_000);
    } catch {
      setSaveStatus('error');
      addNotification({
        type: 'error',
        title: 'Auto-save failed',
        message: 'Your changes could not be saved. Try saving manually.',
      });
    }
  }, [projectId, saveMutation, addNotification]);

  // Watch isDirty changes and trigger debounced save
  useEffect(() => {
    const unsubscribe = useWorkflowStore.subscribe((state) => {
      const isDirty = state.isDirty;

      // Only trigger save when isDirty transitions from false → true
      if (isDirty && !prevDirtyRef.current && projectId) {
        clearTimeout(timerRef.current);
        timerRef.current = setTimeout(doSave, AUTO_SAVE_DELAY);
      }

      // Also re-debounce on continued dirty changes
      if (isDirty && prevDirtyRef.current && projectId) {
        clearTimeout(timerRef.current);
        timerRef.current = setTimeout(doSave, AUTO_SAVE_DELAY);
      }

      prevDirtyRef.current = isDirty;
    });

    return () => {
      unsubscribe();
      clearTimeout(timerRef.current);
      clearTimeout(savedTimerRef.current);
    };
  }, [doSave, projectId]);

  // Manual save (Ctrl+S)
  const saveNow = useCallback(() => {
    clearTimeout(timerRef.current);
    doSave();
  }, [doSave]);

  return { saveStatus, saveNow };
}

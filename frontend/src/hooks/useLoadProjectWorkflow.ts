import { useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { projectWorkflowsQuery } from '@/api/queries/workflowQueries';
import { useWorkflowStore } from '@/stores/useWorkflowStore';
import { deserializeWorkflow } from '@/services/workflowSerializer';

export function useLoadProjectWorkflow(projectId: string | undefined) {
  const loadWorkflow = useWorkflowStore((s) => s.loadWorkflow);
  const clearWorkflow = useWorkflowStore((s) => s.clearWorkflow);
  const hasLoadedRef = useRef(false);

  const { data, isLoading, isError, error } = useQuery(
    projectWorkflowsQuery(projectId ?? ''),
  );

  useEffect(() => {
    if (!data || hasLoadedRef.current) return;

    const workflows = data.data;

    if (workflows.length > 0) {
      const workflow = workflows[0]!;
      const { nodes, edges } = deserializeWorkflow(workflow.definition);

      loadWorkflow(nodes, edges, {
        id: workflow._id,
        name: workflow.name,
      });
    } else {
      clearWorkflow();
    }

    hasLoadedRef.current = true;
  }, [data, loadWorkflow, clearWorkflow]);

  // Reset when projectId changes so a new fetch triggers a fresh load
  useEffect(() => {
    hasLoadedRef.current = false;
  }, [projectId]);

  // Clear workflow store when leaving the editor
  useEffect(() => {
    return () => {
      clearWorkflow();
    };
  }, [clearWorkflow]);

  return { isLoading, isError, error };
}

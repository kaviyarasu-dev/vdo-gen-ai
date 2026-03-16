import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { templateListQuery, templateDetailQuery } from '@/api/queries/templateQueries';
import {
  useCreateTemplate,
  useUpdateTemplate,
  useDeleteTemplate,
  useCloneTemplate,
} from '@/api/mutations/templateMutations';
import { useWorkflowStore } from '@/stores/useWorkflowStore';
import { useNotificationStore } from '@/stores/useNotificationStore';
import { deserializeWorkflow } from '@/services/workflowSerializer';
import { ROUTES } from '@/config/routes';
import type { TemplateListFilters, CreateTemplatePayload, UpdateTemplatePayload } from '@/types/template.types';

export function useTemplateList(filters: TemplateListFilters = {}) {
  return useQuery(templateListQuery(filters));
}

export function useTemplateDetail(id: string) {
  return useQuery(templateDetailQuery(id));
}

export function useTemplateActions() {
  const navigate = useNavigate();
  const addNotification = useNotificationStore((s) => s.addNotification);
  const loadWorkflow = useWorkflowStore((s) => s.loadWorkflow);
  const nodes = useWorkflowStore((s) => s.nodes);
  const edges = useWorkflowStore((s) => s.edges);
  const isDirty = useWorkflowStore((s) => s.isDirty);

  const createMutation = useCreateTemplate();
  const updateMutation = useUpdateTemplate();
  const deleteMutation = useDeleteTemplate();
  const cloneMutation = useCloneTemplate();

  const createTemplate = async (payload: CreateTemplatePayload) => {
    try {
      const template = await createMutation.mutateAsync(payload);
      addNotification({
        type: 'success',
        title: 'Template saved',
        message: `"${template.name}" has been saved as a template.`,
      });
      return template;
    } catch {
      addNotification({
        type: 'error',
        title: 'Failed to save template',
        message: 'Something went wrong. Please try again.',
      });
      return null;
    }
  };

  const updateTemplate = async (id: string, payload: UpdateTemplatePayload) => {
    try {
      const template = await updateMutation.mutateAsync({ id, payload });
      addNotification({
        type: 'success',
        title: 'Template updated',
      });
      return template;
    } catch {
      addNotification({
        type: 'error',
        title: 'Failed to update template',
        message: 'Something went wrong. Please try again.',
      });
      return null;
    }
  };

  const deleteTemplate = async (id: string, name: string) => {
    try {
      await deleteMutation.mutateAsync(id);
      addNotification({
        type: 'success',
        title: 'Template deleted',
        message: `"${name}" has been removed.`,
      });
    } catch {
      addNotification({
        type: 'error',
        title: 'Failed to delete template',
        message: 'Something went wrong. Please try again.',
      });
    }
  };

  const useTemplate = async (templateId: string, projectId: string) => {
    try {
      const template = await cloneMutation.mutateAsync(templateId);
      const { nodes, edges } = deserializeWorkflow(template.definition);
      loadWorkflow(nodes, edges, {
        id: '',
        name: template.name,
      });
      navigate(ROUTES.EDITOR(projectId));
      addNotification({
        type: 'success',
        title: 'Template loaded',
        message: `"${template.name}" has been loaded into the editor.`,
      });
    } catch {
      addNotification({
        type: 'error',
        title: 'Failed to load template',
        message: 'Something went wrong. Please try again.',
      });
    }
  };

  return {
    createTemplate,
    updateTemplate,
    deleteTemplate,
    useTemplate,
    currentNodes: nodes,
    currentEdges: edges,
    hasUnsavedChanges: isDirty,
    isCreating: createMutation.isPending,
    isUpdating: updateMutation.isPending,
    isDeleting: deleteMutation.isPending,
    isCloning: cloneMutation.isPending,
  };
}

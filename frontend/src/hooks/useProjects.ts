import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { projectListQuery, projectDetailQuery } from '@/api/queries/projectQueries';
import { useCreateProject, useUpdateProject, useDeleteProject } from '@/api/mutations/projectMutations';
import { useNotificationStore } from '@/stores/useNotificationStore';
import { useProjectStore } from '@/stores/useProjectStore';
import { ROUTES } from '@/config/routes';
import type { ListQueryParams } from '@/types/api.types';
import type { CreateProjectPayload, UpdateProjectPayload } from '@/types/workflow.types';

export function useProjectList(filters: ListQueryParams = {}) {
  return useQuery(projectListQuery(filters));
}

export function useProjectDetail(id: string) {
  return useQuery(projectDetailQuery(id));
}

export function useProjectActions() {
  const navigate = useNavigate();
  const addNotification = useNotificationStore((s) => s.addNotification);
  const setActiveProject = useProjectStore((s) => s.setActiveProject);
  const createMutation = useCreateProject();
  const updateMutation = useUpdateProject();
  const deleteMutation = useDeleteProject();

  const createProject = async (payload: CreateProjectPayload) => {
    try {
      const project = await createMutation.mutateAsync(payload);
      addNotification({
        type: 'success',
        title: 'Project created',
        message: `"${project.name}" is ready to use.`,
      });
      setActiveProject(project);
      navigate(ROUTES.EDITOR(project._id));
      return project;
    } catch {
      addNotification({
        type: 'error',
        title: 'Failed to create project',
        message: 'Something went wrong. Please try again.',
      });
      return null;
    }
  };

  const updateProject = async (id: string, payload: UpdateProjectPayload) => {
    try {
      const project = await updateMutation.mutateAsync({ id, payload });
      addNotification({
        type: 'success',
        title: 'Project updated',
      });
      return project;
    } catch {
      addNotification({
        type: 'error',
        title: 'Failed to update project',
        message: 'Something went wrong. Please try again.',
      });
      return null;
    }
  };

  const deleteProject = async (id: string, name: string) => {
    try {
      await deleteMutation.mutateAsync(id);
      addNotification({
        type: 'success',
        title: 'Project deleted',
        message: `"${name}" has been removed.`,
      });
    } catch {
      addNotification({
        type: 'error',
        title: 'Failed to delete project',
        message: 'Something went wrong. Please try again.',
      });
    }
  };

  return {
    createProject,
    updateProject,
    deleteProject,
    isCreating: createMutation.isPending,
    isUpdating: updateMutation.isPending,
    isDeleting: deleteMutation.isPending,
  };
}

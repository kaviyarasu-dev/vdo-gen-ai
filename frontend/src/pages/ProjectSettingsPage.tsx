import { useParams } from 'react-router-dom';
import { useProjectDetail, useProjectActions } from '@/hooks/useProjects';
import { ProjectSettingsForm } from '@/components/projects/ProjectSettings';
import { Skeleton } from '@/components/ui/Skeleton';

export function Component() {
  const { projectId } = useParams<{ projectId: string }>();
  const { data: project, isLoading, isError } = useProjectDetail(projectId ?? '');
  const { updateProject, isUpdating } = useProjectActions();

  if (isLoading) {
    return (
      <div className="mx-auto max-w-2xl p-6">
        <Skeleton className="mb-6 h-8 w-48" />
        <div className="space-y-4">
          <Skeleton className="h-10 w-full" variant="rectangular" />
          <Skeleton className="h-20 w-full" variant="rectangular" />
          <Skeleton className="h-10 w-full" variant="rectangular" />
        </div>
      </div>
    );
  }

  if (isError || !project) {
    return (
      <div className="p-6 text-center">
        <p className="text-sm text-red-600 dark:text-red-400">
          Failed to load project settings.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl p-6">
      <h2 className="mb-6 text-2xl font-bold text-gray-900 dark:text-white">
        Project Settings
      </h2>
      <ProjectSettingsForm
        project={project}
        onSave={updateProject}
        isSaving={isUpdating}
      />
    </div>
  );
}

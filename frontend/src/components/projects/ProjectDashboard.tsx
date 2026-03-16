import { useState, useCallback } from 'react';
import { Plus, FolderOpen, Search } from 'lucide-react';
import { useProjectList, useProjectActions } from '@/hooks/useProjects';
import { ProjectCard } from '@/components/projects/ProjectCard';
import { ProjectWizard } from '@/components/projects/ProjectWizard';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { cn } from '@/lib/cn';
import type { ListQueryParams } from '@/types/api.types';

export function ProjectDashboard() {
  const [isWizardOpen, setIsWizardOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filters] = useState<ListQueryParams>({});

  const { data, isLoading, isError } = useProjectList(filters);
  const { createProject, updateProject, deleteProject, isCreating } = useProjectActions();
  const [pendingDelete, setPendingDelete] = useState<{ id: string; name: string } | null>(null);

  const projects = data?.data ?? [];
  const filteredProjects = searchQuery
    ? projects.filter((p) =>
        p.name.toLowerCase().includes(searchQuery.toLowerCase()),
      )
    : projects;

  const handleArchive = (id: string) => {
    updateProject(id, { status: 'archived' });
  };

  const handleDeleteRequest = useCallback((id: string, name: string) => {
    setPendingDelete({ id, name });
  }, []);

  const handleConfirmDelete = useCallback(() => {
    if (!pendingDelete) return;
    deleteProject(pendingDelete.id, pendingDelete.name);
    setPendingDelete(null);
  }, [pendingDelete, deleteProject]);

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Projects</h2>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Manage your video generation projects
          </p>
        </div>
        <Button onClick={() => setIsWizardOpen(true)}>
          <Plus size={18} />
          New Project
        </Button>
      </div>

      {/* Search bar */}
      {projects.length > 0 && (
        <div className="relative mb-6">
          <label htmlFor="project-search" className="sr-only">Search projects</label>
          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
            aria-hidden="true"
          />
          <input
            id="project-search"
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search projects..."
            className={cn(
              'h-10 w-full max-w-sm rounded-lg border border-gray-300 bg-white pl-9 pr-3 text-sm transition-colors',
              'placeholder:text-gray-400',
              'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1',
              'dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:placeholder:text-gray-500',
              'dark:focus:ring-offset-gray-900',
            )}
          />
        </div>
      )}

      {/* Loading state */}
      {isLoading && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }, (_, i) => (
            <div
              key={i}
              className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800"
            >
              <Skeleton className="mb-3 h-5 w-3/4" />
              <Skeleton className="mb-4 h-4 w-full" />
              <div className="flex items-center justify-between">
                <Skeleton className="h-5 w-16" variant="rectangular" />
                <Skeleton className="h-4 w-20" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Error state */}
      {isError && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-6 py-8 text-center dark:border-red-800 dark:bg-red-900/20">
          <p className="text-sm text-red-600 dark:text-red-400">
            Failed to load projects. Check your connection and try again.
          </p>
        </div>
      )}

      {/* Empty state */}
      {!isLoading && !isError && projects.length === 0 && (
        <div className="rounded-xl border-2 border-dashed border-gray-300 px-6 py-16 text-center dark:border-gray-600">
          <FolderOpen size={48} className="mx-auto mb-4 text-gray-300 dark:text-gray-600" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            No projects yet
          </h3>
          <p className="mx-auto mt-2 max-w-sm text-sm text-gray-500 dark:text-gray-400">
            Create your first project to start building AI video generation workflows.
          </p>
          <Button onClick={() => setIsWizardOpen(true)} className="mt-6">
            <Plus size={18} />
            Create Project
          </Button>
        </div>
      )}

      {/* Project grid */}
      {!isLoading && !isError && filteredProjects.length > 0 && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredProjects.map((project) => (
            <ProjectCard
              key={project._id}
              project={project}
              onDelete={handleDeleteRequest}
              onArchive={handleArchive}
            />
          ))}
        </div>
      )}

      {/* No search results */}
      {!isLoading && !isError && projects.length > 0 && filteredProjects.length === 0 && (
        <div className="py-12 text-center">
          <Search size={32} className="mx-auto mb-3 text-gray-300 dark:text-gray-600" />
          <p className="text-sm text-gray-500 dark:text-gray-400">
            No projects match &quot;{searchQuery}&quot;
          </p>
        </div>
      )}

      {/* Wizard modal */}
      <ProjectWizard
        isOpen={isWizardOpen}
        onClose={() => setIsWizardOpen(false)}
        onSubmit={createProject}
        isSubmitting={isCreating}
      />

      {/* Delete confirmation */}
      <ConfirmDialog
        isOpen={pendingDelete !== null}
        onClose={() => setPendingDelete(null)}
        onConfirm={handleConfirmDelete}
        title="Delete project"
        message={`This will permanently delete "${pendingDelete?.name ?? ''}" and all its workflows. This action cannot be undone.`}
        confirmLabel="Delete"
        variant="danger"
      />
    </div>
  );
}

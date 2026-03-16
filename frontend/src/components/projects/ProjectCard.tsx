import { useNavigate } from 'react-router-dom';
import { MoreVertical, Pencil, Trash2, Archive, FolderOpen } from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import { ProjectStatusBadge } from '@/components/projects/ProjectStatusBadge';
import { cn } from '@/lib/cn';
import { ROUTES } from '@/config/routes';
import type { Project } from '@/types/workflow.types';

type ProjectCardProps = {
  project: Project;
  onDelete: (id: string, name: string) => void;
  onArchive: (id: string) => void;
};

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays} days ago`;

  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
  });
}

export function ProjectCard({ project, onDelete, onArchive }: ProjectCardProps) {
  const navigate = useNavigate();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isMenuOpen) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isMenuOpen]);

  const handleOpen = () => {
    navigate(ROUTES.EDITOR(project._id));
  };

  return (
    <div
      className={cn(
        'group relative flex flex-col rounded-xl border bg-white p-5 transition-all',
        'border-gray-200 hover:border-blue-300 hover:shadow-md',
        'dark:border-gray-700 dark:bg-gray-800 dark:hover:border-blue-600',
        'cursor-pointer',
      )}
      onClick={handleOpen}
    >
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-base font-semibold text-gray-900 dark:text-white">
            {project.name}
          </h3>
          {project.description && (
            <p className="mt-1 line-clamp-2 text-sm text-gray-500 dark:text-gray-400">
              {project.description}
            </p>
          )}
        </div>

        {/* Context menu */}
        <div ref={menuRef} className="relative ml-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setIsMenuOpen((v) => !v);
            }}
            aria-label={`Actions for ${project.name}`}
            aria-expanded={isMenuOpen}
            aria-haspopup="true"
            className={cn(
              'rounded-lg p-1 text-gray-400 transition-colors',
              'opacity-0 group-hover:opacity-100 focus-visible:opacity-100',
              'hover:bg-gray-100 hover:text-gray-600',
              'dark:hover:bg-gray-700 dark:hover:text-gray-300',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500',
              isMenuOpen && 'opacity-100',
            )}
          >
            <MoreVertical size={16} />
          </button>

          {isMenuOpen && (
            <div
              className={cn(
                'absolute right-0 top-full z-10 mt-1 w-40 overflow-hidden rounded-lg border shadow-lg',
                'border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800',
              )}
            >
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleOpen();
                }}
                className="flex w-full items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-700"
              >
                <FolderOpen size={14} />
                Open
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  navigate(`/settings/project/${project._id}`);
                  setIsMenuOpen(false);
                }}
                className="flex w-full items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-700"
              >
                <Pencil size={14} />
                Edit
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onArchive(project._id);
                  setIsMenuOpen(false);
                }}
                className="flex w-full items-center gap-2 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 dark:text-gray-300 dark:hover:bg-gray-700"
              >
                <Archive size={14} />
                Archive
              </button>
              <div className="border-t border-gray-100 dark:border-gray-700" />
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(project._id, project.name);
                  setIsMenuOpen(false);
                }}
                className="flex w-full items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20"
              >
                <Trash2 size={14} />
                Delete
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="mt-4 flex items-center justify-between">
        <ProjectStatusBadge status={project.status} />
        <span className="text-xs text-gray-400 dark:text-gray-500">
          {formatDate(project.updatedAt)}
        </span>
      </div>
    </div>
  );
}

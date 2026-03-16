import { useState, useDeferredValue } from 'react';
import { Search, SlidersHorizontal, Layout } from 'lucide-react';
import { cn } from '@/lib/cn';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { Skeleton } from '@/components/ui/Skeleton';
import { Button } from '@/components/ui/Button';
import { TemplateCard } from '@/components/templates/TemplateCard';
import { TemplatePreview } from '@/components/templates/TemplatePreview';
import { useTemplateList } from '@/hooks/useTemplates';
import {
  TemplateCategory,
  TEMPLATE_CATEGORY_LABELS,
  type WorkflowTemplate,
  type TemplateSortField,
  type TemplateListFilters,
} from '@/types/template.types';

const SORT_OPTIONS = [
  { value: 'newest', label: 'Newest first' },
  { value: 'mostUsed', label: 'Most used' },
  { value: 'alphabetical', label: 'Alphabetical' },
];

const CATEGORY_TABS: { value: string; label: string }[] = [
  { value: 'all', label: 'All' },
  ...Object.entries(TEMPLATE_CATEGORY_LABELS).map(([value, label]) => ({
    value,
    label,
  })),
];

type TemplateBrowserProps = {
  onUseTemplate: (template: WorkflowTemplate) => void;
};

function TemplateSkeletonGrid() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={i}
          className="overflow-hidden rounded-lg border border-gray-200 dark:border-gray-700"
        >
          <Skeleton variant="rectangular" className="h-32 w-full" />
          <div className="flex flex-col gap-2 p-4">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-1/2" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function TemplateBrowser({ onUseTemplate }: TemplateBrowserProps) {
  const [searchInput, setSearchInput] = useState('');
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [sortBy, setSortBy] = useState<TemplateSortField>('newest');
  const [page, setPage] = useState(1);
  const [previewTemplate, setPreviewTemplate] = useState<WorkflowTemplate | null>(null);

  const deferredSearch = useDeferredValue(searchInput);

  const filters: TemplateListFilters = {
    page,
    limit: 12,
    search: deferredSearch || undefined,
    category: activeCategory !== 'all' ? (activeCategory as TemplateCategory) : undefined,
    sort: sortBy,
  };

  const { data, isLoading, isError } = useTemplateList(filters);

  const templates = data?.data ?? [];
  const pagination = data?.pagination;
  const hasPrevPage = (pagination?.page ?? 1) > 1;
  const hasNextPage = (pagination?.page ?? 1) < (pagination?.totalPages ?? 1);

  return (
    <div className="flex flex-col gap-6">
      {/* Search + Sort bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 max-w-md">
          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
          />
          <Input
            placeholder="Search templates..."
            value={searchInput}
            onChange={(e) => {
              setSearchInput(e.target.value);
              setPage(1);
            }}
            className="pl-9"
          />
        </div>
        <div className="flex items-center gap-2">
          <SlidersHorizontal size={14} className="text-gray-400" />
          <Select
            options={SORT_OPTIONS}
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as TemplateSortField)}
            className="w-40"
          />
        </div>
      </div>

      {/* Category tabs */}
      <div className="flex gap-1 overflow-x-auto border-b border-gray-200 dark:border-gray-700">
        {CATEGORY_TABS.map((tab) => (
          <button
            key={tab.value}
            onClick={() => {
              setActiveCategory(tab.value);
              setPage(1);
            }}
            className={cn(
              '-mb-px border-b-2 px-4 py-2 text-sm font-medium transition-colors',
              activeCategory === tab.value
                ? 'border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400'
                : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 dark:text-gray-400 dark:hover:border-gray-600 dark:hover:text-gray-300',
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      {isLoading ? (
        <TemplateSkeletonGrid />
      ) : isError ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-center dark:border-red-800 dark:bg-red-900/20">
          <p className="text-sm text-red-600 dark:text-red-400">
            Failed to load templates. Please try again.
          </p>
        </div>
      ) : templates.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-16">
          <Layout size={48} className="text-gray-300 dark:text-gray-600" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            No templates found
          </h3>
          <p className="max-w-sm text-center text-sm text-gray-500 dark:text-gray-400">
            {searchInput
              ? `No templates match "${searchInput}". Try a different search.`
              : 'Create your first template by opening a workflow and clicking "Save as Template" in the toolbar.'}
          </p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {templates.map((template) => (
              <TemplateCard
                key={template._id}
                template={template}
                onUseTemplate={onUseTemplate}
                onPreview={setPreviewTemplate}
              />
            ))}
          </div>

          {/* Pagination */}
          {pagination && pagination.totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 pt-4">
              <Button
                variant="secondary"
                size="sm"
                disabled={!hasPrevPage}
                onClick={() => setPage((p) => p - 1)}
              >
                Previous
              </Button>
              <span className="text-sm text-gray-500 dark:text-gray-400">
                Page {pagination.page} of {pagination.totalPages}
              </span>
              <Button
                variant="secondary"
                size="sm"
                disabled={!hasNextPage}
                onClick={() => setPage((p) => p + 1)}
              >
                Next
              </Button>
            </div>
          )}
        </>
      )}

      {/* Preview modal */}
      <TemplatePreview
        template={previewTemplate}
        isOpen={previewTemplate !== null}
        onClose={() => setPreviewTemplate(null)}
        onUseTemplate={(template) => {
          setPreviewTemplate(null);
          onUseTemplate(template);
        }}
      />
    </div>
  );
}

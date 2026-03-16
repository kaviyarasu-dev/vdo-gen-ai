import { memo, useMemo } from 'react';
import { AlertTriangle, CheckCircle, Settings } from 'lucide-react';
import { cn } from '@/lib/cn';
import { useProviders, useProviderModels } from '@/hooks/useProviders';
import { PROVIDER_DISPLAY_NAMES } from '@/types/provider.types';
import { ROUTES } from '@/config/routes';

type ProviderSelectorProps = {
  providers: string[];
  selectedProvider: string | null;
  selectedModel: string | null;
  onProviderChange: (provider: string) => void;
  onModelChange: (model: string) => void;
  className?: string;
};

export const ProviderSelector = memo(function ProviderSelector({
  providers: allowedSlugs,
  selectedProvider,
  selectedModel,
  onProviderChange,
  onModelChange,
  className,
}: ProviderSelectorProps) {
  const { providers: allProviders } = useProviders();
  const { models, isLoading: isLoadingModels } = useProviderModels(selectedProvider);

  const providerEntries = useMemo(() => {
    const configuredMap = new Map(allProviders.map((p) => [p.slug, p.isConfigured]));
    return allowedSlugs.map((slug) => ({
      slug,
      displayName: PROVIDER_DISPLAY_NAMES[slug] ?? slug,
      isConfigured: configuredMap.get(slug) ?? false,
    }));
  }, [allowedSlugs, allProviders]);

  const selectedEntry = providerEntries.find((e) => e.slug === selectedProvider);

  if (allowedSlugs.length === 0) return null;

  return (
    <div className={cn('space-y-3', className)}>
      {/* Provider picker */}
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-gray-700 dark:text-gray-300">
          AI Provider
        </label>
        <div className="flex flex-wrap gap-1.5">
          {providerEntries.map((entry) => (
            <button
              key={entry.slug}
              onClick={() => onProviderChange(entry.slug)}
              className={cn(
                'relative rounded-md border px-2.5 py-1 text-xs font-medium transition-colors',
                selectedProvider === entry.slug
                  ? 'border-blue-500 bg-blue-50 text-blue-700 dark:border-blue-400 dark:bg-blue-900/30 dark:text-blue-300'
                  : 'border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-400 dark:hover:border-gray-500 dark:hover:bg-gray-700',
              )}
            >
              <span className="flex items-center gap-1">
                {entry.displayName}
                {entry.isConfigured ? (
                  <CheckCircle className="h-3 w-3 text-green-500" />
                ) : (
                  <AlertTriangle className="h-3 w-3 text-amber-500" />
                )}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Unconfigured warning */}
      {selectedEntry && !selectedEntry.isConfigured && (
        <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-2.5 py-2 dark:border-amber-700 dark:bg-amber-900/20">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600 dark:text-amber-400" />
          <div className="min-w-0">
            <p className="text-[11px] text-amber-800 dark:text-amber-300">
              API key not configured for {selectedEntry.displayName}.
            </p>
            <a
              href={ROUTES.SETTINGS}
              className="mt-0.5 inline-flex items-center gap-1 text-[11px] font-medium text-amber-700 underline hover:text-amber-900 dark:text-amber-400 dark:hover:text-amber-200"
            >
              <Settings className="h-3 w-3" />
              Configure in Settings
            </a>
          </div>
        </div>
      )}

      {/* Model selector */}
      {selectedProvider && (
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-gray-700 dark:text-gray-300">
            Model
          </label>
          {isLoadingModels ? (
            <div className="flex h-8 items-center">
              <div className="h-4 w-32 animate-pulse rounded bg-gray-200 dark:bg-gray-700" />
            </div>
          ) : models.length > 0 ? (
            <select
              value={selectedModel ?? ''}
              onChange={(e) => onModelChange(e.target.value)}
              className={cn(
                'w-full rounded-md border border-gray-200 bg-white px-3 py-1.5 text-xs',
                'focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500',
                'dark:border-gray-600 dark:bg-gray-700 dark:text-gray-200',
              )}
            >
              <option value="">Select a model...</option>
              {models.map((model) => (
                <option key={model.id} value={model.id}>
                  {model.name}
                </option>
              ))}
            </select>
          ) : (
            <p className="text-xs text-gray-400 dark:text-gray-500">
              No models available
            </p>
          )}

          {/* Model description */}
          {selectedModel && (() => {
            const modelInfo = models.find((m) => m.id === selectedModel);
            return modelInfo?.description ? (
              <p className="text-[11px] text-gray-500 dark:text-gray-400">
                {modelInfo.description}
              </p>
            ) : null;
          })()}

          {/* Model capabilities */}
          {selectedModel && (() => {
            const modelInfo = models.find((m) => m.id === selectedModel);
            return modelInfo?.capabilities && modelInfo.capabilities.length > 0 ? (
              <div className="flex flex-wrap gap-1">
                {modelInfo.capabilities.map((cap) => (
                  <span
                    key={cap}
                    className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] text-gray-500 dark:bg-gray-700 dark:text-gray-400"
                  >
                    {cap}
                  </span>
                ))}
              </div>
            ) : null;
          })()}
        </div>
      )}
    </div>
  );
});

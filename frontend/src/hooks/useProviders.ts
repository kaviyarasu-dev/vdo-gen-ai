import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { providerListQuery, providerModelsQuery } from '@/api/queries/providerQueries';
import type { AIProvider, AIModel, ProviderCategory } from '@/types/provider.types';
import { PROVIDER_CATEGORY_MAP, PROVIDER_DISPLAY_NAMES } from '@/types/provider.types';

/**
 * Fetches all providers and provides helpers to filter by slug list.
 */
export function useProviders() {
  const { data: providers = [], isLoading, isError } = useQuery(providerListQuery());

  const providersBySlug = useMemo(() => {
    const map = new Map<string, AIProvider>();
    for (const p of providers) {
      map.set(p.slug, p);
    }
    return map;
  }, [providers]);

  const getProvidersByCategory = (category: ProviderCategory): AIProvider[] =>
    providers.filter((p) => p.category === category);

  const getProvidersBySlugs = (slugs: string[]): AIProvider[] =>
    slugs
      .map((slug) => providersBySlug.get(slug))
      .filter((p): p is AIProvider => p !== undefined);

  return {
    providers,
    providersBySlug,
    getProvidersByCategory,
    getProvidersBySlugs,
    isLoading,
    isError,
  };
}

/**
 * Fetches models for a specific provider within a category.
 */
export function useProviderModels(providerSlug: string | null) {
  const category = providerSlug ? PROVIDER_CATEGORY_MAP[providerSlug] ?? '' : '';

  const { data: models = [], isLoading } = useQuery(
    providerModelsQuery(category, providerSlug ?? ''),
  );

  return { models: models as AIModel[], isLoading };
}

/**
 * Returns the display name for a provider slug.
 */
export function getProviderDisplayName(slug: string): string {
  return PROVIDER_DISPLAY_NAMES[slug] ?? slug;
}

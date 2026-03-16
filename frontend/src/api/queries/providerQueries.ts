import { queryOptions } from '@tanstack/react-query';
import { apiClient } from '@/api/client';
import { ENDPOINTS } from '@/api/endpoints';
import type { ApiResponse } from '@/types/api.types';
import type {
  AIProvider,
  AIModel,
  ProviderApiKeyEntry,
  DefaultProviderPreferences,
} from '@/types/provider.types';

export const providerKeys = {
  all: ['providers'] as const,
  list: () => [...providerKeys.all, 'list'] as const,
  models: (category: string, provider: string) =>
    [...providerKeys.all, 'models', category, provider] as const,
  apiKeys: () => [...providerKeys.all, 'api-keys'] as const,
  defaults: () => [...providerKeys.all, 'defaults'] as const,
};

export function providerListQuery() {
  return queryOptions({
    queryKey: providerKeys.list(),
    queryFn: async () => {
      const { data } = await apiClient.get<ApiResponse<AIProvider[]>>(
        ENDPOINTS.PROVIDERS.LIST,
      );
      return data.data;
    },
    staleTime: 30 * 60 * 1000,
  });
}

export function providerModelsQuery(category: string, provider: string) {
  return queryOptions({
    queryKey: providerKeys.models(category, provider),
    queryFn: async () => {
      const { data } = await apiClient.get<{ models: AIModel[] }>(
        ENDPOINTS.PROVIDERS.MODELS(category, provider),
      );
      return data.models;
    },
    enabled: !!category && !!provider,
    staleTime: 30 * 60 * 1000,
  });
}

export function apiKeysQuery() {
  return queryOptions({
    queryKey: providerKeys.apiKeys(),
    queryFn: async () => {
      const { data } = await apiClient.get<ApiResponse<ProviderApiKeyEntry[]>>(
        ENDPOINTS.USERS.API_KEYS,
      );
      return data.data;
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function defaultProvidersQuery() {
  return queryOptions({
    queryKey: providerKeys.defaults(),
    queryFn: async () => {
      const { data } = await apiClient.get<ApiResponse<DefaultProviderPreferences>>(
        ENDPOINTS.USERS.PROVIDERS,
      );
      return data.data;
    },
    staleTime: 10 * 60 * 1000,
  });
}

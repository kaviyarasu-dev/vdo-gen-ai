import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/api/client';
import { ENDPOINTS } from '@/api/endpoints';
import { providerKeys } from '@/api/queries/providerQueries';
import type { ApiResponse } from '@/types/api.types';
import type { ProviderApiKeyStatus, DefaultProviderPreferences } from '@/types/provider.types';

type SaveApiKeyPayload = {
  provider: string;
  apiKey: string;
};

type ValidateApiKeyResult = {
  provider: string;
  status: ProviderApiKeyStatus;
};

export function useSaveApiKey() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload: SaveApiKeyPayload) => {
      const { data } = await apiClient.put<ApiResponse<{ status: ProviderApiKeyStatus }>>(
        ENDPOINTS.USERS.API_KEYS,
        payload,
      );
      return data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: providerKeys.apiKeys() });
      queryClient.invalidateQueries({ queryKey: providerKeys.list() });
    },
  });
}

export function useValidateApiKey() {
  return useMutation({
    mutationFn: async (payload: SaveApiKeyPayload) => {
      const { data } = await apiClient.post<ApiResponse<ValidateApiKeyResult>>(
        `${ENDPOINTS.USERS.API_KEYS}/validate`,
        payload,
      );
      return data.data;
    },
  });
}

export function useSaveDefaultProviders() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (preferences: DefaultProviderPreferences) => {
      const { data } = await apiClient.put<ApiResponse<DefaultProviderPreferences>>(
        ENDPOINTS.USERS.PROVIDERS,
        preferences,
      );
      return data.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: providerKeys.defaults() });
    },
  });
}

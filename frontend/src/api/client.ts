import axios, { AxiosError, type InternalAxiosRequestConfig } from 'axios';
import { env } from '@/config/env';
import { useAuthStore } from '@/stores/useAuthStore';
import type { ApiError, ApiErrorResponse } from '@/types/api.types';

export const apiClient = axios.create({
  baseURL: env.API_URL,
  timeout: 30_000,
  headers: {
    'Content-Type': 'application/json',
  },
});

apiClient.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = localStorage.getItem('auth_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  config.headers['X-Request-ID'] = crypto.randomUUID();
  return config;
});

function normalizeError(error: AxiosError<ApiErrorResponse>): ApiError {
  if (error.response) {
    const body = error.response.data;
    return {
      code: body?.error?.code ?? 'UNKNOWN_ERROR',
      message: body?.error?.message ?? error.message,
      status: error.response.status,
      details: body?.error?.details,
    };
  }

  if (error.request) {
    return {
      code: 'NETWORK_ERROR',
      message: 'Unable to reach the server. Check your connection.',
      status: 0,
    };
  }

  return {
    code: 'REQUEST_ERROR',
    message: error.message,
    status: 0,
  };
}

apiClient.interceptors.response.use(
  (response) => response,
  (error: AxiosError<ApiErrorResponse>) => {
    if (error.response?.status === 401) {
      useAuthStore.getState().clearAuth();
    }

    return Promise.reject(normalizeError(error));
  },
);

import { useMutation } from '@tanstack/react-query';
import { apiClient } from '@/api/client';
import { ENDPOINTS } from '@/api/endpoints';
import type { ApiResponse } from '@/types/api.types';

type ExecutionResponse = {
  executionId: string;
  workflowId: string;
  status: string;
};

type StartExecutionParams = {
  workflowId: string;
};

export function useStartExecution() {
  return useMutation({
    mutationFn: async ({ workflowId }: StartExecutionParams) => {
      const response = await apiClient.post<ApiResponse<ExecutionResponse>>(
        ENDPOINTS.EXECUTIONS.LIST,
        { workflowId },
      );
      return response.data.data;
    },
  });
}

export function usePauseExecution() {
  return useMutation({
    mutationFn: async (executionId: string) => {
      const response = await apiClient.post<ApiResponse<ExecutionResponse>>(
        ENDPOINTS.EXECUTIONS.PAUSE(executionId),
      );
      return response.data.data;
    },
  });
}

export function useResumeExecution() {
  return useMutation({
    mutationFn: async (executionId: string) => {
      const response = await apiClient.post<ApiResponse<ExecutionResponse>>(
        ENDPOINTS.EXECUTIONS.RESUME(executionId),
      );
      return response.data.data;
    },
  });
}

export function useCancelExecution() {
  return useMutation({
    mutationFn: async (executionId: string) => {
      const response = await apiClient.post<ApiResponse<ExecutionResponse>>(
        ENDPOINTS.EXECUTIONS.CANCEL(executionId),
      );
      return response.data.data;
    },
  });
}

export function useRetryExecution() {
  return useMutation({
    mutationFn: async (executionId: string) => {
      const response = await apiClient.post<ApiResponse<ExecutionResponse>>(
        ENDPOINTS.EXECUTIONS.RETRY(executionId),
      );
      return response.data.data;
    },
  });
}

type RetryNodeParams = {
  executionId: string;
  nodeId: string;
};

export function useRetryNode() {
  return useMutation({
    mutationFn: async ({ executionId, nodeId }: RetryNodeParams) => {
      const response = await apiClient.post<ApiResponse<ExecutionResponse>>(
        ENDPOINTS.EXECUTIONS.NODE_RETRY(executionId, nodeId),
      );
      return response.data.data;
    },
  });
}

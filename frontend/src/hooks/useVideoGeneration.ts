import { useState, useCallback } from 'react';
import { useMutation } from '@tanstack/react-query';
import axios from 'axios';
import { env } from '@/config/env';
import type {
  VideoGenerationPayload,
  VideoGenerationResponse,
} from '@/types/n8n.types';

const n8nClient = axios.create({
  timeout: 30_000,
  headers: { 'Content-Type': 'application/json' },
});

function getN8nUrl(): string {
  const url = env.N8N_URL;
  if (!url) {
    throw new Error('VITE_N8N_URL is not configured. Set it in .env.local.');
  }
  return url;
}

async function triggerVideoGeneration(
  payload: VideoGenerationPayload,
): Promise<VideoGenerationResponse> {
  const { data } = await n8nClient.post<VideoGenerationResponse>(
    getN8nUrl(),
    payload,
  );

  return data;
}

export function useVideoGeneration() {
  const [generationResult, setGenerationResult] = useState<VideoGenerationResponse | null>(null);

  const mutation = useMutation({
    mutationFn: triggerVideoGeneration,
    onSuccess: (data) => {
      setGenerationResult(data);
    },
  });

  const clearResult = useCallback(() => {
    setGenerationResult(null);
    mutation.reset();
  }, [mutation]);

  return {
    trigger: mutation.mutate,
    triggerAsync: mutation.mutateAsync,
    generationResult,
    clearResult,
    isPending: mutation.isPending,
    isSuccess: mutation.isSuccess,
    isError: mutation.isError,
    error: mutation.error,
  };
}

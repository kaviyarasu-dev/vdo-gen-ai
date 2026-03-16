export const env = {
  API_URL: (import.meta.env.VITE_API_URL as string) ?? 'http://localhost:4000/api',
  WS_URL: (import.meta.env.VITE_WS_URL as string) ?? 'http://localhost:3001',
  APP_NAME: (import.meta.env.VITE_APP_NAME as string) ?? 'VDO Gen',
  N8N_URL: (import.meta.env.VITE_N8N_URL as string) ?? '',
  DEFAULT_CALLBACK_URL: (import.meta.env.VITE_DEFAULT_CALLBACK_URL as string) ?? '',
  IS_DEV: import.meta.env.DEV,
  IS_PROD: import.meta.env.PROD,
} as const;

export const ROUTES = {
  LOGIN: '/login',
  REGISTER: '/register',
  DASHBOARD: '/dashboard',
  EDITOR: (projectId: string) => `/editor/${projectId}`,
  TEMPLATES: '/templates',
  N8N_GENERATE: '/n8n-generate',
  SETTINGS: '/settings',
  PROJECT_SETTINGS: (projectId: string) => `/settings/project/${projectId}`,
} as const;

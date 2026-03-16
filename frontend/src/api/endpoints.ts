const V1 = '/v1';

export const ENDPOINTS = {
  AUTH: {
    REGISTER: `${V1}/auth/register`,
    LOGIN: `${V1}/auth/login`,
    REFRESH: `${V1}/auth/refresh`,
    LOGOUT: `${V1}/auth/logout`,
  },
  USERS: {
    ME: `${V1}/users/me`,
    PROVIDERS: `${V1}/users/me/providers`,
    API_KEYS: `${V1}/users/me/api-keys`,
  },
  PROJECTS: {
    LIST: `${V1}/projects`,
    DETAIL: (id: string) => `${V1}/projects/${id}`,
    WORKFLOWS: (projectId: string) => `${V1}/projects/${projectId}/workflows`,
    WORKFLOW: (projectId: string, workflowId: string) =>
      `${V1}/projects/${projectId}/workflows/${workflowId}`,
    ASSETS: (projectId: string) => `${V1}/projects/${projectId}/assets`,
  },
  TEMPLATES: {
    LIST: `${V1}/workflow-templates`,
    DETAIL: (id: string) => `${V1}/workflow-templates/${id}`,
    CLONE: (id: string) => `${V1}/workflow-templates/${id}/clone`,
  },
  EXECUTIONS: {
    LIST: `${V1}/executions`,
    DETAIL: (id: string) => `${V1}/executions/${id}`,
    PAUSE: (id: string) => `${V1}/executions/${id}/pause`,
    RESUME: (id: string) => `${V1}/executions/${id}/resume`,
    CANCEL: (id: string) => `${V1}/executions/${id}/cancel`,
    RETRY: (id: string) => `${V1}/executions/${id}/retry`,
    NODE_OVERRIDE: (executionId: string, nodeId: string) =>
      `${V1}/executions/${executionId}/nodes/${nodeId}/override`,
    NODE_RETRY: (executionId: string, nodeId: string) =>
      `${V1}/executions/${executionId}/nodes/${nodeId}/retry`,
    NODE_STATE: (executionId: string, nodeId: string) =>
      `${V1}/executions/${executionId}/nodes/${nodeId}`,
  },
  PROVIDERS: {
    LIST: `${V1}/providers`,
    MODELS: (category: string, provider: string) =>
      `${V1}/providers/${category}/${provider}/models`,
  },
  WEBHOOKS: {
    CALLBACK: (provider: string) => `${V1}/webhooks/${provider}`,
  },
} as const;

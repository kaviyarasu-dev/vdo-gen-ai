import { useMutation } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { apiClient } from '@/api/client';
import { ENDPOINTS } from '@/api/endpoints';
import { useAuthStore } from '@/stores/useAuthStore';
import { ROUTES } from '@/config/routes';
import type { AuthResponse, LoginPayload, RegisterPayload } from '@/types/auth.types';

export function useLogin() {
  const navigate = useNavigate();
  const setAuth = useAuthStore((s) => s.setAuth);

  return useMutation({
    mutationFn: async (payload: LoginPayload) => {
      const { data } = await apiClient.post<AuthResponse>(
        ENDPOINTS.AUTH.LOGIN,
        payload,
      );
      return data;
    },
    onSuccess: (data) => {
      setAuth(data.user, data.accessToken, data.refreshToken);
      navigate(ROUTES.DASHBOARD, { replace: true });
    },
  });
}

export function useRegister() {
  const navigate = useNavigate();
  const setAuth = useAuthStore((s) => s.setAuth);

  return useMutation({
    mutationFn: async (payload: RegisterPayload) => {
      const { data } = await apiClient.post<AuthResponse>(
        ENDPOINTS.AUTH.REGISTER,
        payload,
      );
      return data;
    },
    onSuccess: (data) => {
      setAuth(data.user, data.accessToken, data.refreshToken);
      navigate(ROUTES.DASHBOARD, { replace: true });
    },
  });
}

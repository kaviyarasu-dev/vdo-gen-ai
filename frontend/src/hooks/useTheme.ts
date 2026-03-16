import { useEffect } from 'react';
import { useUIStore } from '@/stores/useUIStore';

export function useTheme() {
  const theme = useUIStore((state) => state.theme);
  const setTheme = useUIStore((state) => state.setTheme);

  useEffect(() => {
    const root = document.documentElement;

    const applyTheme = (resolvedTheme: 'light' | 'dark') => {
      if (resolvedTheme === 'dark') {
        root.classList.add('dark');
      } else {
        root.classList.remove('dark');
      }
    };

    if (theme === 'system') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      applyTheme(mediaQuery.matches ? 'dark' : 'light');

      const handler = (e: MediaQueryListEvent) => {
        applyTheme(e.matches ? 'dark' : 'light');
      };
      mediaQuery.addEventListener('change', handler);
      return () => mediaQuery.removeEventListener('change', handler);
    }

    applyTheme(theme);
  }, [theme]);

  const resolvedTheme: 'light' | 'dark' =
    theme === 'system'
      ? window.matchMedia('(prefers-color-scheme: dark)').matches
        ? 'dark'
        : 'light'
      : theme;

  return { theme, setTheme, resolvedTheme };
}

import { create } from 'zustand';

type Theme = 'light' | 'dark' | 'system';

type UIState = {
  theme: Theme;
  sidebarOpen: boolean;
  nodePaletteOpen: boolean;
  configPanelOpen: boolean;
  executionLogOpen: boolean;
  fullscreenMediaId: string | null;
  activeModal: string | null;
  activeModalProps: Record<string, unknown>;
};

type UIActions = {
  setTheme: (theme: Theme) => void;
  toggleSidebar: () => void;
  toggleNodePalette: () => void;
  toggleConfigPanel: () => void;
  toggleExecutionLog: () => void;
  openFullscreenMedia: (mediaId: string) => void;
  closeFullscreenMedia: () => void;
  openModal: (modal: string, props?: Record<string, unknown>) => void;
  closeModal: () => void;
};

export const useUIStore = create<UIState & UIActions>((set) => ({
  theme: (localStorage.getItem('theme') as Theme) ?? 'system',
  sidebarOpen: true,
  nodePaletteOpen: false,
  configPanelOpen: false,
  executionLogOpen: false,
  fullscreenMediaId: null,
  activeModal: null,
  activeModalProps: {},

  setTheme: (theme) => {
    localStorage.setItem('theme', theme);
    set({ theme });
  },
  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
  toggleNodePalette: () => set((state) => ({ nodePaletteOpen: !state.nodePaletteOpen })),
  toggleConfigPanel: () => set((state) => ({ configPanelOpen: !state.configPanelOpen })),
  toggleExecutionLog: () => set((state) => ({ executionLogOpen: !state.executionLogOpen })),
  openFullscreenMedia: (mediaId) => set({ fullscreenMediaId: mediaId }),
  closeFullscreenMedia: () => set({ fullscreenMediaId: null }),
  openModal: (modal, props = {}) => set({ activeModal: modal, activeModalProps: props }),
  closeModal: () => set({ activeModal: null, activeModalProps: {} }),
}));

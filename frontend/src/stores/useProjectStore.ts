import { create } from 'zustand';
import type { Project } from '@/types/workflow.types';

type ProjectState = {
  activeProject: Project | null;
  activeProjectId: string | null;
};

type ProjectActions = {
  setActiveProject: (project: Project | null) => void;
  setActiveProjectId: (id: string | null) => void;
};

export const useProjectStore = create<ProjectState & ProjectActions>((set) => ({
  activeProject: null,
  activeProjectId: null,

  setActiveProject: (project) => {
    set({
      activeProject: project,
      activeProjectId: project?._id ?? null,
    });
  },

  setActiveProjectId: (id) => {
    set({ activeProjectId: id });
  },
}));

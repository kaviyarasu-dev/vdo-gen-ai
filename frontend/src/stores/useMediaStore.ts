import { create } from 'zustand';
import type { MediaAsset, UploadProgress, MediaFilter } from '@/types/media.types';

type ComparisonState = {
  leftAsset: MediaAsset | null;
  rightAsset: MediaAsset | null;
};

type MediaState = {
  uploads: UploadProgress[];
  selectedAssetId: string | null;
  selectedAssets: string[];
  filter: MediaFilter;
  comparison: ComparisonState;
  galleryOpen: boolean;
};

type MediaActions = {
  addUpload: (upload: UploadProgress) => void;
  updateUpload: (fileId: string, update: Partial<UploadProgress>) => void;
  removeUpload: (fileId: string) => void;
  clearUploads: () => void;
  selectAsset: (assetId: string | null) => void;
  toggleAssetSelection: (assetId: string) => void;
  clearSelection: () => void;
  setFilter: (filter: MediaFilter) => void;
  setComparison: (comparison: Partial<ComparisonState>) => void;
  clearComparison: () => void;
  toggleGallery: () => void;
  openGallery: () => void;
  closeGallery: () => void;
};

export const useMediaStore = create<MediaState & MediaActions>((set) => ({
  uploads: [],
  selectedAssetId: null,
  selectedAssets: [],
  filter: {},
  comparison: { leftAsset: null, rightAsset: null },
  galleryOpen: false,

  addUpload: (upload) =>
    set((state) => ({ uploads: [...state.uploads, upload] })),

  updateUpload: (fileId, update) =>
    set((state) => ({
      uploads: state.uploads.map((u) =>
        u.fileId === fileId ? { ...u, ...update } : u,
      ),
    })),

  removeUpload: (fileId) =>
    set((state) => ({
      uploads: state.uploads.filter((u) => u.fileId !== fileId),
    })),

  clearUploads: () =>
    set({ uploads: [] }),

  selectAsset: (assetId) =>
    set({ selectedAssetId: assetId }),

  toggleAssetSelection: (assetId) =>
    set((state) => ({
      selectedAssets: state.selectedAssets.includes(assetId)
        ? state.selectedAssets.filter((id) => id !== assetId)
        : [...state.selectedAssets, assetId],
    })),

  clearSelection: () =>
    set({ selectedAssets: [], selectedAssetId: null }),

  setFilter: (filter) =>
    set({ filter }),

  setComparison: (comparison) =>
    set((state) => ({
      comparison: { ...state.comparison, ...comparison },
    })),

  clearComparison: () =>
    set({ comparison: { leftAsset: null, rightAsset: null } }),

  toggleGallery: () =>
    set((state) => ({ galleryOpen: !state.galleryOpen })),

  openGallery: () =>
    set({ galleryOpen: true }),

  closeGallery: () =>
    set({ galleryOpen: false }),
}));

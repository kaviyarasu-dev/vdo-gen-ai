export const APP_NAME = 'VDO Gen';

export const SIDEBAR_WIDTH = 256;
export const SIDEBAR_COLLAPSED_WIDTH = 64;
export const HEADER_HEIGHT = 56;

export const NODE_CATEGORIES = {
  INPUT: 'input',
  PROCESSING: 'processing',
  GENERATION: 'generation',
  OUTPUT: 'output',
} as const;

export const BREAKPOINTS = {
  SM: 640,
  MD: 768,
  LG: 1024,
  XL: 1280,
  '2XL': 1536,
} as const;

export const CANVAS_LIMITS = {
  MAX_NODES: 100,
  NODE_EXTENT: [[-5000, -5000], [5000, 5000]] as const,
  MIN_ZOOM: 0.1,
  MAX_ZOOM: 2,
  SNAP_GRID: [20, 20] as const,
  FIT_VIEW_PADDING: 0.2,
} as const;

export const DEBOUNCE_MS = {
  SEARCH: 300,
  AUTO_SAVE: 2000,
  CANVAS_OPERATION: 100,
} as const;

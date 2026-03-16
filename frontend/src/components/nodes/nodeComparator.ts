import type { VdoNodeProps } from '@/types/node.types';
import type { MediaAsset } from '@/types/media.types';

/**
 * Custom React.memo comparator for node components.
 * Only re-renders when meaningful data changes — ignores position updates
 * that React Flow handles internally.
 */
export function areNodePropsEqual(
  prev: VdoNodeProps,
  next: VdoNodeProps,
): boolean {
  if (prev.selected !== next.selected) return false;
  if (prev.data.status !== next.data.status) return false;
  if (prev.data.progress !== next.data.progress) return false;
  if (prev.data.label !== next.data.label) return false;
  if (prev.data.provider !== next.data.provider) return false;
  if (prev.data.model !== next.data.model) return false;
  if (prev.data.error !== next.data.error) return false;

  // Compare config shallowly
  const prevConfig = prev.data.config;
  const nextConfig = next.data.config;
  const prevKeys = Object.keys(prevConfig);
  const nextKeys = Object.keys(nextConfig);
  if (prevKeys.length !== nextKeys.length) return false;
  for (const key of prevKeys) {
    if (prevConfig[key] !== nextConfig[key]) return false;
  }

  // Compare generated assets length (deep comparison unnecessary)
  const prevAssets = (prev.data.generatedAssets ?? []) as MediaAsset[];
  const nextAssets = (next.data.generatedAssets ?? []) as MediaAsset[];
  if (prevAssets.length !== nextAssets.length) return false;

  return true;
}

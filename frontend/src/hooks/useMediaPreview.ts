import { useMemo } from 'react';
import { getMediaTypeFromMime, type MediaType } from '@/types/media.types';

type PreviewState = {
  url: string | null;
  mediaType: MediaType | null;
};

/**
 * Derives preview info from a File object synchronously.
 * Object URL creation/revocation should be handled by the component
 * that actually renders the preview.
 */
export function useMediaPreview(file: File | null): PreviewState {
  return useMemo<PreviewState>(() => {
    if (!file) {
      return { url: null, mediaType: null };
    }
    return {
      url: null,
      mediaType: getMediaTypeFromMime(file.type),
    };
  }, [file]);
}

/**
 * Generates a thumbnail from a video URL using a canvas capture.
 * Returns the thumbnail data URL via a callback to avoid
 * synchronous setState constraints in effects.
 */
export function createVideoThumbnail(url: string): Promise<string | null> {
  return new Promise((resolve) => {
    const video = document.createElement('video');
    video.crossOrigin = 'anonymous';
    video.preload = 'metadata';

    video.addEventListener('loadeddata', () => {
      video.currentTime = 1;
    });

    video.addEventListener('seeked', () => {
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0);
        resolve(canvas.toDataURL('image/jpeg', 0.7));
      } else {
        resolve(null);
      }
      video.remove();
    });

    video.addEventListener('error', () => {
      resolve(null);
      video.remove();
    });

    video.src = url;
  });
}

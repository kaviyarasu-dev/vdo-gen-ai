import { memo, useState, useCallback, useRef, useEffect, type MouseEvent } from 'react';
import { cn } from '@/lib/cn';
import type { MediaAsset } from '@/types/media.types';

type MediaComparisonProps = {
  leftAsset: MediaAsset;
  rightAsset: MediaAsset;
  leftLabel?: string;
  rightLabel?: string;
  className?: string;
};

export const MediaComparison = memo(function MediaComparison({
  leftAsset,
  rightAsset,
  leftLabel = 'Before',
  rightLabel = 'After',
  className,
}: MediaComparisonProps) {
  const [sliderPosition, setSliderPosition] = useState(50);
  const [isDragging, setIsDragging] = useState(false);
  const [containerWidth, setContainerWidth] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  // Track container width via ResizeObserver
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerWidth(entry.contentRect.width);
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const updateSliderPosition = useCallback((clientX: number) => {
    const container = containerRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const position = ((clientX - rect.left) / rect.width) * 100;
    setSliderPosition(Math.max(0, Math.min(100, position)));
  }, []);

  const handleMouseDown = useCallback(
    (e: MouseEvent) => {
      setIsDragging(true);
      updateSliderPosition(e.clientX);
    },
    [updateSliderPosition],
  );

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!isDragging) return;
      updateSliderPosition(e.clientX);
    },
    [isDragging, updateSliderPosition],
  );

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (e.touches.length > 0) {
        updateSliderPosition(e.touches[0].clientX);
      }
    },
    [updateSliderPosition],
  );

  return (
    <div
      ref={containerRef}
      className={cn(
        'relative cursor-col-resize select-none overflow-hidden rounded-lg border border-gray-200 dark:border-gray-700',
        className,
      )}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleMouseUp}
    >
      {/* Right image (full width background) */}
      <div className="relative aspect-video w-full">
        <img
          src={rightAsset.thumbnailUrl ?? rightAsset.url}
          alt={rightAsset.originalName}
          className="h-full w-full object-contain"
          draggable={false}
        />

        {/* Left image (clipped) */}
        <div
          className="absolute inset-0 overflow-hidden"
          style={{ width: `${sliderPosition}%` }}
        >
          <img
            src={leftAsset.thumbnailUrl ?? leftAsset.url}
            alt={leftAsset.originalName}
            className="h-full object-contain"
            style={{
              width: containerWidth > 0 ? `${containerWidth}px` : '100%',
            }}
            draggable={false}
          />
        </div>

        {/* Slider line */}
        <div
          className="absolute bottom-0 top-0 w-0.5 bg-white shadow-lg"
          style={{ left: `${sliderPosition}%` }}
        >
          {/* Slider handle */}
          <div className="absolute left-1/2 top-1/2 flex h-8 w-8 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-white bg-black/60 shadow-lg">
            <div className="flex gap-0.5">
              <div className="h-3 w-0.5 rounded-full bg-white" />
              <div className="h-3 w-0.5 rounded-full bg-white" />
            </div>
          </div>
        </div>

        {/* Labels */}
        <span className="absolute left-3 top-3 rounded bg-black/60 px-2 py-0.5 text-xs font-medium text-white">
          {leftLabel}
        </span>
        <span className="absolute right-3 top-3 rounded bg-black/60 px-2 py-0.5 text-xs font-medium text-white">
          {rightLabel}
        </span>
      </div>
    </div>
  );
});

import {
  memo,
  useState,
  useCallback,
  useEffect,
  useRef,
  type WheelEvent,
  type MouseEvent,
} from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  ChevronLeft,
  ChevronRight,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Download,
  Info,
} from 'lucide-react';
import { cn } from '@/lib/cn';
import { formatFileSize, type MediaAsset } from '@/types/media.types';
import { VideoPlayer } from './VideoPlayer';

type FullscreenViewerProps = {
  assets: MediaAsset[];
  initialIndex?: number;
  isOpen: boolean;
  onClose: () => void;
};

const MIN_ZOOM = 0.5;
const MAX_ZOOM = 10;
const ZOOM_STEP = 0.25;

/** Inner component that only renders when viewer is open */
function ViewerContent({
  assets,
  initialIndex,
  onClose,
}: {
  assets: MediaAsset[];
  initialIndex: number;
  onClose: () => void;
}) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [zoom, setZoom] = useState(1);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [showInfo, setShowInfo] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const currentAsset = assets[currentIndex];

  const goToPrevious = useCallback(() => {
    setCurrentIndex((prev) => {
      const next = prev > 0 ? prev - 1 : assets.length - 1;
      setZoom(1);
      setPanOffset({ x: 0, y: 0 });
      setShowInfo(false);
      return next;
    });
  }, [assets.length]);

  const goToNext = useCallback(() => {
    setCurrentIndex((prev) => {
      const next = prev < assets.length - 1 ? prev + 1 : 0;
      setZoom(1);
      setPanOffset({ x: 0, y: 0 });
      setShowInfo(false);
      return next;
    });
  }, [assets.length]);

  const zoomIn = useCallback(() => {
    setZoom((prev) => Math.min(prev + ZOOM_STEP, MAX_ZOOM));
  }, []);

  const zoomOut = useCallback(() => {
    setZoom((prev) => Math.max(prev - ZOOM_STEP, MIN_ZOOM));
  }, []);

  const resetView = useCallback(() => {
    setZoom(1);
    setPanOffset({ x: 0, y: 0 });
  }, []);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'Escape':
          onClose();
          break;
        case 'ArrowLeft':
          goToPrevious();
          break;
        case 'ArrowRight':
          goToNext();
          break;
        case '+':
        case '=':
          zoomIn();
          break;
        case '-':
          zoomOut();
          break;
        case '0':
          resetView();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, goToPrevious, goToNext, zoomIn, zoomOut, resetView]);

  // Prevent body scroll while open
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = '';
    };
  }, []);

  const handleWheel = useCallback((e: WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -ZOOM_STEP : ZOOM_STEP;
    setZoom((prev) => Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, prev + delta)));
  }, []);

  const handleMouseDown = useCallback(
    (e: MouseEvent) => {
      if (zoom <= 1) return;
      setIsDragging(true);
      setDragStart({
        x: e.clientX - panOffset.x,
        y: e.clientY - panOffset.y,
      });
    },
    [zoom, panOffset],
  );

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!isDragging) return;
      setPanOffset({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y,
      });
    },
    [isDragging, dragStart],
  );

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  const handleDoubleClick = useCallback(() => {
    resetView();
  }, [resetView]);

  const handleDownload = useCallback(() => {
    if (!currentAsset) return;
    const link = document.createElement('a');
    link.href = currentAsset.url;
    link.download = currentAsset.originalName;
    link.click();
  }, [currentAsset]);

  if (!currentAsset) return null;

  return createPortal(
    <div
      ref={containerRef}
      className="fixed inset-0 z-[9999] flex flex-col bg-black/95"
      role="dialog"
      aria-modal="true"
      aria-label="Media viewer"
    >
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-3">
          <span className="text-sm text-white/80">
            {currentIndex + 1} / {assets.length}
          </span>
          <span className="truncate text-sm text-white/60">
            {currentAsset.originalName}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {currentAsset.type === 'image' && (
            <>
              <button
                onClick={zoomOut}
                className="rounded-md p-1.5 text-white/70 transition-colors hover:bg-white/10 hover:text-white"
                title="Zoom out"
              >
                <ZoomOut className="h-4 w-4" />
              </button>
              <span className="min-w-[3rem] text-center text-xs text-white/60">
                {Math.round(zoom * 100)}%
              </span>
              <button
                onClick={zoomIn}
                className="rounded-md p-1.5 text-white/70 transition-colors hover:bg-white/10 hover:text-white"
                title="Zoom in"
              >
                <ZoomIn className="h-4 w-4" />
              </button>
              <button
                onClick={resetView}
                className="rounded-md p-1.5 text-white/70 transition-colors hover:bg-white/10 hover:text-white"
                title="Reset view"
              >
                <RotateCcw className="h-4 w-4" />
              </button>
            </>
          )}
          <button
            onClick={() => setShowInfo((prev) => !prev)}
            className={cn(
              'rounded-md p-1.5 transition-colors hover:bg-white/10',
              showInfo ? 'text-blue-400' : 'text-white/70 hover:text-white',
            )}
            title="Show info"
          >
            <Info className="h-4 w-4" />
          </button>
          <button
            onClick={handleDownload}
            className="rounded-md p-1.5 text-white/70 transition-colors hover:bg-white/10 hover:text-white"
            title="Download"
          >
            <Download className="h-4 w-4" />
          </button>
          <button
            onClick={onClose}
            className="rounded-md p-1.5 text-white/70 transition-colors hover:bg-white/10 hover:text-white"
            title="Close (Esc)"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Main content area */}
      <div className="relative flex flex-1 items-center justify-center overflow-hidden">
        {/* Previous button */}
        {assets.length > 1 && (
          <button
            onClick={goToPrevious}
            className="absolute left-4 z-10 rounded-full bg-black/50 p-2 text-white/70 transition-colors hover:bg-black/70 hover:text-white"
          >
            <ChevronLeft className="h-6 w-6" />
          </button>
        )}

        {/* Media display */}
        <div
          className={cn(
            'flex h-full w-full items-center justify-center',
            zoom > 1 && 'cursor-grab',
            isDragging && 'cursor-grabbing',
          )}
          onWheel={handleWheel}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onDoubleClick={handleDoubleClick}
        >
          {currentAsset.type === 'image' && (
            <img
              src={currentAsset.url}
              alt={currentAsset.originalName}
              className="max-h-full max-w-full select-none object-contain transition-transform duration-100"
              style={{
                transform: `scale(${zoom}) translate(${panOffset.x / zoom}px, ${panOffset.y / zoom}px)`,
              }}
              draggable={false}
            />
          )}

          {currentAsset.type === 'video' && (
            <div className="w-full max-w-4xl">
              <VideoPlayer
                src={currentAsset.url}
                poster={currentAsset.thumbnailUrl}
                className="aspect-video"
              />
            </div>
          )}
        </div>

        {/* Next button */}
        {assets.length > 1 && (
          <button
            onClick={goToNext}
            className="absolute right-4 z-10 rounded-full bg-black/50 p-2 text-white/70 transition-colors hover:bg-black/70 hover:text-white"
          >
            <ChevronRight className="h-6 w-6" />
          </button>
        )}

        {/* Info panel */}
        {showInfo && (
          <div className="absolute bottom-0 right-0 top-0 w-72 overflow-y-auto border-l border-white/10 bg-black/80 p-4">
            <h4 className="mb-3 text-sm font-semibold text-white">Details</h4>
            <dl className="space-y-2 text-xs">
              <MetadataRow label="Filename" value={currentAsset.originalName} />
              <MetadataRow label="Type" value={currentAsset.mimeType} />
              <MetadataRow
                label="Size"
                value={formatFileSize(currentAsset.size)}
              />
              {currentAsset.metadata.width && currentAsset.metadata.height && (
                <MetadataRow
                  label="Dimensions"
                  value={`${currentAsset.metadata.width} x ${currentAsset.metadata.height}`}
                />
              )}
              {currentAsset.metadata.duration != null && (
                <MetadataRow
                  label="Duration"
                  value={`${currentAsset.metadata.duration.toFixed(1)}s`}
                />
              )}
              <MetadataRow label="Source" value={currentAsset.source} />
              {currentAsset.metadata.generatedBy && (
                <>
                  <MetadataRow
                    label="Provider"
                    value={currentAsset.metadata.generatedBy.provider}
                  />
                  <MetadataRow
                    label="Model"
                    value={currentAsset.metadata.generatedBy.model}
                  />
                  {currentAsset.metadata.generatedBy.prompt && (
                    <MetadataRow
                      label="Prompt"
                      value={currentAsset.metadata.generatedBy.prompt}
                    />
                  )}
                </>
              )}
              <MetadataRow
                label="Created"
                value={new Date(currentAsset.createdAt).toLocaleString()}
              />
            </dl>
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}

export const FullscreenViewer = memo(function FullscreenViewer({
  assets,
  initialIndex = 0,
  isOpen,
  onClose,
}: FullscreenViewerProps) {
  if (!isOpen) return null;
  return (
    <ViewerContent
      assets={assets}
      initialIndex={initialIndex}
      onClose={onClose}
    />
  );
});

function MetadataRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-white/50">{label}</dt>
      <dd className="mt-0.5 break-all text-white/90">{value}</dd>
    </div>
  );
}

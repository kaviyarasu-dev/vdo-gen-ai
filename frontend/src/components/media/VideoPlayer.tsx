import { memo, useRef, useState, useCallback, useEffect } from 'react';
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize,
  Minimize,
  Loader2,
} from 'lucide-react';
import { cn } from '@/lib/cn';

type VideoPlayerProps = {
  src: string;
  poster?: string;
  autoPlay?: boolean;
  className?: string;
};

const PLAYBACK_SPEEDS = [0.5, 1, 1.5, 2] as const;

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export const VideoPlayer = memo(function VideoPlayer({
  src,
  poster,
  autoPlay = false,
  className,
}: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1);
  const [showControls, setShowControls] = useState(true);
  const hideTimeoutRef = useRef<ReturnType<typeof setTimeout>>(null);

  const togglePlay = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      video.play();
    } else {
      video.pause();
    }
  }, []);

  const toggleMute = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = !video.muted;
    setIsMuted(video.muted);
  }, []);

  const handleVolumeChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const video = videoRef.current;
    if (!video) return;
    const newVolume = Number(e.target.value);
    video.volume = newVolume;
    setVolume(newVolume);
    setIsMuted(newVolume === 0);
  }, []);

  const handleSeek = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const video = videoRef.current;
    if (!video) return;
    const time = Number(e.target.value);
    video.currentTime = time;
    setCurrentTime(time);
  }, []);

  const cyclePlaybackSpeed = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    const currentIndex = PLAYBACK_SPEEDS.indexOf(
      playbackSpeed as (typeof PLAYBACK_SPEEDS)[number],
    );
    const nextIndex = (currentIndex + 1) % PLAYBACK_SPEEDS.length;
    const nextSpeed = PLAYBACK_SPEEDS[nextIndex];
    video.playbackRate = nextSpeed;
    setPlaybackSpeed(nextSpeed);
  }, [playbackSpeed]);

  const toggleFullscreen = useCallback(async () => {
    const container = containerRef.current;
    if (!container) return;
    if (document.fullscreenElement) {
      await document.exitFullscreen();
    } else {
      await container.requestFullscreen();
    }
  }, []);

  const scheduleHideControls = useCallback(() => {
    if (hideTimeoutRef.current) {
      clearTimeout(hideTimeoutRef.current);
    }
    setShowControls(true);
    if (isPlaying) {
      hideTimeoutRef.current = setTimeout(() => {
        setShowControls(false);
      }, 3000);
    }
  }, [isPlaying]);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    const onTimeUpdate = () => setCurrentTime(video.currentTime);
    const onLoadedMetadata = () => {
      setDuration(video.duration);
      setIsLoading(false);
    };
    const onWaiting = () => setIsLoading(true);
    const onCanPlay = () => setIsLoading(false);
    const onFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    video.addEventListener('play', onPlay);
    video.addEventListener('pause', onPause);
    video.addEventListener('timeupdate', onTimeUpdate);
    video.addEventListener('loadedmetadata', onLoadedMetadata);
    video.addEventListener('waiting', onWaiting);
    video.addEventListener('canplay', onCanPlay);
    document.addEventListener('fullscreenchange', onFullscreenChange);

    return () => {
      video.removeEventListener('play', onPlay);
      video.removeEventListener('pause', onPause);
      video.removeEventListener('timeupdate', onTimeUpdate);
      video.removeEventListener('loadedmetadata', onLoadedMetadata);
      video.removeEventListener('waiting', onWaiting);
      video.removeEventListener('canplay', onCanPlay);
      document.removeEventListener('fullscreenchange', onFullscreenChange);
    };
  }, []);

  useEffect(() => {
    return () => {
      if (hideTimeoutRef.current) {
        clearTimeout(hideTimeoutRef.current);
      }
    };
  }, []);

  const seekProgress = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div
      ref={containerRef}
      className={cn(
        'group relative overflow-hidden rounded-lg bg-black',
        className,
      )}
      onMouseMove={scheduleHideControls}
      onMouseEnter={() => setShowControls(true)}
      onMouseLeave={() => {
        if (isPlaying) setShowControls(false);
      }}
    >
      {/* Video element */}
      <video
        ref={videoRef}
        src={src}
        poster={poster}
        autoPlay={autoPlay}
        className="h-full w-full cursor-pointer"
        onClick={togglePlay}
        playsInline
      />

      {/* Loading spinner */}
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/30">
          <Loader2 className="h-8 w-8 animate-spin text-white" />
        </div>
      )}

      {/* Big play button when paused */}
      {!isPlaying && !isLoading && (
        <div
          className="absolute inset-0 flex cursor-pointer items-center justify-center"
          onClick={togglePlay}
        >
          <div className="rounded-full bg-black/60 p-4 transition-transform hover:scale-110">
            <Play className="h-8 w-8 text-white" fill="white" />
          </div>
        </div>
      )}

      {/* Controls overlay */}
      <div
        className={cn(
          'absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent px-3 pb-2 pt-8 transition-opacity',
          showControls ? 'opacity-100' : 'opacity-0',
        )}
      >
        {/* Seek bar */}
        <div className="relative mb-2">
          <input
            type="range"
            min={0}
            max={duration || 0}
            step={0.1}
            value={currentTime}
            onChange={handleSeek}
            className="w-full cursor-pointer appearance-none bg-transparent [&::-webkit-slider-runnable-track]:h-1 [&::-webkit-slider-runnable-track]:rounded-full [&::-webkit-slider-runnable-track]:bg-white/30 [&::-webkit-slider-thumb]:mt-[-3px] [&::-webkit-slider-thumb]:h-2.5 [&::-webkit-slider-thumb]:w-2.5 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white"
          />
          <div
            className="pointer-events-none absolute left-0 top-1/2 h-1 -translate-y-1/2 rounded-full bg-blue-500"
            style={{ width: `${seekProgress}%` }}
          />
        </div>

        {/* Control buttons */}
        <div className="flex items-center gap-3">
          {/* Play/Pause */}
          <button
            onClick={togglePlay}
            className="text-white transition-colors hover:text-blue-400"
          >
            {isPlaying ? (
              <Pause className="h-4 w-4" fill="white" />
            ) : (
              <Play className="h-4 w-4" fill="white" />
            )}
          </button>

          {/* Volume */}
          <div className="flex items-center gap-1.5">
            <button
              onClick={toggleMute}
              className="text-white transition-colors hover:text-blue-400"
            >
              {isMuted || volume === 0 ? (
                <VolumeX className="h-4 w-4" />
              ) : (
                <Volume2 className="h-4 w-4" />
              )}
            </button>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={isMuted ? 0 : volume}
              onChange={handleVolumeChange}
              className="w-16 cursor-pointer appearance-none bg-transparent [&::-webkit-slider-runnable-track]:h-1 [&::-webkit-slider-runnable-track]:rounded-full [&::-webkit-slider-runnable-track]:bg-white/30 [&::-webkit-slider-thumb]:mt-[-3px] [&::-webkit-slider-thumb]:h-2.5 [&::-webkit-slider-thumb]:w-2.5 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white"
            />
          </div>

          {/* Time display */}
          <span className="text-xs text-white/80">
            {formatTime(currentTime)} / {formatTime(duration)}
          </span>

          <div className="flex-1" />

          {/* Playback speed */}
          <button
            onClick={cyclePlaybackSpeed}
            className="rounded px-1.5 py-0.5 text-xs font-medium text-white/80 transition-colors hover:bg-white/20 hover:text-white"
          >
            {playbackSpeed}x
          </button>

          {/* Fullscreen */}
          <button
            onClick={toggleFullscreen}
            className="text-white transition-colors hover:text-blue-400"
          >
            {isFullscreen ? (
              <Minimize className="h-4 w-4" />
            ) : (
              <Maximize className="h-4 w-4" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
});

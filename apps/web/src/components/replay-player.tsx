"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Maximize2,
  Minimize2,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface ReplayChunk {
  index: number;
  storageKey: string;
  eventCount: number;
  startTime: number;
  endTime: number;
  signedUrl: string;
}

interface ReplayPlayerProps {
  chunks: ReplayChunk[];
  duration: number;
  onClose?: () => void;
}

interface RRWebPlayerInstance {
  play: () => void;
  pause: () => void;
  goto: (time: number) => void;
  setSpeed: (speed: number) => void;
  addEventListener: (
    event: string,
    callback: (params: unknown) => void,
  ) => void;
}

const PLAYBACK_SPEEDS = [0.5, 1, 1.5, 2, 4];

export function ReplayPlayer({ chunks, duration, onClose }: ReplayPlayerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<RRWebPlayerInstance | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load rrweb-player dynamically
  useEffect(() => {
    let mounted = true;

    async function loadPlayer() {
      if (!chunks.length) {
        setError("No replay data available");
        setIsLoading(false);
        return;
      }

      try {
        // Fetch all chunk data
        const allEvents: unknown[] = [];
        for (const chunk of chunks.sort((a, b) => a.index - b.index)) {
          const response = await fetch(chunk.signedUrl);
          if (!response.ok) {
            throw new Error(`Failed to fetch chunk ${chunk.index}`);
          }
          const chunkEvents = await response.json();
          allEvents.push(...chunkEvents);
        }

        if (!mounted) return;

        // Dynamically import rrweb-player
        const rrwebPlayer = (await import("rrweb-player")).default;
        // Import CSS - we handle CSS via a link tag or in global styles
        // since direct CSS imports may not work with dynamic imports

        if (!mounted || !containerRef.current) return;

        // Clear container
        containerRef.current.innerHTML = "";

        // Create player instance
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const player = new rrwebPlayer({
          target: containerRef.current,
          props: {
            events: allEvents as any,
            width: containerRef.current.clientWidth,
            height: containerRef.current.clientHeight,
            autoPlay: false,
            showController: false, // We use custom controls
            skipInactive: true,
            speed: playbackSpeed,
          },
        }) as unknown as RRWebPlayerInstance;

        playerRef.current = player;
        setIsLoading(false);

        // Listen to player events
        player.addEventListener("ui-update-current-time", (params: unknown) => {
          if (mounted) {
            const event = params as { payload: number };
            setCurrentTime(event.payload);
          }
        });

        player.addEventListener("finish", () => {
          if (mounted) {
            setIsPlaying(false);
          }
        });
      } catch (err) {
        if (mounted) {
          setError(
            err instanceof Error ? err.message : "Failed to load replay",
          );
          setIsLoading(false);
        }
      }
    }

    loadPlayer();

    return () => {
      mounted = false;
      playerRef.current?.pause?.();
    };
  }, [chunks, playbackSpeed]);

  // Update playback speed
  useEffect(() => {
    playerRef.current?.setSpeed?.(playbackSpeed);
  }, [playbackSpeed]);

  const handlePlayPause = useCallback(() => {
    if (!playerRef.current) return;

    if (isPlaying) {
      playerRef.current.pause();
    } else {
      playerRef.current.play();
    }
    setIsPlaying(!isPlaying);
  }, [isPlaying]);

  const handleSeek = useCallback((time: number) => {
    if (!playerRef.current) return;
    playerRef.current.goto(time);
    setCurrentTime(time);
  }, []);

  const handleSkip = useCallback(
    (seconds: number) => {
      const newTime = Math.max(
        0,
        Math.min(duration, currentTime + seconds * 1000),
      );
      handleSeek(newTime);
    },
    [currentTime, duration, handleSeek],
  );

  const handleSpeedChange = useCallback(() => {
    const currentIndex = PLAYBACK_SPEEDS.indexOf(playbackSpeed);
    const nextIndex = (currentIndex + 1) % PLAYBACK_SPEEDS.length;
    setPlaybackSpeed(PLAYBACK_SPEEDS[nextIndex]);
  }, [playbackSpeed]);

  const handleFullscreen = useCallback(() => {
    if (!containerRef.current) return;

    if (!isFullscreen) {
      containerRef.current.requestFullscreen?.();
    } else {
      document.exitFullscreen?.();
    }
  }, [isFullscreen]);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
    };
  }, []);

  const formatTime = (ms: number) => {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
  };

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className="flex flex-col h-full bg-zinc-950">
      {/* Player Container */}
      <div
        ref={containerRef}
        className="flex-1 relative bg-zinc-900 flex items-center justify-center overflow-hidden"
      >
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-zinc-900 z-10">
            <div className="text-center">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">Loading replay...</p>
            </div>
          </div>
        )}
        {error && (
          <div className="absolute inset-0 flex items-center justify-center bg-zinc-900 z-10">
            <div className="text-center">
              <p className="text-sm text-red-400 mb-2">{error}</p>
              <p className="text-xs text-muted-foreground">
                The replay data could not be loaded.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Custom Controls */}
      <div className="bg-zinc-950 border-t border-zinc-800 px-4 py-2">
        {/* Progress Bar */}
        <div
          className="h-1 bg-zinc-800 rounded-full mb-3 cursor-pointer relative group"
          onClick={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const percent = (e.clientX - rect.left) / rect.width;
            handleSeek(percent * duration);
          }}
        >
          <div
            className="h-full bg-primary rounded-full transition-all relative"
            style={{ width: `${progress}%` }}
          >
            <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 bg-primary rounded-full opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
        </div>

        {/* Controls Row */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {/* Skip Back */}
            <button
              onClick={() => handleSkip(-10)}
              className="p-1.5 text-muted-foreground hover:text-foreground transition-colors"
              title="Skip back 10s"
              disabled={isLoading}
            >
              <SkipBack className="h-4 w-4" />
            </button>

            {/* Play/Pause */}
            <button
              onClick={handlePlayPause}
              className="p-2 bg-foreground text-background rounded-full hover:opacity-90 transition-opacity disabled:opacity-50"
              disabled={isLoading || !!error}
            >
              {isPlaying ? (
                <Pause className="h-4 w-4" />
              ) : (
                <Play className="h-4 w-4 ml-0.5" />
              )}
            </button>

            {/* Skip Forward */}
            <button
              onClick={() => handleSkip(10)}
              className="p-1.5 text-muted-foreground hover:text-foreground transition-colors"
              title="Skip forward 10s"
              disabled={isLoading}
            >
              <SkipForward className="h-4 w-4" />
            </button>

            {/* Time Display */}
            <span className="text-xs text-muted-foreground ml-2 tabular-nums">
              {formatTime(currentTime)} / {formatTime(duration)}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {/* Speed Control */}
            <button
              onClick={handleSpeedChange}
              className="px-2 py-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
              disabled={isLoading}
            >
              {playbackSpeed}x
            </button>

            {/* Fullscreen */}
            <button
              onClick={handleFullscreen}
              className="p-1.5 text-muted-foreground hover:text-foreground transition-colors"
              title={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
            >
              {isFullscreen ? (
                <Minimize2 className="h-4 w-4" />
              ) : (
                <Maximize2 className="h-4 w-4" />
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

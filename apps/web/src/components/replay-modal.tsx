"use client";

import { useAuthStore } from "@/stores/auth";
import { trpc } from "@/lib/trpc";
import { ReplayPlayer } from "./replay-player";
import { Loader2, X, AlertCircle } from "lucide-react";

interface ReplayModalProps {
  interactionId: string;
  replayId?: string;
  onClose: () => void;
}

export function ReplayModal({
  interactionId,
  replayId,
  onClose,
}: ReplayModalProps) {
  const { currentProject } = useAuthStore();

  // First, get the interaction details if we don't have replayId
  const { data: interaction, isLoading: interactionLoading } =
    trpc.interactions.get.useQuery(
      {
        projectId: currentProject?.id || "",
        interactionId,
      },
      {
        enabled: !!currentProject?.id && !replayId,
      }
    );

  const effectiveReplayId = replayId || interaction?.replay?.id;

  // Then fetch the replay data
  const {
    data: replay,
    isLoading: replayLoading,
    error,
  } = trpc.interactions.getReplay.useQuery(
    {
      projectId: currentProject?.id || "",
      replayId: effectiveReplayId || "",
    },
    {
      enabled: !!currentProject?.id && !!effectiveReplayId,
    }
  );

  const isLoading = interactionLoading || replayLoading;

  return (
    <div
      className="fixed inset-0 bg-black/80 flex items-center justify-center z-50"
      onClick={onClose}
    >
      <div
        className="bg-card border border-border rounded-lg overflow-hidden w-full max-w-4xl mx-4 max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between px-4 py-3 border-b border-border bg-card"
          style={{ borderBottomWidth: "0.5px" }}
        >
          <div>
            <h3 className="text-sm font-medium text-foreground">
              Session Replay
            </h3>
            {replay && (
              <p className="text-xs text-muted-foreground">
                {replay.eventCount.toLocaleString()} events ·{" "}
                {Math.round((replay.duration || 0) / 1000)}s duration
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 min-h-[400px]">
          {isLoading ? (
            <div className="flex items-center justify-center h-full bg-zinc-900">
              <div className="text-center">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">
                  Loading replay...
                </p>
              </div>
            </div>
          ) : error ? (
            <div className="flex items-center justify-center h-full bg-zinc-900">
              <div className="text-center">
                <AlertCircle className="h-8 w-8 text-red-400 mx-auto mb-2" />
                <p className="text-sm text-red-400 mb-1">
                  Failed to load replay
                </p>
                <p className="text-xs text-muted-foreground">
                  {error.message}
                </p>
              </div>
            </div>
          ) : !effectiveReplayId ? (
            <div className="flex items-center justify-center h-full bg-zinc-900">
              <div className="text-center">
                <AlertCircle className="h-8 w-8 text-amber-400 mx-auto mb-2" />
                <p className="text-sm text-amber-400 mb-1">
                  No replay available
                </p>
                <p className="text-xs text-muted-foreground">
                  This interaction doesn't have an associated replay.
                </p>
              </div>
            </div>
          ) : replay ? (
            <ReplayPlayer
              chunks={replay.chunks}
              duration={replay.duration || 0}
              onClose={onClose}
            />
          ) : null}
        </div>
      </div>
    </div>
  );
}

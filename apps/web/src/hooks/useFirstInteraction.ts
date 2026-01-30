import { useState, useEffect, useCallback } from "react";
import { trpc } from "@/lib/trpc";

interface UseFirstInteractionOptions {
  projectId: string | undefined;
  pollInterval?: number;
  enabled?: boolean;
}

interface UseFirstInteractionResult {
  hasFirstInteraction: boolean;
  isPolling: boolean;
  interactionCount: number;
  stopPolling: () => void;
}

export function useFirstInteraction({
  projectId,
  pollInterval = 5000,
  enabled = true,
}: UseFirstInteractionOptions): UseFirstInteractionResult {
  const [isPolling, setIsPolling] = useState(false);
  const [hasFirstInteraction, setHasFirstInteraction] = useState(false);
  const [interactionCount, setInteractionCount] = useState(0);

  const { data, refetch } = trpc.interactions.inbox.useQuery(
    {
      projectId: projectId || "",
      page: 1,
      pageSize: 1,
      field: "createdAt",
      direction: "desc",
    },
    {
      enabled: !!projectId && enabled && !hasFirstInteraction,
      refetchOnWindowFocus: false,
      staleTime: 0,
    }
  );

  useEffect(() => {
    if (data) {
      const count = data.pagination.total;
      setInteractionCount(count);
      if (count > 0) {
        setHasFirstInteraction(true);
        setIsPolling(false);
      }
    }
  }, [data]);

  useEffect(() => {
    if (!projectId || !enabled || hasFirstInteraction) {
      return;
    }

    setIsPolling(true);

    const interval = setInterval(() => {
      refetch();
    }, pollInterval);

    return () => {
      clearInterval(interval);
      setIsPolling(false);
    };
  }, [projectId, enabled, hasFirstInteraction, pollInterval, refetch]);

  const stopPolling = useCallback(() => {
    setIsPolling(false);
    setHasFirstInteraction(true);
  }, []);

  return {
    hasFirstInteraction,
    isPolling,
    interactionCount,
    stopPolling,
  };
}

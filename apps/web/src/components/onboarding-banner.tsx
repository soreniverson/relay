"use client";

import { useState } from "react";
import { useAuthStore } from "@/stores/auth";
import { useFirstInteraction } from "@/hooks/useFirstInteraction";
import { Button } from "@/components/ui/button";
import { Loader2, X, Sparkles, Code, ExternalLink } from "lucide-react";

interface OnboardingBannerProps {
  onDismiss?: () => void;
}

export function OnboardingBanner({ onDismiss }: OnboardingBannerProps) {
  const { currentProject } = useAuthStore();
  const [dismissed, setDismissed] = useState(false);

  const { hasFirstInteraction, isPolling } = useFirstInteraction({
    projectId: currentProject?.id,
    pollInterval: 5000,
    enabled: !dismissed,
  });

  // Don't render if dismissed or first interaction detected
  if (dismissed || hasFirstInteraction) {
    return null;
  }

  const handleDismiss = () => {
    setDismissed(true);
    onDismiss?.();
  };

  return (
    <div className="bg-gradient-to-r from-primary/10 via-primary/5 to-transparent border-b border-primary/20 px-4 py-3">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-3 flex-1">
          <div className="relative">
            <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center">
              <Sparkles className="h-4 w-4 text-primary" />
            </div>
            {isPolling && (
              <div className="absolute -right-0.5 -bottom-0.5">
                <Loader2 className="h-3 w-3 text-primary animate-spin" />
              </div>
            )}
          </div>
          <div>
            <p className="text-sm font-medium text-foreground">
              Waiting for your first interaction
            </p>
            <p className="text-xs text-muted-foreground">
              {isPolling
                ? "Listening for data from your app..."
                : "Install the SDK to start collecting feedback."}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs"
            onClick={() => window.open("https://docs.relay.dev/quickstart", "_blank")}
          >
            <Code className="h-3 w-3 mr-1.5" />
            View Setup Guide
            <ExternalLink className="h-3 w-3 ml-1.5 opacity-50" />
          </Button>
          <button
            onClick={handleDismiss}
            className="p-1 text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Dismiss"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

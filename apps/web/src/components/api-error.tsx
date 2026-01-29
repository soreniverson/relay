"use client";

import { AlertCircle, RefreshCw, WifiOff } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ApiErrorProps {
  error: { message: string; data?: { code?: string } | null };
  onRetry?: () => void;
  title?: string;
  compact?: boolean;
}

export function ApiError({
  error,
  onRetry,
  title,
  compact = false,
}: ApiErrorProps) {
  // Check if it's a network error
  const isNetworkError =
    error.message.includes("fetch") ||
    error.message.includes("network") ||
    error.message.includes("Failed to fetch");

  // Get user-friendly error message
  const getMessage = () => {
    if (isNetworkError) {
      return "Unable to connect to the server. Please check your internet connection.";
    }

    // Handle tRPC error codes
    const code = error.data?.code;
    if (code === "UNAUTHORIZED") {
      return "Your session has expired. Please log in again.";
    }
    if (code === "FORBIDDEN") {
      return "You don't have permission to access this resource.";
    }
    if (code === "NOT_FOUND") {
      return "The requested resource was not found.";
    }

    return error.message || "An unexpected error occurred.";
  };

  if (compact) {
    return (
      <div className="flex items-center gap-2 p-3 bg-destructive/10 border border-destructive/20 rounded-md text-sm">
        {isNetworkError ? (
          <WifiOff className="h-4 w-4 text-destructive shrink-0" />
        ) : (
          <AlertCircle className="h-4 w-4 text-destructive shrink-0" />
        )}
        <span className="text-destructive flex-1">{getMessage()}</span>
        {onRetry && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onRetry}
            className="h-7 px-2"
          >
            <RefreshCw className="h-3 w-3" />
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center p-8 text-center">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 mb-4">
        {isNetworkError ? (
          <WifiOff className="h-6 w-6 text-destructive" />
        ) : (
          <AlertCircle className="h-6 w-6 text-destructive" />
        )}
      </div>
      <h3 className="text-lg font-medium mb-1">{title || "Failed to load"}</h3>
      <p className="text-muted-foreground text-sm mb-4 max-w-sm">
        {getMessage()}
      </p>
      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Try Again
        </Button>
      )}
    </div>
  );
}

// Empty state component for when data is loaded but empty
interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
}

export function EmptyState({
  icon,
  title,
  description,
  action,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center p-8 text-center">
      {icon && (
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-muted mb-4">
          {icon}
        </div>
      )}
      <h3 className="text-lg font-medium mb-1">{title}</h3>
      {description && (
        <p className="text-muted-foreground text-sm mb-4 max-w-sm">
          {description}
        </p>
      )}
      {action && (
        <Button size="sm" onClick={action.onClick}>
          {action.label}
        </Button>
      )}
    </div>
  );
}

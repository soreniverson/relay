"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import {
  ChevronUp,
  Loader2,
  AlertCircle,
  Plus,
  X,
  MessageSquare,
  CheckCircle2,
  Clock,
  Lightbulb,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface FeedbackItem {
  id: string;
  title: string;
  description: string | null;
  status: "under_review" | "planned" | "in_progress" | "shipped" | "wont_do";
  category: string | null;
  voteCount: number;
  hasVoted: boolean;
  createdAt: string;
}

interface FeedbackData {
  project: { name: string };
  data: FeedbackItem[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

const statusConfig = {
  under_review: {
    label: "Under Review",
    icon: MessageSquare,
    color: "text-blue-500",
  },
  planned: { label: "Planned", icon: Clock, color: "text-violet-500" },
  in_progress: {
    label: "In Progress",
    icon: Loader2,
    color: "text-amber-500",
  },
  shipped: { label: "Shipped", icon: CheckCircle2, color: "text-emerald-500" },
  wont_do: { label: "Won't Do", icon: X, color: "text-muted-foreground" },
};

// Get or create a session ID for voting
function getSessionId(): string {
  if (typeof window === "undefined") return "";
  let sessionId = localStorage.getItem("relay_session_id");
  if (!sessionId) {
    sessionId = crypto.randomUUID();
    localStorage.setItem("relay_session_id", sessionId);
  }
  return sessionId;
}

export default function PublicFeedbackBoardPage() {
  const params = useParams();
  const slug = params.slug as string;

  const [sessionId, setSessionId] = useState<string>("");
  const [data, setData] = useState<FeedbackData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [votingItemId, setVotingItemId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string | undefined>(undefined);

  // Submit modal state
  const [showSubmitModal, setShowSubmitModal] = useState(false);
  const [submitTitle, setSubmitTitle] = useState("");
  const [submitDescription, setSubmitDescription] = useState("");
  const [submitEmail, setSubmitEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitSuccess, setSubmitSuccess] = useState(false);

  useEffect(() => {
    setSessionId(getSessionId());
  }, []);

  useEffect(() => {
    async function fetchFeedback() {
      try {
        setLoading(true);
        const params: Record<string, string | number | undefined> = {
          slug,
          sessionId: sessionId || undefined,
          page: 1,
          pageSize: 50,
          status: statusFilter,
        };

        const response = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001"}/trpc/feedback.publicListBySlug?input=${encodeURIComponent(
            JSON.stringify({ json: params }),
          )}`,
        );

        if (!response.ok) {
          if (response.status === 404) {
            setError("Project not found");
          } else {
            setError("Failed to load feedback");
          }
          return;
        }

        const result = await response.json();
        setData(result.result?.data?.json);
      } catch (err) {
        setError("Failed to load feedback");
      } finally {
        setLoading(false);
      }
    }

    if (slug) {
      fetchFeedback();
    }
  }, [slug, sessionId, statusFilter]);

  const handleVote = async (itemId: string) => {
    if (!sessionId || votingItemId) return;

    const item = data?.data.find((i) => i.id === itemId);
    if (!item || item.hasVoted) return;

    setVotingItemId(itemId);

    // Optimistic update
    setData((prev) =>
      prev
        ? {
            ...prev,
            data: prev.data.map((item) =>
              item.id === itemId
                ? { ...item, hasVoted: true, voteCount: item.voteCount + 1 }
                : item,
            ),
          }
        : prev,
    );

    try {
      await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001"}/trpc/feedback.publicVote`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            json: { slug, feedbackItemId: itemId, sessionId },
          }),
        },
      );
    } catch (err) {
      // Revert on error
      setData((prev) =>
        prev
          ? {
              ...prev,
              data: prev.data.map((item) =>
                item.id === itemId
                  ? { ...item, hasVoted: false, voteCount: item.voteCount - 1 }
                  : item,
              ),
            }
          : prev,
      );
    } finally {
      setVotingItemId(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!submitTitle.trim() || submitting) return;

    setSubmitting(true);

    try {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001"}/trpc/feedback.publicSubmit`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            json: {
              slug,
              title: submitTitle.trim(),
              description: submitDescription.trim() || undefined,
              email: submitEmail.trim() || undefined,
              sessionId: sessionId || undefined,
            },
          }),
        },
      );

      if (response.ok) {
        setSubmitSuccess(true);
        setSubmitTitle("");
        setSubmitDescription("");
        setSubmitEmail("");
        // Refresh the list
        setTimeout(() => {
          setShowSubmitModal(false);
          setSubmitSuccess(false);
          setStatusFilter(undefined);
        }, 2000);
      }
    } catch (err) {
      // Error handling
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4">
        <AlertCircle className="h-12 w-12 text-muted-foreground" />
        <h1 className="text-xl font-semibold text-foreground">{error}</h1>
        <p className="text-muted-foreground">
          The feedback board you're looking for doesn't exist or has been
          removed.
        </p>
      </div>
    );
  }

  if (!data) {
    return null;
  }

  const items = data.data;
  const projectName = data.project.name;

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="border-b border-border/50 bg-card/30">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <span className="text-base font-medium text-foreground/90">
            {projectName} Feedback
          </span>
          <button
            onClick={() => setShowSubmitModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
          >
            <Plus className="h-4 w-4" />
            Submit Idea
          </button>
        </div>
      </header>

      {/* Hero */}
      <div className="py-12 px-6">
        <div className="max-w-xl mx-auto text-center">
          <Lightbulb className="h-10 w-10 text-amber-500 mx-auto mb-4" />
          <h1 className="text-2xl font-semibold text-foreground/90 mb-3">
            Feature Requests
          </h1>
          <p className="text-base text-muted-foreground">
            Vote on existing ideas or submit your own
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="max-w-4xl mx-auto px-6 mb-6">
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setStatusFilter(undefined)}
            className={cn(
              "px-3 py-1.5 rounded-full text-xs font-medium transition-colors",
              !statusFilter
                ? "bg-foreground/10 text-foreground"
                : "text-muted-foreground hover:bg-accent/50",
            )}
          >
            All
          </button>
          {Object.entries(statusConfig)
            .filter(([key]) => key !== "wont_do")
            .map(([key, config]) => (
              <button
                key={key}
                onClick={() => setStatusFilter(key)}
                className={cn(
                  "px-3 py-1.5 rounded-full text-xs font-medium transition-colors",
                  statusFilter === key
                    ? "bg-foreground/10 text-foreground"
                    : "text-muted-foreground hover:bg-accent/50",
                )}
              >
                {config.label}
              </button>
            ))}
        </div>
      </div>

      {/* Feedback List */}
      <div className="max-w-4xl mx-auto px-6 pb-12">
        <div className="space-y-3">
          {items.map((item) => {
            const status = statusConfig[item.status];
            const StatusIcon = status?.icon || MessageSquare;

            return (
              <div
                key={item.id}
                className="flex gap-4 p-4 rounded-lg border border-border/50 bg-card/30 hover:bg-card/50 transition-colors"
              >
                {/* Vote Button */}
                <button
                  onClick={() => handleVote(item.id)}
                  disabled={votingItemId === item.id || item.hasVoted}
                  className={cn(
                    "flex flex-col items-center justify-center w-14 h-14 rounded-lg border transition-colors shrink-0",
                    item.hasVoted
                      ? "bg-primary/10 border-primary/30 text-primary"
                      : "border-border/50 text-muted-foreground hover:bg-accent/50 hover:text-foreground",
                    votingItemId === item.id && "opacity-50",
                  )}
                >
                  {votingItemId === item.id ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <ChevronUp className="h-4 w-4" />
                      <span className="text-sm font-medium">
                        {item.voteCount}
                      </span>
                    </>
                  )}
                </button>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="text-sm font-medium text-foreground/90">
                      {item.title}
                    </h3>
                    <div
                      className={cn(
                        "flex items-center gap-1 px-2 py-0.5 rounded-full text-xs shrink-0",
                        status?.color,
                      )}
                    >
                      <StatusIcon className="h-3 w-3" />
                      <span>{status?.label}</span>
                    </div>
                  </div>
                  {item.description && (
                    <p className="text-xs text-muted-foreground/70 mt-1 line-clamp-2">
                      {item.description}
                    </p>
                  )}
                  {item.category && (
                    <span className="inline-block mt-2 px-2 py-0.5 bg-accent/50 text-xs text-muted-foreground rounded">
                      {item.category}
                    </span>
                  )}
                </div>
              </div>
            );
          })}

          {items.length === 0 && (
            <div className="text-center py-12">
              <Lightbulb className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" />
              <p className="text-muted-foreground">
                No feedback items yet. Be the first to submit an idea!
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-border/50 py-6 text-center">
        <p className="text-sm text-muted-foreground/50">
          Powered by <span className="text-muted-foreground/70">Relay</span>
        </p>
      </footer>

      {/* Submit Modal */}
      {showSubmitModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-card rounded-xl shadow-lg max-w-md w-full p-6">
            {submitSuccess ? (
              <div className="text-center py-8">
                <CheckCircle2 className="h-12 w-12 text-emerald-500 mx-auto mb-4" />
                <h2 className="text-lg font-semibold mb-2">Thank you!</h2>
                <p className="text-muted-foreground">
                  Your idea has been submitted.
                </p>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-lg font-semibold">Submit an Idea</h2>
                  <button
                    onClick={() => setShowSubmitModal(false)}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">
                      Title <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={submitTitle}
                      onChange={(e) => setSubmitTitle(e.target.value)}
                      placeholder="Brief title for your idea"
                      className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1">
                      Description
                    </label>
                    <textarea
                      value={submitDescription}
                      onChange={(e) => setSubmitDescription(e.target.value)}
                      placeholder="Describe your idea in more detail..."
                      rows={4}
                      className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1">
                      Email (optional)
                    </label>
                    <input
                      type="email"
                      value={submitEmail}
                      onChange={(e) => setSubmitEmail(e.target.value)}
                      placeholder="Get notified about updates"
                      className="w-full px-3 py-2 bg-background border border-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
                    />
                  </div>

                  <div className="flex gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => setShowSubmitModal(false)}
                      className="flex-1 px-4 py-2 border border-border rounded-lg text-sm font-medium hover:bg-accent/50 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={!submitTitle.trim() || submitting}
                      className="flex-1 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
                    >
                      {submitting ? (
                        <Loader2 className="h-4 w-4 animate-spin mx-auto" />
                      ) : (
                        "Submit"
                      )}
                    </button>
                  </div>
                </form>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

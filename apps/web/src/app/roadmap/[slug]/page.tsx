"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { ChevronUp, Loader2, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface RoadmapItem {
  id: string;
  title: string;
  description: string | null;
  status: "planned" | "in_progress" | "shipped";
  eta?: string | null;
  voteCount: number;
  hasVoted?: boolean;
}

interface RoadmapData {
  project: { name: string };
  data: RoadmapItem[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

const columns = [
  { key: "planned", label: "Planned", color: "bg-violet-400" },
  { key: "in_progress", label: "In Progress", color: "bg-amber-400" },
  { key: "shipped", label: "Shipped", color: "bg-emerald-400" },
];

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

export default function PublicRoadmapBySlugPage() {
  const params = useParams();
  const slug = params.slug as string;

  const [sessionId, setSessionId] = useState<string>("");
  const [data, setData] = useState<RoadmapData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [votingItemId, setVotingItemId] = useState<string | null>(null);

  useEffect(() => {
    setSessionId(getSessionId());
  }, []);

  useEffect(() => {
    async function fetchRoadmap() {
      try {
        setLoading(true);
        const response = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001"}/trpc/roadmap.publicListBySlug?input=${encodeURIComponent(
            JSON.stringify({
              json: {
                slug,
                sessionId: sessionId || undefined,
                page: 1,
                pageSize: 50,
              },
            }),
          )}`,
        );

        if (!response.ok) {
          if (response.status === 404) {
            setError("Project not found");
          } else {
            setError("Failed to load roadmap");
          }
          return;
        }

        const result = await response.json();
        setData(result.result?.data?.json);
      } catch (err) {
        setError("Failed to load roadmap");
      } finally {
        setLoading(false);
      }
    }

    if (slug) {
      fetchRoadmap();
    }
  }, [slug, sessionId]);

  const handleVote = async (itemId: string) => {
    if (!sessionId || votingItemId) return;

    setVotingItemId(itemId);

    // Optimistic update
    setData((prev) =>
      prev
        ? {
            ...prev,
            data: prev.data.map((item) =>
              item.id === itemId
                ? {
                    ...item,
                    hasVoted: !item.hasVoted,
                    voteCount: item.hasVoted
                      ? item.voteCount - 1
                      : item.voteCount + 1,
                  }
                : item,
            ),
          }
        : prev,
    );

    try {
      await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001"}/trpc/roadmap.publicVote`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            json: { slug, roadmapItemId: itemId, sessionId },
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
                  ? {
                      ...item,
                      hasVoted: !item.hasVoted,
                      voteCount: item.hasVoted
                        ? item.voteCount + 1
                        : item.voteCount - 1,
                    }
                  : item,
              ),
            }
          : prev,
      );
    } finally {
      setVotingItemId(null);
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
          The roadmap you're looking for doesn't exist or has been removed.
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
        <div className="max-w-6xl mx-auto px-6 py-4">
          <span className="text-base font-medium text-foreground/90">
            {projectName} Roadmap
          </span>
        </div>
      </header>

      {/* Hero */}
      <div className="py-12 px-6">
        <div className="max-w-xl mx-auto text-center">
          <h1 className="text-2xl font-semibold text-foreground/90 mb-3">
            What we're building
          </h1>
          <p className="text-base text-muted-foreground">
            See what's planned, in progress, and recently shipped
          </p>
        </div>
      </div>

      {/* Roadmap Board */}
      <div className="max-w-6xl mx-auto px-6 pb-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {columns.map((column) => (
            <div key={column.key}>
              {/* Column Header */}
              <div className="flex items-center gap-2 mb-4">
                <div className={`w-2 h-2 rounded-full ${column.color}`} />
                <h2 className="text-sm font-medium text-foreground/90">
                  {column.label}
                </h2>
                <span className="text-xs text-muted-foreground/50">
                  {items.filter((i) => i.status === column.key).length}
                </span>
              </div>

              {/* Cards */}
              <div className="space-y-3">
                {items
                  .filter((item) => item.status === column.key)
                  .map((item) => (
                    <div
                      key={item.id}
                      className="p-4 rounded-lg border border-border/50 bg-card/30 transition-colors hover:bg-card/50 hover:border-border"
                    >
                      <h3 className="text-sm font-medium text-foreground/90 mb-1.5">
                        {item.title}
                      </h3>
                      {item.description && (
                        <p className="text-xs text-muted-foreground/70 mb-3 leading-relaxed">
                          {item.description}
                        </p>
                      )}
                      <div className="flex items-center justify-between">
                        <button
                          onClick={() => handleVote(item.id)}
                          disabled={votingItemId === item.id}
                          className={cn(
                            "flex items-center gap-1 px-2 py-1 rounded-md text-xs transition-colors",
                            item.hasVoted
                              ? "bg-foreground/10 text-foreground"
                              : "text-muted-foreground/70 hover:bg-accent/50 hover:text-foreground",
                            votingItemId === item.id && "opacity-50",
                          )}
                        >
                          {votingItemId === item.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <ChevronUp className="h-3.5 w-3.5" />
                          )}
                          <span>{item.voteCount}</span>
                        </button>
                        {item.eta && (
                          <span className="text-xs text-muted-foreground/50">
                            {new Date(item.eta).toLocaleDateString("en-US", {
                              month: "short",
                              year: "numeric",
                            })}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}

                {items.filter((i) => i.status === column.key).length === 0 && (
                  <div className="p-4 rounded-lg border border-dashed border-border/50 text-center">
                    <p className="text-xs text-muted-foreground/50">
                      No items yet
                    </p>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-border/50 py-6 text-center">
        <p className="text-sm text-muted-foreground/50">
          Powered by <span className="text-muted-foreground/70">Relay</span>
        </p>
      </footer>
    </div>
  );
}

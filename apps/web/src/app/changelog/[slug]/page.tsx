"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import {
  Loader2,
  AlertCircle,
  Sparkles,
  Wrench,
  Bug,
  Info,
  PartyPopper,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface ChangelogItem {
  id: string;
  title: string;
  content: string;
  style: "info" | "success" | "warning" | "celebration" | null;
  image: string | null;
  actionLabel: string | null;
  actionUrl: string | null;
  createdAt: string;
}

interface ChangelogData {
  project: { name: string };
  items: ChangelogItem[];
  pagination: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

const styleConfig = {
  info: {
    label: "Update",
    icon: Info,
    color: "bg-blue-500/10 text-blue-500 border-blue-500/20",
  },
  success: {
    label: "Improvement",
    icon: Sparkles,
    color: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
  },
  warning: {
    label: "Fix",
    icon: Bug,
    color: "bg-amber-500/10 text-amber-500 border-amber-500/20",
  },
  celebration: {
    label: "New Feature",
    icon: PartyPopper,
    color: "bg-violet-500/10 text-violet-500 border-violet-500/20",
  },
};

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function groupByMonth(items: ChangelogItem[]): Record<string, ChangelogItem[]> {
  const groups: Record<string, ChangelogItem[]> = {};

  items.forEach((item) => {
    const date = new Date(item.createdAt);
    const key = date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
    });

    if (!groups[key]) {
      groups[key] = [];
    }
    groups[key].push(item);
  });

  return groups;
}

export default function PublicChangelogPage() {
  const params = useParams();
  const slug = params.slug as string;

  const [data, setData] = useState<ChangelogData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);

  useEffect(() => {
    async function fetchChangelog() {
      try {
        setLoading(true);
        const params: Record<string, unknown> = {
          slug,
          page: 1,
          pageSize: 50,
        };
        if (categoryFilter) {
          params.category = categoryFilter;
        }

        const response = await fetch(
          `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001"}/trpc/announcements.publicList?input=${encodeURIComponent(
            JSON.stringify({ json: params }),
          )}`,
        );

        if (!response.ok) {
          if (response.status === 404) {
            setError("Project not found");
          } else {
            setError("Failed to load changelog");
          }
          return;
        }

        const result = await response.json();
        setData(result.result?.data?.json);
      } catch (err) {
        setError("Failed to load changelog");
      } finally {
        setLoading(false);
      }
    }

    if (slug) {
      fetchChangelog();
    }
  }, [slug, categoryFilter]);

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
          The changelog you're looking for doesn't exist or has been removed.
        </p>
      </div>
    );
  }

  if (!data) {
    return null;
  }

  const items = data.items;
  const projectName = data.project.name;
  const groupedItems = groupByMonth(items);

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="border-b border-border/50 bg-card/30">
        <div className="max-w-3xl mx-auto px-6 py-4">
          <span className="text-base font-medium text-foreground/90">
            {projectName} Changelog
          </span>
        </div>
      </header>

      {/* Hero */}
      <div className="py-12 px-6">
        <div className="max-w-xl mx-auto text-center">
          <Sparkles className="h-10 w-10 text-violet-500 mx-auto mb-4" />
          <h1 className="text-2xl font-semibold text-foreground/90 mb-3">
            What's New
          </h1>
          <p className="text-base text-muted-foreground">
            Stay up to date with the latest updates and improvements
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="max-w-3xl mx-auto px-6 mb-8">
        <div className="flex flex-wrap gap-2 justify-center">
          <button
            onClick={() => setCategoryFilter(null)}
            className={cn(
              "px-3 py-1.5 rounded-full text-xs font-medium transition-colors",
              !categoryFilter
                ? "bg-foreground/10 text-foreground"
                : "text-muted-foreground hover:bg-accent/50",
            )}
          >
            All
          </button>
          {Object.entries(styleConfig).map(([key, config]) => (
            <button
              key={key}
              onClick={() => setCategoryFilter(key)}
              className={cn(
                "px-3 py-1.5 rounded-full text-xs font-medium transition-colors",
                categoryFilter === key
                  ? "bg-foreground/10 text-foreground"
                  : "text-muted-foreground hover:bg-accent/50",
              )}
            >
              {config.label}
            </button>
          ))}
        </div>
      </div>

      {/* Changelog List */}
      <div className="max-w-3xl mx-auto px-6 pb-12">
        {Object.entries(groupedItems).map(([month, monthItems]) => (
          <div key={month} className="mb-12">
            {/* Month Header */}
            <h2 className="text-lg font-semibold text-foreground/90 mb-6 sticky top-0 bg-background py-2">
              {month}
            </h2>

            {/* Items */}
            <div className="space-y-6 relative">
              {/* Timeline line */}
              <div className="absolute left-[7px] top-2 bottom-2 w-px bg-border/50" />

              {monthItems.map((item) => {
                const style = item.style
                  ? styleConfig[item.style]
                  : styleConfig.info;
                const StyleIcon = style?.icon || Info;

                return (
                  <div key={item.id} className="relative pl-8">
                    {/* Timeline dot */}
                    <div className="absolute left-0 top-1.5 w-[15px] h-[15px] rounded-full bg-background border-2 border-border flex items-center justify-center">
                      <div className="w-2 h-2 rounded-full bg-foreground/30" />
                    </div>

                    {/* Content */}
                    <article className="p-5 rounded-lg border border-border/50 bg-card/30 hover:bg-card/50 transition-colors">
                      {/* Date and Category */}
                      <div className="flex items-center gap-3 mb-3">
                        <time className="text-xs text-muted-foreground">
                          {formatDate(item.createdAt)}
                        </time>
                        <span
                          className={cn(
                            "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border",
                            style?.color,
                          )}
                        >
                          <StyleIcon className="h-3 w-3" />
                          {style?.label}
                        </span>
                      </div>

                      {/* Title */}
                      <h3 className="text-base font-medium text-foreground/90 mb-2">
                        {item.title}
                      </h3>

                      {/* Image */}
                      {item.image && (
                        <div className="mb-3 rounded-lg overflow-hidden border border-border/50">
                          <img
                            src={item.image}
                            alt={item.title}
                            className="w-full h-auto"
                          />
                        </div>
                      )}

                      {/* Content - render as markdown if needed */}
                      <div className="text-sm text-muted-foreground leading-relaxed prose prose-sm max-w-none">
                        {item.content.split("\n").map((paragraph, i) => (
                          <p key={i} className="mb-2 last:mb-0">
                            {paragraph}
                          </p>
                        ))}
                      </div>

                      {/* Action Button */}
                      {item.actionUrl && (
                        <a
                          href={item.actionUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center mt-4 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
                        >
                          {item.actionLabel || "Learn more"}
                        </a>
                      )}
                    </article>
                  </div>
                );
              })}
            </div>
          </div>
        ))}

        {items.length === 0 && (
          <div className="text-center py-12">
            <Sparkles className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" />
            <p className="text-muted-foreground">
              No changelog entries yet. Check back soon!
            </p>
          </div>
        )}
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

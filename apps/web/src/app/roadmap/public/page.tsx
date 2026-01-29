'use client';

import { useState } from 'react';
import { ChevronUp } from 'lucide-react';
import { cn } from '@/lib/utils';

interface RoadmapItem {
  id: string;
  title: string;
  description: string;
  status: 'planned' | 'in_progress' | 'shipped';
  eta?: string;
  voteCount: number;
  hasVoted?: boolean;
}

const publicRoadmap: RoadmapItem[] = [
  {
    id: '1',
    title: 'Mobile SDK (iOS & Android)',
    description: 'Native SDKs for iOS and Android applications with full feature parity.',
    status: 'in_progress',
    eta: '2024-Q2',
    voteCount: 23,
    hasVoted: false,
  },
  {
    id: '2',
    title: 'GitHub Integration',
    description: 'Create GitHub issues directly from bug reports with bidirectional sync.',
    status: 'planned',
    eta: '2024-Q2',
    voteCount: 15,
    hasVoted: true,
  },
  {
    id: '3',
    title: 'Advanced Analytics Dashboard',
    description: 'Comprehensive analytics with trends, user segments, and custom reports.',
    status: 'planned',
    eta: '2024-Q3',
    voteCount: 31,
    hasVoted: false,
  },
  {
    id: '4',
    title: 'Session Replay',
    description: 'Full DOM replay of user sessions with privacy controls.',
    status: 'shipped',
    voteCount: 45,
    hasVoted: true,
  },
  {
    id: '5',
    title: 'AI Auto-Labeling',
    description: 'Automatically categorize and label incoming bug reports using AI.',
    status: 'shipped',
    voteCount: 12,
    hasVoted: false,
  },
];

const columns = [
  { key: 'planned', label: 'Planned', color: 'bg-violet-400' },
  { key: 'in_progress', label: 'In Progress', color: 'bg-amber-400' },
  { key: 'shipped', label: 'Shipped', color: 'bg-emerald-400' },
];

export default function PublicRoadmapPage() {
  const [items, setItems] = useState(publicRoadmap);

  const handleVote = (id: string) => {
    setItems((prev) =>
      prev.map((item) =>
        item.id === id
          ? {
              ...item,
              hasVoted: !item.hasVoted,
              voteCount: item.hasVoted ? item.voteCount - 1 : item.voteCount + 1,
            }
          : item
      )
    );
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="border-b border-border/50 bg-card/30">
        <div className="max-w-6xl mx-auto px-6 py-4">
          <span className="text-base font-medium text-foreground/90">Product Roadmap</span>
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
                <h2 className="text-sm font-medium text-foreground/90">{column.label}</h2>
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
                      <p className="text-xs text-muted-foreground/70 mb-3 leading-relaxed">
                        {item.description}
                      </p>
                      <div className="flex items-center justify-between">
                        <button
                          onClick={() => handleVote(item.id)}
                          className={cn(
                            'flex items-center gap-1 px-2 py-1 rounded-md text-xs transition-colors',
                            item.hasVoted
                              ? 'bg-foreground/10 text-foreground'
                              : 'text-muted-foreground/70 hover:bg-accent/50 hover:text-foreground'
                          )}
                        >
                          <ChevronUp className="h-3.5 w-3.5" />
                          <span>{item.voteCount}</span>
                        </button>
                        {item.eta && (
                          <span className="text-xs text-muted-foreground/50">{item.eta}</span>
                        )}
                      </div>
                    </div>
                  ))}

                {items.filter((i) => i.status === column.key).length === 0 && (
                  <div className="p-4 rounded-lg border border-dashed border-border/50 text-center">
                    <p className="text-xs text-muted-foreground/50">No items yet</p>
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

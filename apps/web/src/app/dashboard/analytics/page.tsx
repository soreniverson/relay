"use client";

import { useState } from "react";
import { useAuthStore } from "@/stores/auth";
import { trpc } from "@/lib/trpc";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  Loader2,
  TrendingUp,
  TrendingDown,
  Bug,
  MessageSquare,
  Users,
  Activity,
  BarChart3,
  Clock,
  CheckCircle,
} from "lucide-react";

type Period = "7d" | "30d" | "90d";

export default function AnalyticsPage() {
  const { currentProject } = useAuthStore();
  const [period, setPeriod] = useState<Period>("30d");

  const { data: overview, isLoading: overviewLoading } =
    trpc.analytics.getOverview.useQuery(
      { projectId: currentProject?.id || "", period },
      { enabled: !!currentProject?.id }
    );

  const { data: timeSeries, isLoading: timeSeriesLoading } =
    trpc.analytics.getTimeSeries.useQuery(
      { projectId: currentProject?.id || "", period, metric: "interactions" },
      { enabled: !!currentProject?.id }
    );

  const { data: interactionBreakdown } =
    trpc.analytics.getInteractionBreakdown.useQuery(
      { projectId: currentProject?.id || "", period },
      { enabled: !!currentProject?.id }
    );

  const { data: severityData } = trpc.analytics.getBugSeverity.useQuery(
    { projectId: currentProject?.id || "", period },
    { enabled: !!currentProject?.id }
  );

  const { data: statusData } = trpc.analytics.getStatusDistribution.useQuery(
    { projectId: currentProject?.id || "", period },
    { enabled: !!currentProject?.id }
  );

  const { data: resolutionMetrics } =
    trpc.analytics.getResolutionMetrics.useQuery(
      { projectId: currentProject?.id || "", period },
      { enabled: !!currentProject?.id }
    );

  const { data: topFeedback } = trpc.analytics.getTopFeedback.useQuery(
    { projectId: currentProject?.id || "", limit: 5 },
    { enabled: !!currentProject?.id }
  );

  const isLoading = overviewLoading || timeSeriesLoading;

  const periodLabels: Record<Period, string> = {
    "7d": "Last 7 days",
    "30d": "Last 30 days",
    "90d": "Last 90 days",
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header */}
      <div className="page-header">
        <h1 className="page-title">Analytics</h1>
        <Select value={period} onValueChange={(v) => setPeriod(v as Period)}>
          <SelectTrigger className="w-36 h-7 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="7d">Last 7 days</SelectItem>
            <SelectItem value="30d">Last 30 days</SelectItem>
            <SelectItem value="90d">Last 90 days</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-4 space-y-4">
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            {/* Overview Stats */}
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
              <StatCard
                label="Total Interactions"
                value={overview?.interactions.count || 0}
                change={overview?.interactions.change || 0}
                icon={<Activity className="h-4 w-4" />}
              />
              <StatCard
                label="Bug Reports"
                value={overview?.bugs.count || 0}
                change={overview?.bugs.change || 0}
                icon={<Bug className="h-4 w-4" />}
              />
              <StatCard
                label="Feedback"
                value={overview?.feedback.count || 0}
                change={overview?.feedback.change || 0}
                icon={<MessageSquare className="h-4 w-4" />}
              />
              <StatCard
                label="Conversations"
                value={overview?.conversations.count || 0}
                change={overview?.conversations.change || 0}
                icon={<MessageSquare className="h-4 w-4" />}
              />
              <StatCard
                label="Sessions"
                value={overview?.sessions.count || 0}
                change={overview?.sessions.change || 0}
                icon={<BarChart3 className="h-4 w-4" />}
              />
              <StatCard
                label="New Users"
                value={overview?.users.count || 0}
                change={overview?.users.change || 0}
                icon={<Users className="h-4 w-4" />}
              />
            </div>

            {/* Charts Row */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Time Series Chart */}
              <div
                className="border border-border rounded-lg p-4"
                style={{ borderWidth: "0.5px" }}
              >
                <h3 className="text-sm font-medium text-foreground mb-4">
                  Interactions Over Time
                </h3>
                <div className="h-48">
                  {timeSeries && timeSeries.length > 0 ? (
                    <SimpleLineChart data={timeSeries} />
                  ) : (
                    <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
                      No data available
                    </div>
                  )}
                </div>
              </div>

              {/* Interaction Type Breakdown */}
              <div
                className="border border-border rounded-lg p-4"
                style={{ borderWidth: "0.5px" }}
              >
                <h3 className="text-sm font-medium text-foreground mb-4">
                  Interaction Types
                </h3>
                <div className="space-y-2">
                  {interactionBreakdown?.map((item) => (
                    <ProgressBar
                      key={item.type}
                      label={formatType(item.type)}
                      value={item.count}
                      total={
                        interactionBreakdown.reduce((sum, i) => sum + i.count, 0) ||
                        1
                      }
                      color={getTypeColor(item.type)}
                    />
                  ))}
                  {(!interactionBreakdown || interactionBreakdown.length === 0) && (
                    <div className="text-muted-foreground text-sm text-center py-4">
                      No data available
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Second Row */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Bug Severity */}
              <div
                className="border border-border rounded-lg p-4"
                style={{ borderWidth: "0.5px" }}
              >
                <h3 className="text-sm font-medium text-foreground mb-4">
                  Bug Severity
                </h3>
                <div className="space-y-2">
                  {severityData?.map((item) => (
                    <ProgressBar
                      key={item.severity}
                      label={formatSeverity(item.severity)}
                      value={item.count}
                      total={severityData.reduce((sum, i) => sum + i.count, 0) || 1}
                      color={getSeverityColor(item.severity)}
                    />
                  ))}
                  {(!severityData || severityData.length === 0) && (
                    <div className="text-muted-foreground text-sm text-center py-4">
                      No bugs reported
                    </div>
                  )}
                </div>
              </div>

              {/* Status Distribution */}
              <div
                className="border border-border rounded-lg p-4"
                style={{ borderWidth: "0.5px" }}
              >
                <h3 className="text-sm font-medium text-foreground mb-4">
                  Status Distribution
                </h3>
                <div className="space-y-2">
                  {statusData?.map((item) => (
                    <ProgressBar
                      key={item.status}
                      label={formatStatus(item.status)}
                      value={item.count}
                      total={statusData.reduce((sum, i) => sum + i.count, 0) || 1}
                      color={getStatusColor(item.status)}
                    />
                  ))}
                  {(!statusData || statusData.length === 0) && (
                    <div className="text-muted-foreground text-sm text-center py-4">
                      No data available
                    </div>
                  )}
                </div>
              </div>

              {/* Resolution Metrics */}
              <div
                className="border border-border rounded-lg p-4"
                style={{ borderWidth: "0.5px" }}
              >
                <h3 className="text-sm font-medium text-foreground mb-4">
                  Resolution Metrics
                </h3>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Clock className="h-4 w-4" />
                      Avg Resolution Time
                    </div>
                    <span className="text-sm font-medium text-foreground">
                      {resolutionMetrics?.avgResolutionTimeHours || 0}h
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <CheckCircle className="h-4 w-4" />
                      Resolved
                    </div>
                    <span className="text-sm font-medium text-foreground">
                      {resolutionMetrics?.resolvedCount || 0}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Activity className="h-4 w-4" />
                      Pending
                    </div>
                    <span className="text-sm font-medium text-foreground">
                      {resolutionMetrics?.pendingCount || 0}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Top Feedback */}
            <div
              className="border border-border rounded-lg p-4"
              style={{ borderWidth: "0.5px" }}
            >
              <h3 className="text-sm font-medium text-foreground mb-4">
                Top Feedback by Votes
              </h3>
              {topFeedback && topFeedback.length > 0 ? (
                <div className="space-y-2">
                  {topFeedback.map((item, index) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between p-2 rounded-md hover:bg-accent/30 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-muted-foreground w-4">
                          #{index + 1}
                        </span>
                        <span className="text-sm text-foreground truncate max-w-md">
                          {item.title}
                        </span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span
                          className={cn(
                            "text-xs px-1.5 py-0.5 rounded",
                            item.status === "shipped"
                              ? "bg-emerald-500/10 text-emerald-400"
                              : item.status === "in_progress"
                                ? "bg-blue-500/10 text-blue-400"
                                : item.status === "planned"
                                  ? "bg-amber-500/10 text-amber-400"
                                  : "bg-muted text-muted-foreground"
                          )}
                        >
                          {formatFeedbackStatus(item.status)}
                        </span>
                        <span className="text-sm font-medium text-foreground">
                          {item.voteCount} votes
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-muted-foreground text-sm text-center py-8">
                  No feedback items yet
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// Stat Card Component
function StatCard({
  label,
  value,
  change,
  icon,
}: {
  label: string;
  value: number;
  change: number;
  icon: React.ReactNode;
}) {
  const isPositive = change >= 0;

  return (
    <div
      className="border border-border rounded-lg p-3"
      style={{ borderWidth: "0.5px" }}
    >
      <div className="flex items-center justify-between mb-2">
        <span className="text-muted-foreground">{icon}</span>
        {change !== 0 && (
          <div
            className={cn(
              "flex items-center gap-0.5 text-xs",
              isPositive ? "text-emerald-400" : "text-red-400"
            )}
          >
            {isPositive ? (
              <TrendingUp className="h-3 w-3" />
            ) : (
              <TrendingDown className="h-3 w-3" />
            )}
            {Math.abs(change)}%
          </div>
        )}
      </div>
      <div className="text-xl font-semibold text-foreground">
        {value.toLocaleString()}
      </div>
      <div className="text-xs text-muted-foreground mt-0.5">{label}</div>
    </div>
  );
}

// Simple Line Chart (SVG-based)
function SimpleLineChart({ data }: { data: { date: string; count: number }[] }) {
  const maxValue = Math.max(...data.map((d) => d.count), 1);
  const width = 100;
  const height = 40;
  const padding = 2;

  const points = data.map((d, i) => {
    const x = padding + (i / (data.length - 1 || 1)) * (width - 2 * padding);
    const y = height - padding - (d.count / maxValue) * (height - 2 * padding);
    return `${x},${y}`;
  });

  const areaPoints = [
    `${padding},${height - padding}`,
    ...points,
    `${width - padding},${height - padding}`,
  ].join(" ");

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-full">
      {/* Area fill */}
      <polygon
        points={areaPoints}
        fill="hsl(var(--primary))"
        fillOpacity="0.1"
      />
      {/* Line */}
      <polyline
        points={points.join(" ")}
        fill="none"
        stroke="hsl(var(--primary))"
        strokeWidth="0.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Dots for key points */}
      {data.length <= 14 &&
        data.map((d, i) => {
          const x = padding + (i / (data.length - 1 || 1)) * (width - 2 * padding);
          const y =
            height - padding - (d.count / maxValue) * (height - 2 * padding);
          return (
            <circle
              key={i}
              cx={x}
              cy={y}
              r="0.8"
              fill="hsl(var(--primary))"
            />
          );
        })}
    </svg>
  );
}

// Progress Bar Component
function ProgressBar({
  label,
  value,
  total,
  color,
}: {
  label: string;
  value: number;
  total: number;
  color: string;
}) {
  const percent = Math.round((value / total) * 100);

  return (
    <div>
      <div className="flex items-center justify-between text-xs mb-1">
        <span className="text-muted-foreground">{label}</span>
        <span className="text-foreground font-medium">
          {value} ({percent}%)
        </span>
      </div>
      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
        <div
          className={cn("h-full rounded-full transition-all", color)}
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}

// Helper functions
function formatType(type: string): string {
  const labels: Record<string, string> = {
    bug: "Bug Reports",
    feedback: "Feedback",
    chat: "Chat",
    survey: "Survey",
    replay: "Replay",
    system: "System",
  };
  return labels[type] || type;
}

function getTypeColor(type: string): string {
  const colors: Record<string, string> = {
    bug: "bg-red-500",
    feedback: "bg-blue-500",
    chat: "bg-emerald-500",
    survey: "bg-purple-500",
    replay: "bg-amber-500",
    system: "bg-gray-500",
  };
  return colors[type] || "bg-gray-500";
}

function formatSeverity(severity: string): string {
  const labels: Record<string, string> = {
    critical: "Critical",
    high: "High",
    med: "Medium",
    low: "Low",
    unset: "Unset",
  };
  return labels[severity] || severity;
}

function getSeverityColor(severity: string): string {
  const colors: Record<string, string> = {
    critical: "bg-red-600",
    high: "bg-red-500",
    med: "bg-amber-500",
    low: "bg-blue-500",
    unset: "bg-gray-500",
  };
  return colors[severity] || "bg-gray-500";
}

function formatStatus(status: string): string {
  const labels: Record<string, string> = {
    new: "New",
    triaging: "Triaging",
    in_progress: "In Progress",
    resolved: "Resolved",
    closed: "Closed",
  };
  return labels[status] || status;
}

function getStatusColor(status: string): string {
  const colors: Record<string, string> = {
    new: "bg-blue-500",
    triaging: "bg-amber-500",
    in_progress: "bg-purple-500",
    resolved: "bg-emerald-500",
    closed: "bg-gray-500",
  };
  return colors[status] || "bg-gray-500";
}

function formatFeedbackStatus(status: string): string {
  const labels: Record<string, string> = {
    under_review: "Under Review",
    planned: "Planned",
    in_progress: "In Progress",
    shipped: "Shipped",
    wont_do: "Won't Do",
  };
  return labels[status] || status;
}

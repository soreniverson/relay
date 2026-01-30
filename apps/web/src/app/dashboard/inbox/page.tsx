"use client";

import { useState, useEffect } from "react";
import { useAuthStore } from "@/stores/auth";
import { trpc } from "@/lib/trpc";
import {
  cn,
  formatRelativeTime,
  severityColors,
  statusColors,
} from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Search,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Eye,
  MoreHorizontal,
  CheckCircle,
  AlertCircle,
  Play,
  Bug,
  Lightbulb,
  MessageSquare,
  ClipboardList,
  User,
  Monitor,
  Globe,
  Clock,
  Tag,
  ExternalLink,
  ChevronDown,
  Loader2,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ApiError, EmptyState } from "@/components/api-error";
import { ReplayModal } from "@/components/replay-modal";
import { OnboardingBanner } from "@/components/onboarding-banner";

type InteractionType =
  | "bug"
  | "feedback"
  | "chat"
  | "survey"
  | "replay"
  | "system";
type InteractionStatus =
  | "new"
  | "triaging"
  | "in_progress"
  | "resolved"
  | "closed";
type Severity = "low" | "med" | "high" | "critical";

interface Interaction {
  id: string;
  type: InteractionType;
  status: InteractionStatus;
  severity: Severity | null;
  contentText: string | null;
  content: {
    title?: string;
    description?: string;
  } | null;
  tags: string[];
  createdAt: string;
  user: {
    id: string;
    email: string | null;
    name: string | null;
  } | null;
  hasReplay: boolean;
  hasLogs: boolean;
  aiSummary: string | null;
  metadata?: {
    browser?: string;
    os?: string;
    url?: string;
    screenSize?: string;
  };
  assignee?: {
    name: string;
    email: string;
  } | null;
  linkedIssueProvider?: string | null;
  linkedIssueId?: string | null;
  linkedIssueUrl?: string | null;
}

const typeConfig: Record<
  InteractionType,
  { icon: typeof Bug; label: string; color: string }
> = {
  bug: { icon: Bug, label: "Bug", color: "text-muted-foreground" },
  feedback: {
    icon: Lightbulb,
    label: "Feedback",
    color: "text-muted-foreground",
  },
  chat: { icon: MessageSquare, label: "Chat", color: "text-muted-foreground" },
  survey: {
    icon: ClipboardList,
    label: "Survey",
    color: "text-muted-foreground",
  },
  replay: { icon: Play, label: "Replay", color: "text-muted-foreground" },
  system: { icon: Monitor, label: "System", color: "text-muted-foreground" },
};

const typeFilters: { key: InteractionType | "all"; label: string }[] = [
  { key: "all", label: "Type" },
  { key: "bug", label: "Bugs" },
  { key: "feedback", label: "Feedback" },
  { key: "chat", label: "Chat" },
  { key: "survey", label: "Surveys" },
];

const statusFilters: { key: InteractionStatus | "all"; label: string }[] = [
  { key: "all", label: "Status" },
  { key: "new", label: "New" },
  { key: "triaging", label: "Triaging" },
  { key: "in_progress", label: "In Progress" },
  { key: "resolved", label: "Resolved" },
  { key: "closed", label: "Closed" },
];

export default function InboxPage() {
  const { currentProject } = useAuthStore();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<InteractionType | "all">("all");
  const [statusFilter, setStatusFilter] = useState<InteractionStatus | "all">(
    "all",
  );

  const utils = trpc.useUtils();

  // Fetch interactions from API
  const { data, isLoading, error, refetch } = trpc.interactions.inbox.useQuery(
    {
      projectId: currentProject?.id || "",
      page,
      pageSize: 50,
      types: typeFilter === "all" ? undefined : [typeFilter],
      statuses: statusFilter === "all" ? undefined : [statusFilter],
      search: search || undefined,
      field: "createdAt",
      direction: "desc",
    },
    {
      enabled: !!currentProject?.id,
      refetchInterval: 30000, // Refresh every 30 seconds
    },
  );

  // Mutations
  const updateStatusMutation = trpc.interactions.updateStatus.useMutation({
    onSuccess: () => {
      utils.interactions.inbox.invalidate();
    },
  });

  const updateTagsMutation = trpc.interactions.updateTags.useMutation({
    onSuccess: () => {
      utils.interactions.inbox.invalidate();
    },
  });

  const assignMutation = trpc.interactions.assign.useMutation({
    onSuccess: () => {
      utils.interactions.inbox.invalidate();
    },
  });

  const interactions = data?.data || [];
  const pagination = data?.pagination;

  const handleStatusChange = (id: string, newStatus: InteractionStatus) => {
    if (!currentProject?.id) return;
    updateStatusMutation.mutate({
      projectId: currentProject.id,
      interactionId: id,
      status: newStatus,
    });
  };

  const handleDelete = (id: string) => {
    // Mark as closed instead of deleting
    handleStatusChange(id, "closed");
    if (selectedId === id) setSelectedId(null);
  };

  const handleAssign = (
    id: string,
    assignee: { name: string; email: string } | null,
  ) => {
    if (!currentProject?.id) return;
    // Note: assigneeId would need to be fetched from team members
    // For now, we'll skip this - needs proper team member lookup
  };

  const handleAddTags = (id: string, tags: string[]) => {
    if (!currentProject?.id) return;
    updateTagsMutation.mutate({
      projectId: currentProject.id,
      interactionId: id,
      tags,
    });
  };

  const handleSendMessage = (id: string, message: string) => {
    // TODO: Implement via conversations router
  };

  // Map API data to Interaction type
  const mappedInteractions: Interaction[] = interactions.map((i) => ({
    id: i.id,
    type: i.type as InteractionType,
    status: i.status as InteractionStatus,
    severity: i.severity as Severity | null,
    contentText: i.contentText,
    content: i.content as { title?: string; description?: string } | null,
    tags: i.tags,
    createdAt: new Date(i.createdAt).toISOString(),
    user: i.user
      ? {
          id: i.user.id,
          email: i.user.email,
          name: i.user.name,
        }
      : null,
    hasReplay: i.hasReplay,
    hasLogs: i.hasLogs,
    aiSummary: i.aiSummary,
    metadata: i.session?.device as Interaction["metadata"],
    linkedIssueProvider: i.linkedIssueProvider,
    linkedIssueId: i.linkedIssueId,
    linkedIssueUrl: i.linkedIssueUrl,
  }));

  // Auto-select first item if nothing selected
  useEffect(() => {
    if (!selectedId && mappedInteractions.length > 0) {
      setSelectedId(mappedInteractions[0].id);
    } else if (
      selectedId &&
      !mappedInteractions.find((i) => i.id === selectedId) &&
      mappedInteractions.length > 0
    ) {
      setSelectedId(mappedInteractions[0].id);
    }
  }, [mappedInteractions, selectedId]);

  const selectedInteraction = mappedInteractions.find(
    (i) => i.id === selectedId,
  );

  // No project selected state
  if (!currentProject) {
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground">
        <div className="text-center">
          <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-50" />
          <p>Select a project to view inbox</p>
        </div>
      </div>
    );
  }

  // Loading state
  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <ApiError
        error={error}
        onRetry={() => refetch()}
        title="Failed to load inbox"
      />
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Onboarding Banner */}
      <OnboardingBanner />

      <div className="flex flex-1 overflow-hidden">
        {/* List Panel */}
        <div
          className="w-1/2 border-r border-border flex flex-col"
          style={{ borderRightWidth: "0.5px" }}
        >
          {/* Header */}
          <div className="page-header">
            <h1 className="page-title">Inbox</h1>
            <button
              className="p-1.5 text-muted-foreground hover:text-foreground transition-colors"
              onClick={() => refetch()}
            >
              <RefreshCw
                className={cn("h-3.5 w-3.5", isLoading && "animate-spin")}
              />
            </button>
          </div>

          {/* Search and Filters */}
          <div
            className="flex items-center gap-3 px-4 py-2 border-b border-border"
            style={{ borderBottomWidth: "0.5px" }}
          >
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/50" />
              <Input
                placeholder="Search..."
                className="pl-8 h-7 text-xs bg-transparent border-0 focus-visible:ring-0 focus-visible:ring-offset-0 placeholder:text-muted-foreground/50"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-4">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
                    {typeFilters.find((t) => t.key === typeFilter)?.label}
                    <ChevronDown className="h-3 w-3" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {typeFilters.map((filter) => (
                    <DropdownMenuItem
                      key={filter.key}
                      onClick={() => setTypeFilter(filter.key)}
                    >
                      {filter.label}
                      {filter.key === typeFilter && (
                        <span className="ml-auto text-foreground">✓</span>
                      )}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
                    {statusFilters.find((s) => s.key === statusFilter)?.label}
                    <ChevronDown className="h-3 w-3" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {statusFilters.map((filter) => (
                    <DropdownMenuItem
                      key={filter.key}
                      onClick={() => setStatusFilter(filter.key)}
                    >
                      {filter.label}
                      {filter.key === statusFilter && (
                        <span className="ml-auto text-foreground">✓</span>
                      )}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          {/* List */}
          <div className="flex-1 overflow-auto">
            {mappedInteractions.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                <Search className="h-12 w-12 mb-4 opacity-50" />
                <p>No interactions found</p>
                <p className="text-sm">Try adjusting your filters</p>
              </div>
            ) : (
              mappedInteractions.map((interaction) => {
                const TypeIcon = typeConfig[interaction.type].icon;
                const isUnread = interaction.status === "new";
                const showSeverity = interaction.severity === "critical";

                return (
                  <div
                    key={interaction.id}
                    className={cn(
                      "border-b border-border px-4 py-3 cursor-pointer transition-colors hover:bg-accent/30",
                      selectedId === interaction.id && "bg-accent/40",
                    )}
                    style={{ borderBottomWidth: "0.5px" }}
                    onClick={() => setSelectedId(interaction.id)}
                  >
                    <div className="flex gap-3">
                      <div className="shrink-0 h-8 w-8 rounded-md bg-muted/50 border border-border/50 flex items-center justify-center text-muted-foreground">
                        <TypeIcon className="h-4 w-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        {/* Row 1: Title */}
                        <p
                          className={cn(
                            "text-sm truncate",
                            isUnread
                              ? "text-foreground"
                              : "text-muted-foreground",
                          )}
                        >
                          {interaction.content?.title ||
                            interaction.contentText?.slice(0, 50)}
                        </p>
                        {/* Row 2: User + Timestamp + Severity (if critical) */}
                        <div className="flex items-center justify-between mt-0.5">
                          <div className="flex items-center gap-1.5">
                            <span
                              className={cn(
                                "text-xs",
                                isUnread
                                  ? "text-muted-foreground"
                                  : "text-muted-foreground/70",
                              )}
                            >
                              {interaction.user?.name ||
                                interaction.user?.email ||
                                "Anonymous"}
                            </span>
                            <span className="text-muted-foreground/40">·</span>
                            <span className="text-xs text-muted-foreground/50">
                              {formatRelativeTime(interaction.createdAt)}
                            </span>
                          </div>
                          {showSeverity && (
                            <span
                              className={cn(
                                "text-[11px] leading-none px-1.5 py-1 rounded",
                                severityColors[interaction.severity!],
                              )}
                            >
                              {interaction.severity}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Pagination */}
          <div className="px-4 py-2 flex items-center justify-between">
            <span className="text-xs text-muted-foreground/70">
              {mappedInteractions.length} of {pagination?.total || 0}
            </span>
            <div className="flex items-center gap-1">
              <button
                disabled={page === 1}
                onClick={() => setPage(page - 1)}
                className="p-1 text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:hover:text-muted-foreground transition-colors"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="text-xs text-muted-foreground tabular-nums px-1">
                {page} / {pagination?.totalPages || 1}
              </span>
              <button
                disabled={!pagination?.hasMore}
                onClick={() => setPage(page + 1)}
                className="p-1 text-muted-foreground hover:text-foreground disabled:opacity-30 disabled:hover:text-muted-foreground transition-colors"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Detail Panel */}
        <div className="w-1/2 flex flex-col bg-background">
          {selectedInteraction ? (
            <InteractionDetail
              interaction={selectedInteraction}
              onStatusChange={handleStatusChange}
              onDelete={handleDelete}
              onAssign={handleAssign}
              onAddTags={handleAddTags}
              onSendMessage={handleSendMessage}
            />
          ) : (
            <div className="flex-1 flex items-center justify-center text-muted-foreground">
              <div className="text-center">
                <Eye className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>Select an interaction to view details</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const teamMembers = [
  { id: "1", name: "Alice Support", email: "alice@relay.dev" },
  { id: "2", name: "Bob Wilson", email: "bob@relay.dev" },
  { id: "3", name: "Carol Davis", email: "carol@relay.dev" },
  { id: "4", name: "David Chen", email: "david@relay.dev" },
];

const availableTags = [
  "urgent",
  "bug",
  "feature-request",
  "support",
  "billing",
  "mobile",
  "desktop",
  "api",
  "ui",
  "performance",
  "security",
];

function InteractionDetail({
  interaction,
  onStatusChange,
  onDelete,
  onAssign,
  onAddTags,
  onSendMessage,
}: {
  interaction: Interaction;
  onStatusChange: (id: string, status: InteractionStatus) => void;
  onDelete: (id: string) => void;
  onAssign: (
    id: string,
    assignee: { name: string; email: string } | null,
  ) => void;
  onAddTags: (id: string, tags: string[]) => void;
  onSendMessage: (id: string, message: string) => void;
}) {
  const { currentProject } = useAuthStore();
  const TypeIcon = typeConfig[interaction.type].icon;
  const [showReplayModal, setShowReplayModal] = useState(false);
  const [showLogsModal, setShowLogsModal] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [showTagsModal, setShowTagsModal] = useState(false);
  const [selectedTags, setSelectedTags] = useState<string[]>(interaction.tags);
  const [chatMessage, setChatMessage] = useState("");
  const [showTechnical, setShowTechnical] = useState(false);
  const [showLinearModal, setShowLinearModal] = useState(false);
  const [selectedTeamId, setSelectedTeamId] = useState<string>("");
  const [selectedLabelIds, setSelectedLabelIds] = useState<string[]>([]);
  const [linearPriority, setLinearPriority] = useState<number>(3);

  const utils = trpc.useUtils();

  // Check if Linear is connected
  const { data: integrations } = trpc.integrations.list.useQuery(
    { projectId: currentProject?.id || "" },
    { enabled: !!currentProject?.id }
  );
  const linearConnected = integrations?.find(i => i.provider === "linear")?.configured &&
                          integrations?.find(i => i.provider === "linear")?.enabled;

  // Fetch Linear teams when modal opens
  const { data: linearTeams, isLoading: teamsLoading } = trpc.integrations.getLinearTeams.useQuery(
    { projectId: currentProject?.id || "" },
    { enabled: !!currentProject?.id && showLinearModal && !!linearConnected }
  );

  // Fetch labels for selected team
  const { data: linearLabels } = trpc.integrations.getLinearLabels.useQuery(
    { projectId: currentProject?.id || "", teamId: selectedTeamId },
    { enabled: !!currentProject?.id && !!selectedTeamId && showLinearModal }
  );

  // Auto-select first team when teams load
  useEffect(() => {
    if (linearTeams && linearTeams.length > 0 && !selectedTeamId) {
      setSelectedTeamId(linearTeams[0].id);
    }
  }, [linearTeams, selectedTeamId]);

  // Create Linear issue mutation
  const createLinearIssueMutation = trpc.integrations.syncLinearIssue.useMutation({
    onSuccess: () => {
      setShowLinearModal(false);
      utils.interactions.inbox.invalidate();
    },
  });

  const statuses: InteractionStatus[] = [
    "new",
    "triaging",
    "in_progress",
    "resolved",
    "closed",
  ];

  return (
    <>
      {/* Header - Compact with title as anchor */}
      <div
        className="border-b border-border px-4 py-3"
        style={{ borderBottomWidth: "0.5px" }}
      >
        {/* Row 1: Title + Actions */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-2.5 min-w-0 flex-1">
            <div className="shrink-0 h-8 w-8 rounded-md bg-muted/50 border border-border/50 flex items-center justify-center text-muted-foreground">
              <TypeIcon className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="text-sm font-medium text-foreground leading-snug">
                {interaction.content?.title || "Untitled"}
              </h2>
              {/* Row 2: User + Timestamp + Linked Issue */}
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="text-xs text-muted-foreground">
                  {interaction.user?.name ||
                    interaction.user?.email ||
                    "Anonymous"}
                </span>
                <span className="text-muted-foreground/40">·</span>
                <span className="text-xs text-muted-foreground/70">
                  {formatRelativeTime(interaction.createdAt)}
                </span>
                {interaction.linkedIssueId && interaction.linkedIssueUrl && (
                  <>
                    <span className="text-muted-foreground/40">·</span>
                    <a
                      href={interaction.linkedIssueUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-violet-400 hover:text-violet-300 transition-colors flex items-center gap-1"
                    >
                      <span>📋</span>
                      {interaction.linkedIssueId}
                    </a>
                  </>
                )}
              </div>
            </div>
          </div>
          {/* Compact action icons */}
          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={() => setShowAssignModal(true)}
              className="p-1.5 text-muted-foreground hover:text-foreground transition-colors"
              title="Assign"
            >
              <User className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => setShowTagsModal(true)}
              className="p-1.5 text-muted-foreground hover:text-foreground transition-colors"
              title="Tags"
            >
              <Tag className="h-3.5 w-3.5" />
            </button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="p-1.5 text-muted-foreground hover:text-foreground transition-colors">
                  <MoreHorizontal className="h-3.5 w-3.5" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {linearConnected && !interaction.linkedIssueId && (
                  <DropdownMenuItem onClick={() => setShowLinearModal(true)}>
                    <ExternalLink className="mr-2 h-4 w-4" />
                    Create Linear Issue
                  </DropdownMenuItem>
                )}
                {interaction.linkedIssueUrl && (
                  <DropdownMenuItem asChild>
                    <a href={interaction.linkedIssueUrl} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="mr-2 h-4 w-4" />
                      View in Linear ({interaction.linkedIssueId})
                    </a>
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => onDelete(interaction.id)}
                  className="text-destructive"
                >
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Row 3: Inline status chips + severity */}
        <div className="flex items-center gap-2 mt-2.5 h-5">
          <div className="flex items-center gap-1">
            {statuses.map((status) => (
              <button
                key={status}
                onClick={() => onStatusChange(interaction.id, status)}
                className={cn(
                  "text-[11px] leading-none px-2 py-1 rounded transition-colors",
                  interaction.status === status
                    ? statusColors[status]
                    : "text-muted-foreground/50 hover:text-muted-foreground hover:bg-muted",
                )}
              >
                {status.replace("_", " ")}
              </button>
            ))}
          </div>
          {interaction.severity && (
            <>
              <span className="text-muted-foreground/30">|</span>
              <span
                className={cn(
                  "text-[11px] leading-none px-1.5 py-1 rounded",
                  severityColors[interaction.severity],
                )}
              >
                {interaction.severity}
              </span>
            </>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-4">
        {/* AI Summary - Compact inline callout */}
        {interaction.aiSummary && (
          <div className="flex gap-2 mb-4 text-sm">
            <span className="shrink-0 text-primary">
              <AlertCircle className="h-3.5 w-3.5 mt-0.5" />
            </span>
            <p className="text-muted-foreground">{interaction.aiSummary}</p>
          </div>
        )}

        {/* Assignee - Compact inline */}
        {interaction.assignee && (
          <div className="flex items-center gap-2 mb-4">
            <div className="h-5 w-5 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[10px] font-medium">
              {interaction.assignee.name.charAt(0)}
            </div>
            <span className="text-xs text-muted-foreground">
              Assigned to{" "}
              <span className="text-foreground">
                {interaction.assignee.name}
              </span>
            </span>
          </div>
        )}

        {/* Description - No header needed */}
        <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">
          {interaction.content?.description ||
            interaction.contentText ||
            "No description provided"}
        </p>

        {/* Tags - Inline after description */}
        {interaction.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-4">
            {interaction.tags.map((tag) => (
              <span
                key={tag}
                className="text-[11px] text-muted-foreground px-1.5 py-0.5 rounded bg-muted"
              >
                {tag}
              </span>
            ))}
          </div>
        )}

        {/* Technical Details - Collapsible */}
        {interaction.metadata && (
          <div className="mt-6">
            <button
              onClick={() => setShowTechnical(!showTechnical)}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <ChevronDown
                className={cn(
                  "h-3 w-3 transition-transform",
                  showTechnical && "rotate-180",
                )}
              />
              Technical details
            </button>
            {showTechnical && (
              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs">
                {interaction.metadata.browser && (
                  <span className="text-muted-foreground">
                    <span className="text-muted-foreground/70">Browser:</span>{" "}
                    {interaction.metadata.browser}
                  </span>
                )}
                {interaction.metadata.os && (
                  <span className="text-muted-foreground">
                    <span className="text-muted-foreground/70">OS:</span>{" "}
                    {interaction.metadata.os}
                  </span>
                )}
                {interaction.metadata.screenSize && (
                  <span className="text-muted-foreground">
                    <span className="text-muted-foreground/70">Screen:</span>{" "}
                    {interaction.metadata.screenSize}
                  </span>
                )}
                {interaction.metadata.url && (
                  <span className="text-muted-foreground truncate max-w-full">
                    <span className="text-muted-foreground/70">URL:</span>{" "}
                    <span className="font-mono">
                      {interaction.metadata.url}
                    </span>
                  </span>
                )}
              </div>
            )}
          </div>
        )}

        {/* Actions - Contextual, near technical details */}
        {(interaction.hasReplay || interaction.hasLogs) && (
          <div className="flex gap-2 mt-4">
            {interaction.hasReplay && (
              <button
                onClick={() => setShowReplayModal(true)}
                className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                <Play className="h-3 w-3" />
                View replay
              </button>
            )}
            {interaction.hasLogs && (
              <button
                onClick={() => setShowLogsModal(true)}
                className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                <Monitor className="h-3 w-3" />
                Console logs
              </button>
            )}
          </div>
        )}
      </div>

      {/* Reply Box (for chat type) */}
      {interaction.type === "chat" && (
        <div
          className="border-t border-border px-4 py-3"
          style={{ borderTopWidth: "0.5px" }}
        >
          <div className="flex gap-2">
            <Input
              placeholder="Type your reply..."
              className="flex-1 h-8 text-sm"
              value={chatMessage}
              onChange={(e) => setChatMessage(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && chatMessage.trim()) {
                  onSendMessage(interaction.id, chatMessage);
                  setChatMessage("");
                }
              }}
            />
            <Button
              size="sm"
              onClick={() => {
                if (chatMessage.trim()) {
                  onSendMessage(interaction.id, chatMessage);
                  setChatMessage("");
                }
              }}
              disabled={!chatMessage.trim()}
            >
              Send
            </Button>
          </div>
        </div>
      )}

      {/* Replay Modal */}
      {showReplayModal && (
        <ReplayModal
          interactionId={interaction.id}
          onClose={() => setShowReplayModal(false)}
        />
      )}

      {/* Console Logs Modal */}
      {showLogsModal && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
          onClick={() => setShowLogsModal(false)}
        >
          <div
            className="bg-card border border-border rounded-lg overflow-hidden max-w-2xl w-full mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-border">
              <h3 className="text-sm font-medium text-foreground">
                Console Logs
              </h3>
              <button
                onClick={() => setShowLogsModal(false)}
                className="text-muted-foreground hover:text-foreground"
              >
                <span className="text-lg leading-none">×</span>
              </button>
            </div>
            <div className="bg-zinc-900 p-3 font-mono text-xs text-green-400 max-h-80 overflow-auto">
              <p className="text-zinc-500">
                [{new Date(interaction.createdAt).toISOString()}]
              </p>
              <p className="text-red-400">
                [ERROR] Uncaught TypeError: Cannot read property 'value' of null
              </p>
              <p className="text-zinc-400">
                {" "}
                at handleSubmit (checkout.js:142)
              </p>
              <p className="text-zinc-400">
                {" "}
                at HTMLFormElement.onsubmit (checkout.js:89)
              </p>
              <p className="text-yellow-400">
                [WARN] Payment validation failed
              </p>
              <p className="text-zinc-400">
                [INFO] User agent: {interaction.metadata?.browser || "Unknown"}
              </p>
              <p className="text-zinc-400">
                [INFO] Page URL: {interaction.metadata?.url || "Unknown"}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Assign Modal */}
      {showAssignModal && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
          onClick={() => setShowAssignModal(false)}
        >
          <div
            className="bg-card border border-border rounded-lg p-4 max-w-sm w-full mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-medium text-foreground">Assign to</h3>
              <button
                onClick={() => setShowAssignModal(false)}
                className="text-muted-foreground hover:text-foreground"
              >
                <span className="text-lg leading-none">×</span>
              </button>
            </div>
            <div className="space-y-1">
              {interaction.assignee && (
                <button
                  onClick={() => {
                    onAssign(interaction.id, null);
                    setShowAssignModal(false);
                  }}
                  className="w-full flex items-center gap-2.5 px-2 py-2 rounded-md hover:bg-accent transition-colors text-left"
                >
                  <div className="h-6 w-6 rounded-full bg-muted flex items-center justify-center text-muted-foreground">
                    <User className="h-3 w-3" />
                  </div>
                  <span className="text-sm text-muted-foreground">
                    Unassign
                  </span>
                </button>
              )}
              {teamMembers.map((member) => (
                <button
                  key={member.id}
                  onClick={() => {
                    onAssign(interaction.id, {
                      name: member.name,
                      email: member.email,
                    });
                    setShowAssignModal(false);
                  }}
                  className={cn(
                    "w-full flex items-center gap-2.5 px-2 py-2 rounded-md hover:bg-accent transition-colors text-left",
                    interaction.assignee?.email === member.email && "bg-accent",
                  )}
                >
                  <div className="h-6 w-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-medium">
                    {member.name.charAt(0)}
                  </div>
                  <span className="text-sm text-foreground">{member.name}</span>
                  {interaction.assignee?.email === member.email && (
                    <CheckCircle className="ml-auto h-3.5 w-3.5 text-primary" />
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Tags Modal */}
      {showTagsModal && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
          onClick={() => setShowTagsModal(false)}
        >
          <div
            className="bg-card border border-border rounded-lg p-4 max-w-sm w-full mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-medium text-foreground">Tags</h3>
              <button
                onClick={() => setShowTagsModal(false)}
                className="text-muted-foreground hover:text-foreground"
              >
                <span className="text-lg leading-none">×</span>
              </button>
            </div>
            <div className="flex flex-wrap gap-1.5 mb-4">
              {availableTags.map((tag) => (
                <button
                  key={tag}
                  onClick={() => {
                    setSelectedTags((prev) =>
                      prev.includes(tag)
                        ? prev.filter((t) => t !== tag)
                        : [...prev, tag],
                    );
                  }}
                  className={cn(
                    "px-2 py-1 rounded text-xs transition-colors",
                    selectedTags.includes(tag)
                      ? "bg-foreground text-background"
                      : "bg-muted text-muted-foreground hover:bg-accent",
                  )}
                >
                  {tag}
                </button>
              ))}
            </div>
            <div className="flex justify-end gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowTagsModal(false)}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={() => {
                  onAddTags(interaction.id, selectedTags);
                  setShowTagsModal(false);
                }}
              >
                Save
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Create Linear Issue Modal */}
      {showLinearModal && (
        <div
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
          onClick={() => setShowLinearModal(false)}
        >
          <div
            className="bg-card border border-border rounded-lg p-4 max-w-md w-full mx-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-medium text-foreground">Create Linear Issue</h3>
              <button
                onClick={() => setShowLinearModal(false)}
                className="text-muted-foreground hover:text-foreground"
              >
                <span className="text-lg leading-none">×</span>
              </button>
            </div>

            {teamsLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <div className="space-y-4">
                {/* Team Selection */}
                <div>
                  <label className="text-xs text-muted-foreground mb-1.5 block">Team</label>
                  <select
                    value={selectedTeamId}
                    onChange={(e) => {
                      setSelectedTeamId(e.target.value);
                      setSelectedLabelIds([]);
                    }}
                    className="w-full px-3 py-2 bg-background border border-border rounded-md text-sm"
                  >
                    {linearTeams?.map((team) => (
                      <option key={team.id} value={team.id}>
                        {team.name} ({team.key})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Priority Selection */}
                <div>
                  <label className="text-xs text-muted-foreground mb-1.5 block">Priority</label>
                  <select
                    value={linearPriority}
                    onChange={(e) => setLinearPriority(Number(e.target.value))}
                    className="w-full px-3 py-2 bg-background border border-border rounded-md text-sm"
                  >
                    <option value={0}>No priority</option>
                    <option value={1}>Urgent</option>
                    <option value={2}>High</option>
                    <option value={3}>Normal</option>
                    <option value={4}>Low</option>
                  </select>
                </div>

                {/* Labels Selection */}
                {linearLabels && linearLabels.length > 0 && (
                  <div>
                    <label className="text-xs text-muted-foreground mb-1.5 block">Labels</label>
                    <div className="flex flex-wrap gap-1.5">
                      {linearLabels.map((label) => (
                        <button
                          key={label.id}
                          onClick={() => {
                            setSelectedLabelIds((prev) =>
                              prev.includes(label.id)
                                ? prev.filter((id) => id !== label.id)
                                : [...prev, label.id]
                            );
                          }}
                          className={cn(
                            "px-2 py-1 rounded text-xs transition-colors",
                            selectedLabelIds.includes(label.id)
                              ? "bg-foreground text-background"
                              : "bg-muted text-muted-foreground hover:bg-accent"
                          )}
                          style={{
                            borderLeft: `3px solid ${label.color}`,
                          }}
                        >
                          {label.name}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Issue Preview */}
                <div className="p-3 bg-muted/30 rounded-md">
                  <div className="text-xs text-muted-foreground mb-1">Preview</div>
                  <div className="text-sm font-medium text-foreground">
                    {interaction.content?.title || interaction.contentText?.slice(0, 100) || "Untitled"}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1 line-clamp-2">
                    {interaction.content?.description || interaction.contentText || "No description"}
                  </div>
                </div>

                {/* Error Message */}
                {createLinearIssueMutation.error && (
                  <div className="text-xs text-red-400">
                    {createLinearIssueMutation.error.message}
                  </div>
                )}

                {/* Actions */}
                <div className="flex justify-end gap-2 pt-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowLinearModal(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => {
                      if (!currentProject?.id || !selectedTeamId) return;
                      createLinearIssueMutation.mutate({
                        projectId: currentProject.id,
                        interactionId: interaction.id,
                        teamId: selectedTeamId,
                        labelIds: selectedLabelIds.length > 0 ? selectedLabelIds : undefined,
                        priority: linearPriority,
                      });
                    }}
                    disabled={!selectedTeamId || createLinearIssueMutation.isPending}
                  >
                    {createLinearIssueMutation.isPending ? (
                      <>
                        <Loader2 className="h-3 w-3 animate-spin mr-1" />
                        Creating...
                      </>
                    ) : (
                      "Create Issue"
                    )}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

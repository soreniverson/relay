"use client";

import { useState } from "react";
import { useAuthStore } from "@/stores/auth";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Plus,
  Search,
  ChevronDown,
  ChevronUp,
  MoreHorizontal,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ApiError, EmptyState } from "@/components/api-error";

type FeedbackStatus =
  | "under_review"
  | "planned"
  | "in_progress"
  | "shipped"
  | "wont_do";

interface FeedbackItem {
  id: string;
  title: string;
  description: string | null;
  category: string | null;
  status: FeedbackStatus;
  voteCount: number;
  createdAt: Date | string;
}

const statusColors: Record<string, string> = {
  under_review: "bg-muted text-muted-foreground",
  planned: "bg-violet-500/10 text-violet-400",
  in_progress: "bg-amber-500/10 text-amber-400",
  shipped: "bg-emerald-500/10 text-emerald-400",
  wont_do: "bg-red-500/10 text-red-400",
};

const statusLabels: Record<string, string> = {
  under_review: "Under Review",
  planned: "Planned",
  in_progress: "In Progress",
  shipped: "Shipped",
  wont_do: "Won't Do",
};

const categoryLabels: Record<string, string> = {
  feature: "Feature Request",
  enhancement: "Enhancement",
  integration: "Integration",
  bug: "Bug Fix",
  ui: "UI/UX",
  other: "Other",
};

export default function FeedbackPage() {
  const { currentProject } = useAuthStore();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<"votes" | "createdAt">("votes");
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newItem, setNewItem] = useState({
    title: "",
    description: "",
    category: "feature",
    status: "under_review" as FeedbackStatus,
  });

  const utils = trpc.useUtils();

  // Fetch feedback items
  const { data, isLoading, error, refetch } = trpc.feedback.list.useQuery(
    {
      projectId: currentProject?.id || "",
      status: statusFilter as FeedbackStatus | undefined,
      sortBy,
      sortDir: "desc",
    },
    { enabled: !!currentProject?.id },
  );

  // Create mutation
  const createMutation = trpc.feedback.create.useMutation({
    onSuccess: () => {
      utils.feedback.list.invalidate();
      setNewItem({
        title: "",
        description: "",
        category: "feature",
        status: "under_review",
      });
      setIsCreateOpen(false);
    },
  });

  // Update status mutation
  const updateMutation = trpc.feedback.update.useMutation({
    onSuccess: () => {
      utils.feedback.list.invalidate();
    },
  });

  // Delete mutation
  const deleteMutation = trpc.feedback.delete.useMutation({
    onSuccess: () => {
      utils.feedback.list.invalidate();
    },
  });

  const handleCreate = () => {
    if (!currentProject?.id || !newItem.title.trim()) return;
    createMutation.mutate({
      projectId: currentProject.id,
      title: newItem.title,
      description: newItem.description,
      category: newItem.category,
      status: newItem.status,
    });
  };

  const handleStatusChange = (id: string, newStatus: FeedbackStatus) => {
    if (!currentProject?.id) return;
    updateMutation.mutate({
      projectId: currentProject.id,
      feedbackItemId: id,
      status: newStatus,
    });
  };

  const handleDelete = (id: string) => {
    if (!currentProject?.id) return;
    deleteMutation.mutate({
      projectId: currentProject.id,
      feedbackItemId: id,
    });
  };

  // Filter by search
  const filteredFeedback = (data?.data || []).filter((item: FeedbackItem) => {
    if (search) {
      const searchLower = search.toLowerCase();
      return (
        item.title.toLowerCase().includes(searchLower) ||
        (item.description?.toLowerCase().includes(searchLower) ?? false)
      );
    }
    return true;
  });

  if (!currentProject) {
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground">
        <p>Select a project to view feedback</p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <ApiError
        error={error}
        onRetry={() => refetch()}
        title="Failed to load feedback"
      />
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="page-header">
        <h1 className="page-title">Feedback</h1>
        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
          <DialogTrigger asChild>
            <Button size="sm" variant="ghost" className="h-7 w-7 p-0">
              <Plus className="h-4 w-4" />
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[400px]">
            <DialogHeader>
              <DialogTitle>Add feedback</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 pt-2">
              <div className="grid gap-1.5">
                <Label
                  htmlFor="title"
                  className="text-xs text-muted-foreground"
                >
                  Title
                </Label>
                <Input
                  id="title"
                  placeholder="Short, descriptive title"
                  value={newItem.title}
                  onChange={(e) =>
                    setNewItem({ ...newItem, title: e.target.value })
                  }
                />
              </div>
              <div className="grid gap-1.5">
                <Label
                  htmlFor="description"
                  className="text-xs text-muted-foreground"
                >
                  Description
                </Label>
                <Textarea
                  id="description"
                  placeholder="Optional details"
                  value={newItem.description}
                  onChange={(e) =>
                    setNewItem({ ...newItem, description: e.target.value })
                  }
                  rows={3}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-1.5">
                  <Label
                    htmlFor="category"
                    className="text-xs text-muted-foreground"
                  >
                    Category
                  </Label>
                  <Select
                    value={newItem.category}
                    onValueChange={(value) =>
                      setNewItem({ ...newItem, category: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(categoryLabels).map(([value, label]) => (
                        <SelectItem key={value} value={value}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-1.5">
                  <Label
                    htmlFor="status"
                    className="text-xs text-muted-foreground"
                  >
                    Status
                  </Label>
                  <Select
                    value={newItem.status}
                    onValueChange={(value) =>
                      setNewItem({
                        ...newItem,
                        status: value as FeedbackStatus,
                      })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(statusLabels).map(([value, label]) => (
                        <SelectItem key={value} value={value}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
            <DialogFooter className="pt-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsCreateOpen(false)}
              >
                Cancel
              </Button>
              <Button
                size="sm"
                onClick={handleCreate}
                disabled={!newItem.title.trim() || createMutation.isPending}
              >
                {createMutation.isPending ? "Creating..." : "Create"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
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
                {statusFilter ? statusLabels[statusFilter] : "Status"}
                <ChevronDown className="h-3 w-3" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setStatusFilter(null)}>
                All
                {!statusFilter && (
                  <span className="ml-auto text-foreground">✓</span>
                )}
              </DropdownMenuItem>
              {Object.entries(statusLabels).map(([value, label]) => (
                <DropdownMenuItem
                  key={value}
                  onClick={() => setStatusFilter(value)}
                >
                  {label}
                  {statusFilter === value && (
                    <span className="ml-auto text-foreground">✓</span>
                  )}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
                {sortBy === "votes" ? "Top" : "Recent"}
                <ChevronDown className="h-3 w-3" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setSortBy("votes")}>
                Top Voted
                {sortBy === "votes" && (
                  <span className="ml-auto text-foreground">✓</span>
                )}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setSortBy("createdAt")}>
                Most Recent
                {sortBy === "createdAt" && (
                  <span className="ml-auto text-foreground">✓</span>
                )}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Feedback List */}
      <div className="flex-1 overflow-auto">
        {filteredFeedback.length === 0 ? (
          <EmptyState
            icon={<Search className="h-6 w-6 text-muted-foreground" />}
            title="No feedback items"
            description={
              search
                ? "Try adjusting your search"
                : "Create your first feedback item to get started"
            }
            action={
              !search
                ? {
                    label: "Add Feedback",
                    onClick: () => setIsCreateOpen(true),
                  }
                : undefined
            }
          />
        ) : (
          filteredFeedback.map((item: FeedbackItem) => {
            const showStatus = item.status !== "under_review";

            return (
              <div
                key={item.id}
                className="border-b border-border px-4 py-3 hover:bg-accent/30 transition-colors"
                style={{ borderBottomWidth: "0.5px" }}
              >
                <div className="flex items-center gap-3">
                  {/* Vote indicator */}
                  <div
                    className={cn(
                      "shrink-0 flex flex-col items-center justify-center w-10 py-1.5 rounded-md border bg-muted/50 border-border text-muted-foreground",
                    )}
                    style={{ borderWidth: "0.5px" }}
                  >
                    <ChevronUp className="h-3.5 w-3.5" />
                    <span className="text-xs font-medium leading-none">
                      {item.voteCount}
                    </span>
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">
                      {item.title}
                    </p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="text-xs text-muted-foreground capitalize">
                        {categoryLabels[item.category ?? "other"] ||
                          item.category ||
                          "Other"}
                      </span>
                      <span className="text-muted-foreground/40">·</span>
                      <span className="text-xs text-muted-foreground/50">
                        {new Date(item.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>

                  {/* Status Badge */}
                  {showStatus && (
                    <span
                      className={cn(
                        "shrink-0 text-[11px] leading-none px-1.5 py-1 rounded",
                        statusColors[item.status],
                      )}
                    >
                      {statusLabels[item.status]}
                    </span>
                  )}

                  {/* Actions */}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button className="shrink-0 p-1 text-muted-foreground hover:text-foreground transition-colors">
                        <MoreHorizontal className="h-4 w-4" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onClick={() => handleStatusChange(item.id, "planned")}
                      >
                        Mark as Planned
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() =>
                          handleStatusChange(item.id, "in_progress")
                        }
                      >
                        Mark as In Progress
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => handleStatusChange(item.id, "shipped")}
                      >
                        Mark as Shipped
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => handleDelete(item.id)}
                        className="text-destructive"
                      >
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

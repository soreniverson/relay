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
import { Plus, ExternalLink, Check, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { ApiError, EmptyState } from "@/components/api-error";

type RoadmapStatus = "planned" | "in_progress" | "shipped";

const columns = [
  { key: "planned", label: "Planned", color: "bg-violet-400" },
  { key: "in_progress", label: "In Progress", color: "bg-amber-400" },
  { key: "shipped", label: "Shipped", color: "bg-emerald-400" },
];

const etaOptions = [
  { value: "2026-Q1", label: "2026 Q1" },
  { value: "2026-Q2", label: "2026 Q2" },
  { value: "2026-Q3", label: "2026 Q3" },
  { value: "2026-Q4", label: "2026 Q4" },
  { value: "2027-Q1", label: "2027 Q1" },
  { value: "2027-Q2", label: "2027 Q2" },
];

export default function RoadmapPage() {
  const { currentProject } = useAuthStore();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [newItem, setNewItem] = useState({
    title: "",
    description: "",
    status: "planned" as RoadmapStatus,
    eta: "",
  });

  const utils = trpc.useUtils();

  // Fetch roadmap items
  const { data, isLoading, error, refetch } = trpc.roadmap.list.useQuery(
    { projectId: currentProject?.id || "" },
    { enabled: !!currentProject?.id },
  );

  // Create mutation
  const createMutation = trpc.roadmap.create.useMutation({
    onSuccess: () => {
      utils.roadmap.list.invalidate();
      setNewItem({ title: "", description: "", status: "planned", eta: "" });
      setIsCreateOpen(false);
    },
  });

  // Update mutation for drag & drop
  const updateMutation = trpc.roadmap.update.useMutation({
    onSuccess: () => {
      utils.roadmap.list.invalidate();
    },
  });

  const items = data?.data || [];

  const handleCreate = () => {
    if (!currentProject?.id || !newItem.title.trim()) return;
    createMutation.mutate({
      projectId: currentProject.id,
      title: newItem.title,
      description: newItem.description,
      status: newItem.status,
      visibility: "public",
      eta: newItem.eta ? new Date(newItem.eta) : undefined,
    });
  };

  const handleDrop = (itemId: string, newStatus: RoadmapStatus) => {
    if (!currentProject?.id) return;
    const item = items.find((i) => i.id === itemId);
    if (!item || item.status === newStatus) return;

    updateMutation.mutate({
      projectId: currentProject.id,
      roadmapItemId: itemId,
      status: newStatus,
    });
  };

  const handleCopyLink = () => {
    // Open public roadmap using project slug
    const slug = currentProject?.slug;
    if (slug) {
      window.open(`/roadmap/${slug}`, "_blank");
    } else {
      // Fallback to demo page if no slug configured
      window.open("/roadmap/public", "_blank");
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Drag state
  const [draggedItem, setDraggedItem] = useState<string | null>(null);
  const [dragOverColumn, setDragOverColumn] = useState<string | null>(null);

  if (!currentProject) {
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground">
        <p>Select a project to view roadmap</p>
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
        title="Failed to load roadmap"
      />
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="page-header">
        <h1 className="page-title">Roadmap</h1>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleCopyLink}
            className="h-7 w-7 p-0 text-muted-foreground"
          >
            {copied ? (
              <Check className="h-4 w-4" />
            ) : (
              <ExternalLink className="h-4 w-4" />
            )}
          </Button>

          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button size="sm" variant="ghost" className="h-7 w-7 p-0">
                <Plus className="h-4 w-4" />
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[400px]">
              <DialogHeader>
                <DialogTitle>Add roadmap item</DialogTitle>
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
                    placeholder="Feature or milestone name"
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
                    placeholder="What will this deliver?"
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
                          status: value as RoadmapStatus,
                        })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="planned">Planned</SelectItem>
                        <SelectItem value="in_progress">In Progress</SelectItem>
                        <SelectItem value="shipped">Shipped</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-1.5">
                    <Label
                      htmlFor="eta"
                      className="text-xs text-muted-foreground"
                    >
                      ETA
                    </Label>
                    <Select
                      value={newItem.eta}
                      onValueChange={(value) =>
                        setNewItem({ ...newItem, eta: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select..." />
                      </SelectTrigger>
                      <SelectContent>
                        {etaOptions.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>
                            {opt.label}
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
      </div>

      {/* Column Headers */}
      <div
        className="flex items-center h-[41px] border-b border-border"
        style={{ borderBottomWidth: "0.5px" }}
      >
        {columns.map((column, index) => (
          <div
            key={column.key}
            className={cn(
              "flex-1 flex items-center gap-2 px-4",
              index < columns.length - 1 && "border-r border-border",
            )}
            style={
              index < columns.length - 1
                ? { borderRightWidth: "0.5px" }
                : undefined
            }
          >
            <div className={`w-2 h-2 rounded-full ${column.color}`} />
            <h2 className="text-xs text-muted-foreground">{column.label}</h2>
            <span className="text-xs text-muted-foreground/50">
              {items.filter((i) => i.status === column.key).length}
            </span>
          </div>
        ))}
      </div>

      {/* Kanban Board */}
      <div className="flex-1 flex min-h-0">
        {columns.map((column, index) => {
          const isDropTarget = dragOverColumn === column.key && draggedItem;
          const draggedItemData = items.find((i) => i.id === draggedItem);
          const isDifferentColumn =
            draggedItemData && draggedItemData.status !== column.key;

          return (
            <div
              key={column.key}
              className={cn(
                "flex-1 flex flex-col min-h-0",
                index < columns.length - 1 && "border-r border-border",
              )}
              style={
                index < columns.length - 1
                  ? { borderRightWidth: "0.5px" }
                  : undefined
              }
            >
              <div
                className={cn(
                  "flex-1 p-3 transition-colors duration-200 overflow-y-auto",
                  isDropTarget && isDifferentColumn && "bg-accent/20",
                )}
                onDragEnter={(e) => {
                  e.preventDefault();
                  setDragOverColumn(column.key);
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                  if (dragOverColumn !== column.key) {
                    setDragOverColumn(column.key);
                  }
                }}
                onDrop={() => {
                  if (draggedItem) {
                    handleDrop(draggedItem, column.key as RoadmapStatus);
                  }
                  setDraggedItem(null);
                  setDragOverColumn(null);
                }}
              >
                <div className="space-y-2">
                  {items
                    .filter((item) => item.status === column.key)
                    .map((item) => {
                      const isDragging = draggedItem === item.id;

                      return (
                        <div
                          key={item.id}
                          draggable
                          onDragStart={() => setDraggedItem(item.id)}
                          onDragEnd={() => {
                            setDraggedItem(null);
                            setDragOverColumn(null);
                          }}
                          className={cn(
                            "bg-card border border-border rounded-md p-3 transition-all duration-200",
                            "cursor-grab active:cursor-grabbing",
                            "hover:border-border/80 hover:shadow-sm",
                            isDragging &&
                              "opacity-40 scale-[0.98] shadow-lg rotate-1",
                          )}
                          style={{ borderWidth: "0.5px" }}
                        >
                          <h3 className="text-sm font-medium text-foreground mb-1">
                            {item.title}
                          </h3>
                          {item.description && (
                            <p className="text-xs text-muted-foreground mb-2 line-clamp-2">
                              {item.description}
                            </p>
                          )}
                          <div className="flex items-center justify-between text-xs text-muted-foreground">
                            <span>{item.linkedFeedbackCount || 0} votes</span>
                            {item.eta && (
                              <span>
                                {new Date(item.eta).toLocaleDateString(
                                  "en-US",
                                  { year: "numeric", month: "short" },
                                )}
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                </div>
                {items.filter((item) => item.status === column.key).length ===
                  0 && (
                  <div className="flex items-center justify-center h-full text-muted-foreground/50 text-sm">
                    No items
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

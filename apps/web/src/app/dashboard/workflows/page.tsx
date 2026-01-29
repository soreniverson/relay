"use client";

import { useState } from "react";
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
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Plus,
  Search,
  Zap,
  MoreHorizontal,
  ArrowRight,
  ChevronDown,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

interface Workflow {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  trigger: string;
  actions: string[];
  runCount: number;
  lastRunAt: string;
  lastStatus: "completed" | "failed";
}

const mockWorkflows: Workflow[] = [
  {
    id: "1",
    name: "Auto-assign Critical Bugs",
    description: "Assign critical bugs to on-call engineer",
    enabled: true,
    trigger: "interaction.created",
    actions: ["assign_to", "send_slack"],
    runCount: 156,
    lastRunAt: "2024-01-16T10:30:00Z",
    lastStatus: "completed",
  },
  {
    id: "2",
    name: "Welcome Message",
    description: "Send welcome message on new conversation",
    enabled: true,
    trigger: "conversation.created",
    actions: ["ai_respond"],
    runCount: 892,
    lastRunAt: "2024-01-16T11:15:00Z",
    lastStatus: "completed",
  },
  {
    id: "3",
    name: "NPS Detractor Follow-up",
    description: "Create task when NPS score is low",
    enabled: false,
    trigger: "survey.response",
    actions: ["add_tag", "send_slack"],
    runCount: 45,
    lastRunAt: "2024-01-15T09:00:00Z",
    lastStatus: "failed",
  },
];

const triggerOptions = [
  { value: "interaction.created", label: "When interaction is created" },
  { value: "interaction.updated", label: "When interaction is updated" },
  { value: "conversation.created", label: "When conversation starts" },
  { value: "message.received", label: "When message is received" },
  { value: "survey.response", label: "When survey is submitted" },
];

const actionOptions = [
  { value: "send_email", label: "Send Email" },
  { value: "send_slack", label: "Send Slack" },
  { value: "assign_to", label: "Assign To" },
  { value: "add_tag", label: "Add Tag" },
  { value: "set_status", label: "Set Status" },
  { value: "ai_respond", label: "AI Respond" },
  { value: "create_linear_issue", label: "Create Linear Issue" },
];

const triggerLabels: Record<string, string> = {
  "interaction.created": "Interaction created",
  "interaction.updated": "Interaction updated",
  "conversation.created": "Conversation starts",
  "message.received": "Message received",
  "survey.response": "Survey submitted",
};

const actionLabels: Record<string, string> = {
  send_email: "Send Email",
  send_slack: "Send Slack",
  assign_to: "Assign To",
  add_tag: "Add Tag",
  set_status: "Set Status",
  ai_respond: "AI Respond",
  create_linear_issue: "Create Linear Issue",
};

export default function WorkflowsPage() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"active" | "paused" | null>(
    null,
  );
  const [workflows, setWorkflows] = useState(mockWorkflows);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newWorkflow, setNewWorkflow] = useState({
    name: "",
    description: "",
    trigger: "interaction.created",
    action: "send_slack",
  });

  const filteredWorkflows = workflows.filter((workflow) => {
    if (statusFilter === "active" && !workflow.enabled) return false;
    if (statusFilter === "paused" && workflow.enabled) return false;
    if (search && !workflow.name.toLowerCase().includes(search.toLowerCase()))
      return false;
    return true;
  });

  const toggleWorkflow = (workflowId: string) => {
    setWorkflows((prev) =>
      prev.map((w) =>
        w.id === workflowId ? { ...w, enabled: !w.enabled } : w,
      ),
    );
  };

  const handleCreate = () => {
    if (!newWorkflow.name.trim()) return;

    const workflow: Workflow = {
      id: Date.now().toString(),
      name: newWorkflow.name,
      description: newWorkflow.description,
      enabled: false,
      trigger: newWorkflow.trigger,
      actions: [newWorkflow.action],
      runCount: 0,
      lastRunAt: new Date().toISOString(),
      lastStatus: "completed",
    };

    setWorkflows((prev) => [workflow, ...prev]);
    setNewWorkflow({
      name: "",
      description: "",
      trigger: "interaction.created",
      action: "send_slack",
    });
    setIsCreateOpen(false);
  };

  const handleDelete = (id: string) => {
    setWorkflows((prev) => prev.filter((w) => w.id !== id));
  };

  const handleDuplicate = (id: string) => {
    const original = workflows.find((w) => w.id === id);
    if (!original) return;

    const duplicate: Workflow = {
      ...original,
      id: Date.now().toString(),
      name: `${original.name} (Copy)`,
      enabled: false,
      runCount: 0,
      lastRunAt: new Date().toISOString(),
    };

    setWorkflows((prev) => [duplicate, ...prev]);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="page-header">
        <h1 className="page-title">Workflows</h1>
        <Button
          size="sm"
          variant="ghost"
          className="h-7 w-7 p-0"
          onClick={() => setIsCreateOpen(true)}
        >
          <Plus className="h-4 w-4" />
        </Button>
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
                {statusFilter === null
                  ? "Status"
                  : statusFilter === "active"
                    ? "Active"
                    : "Paused"}
                <ChevronDown className="h-3 w-3" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setStatusFilter(null)}>
                All
                {statusFilter === null && (
                  <span className="ml-auto text-foreground">✓</span>
                )}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setStatusFilter("active")}>
                Active
                {statusFilter === "active" && (
                  <span className="ml-auto text-foreground">✓</span>
                )}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setStatusFilter("paused")}>
                Paused
                {statusFilter === "paused" && (
                  <span className="ml-auto text-foreground">✓</span>
                )}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Workflows List */}
      <div className="flex-1 overflow-auto">
        {filteredWorkflows.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
            <Zap className="h-12 w-12 mb-4 opacity-50" />
            <p>No workflows found</p>
            <p className="text-sm">Try adjusting your filters</p>
          </div>
        ) : (
          filteredWorkflows.map((workflow) => (
            <div
              key={workflow.id}
              className="border-b border-border px-4 py-3 hover:bg-accent/30 transition-colors"
              style={{ borderBottomWidth: "0.5px" }}
            >
              <div className="flex items-center gap-3">
                {/* Icon */}
                <div
                  className={cn(
                    "shrink-0 h-8 w-8 rounded-md flex items-center justify-center",
                    workflow.enabled
                      ? "bg-foreground/10 text-foreground"
                      : "bg-muted/50 text-muted-foreground",
                  )}
                >
                  <Zap className="h-4 w-4" />
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">
                    {workflow.name}
                  </p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="text-xs text-muted-foreground">
                      {triggerLabels[workflow.trigger] || workflow.trigger}
                    </span>
                    <ArrowRight className="h-3 w-3 text-muted-foreground/40" />
                    <span className="text-xs text-muted-foreground/70">
                      {workflow.actions
                        .map((a) => actionLabels[a] || a)
                        .join(", ")}
                    </span>
                    <span className="text-muted-foreground/40">·</span>
                    <span className="text-xs text-muted-foreground/70">
                      {workflow.runCount.toLocaleString()} runs
                    </span>
                    {workflow.lastStatus === "failed" && (
                      <>
                        <span className="text-muted-foreground/40">·</span>
                        <span className="text-xs text-red-400">failed</span>
                      </>
                    )}
                  </div>
                </div>

                {/* Status Badge */}
                <button
                  onClick={() => toggleWorkflow(workflow.id)}
                  className={cn(
                    "shrink-0 text-[11px] leading-none px-1.5 py-1 rounded transition-colors",
                    workflow.enabled
                      ? "bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20"
                      : "bg-muted text-muted-foreground hover:bg-muted/80",
                  )}
                >
                  {workflow.enabled ? "Active" : "Paused"}
                </button>

                {/* Actions */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="shrink-0 p-1 text-muted-foreground hover:text-foreground transition-colors">
                      <MoreHorizontal className="h-4 w-4" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem
                      onClick={() => handleDuplicate(workflow.id)}
                    >
                      Duplicate
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => handleDelete(workflow.id)}
                      className="text-destructive"
                    >
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Create Modal */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Add workflow</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 pt-2">
            <div className="grid gap-1.5">
              <Label htmlFor="name" className="text-xs text-muted-foreground">
                Name
              </Label>
              <Input
                id="name"
                placeholder="e.g. Auto-assign Critical Bugs"
                value={newWorkflow.name}
                onChange={(e) =>
                  setNewWorkflow({ ...newWorkflow, name: e.target.value })
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
                value={newWorkflow.description}
                onChange={(e) =>
                  setNewWorkflow({
                    ...newWorkflow,
                    description: e.target.value,
                  })
                }
                rows={2}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label className="text-xs text-muted-foreground">Trigger</Label>
                <Select
                  value={newWorkflow.trigger}
                  onValueChange={(value) =>
                    setNewWorkflow({ ...newWorkflow, trigger: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {triggerOptions.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        {opt.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1.5">
                <Label className="text-xs text-muted-foreground">Action</Label>
                <Select
                  value={newWorkflow.action}
                  onValueChange={(value) =>
                    setNewWorkflow({ ...newWorkflow, action: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {actionOptions.map((opt) => (
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
              disabled={!newWorkflow.name.trim()}
            >
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

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
  Megaphone,
  MoreHorizontal,
  ChevronDown,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

interface Announcement {
  id: string;
  title: string;
  content: string;
  type: "banner" | "modal" | "slideout" | "feed_item";
  enabled: boolean;
  viewCount: number;
  clickCount: number;
  startAt: string | null;
  endAt: string | null;
  createdAt: string;
}

const mockAnnouncements: Announcement[] = [
  {
    id: "1",
    title: "New Feature: Dark Mode",
    content: "We just launched dark mode! Toggle it in your settings.",
    type: "banner",
    enabled: true,
    viewCount: 3421,
    clickCount: 892,
    startAt: null,
    endAt: null,
    createdAt: "2024-01-15",
  },
  {
    id: "2",
    title: "Scheduled Maintenance",
    content: "Brief downtime expected on Saturday at 2am UTC.",
    type: "modal",
    enabled: true,
    viewCount: 1243,
    clickCount: 156,
    startAt: "2024-01-18",
    endAt: "2024-01-20",
    createdAt: "2024-01-14",
  },
  {
    id: "3",
    title: "Welcome to Relay",
    content: "Get started with our quick setup guide.",
    type: "slideout",
    enabled: false,
    viewCount: 5678,
    clickCount: 2341,
    startAt: null,
    endAt: null,
    createdAt: "2024-01-10",
  },
  {
    id: "4",
    title: "API v2 Released",
    content: "Check out the new API with improved performance.",
    type: "feed_item",
    enabled: true,
    viewCount: 876,
    clickCount: 234,
    startAt: null,
    endAt: null,
    createdAt: "2024-01-16",
  },
];

const typeLabels: Record<string, string> = {
  banner: "Banner",
  modal: "Modal",
  slideout: "Slideout",
  feed_item: "News Feed",
};

export default function AnnouncementsPage() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"active" | "paused" | null>(
    null,
  );
  const [typeFilter, setTypeFilter] = useState<string | null>(null);
  const [announcements, setAnnouncements] = useState(mockAnnouncements);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newAnnouncement, setNewAnnouncement] = useState({
    title: "",
    content: "",
    type: "banner" as Announcement["type"],
  });

  const filteredAnnouncements = announcements.filter((announcement) => {
    if (statusFilter === "active" && !announcement.enabled) return false;
    if (statusFilter === "paused" && announcement.enabled) return false;
    if (typeFilter && announcement.type !== typeFilter) return false;
    if (
      search &&
      !announcement.title.toLowerCase().includes(search.toLowerCase())
    )
      return false;
    return true;
  });

  const toggleAnnouncement = (announcementId: string) => {
    setAnnouncements((prev) =>
      prev.map((a) =>
        a.id === announcementId ? { ...a, enabled: !a.enabled } : a,
      ),
    );
  };

  const handleCreate = () => {
    if (!newAnnouncement.title.trim()) return;

    const announcement: Announcement = {
      id: Date.now().toString(),
      title: newAnnouncement.title,
      content: newAnnouncement.content,
      type: newAnnouncement.type,
      enabled: false,
      viewCount: 0,
      clickCount: 0,
      startAt: null,
      endAt: null,
      createdAt: new Date().toISOString().split("T")[0],
    };

    setAnnouncements((prev) => [announcement, ...prev]);
    setNewAnnouncement({ title: "", content: "", type: "banner" });
    setIsCreateOpen(false);
  };

  const handleDelete = (id: string) => {
    setAnnouncements((prev) => prev.filter((a) => a.id !== id));
  };

  const handleDuplicate = (id: string) => {
    const original = announcements.find((a) => a.id === id);
    if (!original) return;

    const duplicate: Announcement = {
      ...original,
      id: Date.now().toString(),
      title: `${original.title} (Copy)`,
      enabled: false,
      viewCount: 0,
      clickCount: 0,
      createdAt: new Date().toISOString().split("T")[0],
    };

    setAnnouncements((prev) => [duplicate, ...prev]);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="page-header">
        <h1 className="page-title">Announcements</h1>
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
                {typeFilter ? typeLabels[typeFilter] : "Type"}
                <ChevronDown className="h-3 w-3" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setTypeFilter(null)}>
                All
                {typeFilter === null && (
                  <span className="ml-auto text-foreground">✓</span>
                )}
              </DropdownMenuItem>
              {Object.entries(typeLabels).map(([value, label]) => (
                <DropdownMenuItem
                  key={value}
                  onClick={() => setTypeFilter(value)}
                >
                  {label}
                  {typeFilter === value && (
                    <span className="ml-auto text-foreground">✓</span>
                  )}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
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

      {/* Announcements List */}
      <div className="flex-1 overflow-auto">
        {filteredAnnouncements.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
            <Megaphone className="h-12 w-12 mb-4 opacity-50" />
            <p>No announcements found</p>
            <p className="text-sm">Try adjusting your filters</p>
          </div>
        ) : (
          filteredAnnouncements.map((announcement) => (
            <div
              key={announcement.id}
              className="border-b border-border px-4 py-3 hover:bg-accent/30 transition-colors"
              style={{ borderBottomWidth: "0.5px" }}
            >
              <div className="flex items-center gap-3">
                {/* Icon */}
                <div
                  className={cn(
                    "shrink-0 h-8 w-8 rounded-md flex items-center justify-center",
                    announcement.enabled
                      ? "bg-foreground/10 text-foreground"
                      : "bg-muted/50 text-muted-foreground",
                  )}
                >
                  <Megaphone className="h-4 w-4" />
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">
                    {announcement.title}
                  </p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="text-xs text-muted-foreground">
                      {typeLabels[announcement.type]}
                    </span>
                    <span className="text-muted-foreground/40">·</span>
                    <span className="text-xs text-muted-foreground/70">
                      {announcement.viewCount.toLocaleString()} views
                    </span>
                    <span className="text-muted-foreground/40">·</span>
                    <span className="text-xs text-muted-foreground/70">
                      {announcement.viewCount > 0
                        ? Math.round(
                            (announcement.clickCount / announcement.viewCount) *
                              100,
                          )
                        : 0}
                      % CTR
                    </span>
                    {(announcement.startAt || announcement.endAt) && (
                      <>
                        <span className="text-muted-foreground/40">·</span>
                        <span className="text-xs text-muted-foreground/50">
                          scheduled
                        </span>
                      </>
                    )}
                  </div>
                </div>

                {/* Status Badge */}
                <button
                  onClick={() => toggleAnnouncement(announcement.id)}
                  className={cn(
                    "shrink-0 text-[11px] leading-none px-1.5 py-1 rounded transition-colors",
                    announcement.enabled
                      ? "bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20"
                      : "bg-muted text-muted-foreground hover:bg-muted/80",
                  )}
                >
                  {announcement.enabled ? "Active" : "Paused"}
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
                      onClick={() => handleDuplicate(announcement.id)}
                    >
                      Duplicate
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => handleDelete(announcement.id)}
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
            <DialogTitle>Add announcement</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 pt-2">
            <div className="grid gap-1.5">
              <Label htmlFor="title" className="text-xs text-muted-foreground">
                Title
              </Label>
              <Input
                id="title"
                placeholder="e.g. New Feature Launch"
                value={newAnnouncement.title}
                onChange={(e) =>
                  setNewAnnouncement({
                    ...newAnnouncement,
                    title: e.target.value,
                  })
                }
              />
            </div>
            <div className="grid gap-1.5">
              <Label
                htmlFor="content"
                className="text-xs text-muted-foreground"
              >
                Content
              </Label>
              <Textarea
                id="content"
                placeholder="Optional details"
                value={newAnnouncement.content}
                onChange={(e) =>
                  setNewAnnouncement({
                    ...newAnnouncement,
                    content: e.target.value,
                  })
                }
                rows={3}
              />
            </div>
            <div className="grid gap-1.5">
              <Label className="text-xs text-muted-foreground">
                Display type
              </Label>
              <Select
                value={newAnnouncement.type}
                onValueChange={(value) =>
                  setNewAnnouncement({
                    ...newAnnouncement,
                    type: value as Announcement["type"],
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="banner">Banner</SelectItem>
                  <SelectItem value="modal">Modal</SelectItem>
                  <SelectItem value="slideout">Slideout</SelectItem>
                  <SelectItem value="feed_item">News Feed</SelectItem>
                </SelectContent>
              </Select>
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
              disabled={!newAnnouncement.title.trim()}
            >
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

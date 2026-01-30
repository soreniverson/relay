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
  Plus,
  Search,
  FileText,
  Eye,
  ThumbsUp,
  MoreHorizontal,
  ExternalLink,
  Folder,
  ChevronDown,
  Loader2,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { ApiError, EmptyState } from "@/components/api-error";

type ArticleStatus = "draft" | "published" | "archived";

const statusColors = {
  published: "bg-emerald-500/10 text-emerald-400",
  draft: "bg-amber-500/10 text-amber-400",
  archived: "bg-muted text-muted-foreground",
};

const statusLabels = {
  published: "Published",
  draft: "Draft",
  archived: "Archived",
};

function generateSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export default function KnowledgePage() {
  const { currentProject } = useAuthStore();
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<ArticleStatus | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isCreateCategoryOpen, setIsCreateCategoryOpen] = useState(false);
  const [newArticle, setNewArticle] = useState({
    title: "",
    content: "",
    categoryId: "",
    status: "draft" as ArticleStatus,
  });
  const [newCategoryName, setNewCategoryName] = useState("");

  const utils = trpc.useUtils();

  // Fetch articles
  const {
    data: articlesData,
    isLoading,
    error,
    refetch,
  } = trpc.knowledge.listArticles.useQuery(
    {
      projectId: currentProject?.id || "",
      status: statusFilter || undefined,
      categoryId: selectedCategory || undefined,
      search: search || undefined,
    },
    { enabled: !!currentProject?.id },
  );

  // Fetch categories
  const { data: categories } = trpc.knowledge.listCategories.useQuery(
    { projectId: currentProject?.id || "" },
    { enabled: !!currentProject?.id },
  );

  // Create article mutation
  const createArticleMutation = trpc.knowledge.createArticle.useMutation({
    onSuccess: () => {
      utils.knowledge.listArticles.invalidate();
      setNewArticle({
        title: "",
        content: "",
        categoryId: "",
        status: "draft",
      });
      setIsCreateOpen(false);
    },
  });

  // Update article mutation
  const updateArticleMutation = trpc.knowledge.updateArticle.useMutation({
    onSuccess: () => {
      utils.knowledge.listArticles.invalidate();
    },
  });

  // Delete article mutation
  const deleteArticleMutation = trpc.knowledge.deleteArticle.useMutation({
    onSuccess: () => {
      utils.knowledge.listArticles.invalidate();
    },
  });

  // Create category mutation
  const createCategoryMutation = trpc.knowledge.createCategory.useMutation({
    onSuccess: () => {
      utils.knowledge.listCategories.invalidate();
      setNewCategoryName("");
      setIsCreateCategoryOpen(false);
    },
  });

  const handleCreateArticle = () => {
    if (!currentProject?.id || !newArticle.title.trim()) return;
    createArticleMutation.mutate({
      projectId: currentProject.id,
      title: newArticle.title,
      slug: generateSlug(newArticle.title),
      content: newArticle.content,
      categoryId: newArticle.categoryId || undefined,
      status: newArticle.status,
    });
  };

  const handleCreateCategory = () => {
    if (!currentProject?.id || !newCategoryName.trim()) return;
    createCategoryMutation.mutate({
      projectId: currentProject.id,
      name: newCategoryName,
      slug: generateSlug(newCategoryName),
    });
  };

  const handleDeleteArticle = (id: string) => {
    deleteArticleMutation.mutate({ id });
  };

  const handleToggleStatus = (id: string, currentStatus: ArticleStatus) => {
    const newStatus = currentStatus === "published" ? "draft" : "published";
    updateArticleMutation.mutate({ id, status: newStatus });
  };

  const articles = articlesData?.articles || [];

  if (!currentProject) {
    return (
      <EmptyState
        title="No project selected"
        description="Please select a project to view the knowledge base"
      />
    );
  }

  if (error) {
    return <ApiError error={error} onRetry={refetch} />;
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="page-header">
        <h1 className="page-title">Knowledge</h1>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() =>
              window.open(
                `/help/${currentProject.slug || currentProject.id}`,
                "_blank",
              )
            }
            className="h-7 w-7 p-0 text-muted-foreground"
          >
            <ExternalLink className="h-4 w-4" />
          </Button>
          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button size="sm" variant="ghost" className="h-7 w-7 p-0">
                <Plus className="h-4 w-4" />
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[400px]">
              <DialogHeader>
                <DialogTitle>Create article</DialogTitle>
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
                    placeholder="Article title"
                    value={newArticle.title}
                    onChange={(e) =>
                      setNewArticle({ ...newArticle, title: e.target.value })
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
                    placeholder="Write your article content..."
                    value={newArticle.content}
                    onChange={(e) =>
                      setNewArticle({ ...newArticle, content: e.target.value })
                    }
                    rows={6}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="grid gap-1.5">
                    <Label className="text-xs text-muted-foreground">
                      Category
                    </Label>
                    <Select
                      value={newArticle.categoryId}
                      onValueChange={(value) =>
                        setNewArticle({ ...newArticle, categoryId: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select category" />
                      </SelectTrigger>
                      <SelectContent>
                        {categories?.map((cat) => (
                          <SelectItem key={cat.id} value={cat.id}>
                            {cat.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-1.5">
                    <Label className="text-xs text-muted-foreground">
                      Status
                    </Label>
                    <Select
                      value={newArticle.status}
                      onValueChange={(value) =>
                        setNewArticle({
                          ...newArticle,
                          status: value as ArticleStatus,
                        })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="draft">Draft</SelectItem>
                        <SelectItem value="published">Published</SelectItem>
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
                  onClick={handleCreateArticle}
                  disabled={
                    !newArticle.title.trim() || createArticleMutation.isPending
                  }
                >
                  {createArticleMutation.isPending && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  Create
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Two-panel layout */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar - Categories */}
        <div
          className="w-56 border-r border-border flex flex-col"
          style={{ borderRightWidth: "0.5px" }}
        >
          <div
            className="flex items-center justify-between h-11 px-4 border-b border-border"
            style={{ borderBottomWidth: "0.5px" }}
          >
            <span className="text-xs text-muted-foreground">Categories</span>
            <Dialog
              open={isCreateCategoryOpen}
              onOpenChange={setIsCreateCategoryOpen}
            >
              <DialogTrigger asChild>
                <button className="text-muted-foreground hover:text-foreground transition-colors">
                  <Plus className="h-4 w-4" />
                </button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[300px]">
                <DialogHeader>
                  <DialogTitle>Create category</DialogTitle>
                </DialogHeader>
                <div className="grid gap-4 pt-2">
                  <div className="grid gap-1.5">
                    <Label
                      htmlFor="categoryName"
                      className="text-xs text-muted-foreground"
                    >
                      Name
                    </Label>
                    <Input
                      id="categoryName"
                      placeholder="e.g. Integrations"
                      value={newCategoryName}
                      onChange={(e) => setNewCategoryName(e.target.value)}
                    />
                  </div>
                </div>
                <DialogFooter className="pt-4">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setIsCreateCategoryOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleCreateCategory}
                    disabled={
                      !newCategoryName.trim() ||
                      createCategoryMutation.isPending
                    }
                  >
                    {createCategoryMutation.isPending && (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    )}
                    Create
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
          <div className="flex-1 overflow-y-auto p-3">
            <button
              onClick={() => setSelectedCategory(null)}
              className={cn(
                "w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-colors",
                !selectedCategory
                  ? "bg-accent/40 text-foreground"
                  : "text-muted-foreground hover:bg-accent/30 hover:text-foreground",
              )}
            >
              <Folder className="h-4 w-4" />
              <span className="flex-1 text-left">All Articles</span>
              <span className="text-xs text-muted-foreground/50">
                {articlesData?.pagination.total || 0}
              </span>
            </button>
            {categories?.map((category) => (
              <button
                key={category.id}
                onClick={() => setSelectedCategory(category.id)}
                className={cn(
                  "w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-colors",
                  selectedCategory === category.id
                    ? "bg-accent/40 text-foreground"
                    : "text-muted-foreground hover:bg-accent/30 hover:text-foreground",
                )}
              >
                <Folder className="h-4 w-4" />
                <span className="flex-1 text-left">{category.name}</span>
                <span className="text-xs text-muted-foreground/50">
                  {category._count?.articles || 0}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Search and Filters */}
          <div
            className="flex items-center gap-3 h-11 px-4 border-b border-border"
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
                    onClick={() => setStatusFilter(value as ArticleStatus)}
                  >
                    {label}
                    {statusFilter === value && (
                      <span className="ml-auto text-foreground">✓</span>
                    )}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Articles List */}
          <div className="flex-1 overflow-auto">
            {isLoading ? (
              <div className="flex items-center justify-center h-full">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : articles.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                <FileText className="h-12 w-12 mb-4 opacity-50" />
                <p>No articles found</p>
                <p className="text-sm">
                  Create your first article to get started
                </p>
              </div>
            ) : (
              articles.map((article) => (
                <div
                  key={article.id}
                  className="border-b border-border px-4 py-3 hover:bg-accent/30 transition-colors cursor-pointer"
                  style={{ borderBottomWidth: "0.5px" }}
                >
                  <div className="flex items-center gap-3">
                    {/* Icon */}
                    <div className="shrink-0 h-8 w-8 rounded-md bg-muted/50 border border-border/50 flex items-center justify-center text-muted-foreground">
                      <FileText className="h-4 w-4" />
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      {/* Row 1: Title + Status */}
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-foreground truncate">
                          {article.title}
                        </p>
                        {article.status !== "published" && (
                          <span
                            className={cn(
                              "text-[11px] leading-none px-1.5 py-1 rounded shrink-0",
                              statusColors[article.status],
                            )}
                          >
                            {statusLabels[article.status]}
                          </span>
                        )}
                      </div>
                      {/* Row 2: Category + Views + Helpful */}
                      <div className="flex items-center gap-1.5 mt-0.5">
                        {article.category && (
                          <>
                            <span className="text-xs text-muted-foreground/70">
                              {article.category.name}
                            </span>
                            <span className="text-muted-foreground/40">·</span>
                          </>
                        )}
                        <span className="text-xs text-muted-foreground/50 flex items-center gap-1">
                          <Eye className="h-3 w-3" />
                          {article.viewCount}
                        </span>
                        <span className="text-muted-foreground/40">·</span>
                        <span className="text-xs text-muted-foreground/50 flex items-center gap-1">
                          <ThumbsUp className="h-3 w-3" />
                          {article.helpfulCount}
                        </span>
                      </div>
                    </div>

                    {/* Actions */}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button className="shrink-0 p-1 text-muted-foreground hover:text-foreground transition-colors">
                          <MoreHorizontal className="h-4 w-4" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={() =>
                            handleToggleStatus(article.id, article.status)
                          }
                        >
                          {article.status === "published"
                            ? "Unpublish"
                            : "Publish"}
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => handleDeleteArticle(article.id)}
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
        </div>
      </div>
    </div>
  );
}

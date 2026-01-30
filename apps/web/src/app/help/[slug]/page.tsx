"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { trpc } from "@/lib/trpc";
import {
  Search,
  FileText,
  ChevronRight,
  ThumbsUp,
  ThumbsDown,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";

export default function PublicHelpCenterPage() {
  const params = useParams();
  const slug = params.slug as string;
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedArticle, setSelectedArticle] = useState<string | null>(null);

  // Resolve project ID from slug
  const { data: project, isLoading: projectLoading } =
    trpc.auth.getProjectBySlug.useQuery(
      { slug },
      { enabled: !!slug, retry: false },
    );

  // Fetch help center data
  const { data: helpCenter, isLoading: helpCenterLoading } =
    trpc.knowledge.getPublicHelpCenter.useQuery(
      { projectId: project?.id || "" },
      { enabled: !!project?.id },
    );

  // Search articles
  const { data: searchResults } = trpc.knowledge.searchArticles.useQuery(
    { projectId: project?.id || "", query: search, limit: 10 },
    { enabled: !!project?.id && search.length > 0 },
  );

  // Fetch single article
  const { data: articleDetail, isLoading: articleLoading } =
    trpc.knowledge.getArticleBySlug.useQuery(
      { projectId: project?.id || "", slug: selectedArticle || "" },
      { enabled: !!project?.id && !!selectedArticle },
    );

  // Article feedback mutation
  const feedbackMutation = trpc.knowledge.articleFeedback.useMutation();

  const isLoading = projectLoading || helpCenterLoading;

  // Show article detail view
  if (selectedArticle && articleDetail) {
    return (
      <div className="min-h-screen bg-background text-foreground">
        {/* Header */}
        <header className="border-b border-border/50 bg-card/30">
          <div className="max-w-4xl mx-auto px-6 py-4 flex items-center gap-2">
            <button
              onClick={() => setSelectedArticle(null)}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              {project?.name || "Help Center"}
            </button>
            <ChevronRight className="h-4 w-4 text-muted-foreground/50" />
            <span className="text-sm text-foreground/90 truncate">
              {articleDetail.title}
            </span>
          </div>
        </header>

        {/* Article Content */}
        <div className="max-w-3xl mx-auto px-6 py-8">
          <h1 className="text-2xl font-semibold text-foreground/90 mb-4">
            {articleDetail.title}
          </h1>
          {articleDetail.category && (
            <span className="inline-block px-2 py-1 text-xs rounded bg-accent/50 text-muted-foreground mb-6">
              {articleDetail.category.name}
            </span>
          )}
          <div className="prose prose-invert prose-sm max-w-none">
            <div
              dangerouslySetInnerHTML={{
                __html:
                  articleDetail.contentHtml ||
                  articleDetail.content.replace(/\n/g, "<br />"),
              }}
            />
          </div>

          {/* Feedback */}
          <div className="mt-12 pt-6 border-t border-border/50">
            <p className="text-sm text-muted-foreground mb-3">
              Was this article helpful?
            </p>
            <div className="flex gap-2">
              <button
                onClick={() =>
                  feedbackMutation.mutate({
                    articleId: articleDetail.id,
                    helpful: true,
                  })
                }
                disabled={feedbackMutation.isPending}
                className="flex items-center gap-2 px-4 py-2 rounded-lg border border-border/50 bg-card/30 text-sm hover:bg-card/50 transition-colors"
              >
                <ThumbsUp className="h-4 w-4" />
                Yes
              </button>
              <button
                onClick={() =>
                  feedbackMutation.mutate({
                    articleId: articleDetail.id,
                    helpful: false,
                  })
                }
                disabled={feedbackMutation.isPending}
                className="flex items-center gap-2 px-4 py-2 rounded-lg border border-border/50 bg-card/30 text-sm hover:bg-card/50 transition-colors"
              >
                <ThumbsDown className="h-4 w-4" />
                No
              </button>
            </div>
            {feedbackMutation.isSuccess && (
              <p className="text-sm text-emerald-400 mt-2">
                Thanks for your feedback!
              </p>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Project not found
  if (!project) {
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center">
        <div className="text-center">
          <FileText className="h-12 w-12 mx-auto mb-4 text-muted-foreground/30" />
          <h1 className="text-xl font-semibold text-foreground/90 mb-2">
            Help Center Not Found
          </h1>
          <p className="text-muted-foreground">
            This help center doesn't exist or is not public.
          </p>
        </div>
      </div>
    );
  }

  const categories = helpCenter?.categories || [];
  const popularArticles = helpCenter?.popularArticles || [];
  const displayArticles = search
    ? searchResults || []
    : selectedCategory
      ? categories.find((c) => c.id === selectedCategory)?.articles || []
      : popularArticles;

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="border-b border-border/50 bg-card/30">
        <div className="max-w-4xl mx-auto px-6 py-4">
          <span className="text-base font-medium text-foreground/90">
            {project.name} Help Center
          </span>
        </div>
      </header>

      {/* Hero */}
      <div className="py-12 px-6">
        <div className="max-w-xl mx-auto text-center">
          <h1 className="text-2xl font-semibold text-foreground/90 mb-3">
            How can we help?
          </h1>
          <p className="text-base text-muted-foreground mb-6">
            Search our knowledge base or browse by category
          </p>
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/50" />
            <input
              type="search"
              placeholder="Search articles..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setSelectedCategory(null);
              }}
              className="w-full pl-11 pr-4 py-3 text-base rounded-lg border border-border/50 bg-card/50 text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-border"
            />
          </div>
        </div>
      </div>

      {/* Category Cards */}
      {!search && !selectedCategory && categories.length > 0 && (
        <div className="max-w-4xl mx-auto px-6 pb-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className="p-4 rounded-lg border border-border/50 bg-card/30 text-left transition-colors hover:bg-card/50 hover:border-border"
              >
                <h3 className="text-sm font-medium text-foreground/90 mb-0.5">
                  {cat.name}
                </h3>
                <p className="text-xs text-muted-foreground/70">
                  {cat.articles.length} articles
                </p>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="max-w-4xl mx-auto px-6 pb-12">
        {/* Breadcrumb / Filter */}
        {(search || selectedCategory) && (
          <div className="flex items-center gap-3 mb-4">
            {selectedCategory && (
              <button
                onClick={() => setSelectedCategory(null)}
                className="text-sm text-muted-foreground hover:text-foreground/90 transition-colors"
              >
                ← All categories
              </button>
            )}
            {search && (
              <span className="text-sm text-muted-foreground">
                Results for "{search}"
              </span>
            )}
          </div>
        )}

        {/* Section Title */}
        {!search && (
          <h2 className="text-sm font-medium text-muted-foreground mb-4">
            {selectedCategory
              ? categories.find((c) => c.id === selectedCategory)?.name
              : "Popular Articles"}
          </h2>
        )}

        {/* Articles */}
        <div className="space-y-2">
          {displayArticles.map((article) => (
            <button
              key={article.id}
              onClick={() => setSelectedArticle(article.slug)}
              className="block w-full p-4 rounded-lg border border-border/50 bg-card/30 transition-colors hover:bg-card/50 hover:border-border group text-left"
            >
              <div className="flex items-center gap-4">
                <FileText className="h-5 w-5 text-muted-foreground/50 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <h3 className="text-base font-medium text-foreground/90 group-hover:text-foreground">
                    {article.title}
                  </h3>
                  {article.excerpt && (
                    <p className="text-sm text-muted-foreground/70 mt-0.5 truncate">
                      {article.excerpt}
                    </p>
                  )}
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground/30 flex-shrink-0 transition-transform group-hover:translate-x-0.5 group-hover:text-muted-foreground/50" />
              </div>
            </button>
          ))}

          {displayArticles.length === 0 && (
            <div className="text-center py-12">
              <FileText className="h-10 w-10 mx-auto mb-3 text-muted-foreground/30" />
              <p className="text-base text-muted-foreground/70 mb-1">
                No articles found
              </p>
              <p className="text-sm text-muted-foreground/50">
                {search
                  ? "Try a different search term"
                  : "No articles published yet"}
              </p>
            </div>
          )}
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

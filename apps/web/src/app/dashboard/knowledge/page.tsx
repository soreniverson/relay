'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
  Code,
  BookOpen,
  Lightbulb,
  Rocket,
  Settings,
  HelpCircle,
  Zap,
  Shield,
  type LucideIcon,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

type ArticleIconType = 'FileText' | 'Code' | 'BookOpen' | 'Lightbulb' | 'Rocket' | 'Settings' | 'HelpCircle' | 'Zap' | 'Shield';

const iconOptions: { value: ArticleIconType; icon: LucideIcon; label: string }[] = [
  { value: 'FileText', icon: FileText, label: 'Document' },
  { value: 'Code', icon: Code, label: 'Code' },
  { value: 'BookOpen', icon: BookOpen, label: 'Guide' },
  { value: 'Lightbulb', icon: Lightbulb, label: 'Tip' },
  { value: 'Rocket', icon: Rocket, label: 'Getting Started' },
  { value: 'Settings', icon: Settings, label: 'Settings' },
  { value: 'HelpCircle', icon: HelpCircle, label: 'FAQ' },
  { value: 'Zap', icon: Zap, label: 'Quick Start' },
  { value: 'Shield', icon: Shield, label: 'Security' },
];

const iconMap: Record<ArticleIconType, LucideIcon> = {
  FileText,
  Code,
  BookOpen,
  Lightbulb,
  Rocket,
  Settings,
  HelpCircle,
  Zap,
  Shield,
};

interface Article {
  id: string;
  title: string;
  content: string;
  slug: string;
  status: 'published' | 'draft' | 'archived';
  category: string;
  icon: ArticleIconType;
  viewCount: number;
  helpfulCount: number;
  updatedAt: string;
}

interface Category {
  id: string;
  name: string;
}

const initialArticles: Article[] = [
  {
    id: '1',
    title: 'Getting Started with Relay',
    content: 'Learn how to set up Relay in your application...',
    slug: 'getting-started',
    status: 'published',
    category: 'Onboarding',
    icon: 'Rocket',
    viewCount: 1243,
    helpfulCount: 89,
    updatedAt: '2024-01-15',
  },
  {
    id: '2',
    title: 'Setting Up Your First Project',
    content: 'Step-by-step guide to creating your first project...',
    slug: 'first-project',
    status: 'published',
    category: 'Onboarding',
    icon: 'BookOpen',
    viewCount: 856,
    helpfulCount: 62,
    updatedAt: '2024-01-14',
  },
  {
    id: '3',
    title: 'Understanding Feedback Collection',
    content: 'How feedback flows from users to your dashboard...',
    slug: 'feedback-collection',
    status: 'draft',
    category: 'Features',
    icon: 'Lightbulb',
    viewCount: 0,
    helpfulCount: 0,
    updatedAt: '2024-01-16',
  },
  {
    id: '4',
    title: 'API Documentation',
    content: 'Complete API reference for developers...',
    slug: 'api-docs',
    status: 'published',
    category: 'Developers',
    icon: 'Code',
    viewCount: 2341,
    helpfulCount: 156,
    updatedAt: '2024-01-12',
  },
];

const initialCategories: Category[] = [
  { id: '1', name: 'Onboarding' },
  { id: '2', name: 'Features' },
  { id: '3', name: 'Developers' },
  { id: '4', name: 'Troubleshooting' },
];

const statusColors = {
  published: 'bg-emerald-500/10 text-emerald-400',
  draft: 'bg-amber-500/10 text-amber-400',
  archived: 'bg-muted text-muted-foreground',
};

const statusLabels = {
  published: 'Published',
  draft: 'Draft',
  archived: 'Archived',
};

export default function KnowledgePage() {
  const [articles, setArticles] = useState(initialArticles);
  const [categories, setCategories] = useState(initialCategories);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isCreateCategoryOpen, setIsCreateCategoryOpen] = useState(false);
  const [newArticle, setNewArticle] = useState<{
    title: string;
    content: string;
    category: string;
    status: Article['status'];
  }>({
    title: '',
    content: '',
    category: 'Onboarding',
    status: 'draft',
  });
  const [newCategoryName, setNewCategoryName] = useState('');

  const filteredArticles = articles.filter((article) => {
    if (search && !article.title.toLowerCase().includes(search.toLowerCase())) {
      return false;
    }
    if (selectedCategory && article.category !== selectedCategory) {
      return false;
    }
    if (statusFilter && article.status !== statusFilter) {
      return false;
    }
    return true;
  });

  const handleCreateArticle = () => {
    if (!newArticle.title.trim()) return;

    const article: Article = {
      id: Date.now().toString(),
      title: newArticle.title,
      content: newArticle.content,
      slug: newArticle.title.toLowerCase().replace(/\s+/g, '-'),
      status: newArticle.status,
      category: newArticle.category,
      icon: 'FileText',
      viewCount: 0,
      helpfulCount: 0,
      updatedAt: new Date().toISOString().split('T')[0],
    };

    setArticles((prev) => [article, ...prev]);
    setNewArticle({ title: '', content: '', category: 'Onboarding', status: 'draft' });
    setIsCreateOpen(false);
  };

  const handleCreateCategory = () => {
    if (!newCategoryName.trim()) return;

    const category: Category = {
      id: Date.now().toString(),
      name: newCategoryName,
    };

    setCategories((prev) => [...prev, category]);
    setNewCategoryName('');
    setIsCreateCategoryOpen(false);
  };

  const handleDeleteArticle = (id: string) => {
    setArticles((prev) => prev.filter((a) => a.id !== id));
  };

  const handleToggleStatus = (id: string) => {
    setArticles((prev) =>
      prev.map((article) =>
        article.id === id
          ? { ...article, status: article.status === 'published' ? 'draft' : 'published' }
          : article
      )
    );
  };

  const handleIconChange = (id: string, icon: ArticleIconType) => {
    setArticles((prev) =>
      prev.map((article) =>
        article.id === id ? { ...article, icon } : article
      )
    );
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="page-header">
        <h1 className="page-title">Knowledge</h1>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => window.open('/help', '_blank')}
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
                  <Label htmlFor="title" className="text-xs text-muted-foreground">Title</Label>
                  <Input
                    id="title"
                    placeholder="Article title"
                    value={newArticle.title}
                    onChange={(e) => setNewArticle({ ...newArticle, title: e.target.value })}
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="content" className="text-xs text-muted-foreground">Content</Label>
                  <Textarea
                    id="content"
                    placeholder="Write your article content..."
                    value={newArticle.content}
                    onChange={(e) => setNewArticle({ ...newArticle, content: e.target.value })}
                    rows={6}
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="grid gap-1.5">
                    <Label className="text-xs text-muted-foreground">Category</Label>
                    <Select
                      value={newArticle.category}
                      onValueChange={(value) => setNewArticle({ ...newArticle, category: value })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {categories.map((cat) => (
                          <SelectItem key={cat.id} value={cat.name}>
                            {cat.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-1.5">
                    <Label className="text-xs text-muted-foreground">Status</Label>
                    <Select
                      value={newArticle.status}
                      onValueChange={(value) => setNewArticle({ ...newArticle, status: value as Article['status'] })}
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
                <Button variant="ghost" size="sm" onClick={() => setIsCreateOpen(false)}>
                  Cancel
                </Button>
                <Button size="sm" onClick={handleCreateArticle} disabled={!newArticle.title.trim()}>
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
        <div className="w-56 border-r border-border flex flex-col" style={{ borderRightWidth: '0.5px' }}>
          <div className="flex items-center justify-between h-11 px-4 border-b border-border" style={{ borderBottomWidth: '0.5px' }}>
            <span className="text-xs text-muted-foreground">Categories</span>
            <Dialog open={isCreateCategoryOpen} onOpenChange={setIsCreateCategoryOpen}>
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
                    <Label htmlFor="categoryName" className="text-xs text-muted-foreground">Name</Label>
                    <Input
                      id="categoryName"
                      placeholder="e.g. Integrations"
                      value={newCategoryName}
                      onChange={(e) => setNewCategoryName(e.target.value)}
                    />
                  </div>
                </div>
                <DialogFooter className="pt-4">
                  <Button variant="ghost" size="sm" onClick={() => setIsCreateCategoryOpen(false)}>
                    Cancel
                  </Button>
                  <Button size="sm" onClick={handleCreateCategory} disabled={!newCategoryName.trim()}>
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
                'w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-colors',
                !selectedCategory
                  ? 'bg-accent/40 text-foreground'
                  : 'text-muted-foreground hover:bg-accent/30 hover:text-foreground'
              )}
            >
              <Folder className="h-4 w-4" />
              <span className="flex-1 text-left">All Articles</span>
              <span className="text-xs text-muted-foreground/50">{articles.length}</span>
            </button>
            {categories.map((category) => (
              <button
                key={category.id}
                onClick={() => setSelectedCategory(category.name)}
                className={cn(
                  'w-full flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-colors',
                  selectedCategory === category.name
                    ? 'bg-accent/40 text-foreground'
                    : 'text-muted-foreground hover:bg-accent/30 hover:text-foreground'
                )}
              >
                <Folder className="h-4 w-4" />
                <span className="flex-1 text-left">{category.name}</span>
                <span className="text-xs text-muted-foreground/50">
                  {articles.filter((a) => a.category === category.name).length}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Search and Filters */}
          <div className="flex items-center gap-3 h-11 px-4 border-b border-border" style={{ borderBottomWidth: '0.5px' }}>
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
                  {statusFilter ? statusLabels[statusFilter as keyof typeof statusLabels] : 'Status'}
                  <ChevronDown className="h-3 w-3" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setStatusFilter(null)}>
                  All
                  {!statusFilter && <span className="ml-auto text-foreground">✓</span>}
                </DropdownMenuItem>
                {Object.entries(statusLabels).map(([value, label]) => (
                  <DropdownMenuItem key={value} onClick={() => setStatusFilter(value)}>
                    {label}
                    {statusFilter === value && <span className="ml-auto text-foreground">✓</span>}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          {/* Articles List */}
          <div className="flex-1 overflow-auto">
            {filteredArticles.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
                <FileText className="h-12 w-12 mb-4 opacity-50" />
                <p>No articles found</p>
                <p className="text-sm">Try adjusting your filters</p>
              </div>
            ) : (
              filteredArticles.map((article) => {
                const IconComponent = iconMap[article.icon];
                return (
                  <div
                    key={article.id}
                    className="border-b border-border px-4 py-3 hover:bg-accent/30 transition-colors cursor-pointer"
                    style={{ borderBottomWidth: '0.5px' }}
                  >
                    <div className="flex items-center gap-3">
                      {/* Icon with picker */}
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button className="shrink-0 h-8 w-8 rounded-md bg-muted/50 border border-border/50 flex items-center justify-center text-muted-foreground hover:bg-muted hover:text-foreground transition-colors focus:outline-none">
                            <IconComponent className="h-4 w-4" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="start" className="p-1.5 min-w-0">
                          <div className="grid grid-cols-3 gap-1">
                            {iconOptions.map((option) => {
                              const OptionIcon = option.icon;
                              const isSelected = article.icon === option.value;
                              return (
                                <button
                                  key={option.value}
                                  onClick={() => handleIconChange(article.id, option.value)}
                                  className={cn(
                                    'h-8 w-8 rounded-md flex items-center justify-center transition-colors focus:outline-none',
                                    isSelected
                                      ? 'bg-accent text-foreground'
                                      : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground'
                                  )}
                                >
                                  <OptionIcon className="h-4 w-4" />
                                </button>
                              );
                            })}
                          </div>
                        </DropdownMenuContent>
                      </DropdownMenu>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        {/* Row 1: Title + Status */}
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium text-foreground truncate">
                            {article.title}
                          </p>
                          {article.status !== 'published' && (
                            <span className={cn('text-[11px] leading-none px-1.5 py-1 rounded shrink-0', statusColors[article.status])}>
                              {statusLabels[article.status]}
                            </span>
                          )}
                        </div>
                        {/* Row 2: Updated + Views + Helpful */}
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className="text-xs text-muted-foreground/70">
                            Updated {article.updatedAt}
                          </span>
                          <span className="text-muted-foreground/40">·</span>
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
                          <DropdownMenuItem onClick={() => handleToggleStatus(article.id)}>
                            {article.status === 'published' ? 'Unpublish' : 'Publish'}
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleDeleteArticle(article.id)} className="text-destructive">
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
      </div>
    </div>
  );
}

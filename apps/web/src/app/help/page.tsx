'use client';

import { useState } from 'react';
import { Search, FileText, ChevronRight } from 'lucide-react';

interface Article {
  id: string;
  title: string;
  excerpt: string;
  category: string;
  readTime?: string;
}

const articles: Article[] = [
  {
    id: '1',
    title: 'Getting Started with Relay',
    excerpt: 'Learn how to set up Relay in your application and start collecting feedback.',
    category: 'Onboarding',
    readTime: '3 min',
  },
  {
    id: '2',
    title: 'Setting Up Your First Project',
    excerpt: 'Step-by-step guide to creating your first project and configuring your workspace.',
    category: 'Onboarding',
    readTime: '5 min',
  },
  {
    id: '3',
    title: 'Understanding Feedback Collection',
    excerpt: 'How feedback flows from users to your dashboard and best practices for organization.',
    category: 'Features',
    readTime: '4 min',
  },
  {
    id: '4',
    title: 'API Documentation',
    excerpt: 'Complete API reference for developers building custom integrations.',
    category: 'Developers',
    readTime: '10 min',
  },
];

const categories = [
  { name: 'Onboarding', description: 'Get started quickly' },
  { name: 'Features', description: 'Learn what you can do' },
  { name: 'Developers', description: 'API & integrations' },
  { name: 'Troubleshooting', description: 'Common issues & fixes' },
];

export default function HelpCenterPage() {
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const filteredArticles = articles.filter((article) => {
    if (search && !article.title.toLowerCase().includes(search.toLowerCase())) {
      return false;
    }
    if (selectedCategory && article.category !== selectedCategory) {
      return false;
    }
    return true;
  });

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="border-b border-border/50 bg-card/30">
        <div className="max-w-4xl mx-auto px-6 py-4">
          <span className="text-base font-medium text-foreground/90">Help Center</span>
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
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-11 pr-4 py-3 text-base rounded-lg border border-border/50 bg-card/50 text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-border"
            />
          </div>
        </div>
      </div>

      {/* Category Cards */}
      {!search && !selectedCategory && (
        <div className="max-w-4xl mx-auto px-6 pb-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {categories.map((cat) => (
              <button
                key={cat.name}
                onClick={() => setSelectedCategory(cat.name)}
                className="p-4 rounded-lg border border-border/50 bg-card/30 text-left transition-colors hover:bg-card/50 hover:border-border"
              >
                <h3 className="text-sm font-medium text-foreground/90 mb-0.5">{cat.name}</h3>
                <p className="text-xs text-muted-foreground/70">{cat.description}</p>
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
            {selectedCategory || 'All Articles'}
          </h2>
        )}

        {/* Articles */}
        <div className="space-y-2">
          {filteredArticles.map((article) => (
            <a
              key={article.id}
              href={`/help/${article.id}`}
              className="block p-4 rounded-lg border border-border/50 bg-card/30 transition-colors hover:bg-card/50 hover:border-border group"
            >
              <div className="flex items-center gap-4">
                <FileText className="h-5 w-5 text-muted-foreground/50 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <h3 className="text-base font-medium text-foreground/90 group-hover:text-foreground">
                    {article.title}
                  </h3>
                  <p className="text-sm text-muted-foreground/70 mt-0.5">
                    {article.category} · {article.readTime}
                  </p>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground/30 flex-shrink-0 transition-transform group-hover:translate-x-0.5 group-hover:text-muted-foreground/50" />
              </div>
            </a>
          ))}

          {filteredArticles.length === 0 && (
            <div className="text-center py-12">
              <FileText className="h-10 w-10 mx-auto mb-3 text-muted-foreground/30" />
              <p className="text-base text-muted-foreground/70 mb-1">No articles found</p>
              <p className="text-sm text-muted-foreground/50">Try a different search term</p>
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

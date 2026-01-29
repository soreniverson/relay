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
  Navigation,
  MoreHorizontal,
  Edit,
  BarChart2,
  Eye,
  ChevronDown,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';

interface TourStep {
  id: string;
  title: string;
  content: string;
  target: string;
  placement: 'top' | 'bottom' | 'left' | 'right';
}

interface Tour {
  id: string;
  name: string;
  description: string;
  steps: number;
  stepDetails: TourStep[];
  enabled: boolean;
  viewCount: number;
  completionCount: number;
  targetUrl: string;
  createdAt: string;
}

const mockTours: Tour[] = [
  {
    id: '1',
    name: 'Welcome Tour',
    description: 'Introduce new users to the dashboard',
    steps: 5,
    stepDetails: [
      { id: '1-1', title: 'Welcome!', content: 'Welcome to your dashboard. Let\'s get you started.', target: '#dashboard-header', placement: 'bottom' },
      { id: '1-2', title: 'Navigation', content: 'Use the sidebar to navigate between sections.', target: '#sidebar', placement: 'right' },
      { id: '1-3', title: 'Quick Actions', content: 'Create new items quickly from here.', target: '#quick-actions', placement: 'bottom' },
      { id: '1-4', title: 'Recent Activity', content: 'See your recent activity at a glance.', target: '#activity', placement: 'left' },
      { id: '1-5', title: 'Get Help', content: 'Need help? Click here anytime.', target: '#help-button', placement: 'top' },
    ],
    enabled: true,
    viewCount: 1543,
    completionCount: 892,
    targetUrl: '/dashboard',
    createdAt: '2024-01-10',
  },
  {
    id: '2',
    name: 'Feature Onboarding',
    description: 'Show users how to create their first project',
    steps: 8,
    stepDetails: [
      { id: '2-1', title: 'Create Project', content: 'Click here to create your first project.', target: '#create-btn', placement: 'bottom' },
      { id: '2-2', title: 'Project Name', content: 'Give your project a meaningful name.', target: '#project-name', placement: 'right' },
      { id: '2-3', title: 'Settings', content: 'Configure your project settings here.', target: '#settings', placement: 'bottom' },
    ],
    enabled: true,
    viewCount: 756,
    completionCount: 423,
    targetUrl: '/projects/new',
    createdAt: '2024-01-12',
  },
  {
    id: '3',
    name: 'Advanced Settings Tour',
    description: 'Guide power users through advanced configuration',
    steps: 6,
    stepDetails: [
      { id: '3-1', title: 'Advanced Options', content: 'Access advanced settings from here.', target: '#advanced', placement: 'bottom' },
      { id: '3-2', title: 'Integrations', content: 'Connect with your favorite tools.', target: '#integrations', placement: 'right' },
    ],
    enabled: false,
    viewCount: 234,
    completionCount: 178,
    targetUrl: '/settings',
    createdAt: '2024-01-14',
  },
];

export default function ToursPage() {
  const [search, setSearch] = useState('');
  const [tours, setTours] = useState(mockTours);
  const [statusFilter, setStatusFilter] = useState<'active' | 'paused' | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [isAnalyticsOpen, setIsAnalyticsOpen] = useState(false);
  const [selectedTour, setSelectedTour] = useState<Tour | null>(null);
  const [previewStep, setPreviewStep] = useState(0);
  const [newTour, setNewTour] = useState({
    name: '',
    description: '',
    targetUrl: '',
  });
  const [editingTour, setEditingTour] = useState<{
    name: string;
    description: string;
    targetUrl: string;
    stepDetails: TourStep[];
  }>({
    name: '',
    description: '',
    targetUrl: '',
    stepDetails: [],
  });

  const filteredTours = tours.filter((tour) => {
    if (statusFilter === 'active' && !tour.enabled) return false;
    if (statusFilter === 'paused' && tour.enabled) return false;
    if (search && !tour.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const toggleTour = (tourId: string) => {
    setTours((prev) =>
      prev.map((t) =>
        t.id === tourId ? { ...t, enabled: !t.enabled } : t
      )
    );
  };

  const handleCreate = () => {
    if (!newTour.name.trim()) return;

    const tour: Tour = {
      id: Date.now().toString(),
      name: newTour.name,
      description: newTour.description,
      steps: 0,
      stepDetails: [],
      enabled: false,
      viewCount: 0,
      completionCount: 0,
      targetUrl: newTour.targetUrl || '/',
      createdAt: new Date().toISOString().split('T')[0],
    };

    setTours((prev) => [tour, ...prev]);
    setNewTour({ name: '', description: '', targetUrl: '' });
    setIsCreateOpen(false);
  };

  const handleDelete = (id: string) => {
    setTours((prev) => prev.filter((t) => t.id !== id));
  };

  const handleDuplicate = (id: string) => {
    const original = tours.find((t) => t.id === id);
    if (!original) return;

    const duplicate: Tour = {
      ...original,
      id: Date.now().toString(),
      name: `${original.name} (Copy)`,
      stepDetails: original.stepDetails.map((s) => ({ ...s, id: `${Date.now()}-${s.id}` })),
      enabled: false,
      viewCount: 0,
      completionCount: 0,
      createdAt: new Date().toISOString().split('T')[0],
    };

    setTours((prev) => [duplicate, ...prev]);
  };

  const handleEdit = (tour: Tour) => {
    setSelectedTour(tour);
    setEditingTour({
      name: tour.name,
      description: tour.description,
      targetUrl: tour.targetUrl,
      stepDetails: tour.stepDetails,
    });
    setIsEditOpen(true);
  };

  const handleSaveEdit = () => {
    if (!selectedTour || !editingTour.name.trim()) return;

    setTours((prev) =>
      prev.map((t) =>
        t.id === selectedTour.id
          ? {
              ...t,
              name: editingTour.name,
              description: editingTour.description,
              targetUrl: editingTour.targetUrl,
              stepDetails: editingTour.stepDetails,
              steps: editingTour.stepDetails.length,
            }
          : t
      )
    );
    setIsEditOpen(false);
    setSelectedTour(null);
  };

  const handlePreview = (tour: Tour) => {
    setSelectedTour(tour);
    setPreviewStep(0);
    setIsPreviewOpen(true);
  };

  const handleAnalytics = (tour: Tour) => {
    setSelectedTour(tour);
    setIsAnalyticsOpen(true);
  };

  const addStep = () => {
    const newStep: TourStep = {
      id: Date.now().toString(),
      title: '',
      content: '',
      target: '',
      placement: 'bottom',
    };
    setEditingTour((prev) => ({
      ...prev,
      stepDetails: [...prev.stepDetails, newStep],
    }));
  };

  const updateStep = (stepId: string, field: keyof TourStep, value: string) => {
    setEditingTour((prev) => ({
      ...prev,
      stepDetails: prev.stepDetails.map((s) =>
        s.id === stepId ? { ...s, [field]: value } : s
      ),
    }));
  };

  const removeStep = (stepId: string) => {
    setEditingTour((prev) => ({
      ...prev,
      stepDetails: prev.stepDetails.filter((s) => s.id !== stepId),
    }));
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="page-header">
        <h1 className="page-title">Tours</h1>
        <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => setIsCreateOpen(true)}>
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      {/* Search and Filters */}
      <div className="flex items-center gap-3 px-4 py-2 border-b border-border" style={{ borderBottomWidth: '0.5px' }}>
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
                {statusFilter === null ? 'Status' : statusFilter === 'active' ? 'Active' : 'Paused'}
                <ChevronDown className="h-3 w-3" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setStatusFilter(null)}>
                All
                {statusFilter === null && <span className="ml-auto text-foreground">✓</span>}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setStatusFilter('active')}>
                Active
                {statusFilter === 'active' && <span className="ml-auto text-foreground">✓</span>}
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setStatusFilter('paused')}>
                Paused
                {statusFilter === 'paused' && <span className="ml-auto text-foreground">✓</span>}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Tours List */}
      <div className="flex-1 overflow-auto">
        {filteredTours.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
            <Navigation className="h-12 w-12 mb-4 opacity-50" />
            <p>No tours found</p>
            <p className="text-sm">Try adjusting your filters</p>
          </div>
        ) : (
          filteredTours.map((tour) => (
            <div
              key={tour.id}
              className="border-b border-border px-4 py-3 hover:bg-accent/30 transition-colors"
              style={{ borderBottomWidth: '0.5px' }}
            >
              <div className="flex items-center gap-3">
                {/* Icon */}
                <div
                  className={cn(
                    'shrink-0 h-8 w-8 rounded-md flex items-center justify-center',
                    tour.enabled
                      ? 'bg-foreground/10 text-foreground'
                      : 'bg-muted/50 text-muted-foreground'
                  )}
                >
                  <Navigation className="h-4 w-4" />
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">
                    {tour.name}
                  </p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="text-xs text-muted-foreground">
                      {tour.steps} steps
                    </span>
                    <span className="text-muted-foreground/40">·</span>
                    <span className="text-xs text-muted-foreground/70">
                      {tour.viewCount.toLocaleString()} views
                    </span>
                    <span className="text-muted-foreground/40">·</span>
                    <span className="text-xs text-muted-foreground/70">
                      {tour.viewCount > 0
                        ? Math.round((tour.completionCount / tour.viewCount) * 100)
                        : 0}% completed
                    </span>
                    <span className="text-muted-foreground/40">·</span>
                    <span className="text-xs text-muted-foreground/50">
                      {tour.targetUrl}
                    </span>
                  </div>
                </div>

                {/* Status Badge */}
                <button
                  onClick={() => toggleTour(tour.id)}
                  className={cn(
                    'shrink-0 text-[11px] leading-none px-1.5 py-1 rounded transition-colors',
                    tour.enabled
                      ? 'bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20'
                      : 'bg-muted text-muted-foreground hover:bg-muted/80'
                  )}
                >
                  {tour.enabled ? 'Active' : 'Paused'}
                </button>

                {/* Actions */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className="shrink-0 p-1 text-muted-foreground hover:text-foreground transition-colors">
                      <MoreHorizontal className="h-4 w-4" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => handleEdit(tour)}>
                      Edit
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handlePreview(tour)}>
                      Preview
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleAnalytics(tour)}>
                      Analytics
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleDuplicate(tour.id)}>
                      Duplicate
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleDelete(tour.id)} className="text-destructive">
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
            <DialogTitle>Add tour</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 pt-2">
            <div className="grid gap-1.5">
              <Label htmlFor="name" className="text-xs text-muted-foreground">Name</Label>
              <Input
                id="name"
                placeholder="e.g. Welcome Tour"
                value={newTour.name}
                onChange={(e) => setNewTour({ ...newTour, name: e.target.value })}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="description" className="text-xs text-muted-foreground">Description</Label>
              <Textarea
                id="description"
                placeholder="Optional details"
                value={newTour.description}
                onChange={(e) => setNewTour({ ...newTour, description: e.target.value })}
                rows={3}
              />
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="targetUrl" className="text-xs text-muted-foreground">Target URL</Label>
              <Input
                id="targetUrl"
                placeholder="e.g. /dashboard"
                value={newTour.targetUrl}
                onChange={(e) => setNewTour({ ...newTour, targetUrl: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter className="pt-4">
            <Button variant="ghost" size="sm" onClick={() => setIsCreateOpen(false)}>
              Cancel
            </Button>
            <Button size="sm" onClick={handleCreate} disabled={!newTour.name.trim()}>
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Modal */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit tour</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 pt-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="edit-name" className="text-xs text-muted-foreground">Name</Label>
                <Input
                  id="edit-name"
                  placeholder="e.g. Welcome Tour"
                  value={editingTour.name}
                  onChange={(e) => setEditingTour({ ...editingTour, name: e.target.value })}
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="edit-targetUrl" className="text-xs text-muted-foreground">Target URL</Label>
                <Input
                  id="edit-targetUrl"
                  placeholder="e.g. /dashboard"
                  value={editingTour.targetUrl}
                  onChange={(e) => setEditingTour({ ...editingTour, targetUrl: e.target.value })}
                />
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label htmlFor="edit-description" className="text-xs text-muted-foreground">Description</Label>
              <Textarea
                id="edit-description"
                placeholder="Optional details"
                value={editingTour.description}
                onChange={(e) => setEditingTour({ ...editingTour, description: e.target.value })}
                rows={2}
              />
            </div>

            <div className="mt-2">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs text-muted-foreground">Steps</span>
                <Button variant="ghost" size="sm" className="h-7" onClick={addStep}>
                  <Plus className="h-3.5 w-3.5 mr-1" />
                  Add
                </Button>
              </div>
              <div className="space-y-3">
                {editingTour.stepDetails.map((step, index) => (
                  <div key={step.id} className="border border-border rounded-md p-3" style={{ borderWidth: '0.5px' }}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs text-muted-foreground">Step {index + 1}</span>
                      <button
                        onClick={() => removeStep(step.id)}
                        className="text-xs text-muted-foreground hover:text-destructive transition-colors"
                      >
                        Remove
                      </button>
                    </div>
                    <div className="grid gap-2">
                      <div className="grid grid-cols-2 gap-2">
                        <Input
                          placeholder="Title"
                          value={step.title}
                          onChange={(e) => updateStep(step.id, 'title', e.target.value)}
                          className="h-8 text-sm"
                        />
                        <Input
                          placeholder="#element-id"
                          value={step.target}
                          onChange={(e) => updateStep(step.id, 'target', e.target.value)}
                          className="h-8 text-sm"
                        />
                      </div>
                      <Textarea
                        placeholder="Content"
                        value={step.content}
                        onChange={(e) => updateStep(step.id, 'content', e.target.value)}
                        rows={2}
                        className="text-sm"
                      />
                      <Select
                        value={step.placement}
                        onValueChange={(value) => updateStep(step.id, 'placement', value)}
                      >
                        <SelectTrigger className="h-8 text-sm">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="top">Top</SelectItem>
                          <SelectItem value="bottom">Bottom</SelectItem>
                          <SelectItem value="left">Left</SelectItem>
                          <SelectItem value="right">Right</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                ))}
                {editingTour.stepDetails.length === 0 && (
                  <div className="text-center py-6 text-muted-foreground border border-dashed border-border rounded-md" style={{ borderWidth: '0.5px' }}>
                    <p className="text-xs">No steps yet</p>
                  </div>
                )}
              </div>
            </div>
          </div>
          <DialogFooter className="pt-4">
            <Button variant="ghost" size="sm" onClick={() => setIsEditOpen(false)}>
              Cancel
            </Button>
            <Button size="sm" onClick={handleSaveEdit} disabled={!editingTour.name.trim()}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Preview Modal */}
      <Dialog open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle className="text-sm font-medium">Preview</DialogTitle>
          </DialogHeader>

          {selectedTour && selectedTour.stepDetails.length > 0 ? (
            <>
              <div className="bg-muted/50 rounded-md p-3 border border-border" style={{ borderWidth: '0.5px' }}>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-[11px] bg-foreground/10 text-foreground px-1.5 py-0.5 rounded">
                    {previewStep + 1}/{selectedTour.stepDetails.length}
                  </span>
                  <span className="text-xs text-muted-foreground/70">
                    {selectedTour.stepDetails[previewStep].target}
                  </span>
                </div>
                <h4 className="text-sm font-medium text-foreground mb-1">
                  {selectedTour.stepDetails[previewStep].title}
                </h4>
                <p className="text-xs text-muted-foreground">
                  {selectedTour.stepDetails[previewStep].content}
                </p>
                <p className="text-xs text-muted-foreground/50 mt-2 capitalize">
                  {selectedTour.stepDetails[previewStep].placement}
                </p>
              </div>

              <div className="flex items-center justify-between pt-2">
                <button
                  onClick={() => setPreviewStep((p) => Math.max(0, p - 1))}
                  disabled={previewStep === 0}
                  className="text-xs text-muted-foreground hover:text-foreground disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Previous
                </button>
                <div className="flex gap-1">
                  {selectedTour.stepDetails.map((_, index) => (
                    <button
                      key={index}
                      onClick={() => setPreviewStep(index)}
                      className={cn(
                        'h-1.5 w-1.5 rounded-full transition-colors',
                        index === previewStep ? 'bg-foreground' : 'bg-muted-foreground/30'
                      )}
                    />
                  ))}
                </div>
                <button
                  onClick={() => setPreviewStep((p) => Math.min(selectedTour.stepDetails.length - 1, p + 1))}
                  disabled={previewStep === selectedTour.stepDetails.length - 1}
                  className="text-xs text-muted-foreground hover:text-foreground disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Next
                </button>
              </div>
            </>
          ) : (
            <div className="text-center py-6 text-muted-foreground">
              <p className="text-sm">No steps yet</p>
              <button
                className="text-xs text-muted-foreground hover:text-foreground mt-2 transition-colors"
                onClick={() => {
                  setIsPreviewOpen(false);
                  if (selectedTour) handleEdit(selectedTour);
                }}
              >
                Add steps
              </button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Analytics Modal */}
      <Dialog open={isAnalyticsOpen} onOpenChange={setIsAnalyticsOpen}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle className="text-sm font-medium">Analytics</DialogTitle>
          </DialogHeader>

          {selectedTour && (
            <>
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-muted/50 rounded-md p-3 border border-border text-center" style={{ borderWidth: '0.5px' }}>
                  <p className="text-xl font-semibold text-foreground">{selectedTour.viewCount.toLocaleString()}</p>
                  <p className="text-xs text-muted-foreground">Views</p>
                </div>
                <div className="bg-muted/50 rounded-md p-3 border border-border text-center" style={{ borderWidth: '0.5px' }}>
                  <p className="text-xl font-semibold text-foreground">{selectedTour.completionCount.toLocaleString()}</p>
                  <p className="text-xs text-muted-foreground">Completions</p>
                </div>
                <div className="bg-muted/50 rounded-md p-3 border border-border text-center" style={{ borderWidth: '0.5px' }}>
                  <p className="text-xl font-semibold text-foreground">
                    {selectedTour.viewCount > 0
                      ? Math.round((selectedTour.completionCount / selectedTour.viewCount) * 100)
                      : 0}%
                  </p>
                  <p className="text-xs text-muted-foreground">Completion</p>
                </div>
                <div className="bg-muted/50 rounded-md p-3 border border-border text-center" style={{ borderWidth: '0.5px' }}>
                  <p className="text-xl font-semibold text-foreground">{selectedTour.steps}</p>
                  <p className="text-xs text-muted-foreground">Steps</p>
                </div>
              </div>

              {selectedTour.stepDetails.length > 0 && (
                <div className="mt-2">
                  <span className="text-xs text-muted-foreground">Drop-off by step</span>
                  <div className="space-y-1.5 mt-2">
                    {selectedTour.stepDetails.map((step, index) => {
                      const dropOff = Math.max(0, 100 - (index * 15) - Math.random() * 10);
                      return (
                        <div key={step.id} className="flex items-center gap-2">
                          <span className="text-xs text-muted-foreground/70 w-10">{index + 1}</span>
                          <div className="flex-1 bg-muted/50 rounded-full h-1.5">
                            <div
                              className="bg-foreground/40 h-1.5 rounded-full"
                              style={{ width: `${dropOff}%` }}
                            />
                          </div>
                          <span className="text-xs text-muted-foreground/70 w-8">{Math.round(dropOff)}%</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

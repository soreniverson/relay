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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { MoreHorizontal, Plus, ChevronDown, Search } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SurveyResponse {
  id: string;
  score: number;
  feedback?: string;
  userId: string;
  userEmail: string;
  createdAt: string;
}

interface Survey {
  id: string;
  name: string;
  type: 'nps' | 'csat' | 'custom';
  active: boolean;
  responseCount: number;
  score?: number;
  question: string;
  followUpQuestion?: string;
  thankYouMessage: string;
  targetingRules: string[];
  responses: SurveyResponse[];
  createdAt: string;
}

const mockSurveys: Survey[] = [
  {
    id: '1',
    name: 'Monthly NPS Survey',
    type: 'nps',
    active: true,
    responseCount: 234,
    score: 42,
    question: 'How likely are you to recommend us to a friend or colleague?',
    followUpQuestion: 'What is the primary reason for your score?',
    thankYouMessage: 'Thank you for your feedback!',
    targetingRules: ['Show after 7 days', 'Once per user'],
    responses: [
      { id: '1', score: 9, feedback: 'Great product, love the features!', userId: '1', userEmail: 'jane@example.com', createdAt: '2024-01-15' },
      { id: '2', score: 10, feedback: 'Best tool I\'ve used', userId: '2', userEmail: 'john@example.com', createdAt: '2024-01-14' },
      { id: '3', score: 7, feedback: 'Good but could be faster', userId: '3', userEmail: 'alice@example.com', createdAt: '2024-01-13' },
    ],
    createdAt: '2024-01-01T00:00:00Z',
  },
  {
    id: '2',
    name: 'Post-Checkout CSAT',
    type: 'csat',
    active: true,
    responseCount: 156,
    score: 4.2,
    question: 'How satisfied are you with your purchase experience?',
    followUpQuestion: 'How can we improve?',
    thankYouMessage: 'Thanks for shopping with us!',
    targetingRules: ['Show on /checkout/success', 'Show once per purchase'],
    responses: [
      { id: '1', score: 5, feedback: 'Quick and easy checkout', userId: '1', userEmail: 'sarah@example.com', createdAt: '2024-01-15' },
      { id: '2', score: 4, userId: '2', userEmail: 'mike@example.com', createdAt: '2024-01-14' },
    ],
    createdAt: '2024-01-10T00:00:00Z',
  },
  {
    id: '3',
    name: 'Feature Feedback Survey',
    type: 'custom',
    active: false,
    responseCount: 89,
    question: 'How useful did you find the export feature?',
    followUpQuestion: 'What other features would you like to see?',
    thankYouMessage: 'Your feedback helps us improve!',
    targetingRules: ['Show to Pro users', 'After using export feature'],
    responses: [],
    createdAt: '2024-01-15T00:00:00Z',
  },
];

const typeLabels: Record<string, string> = {
  nps: 'NPS',
  csat: 'CSAT',
  custom: 'Custom',
};


const npsTemplate = {
  question: 'How likely are you to recommend us to a friend or colleague?',
  followUpQuestion: 'What is the primary reason for your score?',
  thankYouMessage: 'Thank you for your feedback! We truly appreciate it.',
};

const csatTemplate = {
  question: 'How satisfied are you with your experience?',
  followUpQuestion: 'Is there anything we could do better?',
  thankYouMessage: 'Thank you for your feedback!',
};

const customTemplate = {
  question: '',
  followUpQuestion: '',
  thankYouMessage: 'Thank you for your response!',
};

export default function SurveysPage() {
  const [surveys, setSurveys] = useState(mockSurveys);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [createType, setCreateType] = useState<'nps' | 'csat' | 'custom'>('nps');
  const [viewResponsesId, setViewResponsesId] = useState<string | null>(null);
  const [newSurvey, setNewSurvey] = useState({
    name: '',
    question: npsTemplate.question,
    followUpQuestion: npsTemplate.followUpQuestion,
    thankYouMessage: npsTemplate.thankYouMessage,
    targetUrl: '',
    showAfterDays: '7',
    frequency: 'once',
  });

  const filteredSurveys = surveys.filter((survey) => {
    if (typeFilter && survey.type !== typeFilter) return false;
    if (statusFilter === 'active' && !survey.active) return false;
    if (statusFilter === 'paused' && survey.active) return false;
    if (search) {
      const searchLower = search.toLowerCase();
      return survey.name.toLowerCase().includes(searchLower);
    }
    return true;
  });

  const toggleActive = (id: string) => {
    setSurveys((prev) =>
      prev.map((survey) =>
        survey.id === id ? { ...survey, active: !survey.active } : survey
      )
    );
  };

  const handleCreate = () => {
    if (!newSurvey.name.trim()) return;

    const targetingRules: string[] = [];
    if (newSurvey.targetUrl) targetingRules.push(`Show on ${newSurvey.targetUrl}`);
    if (newSurvey.showAfterDays) targetingRules.push(`Show after ${newSurvey.showAfterDays} days`);
    if (newSurvey.frequency === 'once') targetingRules.push('Once per user');
    else if (newSurvey.frequency === 'monthly') targetingRules.push('Once per month');

    const survey: Survey = {
      id: Date.now().toString(),
      name: newSurvey.name,
      type: createType,
      active: false,
      responseCount: 0,
      score: undefined,
      question: newSurvey.question,
      followUpQuestion: newSurvey.followUpQuestion || undefined,
      thankYouMessage: newSurvey.thankYouMessage,
      targetingRules,
      responses: [],
      createdAt: new Date().toISOString(),
    };

    setSurveys((prev) => [survey, ...prev]);
    resetForm();
    setIsCreateOpen(false);
  };

  const resetForm = () => {
    const template = createType === 'nps' ? npsTemplate : createType === 'csat' ? csatTemplate : customTemplate;
    setNewSurvey({
      name: '',
      question: template.question,
      followUpQuestion: template.followUpQuestion,
      thankYouMessage: template.thankYouMessage,
      targetUrl: '',
      showAfterDays: '7',
      frequency: 'once',
    });
  };

  const handleDelete = (id: string) => {
    setSurveys((prev) => prev.filter((s) => s.id !== id));
  };

  const handleDuplicate = (id: string) => {
    const original = surveys.find((s) => s.id === id);
    if (!original) return;

    const duplicate: Survey = {
      ...original,
      id: Date.now().toString(),
      name: `${original.name} (Copy)`,
      responseCount: 0,
      score: undefined,
      active: false,
      responses: [],
      createdAt: new Date().toISOString(),
    };

    setSurveys((prev) => [duplicate, ...prev]);
  };

  const openCreateModal = (type: 'nps' | 'csat' | 'custom') => {
    setCreateType(type);
    const template = type === 'nps' ? npsTemplate : type === 'csat' ? csatTemplate : customTemplate;
    setNewSurvey({
      name: '',
      question: template.question,
      followUpQuestion: template.followUpQuestion,
      thankYouMessage: template.thankYouMessage,
      targetUrl: '',
      showAfterDays: '7',
      frequency: 'once',
    });
    setIsCreateOpen(true);
  };

  const viewingResponses = viewResponsesId ? surveys.find(s => s.id === viewResponsesId) : null;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="page-header">
        <h1 className="page-title">Surveys</h1>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="sm" variant="ghost" className="h-7 w-7 p-0">
              <Plus className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => openCreateModal('nps')}>
              <div>
                <div className="text-sm">NPS Survey</div>
                <div className="text-xs text-muted-foreground">0-10 scale</div>
              </div>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => openCreateModal('csat')}>
              <div>
                <div className="text-sm">CSAT Survey</div>
                <div className="text-xs text-muted-foreground">1-5 scale</div>
              </div>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => openCreateModal('custom')}>
              <div>
                <div className="text-sm">Custom Survey</div>
                <div className="text-xs text-muted-foreground">Your own questions</div>
              </div>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
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
                {typeFilter ? typeLabels[typeFilter] : 'Type'}
                <ChevronDown className="h-3 w-3" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setTypeFilter(null)}>
                All
                {!typeFilter && <span className="ml-auto text-foreground">✓</span>}
              </DropdownMenuItem>
              {Object.entries(typeLabels).map(([value, label]) => (
                <DropdownMenuItem key={value} onClick={() => setTypeFilter(value)}>
                  {label}
                  {typeFilter === value && <span className="ml-auto text-foreground">✓</span>}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
                {statusFilter === 'active' ? 'Active' : statusFilter === 'paused' ? 'Paused' : 'Status'}
                <ChevronDown className="h-3 w-3" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setStatusFilter(null)}>
                All
                {!statusFilter && <span className="ml-auto text-foreground">✓</span>}
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

      {/* Survey List */}
      <div className="flex-1 overflow-auto">
        {filteredSurveys.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
            <Search className="h-12 w-12 mb-4 opacity-50" />
            <p>No surveys found</p>
            <p className="text-sm">Try adjusting your filters</p>
          </div>
        ) : (
          filteredSurveys.map((survey) => (
            <div
              key={survey.id}
              className="border-b border-border px-4 py-3 hover:bg-accent/30 transition-colors"
              style={{ borderBottomWidth: '0.5px' }}
            >
              <div className="flex items-center gap-3">
                {/* Content */}
                <div className="flex-1 min-w-0">
                  {/* Row 1: Name + Status indicator */}
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-foreground truncate">
                      {survey.name}
                    </p>
                    <button
                      onClick={() => toggleActive(survey.id)}
                      className={cn(
                        'text-[11px] leading-none px-1.5 py-1 rounded shrink-0 transition-colors',
                        survey.active
                          ? 'bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20'
                          : 'bg-muted text-muted-foreground hover:bg-muted/80'
                      )}
                    >
                      {survey.active ? 'Active' : 'Paused'}
                    </button>
                  </div>
                  {/* Row 2: Type + Responses + Score + Targeting */}
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="text-xs text-muted-foreground">
                      {typeLabels[survey.type]}
                    </span>
                    <span className="text-muted-foreground/40">·</span>
                    <button
                      onClick={() => setViewResponsesId(survey.id)}
                      className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {survey.responseCount} responses
                    </button>
                    {survey.score !== undefined && (
                      <>
                        <span className="text-muted-foreground/40">·</span>
                        <span className="text-xs text-muted-foreground">
                          Score: {survey.score}{survey.type === 'csat' && '/5'}
                        </span>
                      </>
                    )}
                    {survey.targetingRules.length > 0 && (
                      <>
                        <span className="text-muted-foreground/40">·</span>
                        <span className="text-xs text-muted-foreground/50 truncate">
                          {survey.targetingRules[0]}
                        </span>
                      </>
                    )}
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
                    <DropdownMenuItem onClick={() => setViewResponsesId(survey.id)}>
                      View Responses
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => toggleActive(survey.id)}>
                      {survey.active ? 'Pause Survey' : 'Activate Survey'}
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => handleDuplicate(survey.id)}>
                      Duplicate
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleDelete(survey.id)} className="text-destructive">
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
            <DialogTitle>Create {typeLabels[createType]} survey</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 pt-2 max-h-[60vh] overflow-y-auto">
            <div className="grid gap-1.5">
              <Label htmlFor="name" className="text-xs text-muted-foreground">Name</Label>
              <Input
                id="name"
                placeholder={`e.g. ${createType === 'nps' ? 'Monthly NPS' : createType === 'csat' ? 'Post-Purchase CSAT' : 'Feature Feedback'}`}
                value={newSurvey.name}
                onChange={(e) => setNewSurvey({ ...newSurvey, name: e.target.value })}
              />
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="question" className="text-xs text-muted-foreground">Question</Label>
              <Textarea
                id="question"
                placeholder="Enter your question..."
                value={newSurvey.question}
                onChange={(e) => setNewSurvey({ ...newSurvey, question: e.target.value })}
                rows={2}
              />
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="followUp" className="text-xs text-muted-foreground">Follow-up (optional)</Label>
              <Textarea
                id="followUp"
                placeholder="Ask for more details..."
                value={newSurvey.followUpQuestion}
                onChange={(e) => setNewSurvey({ ...newSurvey, followUpQuestion: e.target.value })}
                rows={2}
              />
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="thankYou" className="text-xs text-muted-foreground">Thank you message</Label>
              <Input
                id="thankYou"
                placeholder="Message shown after submission"
                value={newSurvey.thankYouMessage}
                onChange={(e) => setNewSurvey({ ...newSurvey, thankYouMessage: e.target.value })}
              />
            </div>

            <div className="grid gap-1.5">
              <Label htmlFor="targetUrl" className="text-xs text-muted-foreground">Target URL (optional)</Label>
              <Input
                id="targetUrl"
                placeholder="e.g. /checkout/success"
                value={newSurvey.targetUrl}
                onChange={(e) => setNewSurvey({ ...newSurvey, targetUrl: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label className="text-xs text-muted-foreground">Show after</Label>
                <Select
                  value={newSurvey.showAfterDays}
                  onValueChange={(value) => setNewSurvey({ ...newSurvey, showAfterDays: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0">Immediately</SelectItem>
                    <SelectItem value="1">1 day</SelectItem>
                    <SelectItem value="7">7 days</SelectItem>
                    <SelectItem value="14">14 days</SelectItem>
                    <SelectItem value="30">30 days</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-1.5">
                <Label className="text-xs text-muted-foreground">Frequency</Label>
                <Select
                  value={newSurvey.frequency}
                  onValueChange={(value) => setNewSurvey({ ...newSurvey, frequency: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="once">Once per user</SelectItem>
                    <SelectItem value="monthly">Once per month</SelectItem>
                    <SelectItem value="always">Every visit</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter className="pt-4">
            <Button variant="ghost" size="sm" onClick={() => setIsCreateOpen(false)}>
              Cancel
            </Button>
            <Button size="sm" onClick={handleCreate} disabled={!newSurvey.name.trim() || !newSurvey.question.trim()}>
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Responses Modal */}
      <Dialog open={!!viewResponsesId} onOpenChange={() => setViewResponsesId(null)}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>{viewingResponses?.name}</DialogTitle>
          </DialogHeader>
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            <span>{viewingResponses?.responseCount} responses</span>
            {viewingResponses?.score !== undefined && (
              <>
                <span className="text-muted-foreground/40">·</span>
                <span>Score: {viewingResponses.score}{viewingResponses.type === 'csat' ? '/5' : ''}</span>
              </>
            )}
          </div>
          <div className="mt-2 max-h-[50vh] overflow-y-auto">
            {viewingResponses?.responses.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-sm">
                No responses yet
              </div>
            ) : (
              <div className="space-y-2">
                {viewingResponses?.responses.map((response) => (
                  <div
                    key={response.id}
                    className="border-b border-border py-3"
                    style={{ borderBottomWidth: '0.5px' }}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className={cn(
                          'text-sm font-medium',
                          viewingResponses.type === 'nps'
                            ? response.score >= 9 ? 'text-emerald-400' : response.score >= 7 ? 'text-amber-400' : 'text-red-400'
                            : response.score >= 4 ? 'text-emerald-400' : response.score >= 3 ? 'text-amber-400' : 'text-red-400'
                        )}>
                          {response.score}{viewingResponses.type === 'csat' && '/5'}
                        </span>
                        <span className="text-xs text-muted-foreground">{response.userEmail}</span>
                      </div>
                      <span className="text-xs text-muted-foreground/50">{response.createdAt}</span>
                    </div>
                    {response.feedback && (
                      <p className="text-sm text-foreground mt-1">{response.feedback}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

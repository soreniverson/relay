"use client";

import { useState, useEffect, useRef } from "react";
import { useAuthStore } from "@/stores/auth";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Loader2,
  MessageSquare,
  Sparkles,
  FileText,
  ChevronRight,
  X,
} from "lucide-react";
import { ApiError, EmptyState } from "@/components/api-error";
import { cn } from "@/lib/utils";

type ConversationStatus = "open" | "closed";

interface ConversationListItem {
  id: string;
  status: ConversationStatus;
  subject: string | null;
  assigneeId: string | null;
  lastMessageAt: Date | string | null;
  messageCount: number;
  createdAt: Date | string;
  user: {
    id: string;
    email: string | null;
    name: string | null;
    avatarUrl: string | null;
  } | null;
  lastMessage: {
    id: string;
    direction: "inbound" | "outbound";
    body: string;
    createdAt: Date | string;
  } | null;
}

interface ConversationMessage {
  id: string;
  direction: "inbound" | "outbound";
  body: string;
  createdAt: Date | string;
}

export default function ConversationsPage() {
  const { currentProject } = useAuthStore();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");
  const [filter, setFilter] = useState<"all" | ConversationStatus>("all");
  const [showCopilot, setShowCopilot] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const utils = trpc.useUtils();

  // Fetch conversations list
  const {
    data: conversationsData,
    isLoading: listLoading,
    error: listError,
    refetch: refetchList,
  } = trpc.conversations.list.useQuery(
    {
      projectId: currentProject?.id || "",
      status: filter === "all" ? undefined : filter,
    },
    { enabled: !!currentProject?.id },
  );

  // Fetch selected conversation with messages
  const { data: selectedConversation, isLoading: detailLoading } =
    trpc.conversations.get.useQuery(
      {
        projectId: currentProject?.id || "",
        conversationId: selectedId || "",
      },
      { enabled: !!currentProject?.id && !!selectedId },
    );

  // AI status query
  const { data: aiStatus } = trpc.conversations.aiStatus.useQuery(
    { projectId: currentProject?.id || "" },
    { enabled: !!currentProject?.id },
  );

  // Relevant articles query
  const { data: relevantArticlesData } =
    trpc.conversations.getRelevantArticles.useQuery(
      {
        projectId: currentProject?.id || "",
        conversationId: selectedId || "",
      },
      { enabled: !!currentProject?.id && !!selectedId && showCopilot },
    );

  // Send message mutation
  const sendMutation = trpc.conversations.sendMessage.useMutation({
    onSuccess: () => {
      setReplyText("");
      setSuggestions([]);
      utils.conversations.get.invalidate();
      utils.conversations.list.invalidate();
    },
  });

  // Suggest replies mutation
  const suggestMutation = trpc.conversations.suggestReplies.useMutation({
    onSuccess: (data) => {
      setSuggestions(data.suggestions);
    },
  });

  // Update status mutation
  const updateStatusMutation = trpc.conversations.updateStatus.useMutation({
    onSuccess: () => {
      utils.conversations.get.invalidate();
      utils.conversations.list.invalidate();
    },
  });

  const conversations = conversationsData?.data || [];
  const relevantArticles = relevantArticlesData?.articles || [];

  // Auto-select first conversation if none selected
  useEffect(() => {
    if (!selectedId && conversations.length > 0) {
      setSelectedId(conversations[0].id);
    }
  }, [conversations, selectedId]);

  // Clear suggestions when conversation changes
  useEffect(() => {
    setSuggestions([]);
  }, [selectedId]);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [selectedConversation?.messages]);

  const handleSendReply = () => {
    if (!replyText.trim() || !selectedId || !currentProject?.id) return;
    sendMutation.mutate({
      projectId: currentProject.id,
      conversationId: selectedId,
      body: replyText,
    });
  };

  const handleSuggestReplies = () => {
    if (!selectedId || !currentProject?.id) return;
    setShowCopilot(true);
    suggestMutation.mutate({
      projectId: currentProject.id,
      conversationId: selectedId,
    });
  };

  const handleUseSuggestion = (suggestion: string) => {
    setReplyText(suggestion);
  };

  const handleToggleStatus = () => {
    if (!selectedConversation || !currentProject?.id) return;
    const newStatus =
      selectedConversation.status === "open" ? "closed" : "open";
    updateStatusMutation.mutate({
      projectId: currentProject.id,
      conversationId: selectedConversation.id,
      status: newStatus,
    });
  };

  const formatTime = (date: string | Date) => {
    const d = new Date(date);
    const now = new Date();
    const diffDays = Math.floor(
      (now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24),
    );

    if (diffDays === 0) {
      return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    } else if (diffDays === 1) {
      return "Yesterday";
    } else if (diffDays < 7) {
      return d.toLocaleDateString([], { weekday: "short" });
    }
    return d.toLocaleDateString([], { month: "short", day: "numeric" });
  };

  if (!currentProject) {
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground">
        <p>Select a project to view conversations</p>
      </div>
    );
  }

  if (listLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (listError) {
    return (
      <ApiError
        error={listError}
        onRetry={() => refetchList()}
        title="Failed to load conversations"
      />
    );
  }

  return (
    <div className="flex h-full">
      {/* Conversation List */}
      <div className="w-80 border-r border-border bg-card/50 flex flex-col">
        <div className="h-14 px-4 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-medium text-foreground">
              Conversations
            </h2>
            <span className="text-xs bg-muted text-muted-foreground px-1.5 py-0.5 rounded">
              {conversations.length}
            </span>
          </div>
        </div>
        <div className="px-4 py-2 border-b border-border">
          <div className="filter-tabs">
            {(["all", "open", "closed"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`filter-tab ${filter === f ? "filter-tab-active" : ""}`}
              >
                {f.charAt(0).toUpperCase() + f.slice(1)}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {conversations.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full p-4 text-center">
              <MessageSquare className="h-8 w-8 text-muted-foreground/50 mb-2" />
              <p className="text-sm text-muted-foreground">
                No conversations yet
              </p>
            </div>
          ) : (
            conversations.map((conversation: ConversationListItem) => (
              <button
                key={conversation.id}
                onClick={() => setSelectedId(conversation.id)}
                className={`w-full p-3 text-left border-b border-border hover:bg-accent/50 transition-colors ${
                  selectedId === conversation.id ? "bg-accent" : ""
                }`}
              >
                <div className="flex items-start justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-full bg-muted text-muted-foreground flex items-center justify-center text-xs font-medium">
                      {(
                        conversation.user?.name ||
                        conversation.user?.email ||
                        "U"
                      )
                        .charAt(0)
                        .toUpperCase()}
                    </div>
                    <div>
                      <div className="font-medium text-sm text-foreground">
                        {conversation.user?.name || "Anonymous"}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {conversation.user?.email || "No email"}
                      </div>
                    </div>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {conversation.lastMessageAt
                      ? formatTime(conversation.lastMessageAt)
                      : ""}
                  </span>
                </div>

                <div className="text-sm font-medium text-foreground mb-1 truncate">
                  {conversation.subject || "No subject"}
                </div>
                {conversation.lastMessage && (
                  <div className="text-sm text-muted-foreground truncate">
                    {conversation.lastMessage.direction === "outbound" &&
                      "You: "}
                    {conversation.lastMessage.body}
                  </div>
                )}

                <div className="flex items-center gap-2 mt-2">
                  {conversation.status === "closed" && (
                    <span className="text-xs bg-muted text-muted-foreground px-2 py-0.5 rounded">
                      Closed
                    </span>
                  )}
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Message Thread */}
      {selectedId && selectedConversation ? (
        <div className="flex-1 flex flex-col">
          {/* Header */}
          <div className="h-14 px-4 border-b border-border flex items-center justify-between">
            <div>
              <h3 className="text-sm font-medium text-foreground">
                {selectedConversation.subject || "Conversation"}
              </h3>
              <p className="text-xs text-muted-foreground">
                {selectedConversation.user?.email || "Anonymous"} ·{" "}
                {selectedConversation.messageCount} messages
              </p>
            </div>
            <div className="flex items-center gap-2">
              {aiStatus?.available && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowCopilot(!showCopilot)}
                  className={cn(showCopilot && "bg-accent")}
                >
                  <Sparkles className="h-4 w-4 mr-1" />
                  Copilot
                </Button>
              )}
              <Button
                variant={
                  selectedConversation.status === "open" ? "default" : "outline"
                }
                size="sm"
                onClick={handleToggleStatus}
                disabled={updateStatusMutation.isPending}
              >
                {selectedConversation.status === "open" ? "Close" : "Reopen"}
              </Button>
            </div>
          </div>

          <div className="flex-1 flex overflow-hidden">
            {/* Messages Area */}
            <div className="flex-1 flex flex-col">
              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {detailLoading ? (
                  <div className="flex items-center justify-center h-full">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : (
                  selectedConversation.messages.map(
                    (message: ConversationMessage) => (
                      <div
                        key={message.id}
                        className={`flex ${message.direction === "outbound" ? "justify-end" : ""}`}
                      >
                        <div
                          className={`max-w-lg rounded-lg p-3 ${
                            message.direction === "outbound"
                              ? "bg-primary text-primary-foreground"
                              : "bg-muted text-foreground"
                          }`}
                        >
                          <p className="text-sm whitespace-pre-wrap">
                            {message.body}
                          </p>
                          <div
                            className={`text-xs mt-1 ${
                              message.direction === "outbound"
                                ? "text-primary-foreground/70"
                                : "text-muted-foreground"
                            }`}
                          >
                            {new Date(message.createdAt).toLocaleTimeString(
                              [],
                              {
                                hour: "2-digit",
                                minute: "2-digit",
                              },
                            )}
                          </div>
                        </div>
                      </div>
                    ),
                  )
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* AI Suggestions */}
              {showCopilot && suggestions.length > 0 && (
                <div className="border-t border-border p-3 bg-accent/30">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                      <Sparkles className="h-3 w-3" />
                      Suggested Replies
                    </span>
                    <button
                      onClick={() => setSuggestions([])}
                      className="text-muted-foreground hover:text-foreground"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                  <div className="space-y-2">
                    {suggestions.map((suggestion, index) => (
                      <button
                        key={index}
                        onClick={() => handleUseSuggestion(suggestion)}
                        className="w-full text-left p-2 text-sm rounded border border-border bg-card hover:bg-accent/50 transition-colors"
                      >
                        {suggestion}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Reply Box */}
              {selectedConversation.status === "open" && (
                <div className="p-4 border-t border-border bg-card">
                  <div className="flex gap-2">
                    <Input
                      value={replyText}
                      onChange={(e) => setReplyText(e.target.value)}
                      placeholder="Type your reply..."
                      className="flex-1"
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          handleSendReply();
                        }
                      }}
                    />
                    {aiStatus?.available && (
                      <Button
                        variant="outline"
                        onClick={handleSuggestReplies}
                        disabled={suggestMutation.isPending}
                      >
                        {suggestMutation.isPending ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Sparkles className="h-4 w-4" />
                        )}
                      </Button>
                    )}
                    <Button
                      onClick={handleSendReply}
                      disabled={!replyText.trim() || sendMutation.isPending}
                    >
                      {sendMutation.isPending ? "Sending..." : "Send"}
                    </Button>
                  </div>
                </div>
              )}
            </div>

            {/* Copilot Sidebar */}
            {showCopilot && (
              <div className="w-64 border-l border-border bg-card/50 flex flex-col">
                <div className="p-3 border-b border-border">
                  <h4 className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                    <FileText className="h-3 w-3" />
                    Relevant Articles
                  </h4>
                </div>
                <div className="flex-1 overflow-y-auto p-2">
                  {relevantArticles.length === 0 ? (
                    <p className="text-xs text-muted-foreground text-center py-4">
                      No matching articles found
                    </p>
                  ) : (
                    <div className="space-y-1">
                      {relevantArticles.map((article) => (
                        <a
                          key={article.id}
                          href={`/help/${currentProject.slug || currentProject.id}/${article.slug}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block p-2 rounded hover:bg-accent/50 transition-colors group"
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-foreground group-hover:text-foreground truncate">
                              {article.title}
                            </span>
                            <ChevronRight className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                          </div>
                          {article.excerpt && (
                            <p className="text-xs text-muted-foreground truncate mt-0.5">
                              {article.excerpt}
                            </p>
                          )}
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center text-muted-foreground">
          {conversations.length === 0 ? (
            <EmptyState
              icon={<MessageSquare className="h-6 w-6 text-muted-foreground" />}
              title="No conversations"
              description="Conversations will appear here when users start chatting through the widget"
            />
          ) : (
            <p>Select a conversation to view messages</p>
          )}
        </div>
      )}
    </div>
  );
}

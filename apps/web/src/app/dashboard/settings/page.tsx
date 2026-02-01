"use client";

import { useState, useEffect } from "react";
import { useAuthStore } from "@/stores/auth";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { Loader2, Copy, Check } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState("general");

  const tabs = [
    { id: "general", label: "General" },
    { id: "team", label: "Team" },
    { id: "api-keys", label: "API Keys" },
    { id: "integrations", label: "Integrations" },
    { id: "privacy", label: "Privacy" },
    { id: "billing", label: "Billing" },
  ];

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="page-header">
        <h1 className="page-title">Settings</h1>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <div
          className="w-56 flex-shrink-0 border-r border-border py-2"
          style={{ borderRightWidth: "0.5px" }}
        >
          <nav className="space-y-0.5 px-2">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "w-full text-left px-3 py-1.5 rounded-md text-sm transition-colors",
                  activeTab === tab.id
                    ? "bg-accent text-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-accent/50",
                )}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Content */}
        <div className="flex-1 max-w-2xl overflow-auto p-6">
          {activeTab === "general" && <GeneralSettings />}
          {activeTab === "team" && <TeamSettings />}
          {activeTab === "api-keys" && <ApiKeysSettings />}
          {activeTab === "integrations" && <IntegrationsSettings />}
          {activeTab === "privacy" && <PrivacySettings />}
          {activeTab === "billing" && <BillingSettings />}
        </div>
      </div>
    </div>
  );
}

function GeneralSettings() {
  const { currentProject, setCurrentProject } = useAuthStore();
  const [projectName, setProjectName] = useState(currentProject?.name || "");
  const [projectSlug, setProjectSlug] = useState(currentProject?.slug || "");
  const [saving, setSaving] = useState(false);

  const updateMutation = trpc.auth.updateProject.useMutation({
    onSuccess: (data) => {
      // Update the current project in auth store
      if (currentProject) {
        setCurrentProject({
          ...currentProject,
          name: data.name,
          slug: data.slug ?? undefined,
        });
      }
      setSaving(false);
    },
    onError: () => {
      setSaving(false);
    },
  });

  const handleSave = () => {
    if (!currentProject?.id) return;
    setSaving(true);
    updateMutation.mutate({
      projectId: currentProject.id,
      name: projectName,
      slug: projectSlug || undefined,
    });
  };

  return (
    <div className="space-y-6">
      <div
        className="border border-border rounded-md p-4"
        style={{ borderWidth: "0.5px" }}
      >
        <h3 className="text-sm font-medium text-foreground mb-4">
          Project Details
        </h3>
        <div className="space-y-4">
          <div className="grid gap-1.5">
            <Label
              htmlFor="project-name"
              className="text-xs text-muted-foreground"
            >
              Project Name
            </Label>
            <Input
              id="project-name"
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
            />
          </div>
          <div className="grid gap-1.5">
            <Label
              htmlFor="project-slug"
              className="text-xs text-muted-foreground"
            >
              Public URL Slug
            </Label>
            <Input
              id="project-slug"
              placeholder="my-project"
              value={projectSlug}
              onChange={(e) =>
                setProjectSlug(
                  e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""),
                )
              }
            />
            <p className="text-xs text-muted-foreground">
              Used for public pages: /roadmap/{projectSlug || "slug"},
              /feedback/{projectSlug || "slug"}, /changelog/
              {projectSlug || "slug"}
            </p>
          </div>
          <div className="grid gap-1.5">
            <Label
              htmlFor="environment"
              className="text-xs text-muted-foreground"
            >
              Environment
            </Label>
            <Select defaultValue="production">
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="production">Production</SelectItem>
                <SelectItem value="staging">Staging</SelectItem>
                <SelectItem value="development">Development</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <Button
          size="sm"
          className="mt-4"
          onClick={handleSave}
          disabled={saving}
        >
          {saving ? "Saving..." : "Save Changes"}
        </Button>
      </div>

      <div
        className="border border-border rounded-md p-4"
        style={{ borderWidth: "0.5px" }}
      >
        <h3 className="text-sm font-medium text-foreground mb-3">
          Data Region
        </h3>
        <p className="text-xs text-muted-foreground mb-3">
          Your data is stored in the following region. This cannot be changed
          after project creation.
        </p>
        <div
          className="flex items-center gap-2 p-2.5 bg-muted/50 rounded-md border border-border"
          style={{ borderWidth: "0.5px" }}
        >
          <span className="text-lg">🇺🇸</span>
          <div>
            <div className="text-sm font-medium text-foreground">
              US West (Oregon)
            </div>
            <div className="text-xs text-muted-foreground">us-west-2</div>
          </div>
        </div>
      </div>

      <div
        className="border border-red-500/20 rounded-md p-4 bg-red-500/5"
        style={{ borderWidth: "0.5px" }}
      >
        <h3 className="text-sm font-medium text-red-400 mb-1">Danger Zone</h3>
        <p className="text-xs text-red-400/70 mb-3">
          Permanently delete this project and all associated data.
        </p>
        <Button
          variant="outline"
          size="sm"
          className="border-red-500/30 text-red-400 hover:bg-red-500/10"
        >
          Delete Project
        </Button>
      </div>
    </div>
  );
}

function TeamSettings() {
  const { currentProject } = useAuthStore();
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"admin" | "agent" | "viewer">("viewer");
  const [editingMember, setEditingMember] = useState<{
    userId: string;
    role: string;
  } | null>(null);

  const utils = trpc.useUtils();

  // Fetch members
  const { data: members, isLoading: membersLoading } = trpc.teams.listMembers.useQuery(
    { projectId: currentProject?.id || "" },
    { enabled: !!currentProject?.id }
  );

  // Fetch invitations
  const { data: invitations, isLoading: invitationsLoading } = trpc.teams.listInvitations.useQuery(
    { projectId: currentProject?.id || "" },
    { enabled: !!currentProject?.id }
  );

  // Mutations
  const inviteMutation = trpc.teams.invite.useMutation({
    onSuccess: () => {
      utils.teams.listMembers.invalidate();
      utils.teams.listInvitations.invalidate();
      setIsInviteOpen(false);
      setInviteEmail("");
      setInviteRole("viewer");
    },
  });

  const updateRoleMutation = trpc.teams.updateRole.useMutation({
    onSuccess: () => {
      utils.teams.listMembers.invalidate();
      setEditingMember(null);
    },
  });

  const removeMemberMutation = trpc.teams.removeMember.useMutation({
    onSuccess: () => utils.teams.listMembers.invalidate(),
  });

  const cancelInviteMutation = trpc.teams.cancelInvitation.useMutation({
    onSuccess: () => utils.teams.listInvitations.invalidate(),
  });

  const handleInvite = () => {
    if (!currentProject?.id || !inviteEmail) return;
    inviteMutation.mutate({
      projectId: currentProject.id,
      email: inviteEmail,
      role: inviteRole,
    });
  };

  const handleUpdateRole = (userId: string, newRole: "admin" | "agent" | "viewer") => {
    if (!currentProject?.id) return;
    updateRoleMutation.mutate({
      projectId: currentProject.id,
      userId,
      role: newRole,
    });
  };

  const handleRemoveMember = (userId: string) => {
    if (!currentProject?.id) return;
    if (confirm("Are you sure you want to remove this member?")) {
      removeMemberMutation.mutate({
        projectId: currentProject.id,
        userId,
      });
    }
  };

  const handleCancelInvite = (invitationId: string) => {
    if (confirm("Are you sure you want to cancel this invitation?")) {
      cancelInviteMutation.mutate({ invitationId });
    }
  };

  const isLoading = membersLoading || invitationsLoading;

  const roleLabels: Record<string, string> = {
    owner: "Owner",
    admin: "Admin",
    agent: "Agent",
    viewer: "Viewer",
  };

  return (
    <div className="space-y-6">
      <div
        className="border border-border rounded-md p-4"
        style={{ borderWidth: "0.5px" }}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-medium text-foreground">Team Members</h3>
          <Button size="sm" onClick={() => setIsInviteOpen(true)}>
            Invite
          </Button>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-1">
            {/* Active Members */}
            {members?.map((member) => (
              <div
                key={member.id}
                className="flex items-center justify-between p-2.5 rounded-md hover:bg-accent/30 transition-colors"
              >
                <div className="flex items-center gap-3">
                  {member.avatarUrl ? (
                    <img
                      src={member.avatarUrl}
                      alt={member.name || member.email}
                      className="w-7 h-7 rounded-full"
                    />
                  ) : (
                    <div className="w-7 h-7 rounded-full bg-foreground/10 text-foreground flex items-center justify-center text-xs font-medium">
                      {(member.name || member.email).charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div>
                    <div className="text-sm text-foreground">
                      {member.name || member.email}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {roleLabels[member.role]}
                    </div>
                  </div>
                </div>
                {member.role !== "owner" && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button className="text-xs text-muted-foreground hover:text-foreground transition-colors">
                        Edit
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => handleUpdateRole(member.userId, "admin")}>
                        Make Admin
                        {member.role === "admin" && <Check className="h-3 w-3 ml-auto" />}
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleUpdateRole(member.userId, "agent")}>
                        Make Agent
                        {member.role === "agent" && <Check className="h-3 w-3 ml-auto" />}
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleUpdateRole(member.userId, "viewer")}>
                        Make Viewer
                        {member.role === "viewer" && <Check className="h-3 w-3 ml-auto" />}
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => handleRemoveMember(member.userId)}
                        className="text-destructive"
                      >
                        Remove
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>
            ))}

            {/* Pending Invitations */}
            {invitations?.map((invite) => (
              <div
                key={invite.id}
                className="flex items-center justify-between p-2.5 rounded-md hover:bg-accent/30 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="w-7 h-7 rounded-full bg-amber-500/10 text-amber-400 flex items-center justify-center text-xs font-medium">
                    {invite.email.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <div className="text-sm text-foreground">{invite.email}</div>
                    <div className="text-xs text-muted-foreground">
                      {roleLabels[invite.role]} · Pending
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => handleCancelInvite(invite.id)}
                  className="text-xs text-amber-400 hover:text-amber-300 transition-colors"
                >
                  Cancel
                </button>
              </div>
            ))}

            {(!members || members.length === 0) && (!invitations || invitations.length === 0) && (
              <p className="text-sm text-muted-foreground text-center py-4">
                No team members yet.
              </p>
            )}
          </div>
        )}
      </div>

      <div
        className="border border-border rounded-md p-4"
        style={{ borderWidth: "0.5px" }}
      >
        <h3 className="text-sm font-medium text-foreground mb-3">Roles</h3>
        <div className="space-y-1 text-sm">
          {[
            { role: "Owner", desc: "Full access, billing, transfer ownership" },
            { role: "Admin", desc: "Full access, manage team, no billing" },
            { role: "Agent", desc: "Manage interactions, chat, view analytics" },
            { role: "Viewer", desc: "Read-only access to all data" },
          ].map((item) => (
            <div
              key={item.role}
              className="flex justify-between p-2 rounded-md bg-muted/30"
            >
              <span className="text-foreground">{item.role}</span>
              <span className="text-muted-foreground text-xs">{item.desc}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Invite Dialog */}
      <Dialog open={isInviteOpen} onOpenChange={setIsInviteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Invite Team Member</DialogTitle>
            <DialogDescription>
              Send an invitation to join this project.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid gap-1.5">
              <Label htmlFor="invite-email">Email address</Label>
              <Input
                id="invite-email"
                type="email"
                placeholder="colleague@company.com"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
              />
            </div>
            <div className="grid gap-1.5">
              <Label>Role</Label>
              <Select
                value={inviteRole}
                onValueChange={(v) => setInviteRole(v as "admin" | "agent" | "viewer")}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="agent">Agent</SelectItem>
                  <SelectItem value="viewer">Viewer</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setIsInviteOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleInvite}
              disabled={!inviteEmail || inviteMutation.isPending}
            >
              {inviteMutation.isPending ? "Sending..." : "Send Invite"}
            </Button>
          </DialogFooter>
          {inviteMutation.error && (
            <p className="text-xs text-destructive mt-2">
              {inviteMutation.error.message}
            </p>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ApiKeysSettings() {
  const { currentProject } = useAuthStore();
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newKeyName, setNewKeyName] = useState("");
  const [newKeyScopes, setNewKeyScopes] = useState<
    ("ingest" | "read" | "write" | "admin")[]
  >(["ingest", "read"]);
  const [createdKey, setCreatedKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const utils = trpc.useUtils();

  // Fetch API keys
  const { data: keys, isLoading } = trpc.auth.listApiKeys.useQuery(
    { projectId: currentProject?.id || "" },
    { enabled: !!currentProject?.id },
  );

  // Create API key mutation
  const createMutation = trpc.auth.createApiKey.useMutation({
    onSuccess: (data) => {
      setCreatedKey(data.key);
      utils.auth.listApiKeys.invalidate();
    },
  });

  // Revoke API key mutation
  const revokeMutation = trpc.auth.revokeApiKey.useMutation({
    onSuccess: () => {
      utils.auth.listApiKeys.invalidate();
    },
  });

  const handleCreate = () => {
    if (!currentProject?.id || !newKeyName) return;
    createMutation.mutate({
      projectId: currentProject.id,
      name: newKeyName,
      scopes: newKeyScopes,
    });
  };

  const handleRevoke = (keyId: string) => {
    if (!currentProject?.id) return;
    if (
      confirm(
        "Are you sure you want to revoke this API key? This cannot be undone.",
      )
    ) {
      revokeMutation.mutate({ projectId: currentProject.id, keyId });
    }
  };

  const handleCopy = () => {
    if (createdKey) {
      navigator.clipboard.writeText(createdKey);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleCloseDialog = () => {
    setShowCreateDialog(false);
    setNewKeyName("");
    setCreatedKey(null);
  };

  if (!currentProject) {
    return (
      <div className="text-muted-foreground text-sm">
        Select a project to manage API keys
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div
        className="border border-border rounded-md p-4"
        style={{ borderWidth: "0.5px" }}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-medium text-foreground">API Keys</h3>
          <Button size="sm" onClick={() => setShowCreateDialog(true)}>
            Create Key
          </Button>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : keys && keys.length > 0 ? (
          <div className="space-y-2">
            {keys.map((key) => (
              <div
                key={key.id}
                className="p-3 bg-muted/30 rounded-md border border-border"
                style={{ borderWidth: "0.5px" }}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-sm font-medium text-foreground">
                    {key.name}
                  </span>
                  <button
                    onClick={() => handleRevoke(key.id)}
                    className="text-xs text-red-400 hover:text-red-300 transition-colors"
                    disabled={revokeMutation.isPending}
                  >
                    {revokeMutation.isPending ? "Revoking..." : "Revoke"}
                  </button>
                </div>
                <div className="text-xs text-muted-foreground font-mono mb-2">
                  {key.keyPrefix}...
                </div>
                <div className="flex items-center gap-1.5">
                  {key.scopes.map((scope) => (
                    <span
                      key={scope}
                      className="text-[10px] bg-background text-muted-foreground px-1.5 py-0.5 rounded border border-border"
                      style={{ borderWidth: "0.5px" }}
                    >
                      {scope}
                    </span>
                  ))}
                  <span className="text-xs text-muted-foreground/50 ml-auto">
                    {key.lastUsedAt
                      ? `Last used ${new Date(key.lastUsedAt).toLocaleDateString()}`
                      : "Never used"}
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-sm text-muted-foreground text-center py-8">
            No API keys yet. Create one to start integrating.
          </div>
        )}
      </div>

      <div
        className="border border-amber-500/20 rounded-md p-3 bg-amber-500/5"
        style={{ borderWidth: "0.5px" }}
      >
        <h4 className="text-xs font-medium text-amber-400 mb-1">
          Security Note
        </h4>
        <p className="text-xs text-amber-400/70">
          API keys grant access to your project data. Never expose them in
          client-side code or public repositories.
        </p>
      </div>

      {/* Create API Key Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={handleCloseDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {createdKey ? "API Key Created" : "Create API Key"}
            </DialogTitle>
            <DialogDescription>
              {createdKey
                ? "Copy your API key now. You won't be able to see it again."
                : "Give your API key a name and select its permissions."}
            </DialogDescription>
          </DialogHeader>

          {createdKey ? (
            <div className="space-y-4">
              <div className="flex items-center gap-2 p-3 bg-muted rounded-md font-mono text-sm">
                <code className="flex-1 break-all">{createdKey}</code>
                <Button variant="ghost" size="sm" onClick={handleCopy}>
                  {copied ? (
                    <Check className="h-4 w-4" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>
              <DialogFooter>
                <Button onClick={handleCloseDialog}>Done</Button>
              </DialogFooter>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="grid gap-1.5">
                <Label htmlFor="key-name">Name</Label>
                <Input
                  id="key-name"
                  placeholder="e.g., Production, Development"
                  value={newKeyName}
                  onChange={(e) => setNewKeyName(e.target.value)}
                />
              </div>
              <div className="grid gap-1.5">
                <Label>Permissions</Label>
                <div className="flex items-center gap-2">
                  {(["ingest", "read"] as const).map((scope) => (
                    <label
                      key={scope}
                      className="flex items-center gap-1.5 text-sm"
                    >
                      <input
                        type="checkbox"
                        checked={newKeyScopes.includes(scope)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setNewKeyScopes([...newKeyScopes, scope]);
                          } else {
                            setNewKeyScopes(
                              newKeyScopes.filter((s) => s !== scope),
                            );
                          }
                        }}
                        className="rounded border-border"
                      />
                      {scope}
                    </label>
                  ))}
                </div>
              </div>
              <DialogFooter>
                <Button variant="ghost" onClick={handleCloseDialog}>
                  Cancel
                </Button>
                <Button
                  onClick={handleCreate}
                  disabled={!newKeyName || createMutation.isPending}
                >
                  {createMutation.isPending ? "Creating..." : "Create Key"}
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

const integrationMeta: Record<
  string,
  { icon: string; description: string; displayName: string }
> = {
  linear: {
    icon: "📋",
    description: "Create Linear issues from bug reports",
    displayName: "Linear",
  },
  slack: {
    icon: "💬",
    description: "Get notifications in Slack",
    displayName: "Slack",
  },
  jira: {
    icon: "🎫",
    description: "Create Jira tickets from bug reports",
    displayName: "Jira",
  },
  github: {
    icon: "🐙",
    description: "Create GitHub issues from bug reports",
    displayName: "GitHub",
  },
  email: {
    icon: "📧",
    description: "Send email notifications",
    displayName: "Email",
  },
};

function IntegrationsSettings() {
  const { currentProject } = useAuthStore();
  const [connectingProvider, setConnectingProvider] = useState<string | null>(
    null,
  );

  const {
    data: integrations,
    isLoading,
    refetch,
  } = trpc.integrations.list.useQuery(
    { projectId: currentProject?.id || "" },
    { enabled: !!currentProject?.id },
  );

  const connectLinearMutation = trpc.integrations.connectLinear.useMutation({
    onSuccess: () => {
      refetch();
      setConnectingProvider(null);
    },
    onError: (error) => {
      console.error("Failed to connect Linear:", error);
      setConnectingProvider(null);
    },
  });

  // Handle OAuth callback from URL params
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    const state = params.get("state");

    if (
      code &&
      state === "linear" &&
      currentProject?.id &&
      !connectingProvider
    ) {
      setConnectingProvider("linear");
      // Clean URL
      window.history.replaceState({}, "", window.location.pathname);
      // Exchange code for token
      connectLinearMutation.mutate({
        projectId: currentProject.id,
        code,
        redirectUri: `${window.location.origin}/dashboard/settings`,
      });
    }
  }, [currentProject?.id]);

  const handleConnectLinear = () => {
    const clientId = process.env.NEXT_PUBLIC_LINEAR_CLIENT_ID;
    if (!clientId) {
      // Fallback: try to initiate OAuth anyway, the env var might be server-side only
      const redirectUri = encodeURIComponent(
        `${window.location.origin}/dashboard/settings`,
      );
      const linearAuthUrl = `https://linear.app/oauth/authorize?client_id=7e171e7a28cb2487d9773452b6ded3bc&redirect_uri=${redirectUri}&response_type=code&scope=read,write&state=linear`;
      window.location.href = linearAuthUrl;
      return;
    }
    const redirectUri = encodeURIComponent(
      `${window.location.origin}/dashboard/settings`,
    );
    const linearAuthUrl = `https://linear.app/oauth/authorize?client_id=${clientId}&redirect_uri=${redirectUri}&response_type=code&scope=read,write&state=linear`;
    window.location.href = linearAuthUrl;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div
        className="border border-border rounded-md p-4"
        style={{ borderWidth: "0.5px" }}
      >
        <h3 className="text-sm font-medium text-foreground mb-4">
          Integrations
        </h3>
        <div className="space-y-1">
          {integrations?.map((integration) => {
            const meta = integrationMeta[integration.provider] || {
              icon: "🔗",
              description: "Third-party integration",
              displayName: integration.provider,
            };
            const isAvailable = ["linear", "slack"].includes(
              integration.provider,
            );

            return (
              <div
                key={integration.provider}
                className="flex items-center justify-between p-2.5 rounded-md hover:bg-accent/30 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span className="text-lg">{meta.icon}</span>
                  <div>
                    <div className="text-sm text-foreground">
                      {meta.displayName}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {meta.description}
                    </div>
                  </div>
                </div>
                {integration.configured && integration.enabled ? (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-emerald-400">Connected</span>
                    <Button variant="outline" size="sm" className="h-7 text-xs">
                      Configure
                    </Button>
                  </div>
                ) : isAvailable ? (
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => {
                      if (integration.provider === "linear") {
                        handleConnectLinear();
                      }
                    }}
                    disabled={connectingProvider === integration.provider}
                  >
                    {connectingProvider === integration.provider ? (
                      <>
                        <Loader2 className="h-3 w-3 animate-spin mr-1" />{" "}
                        Connecting...
                      </>
                    ) : (
                      "Connect"
                    )}
                  </Button>
                ) : (
                  <span className="text-xs text-muted-foreground">
                    Coming soon
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div
        className="border border-border rounded-md p-4"
        style={{ borderWidth: "0.5px" }}
      >
        <h3 className="text-sm font-medium text-foreground mb-2">Webhooks</h3>
        <p className="text-xs text-muted-foreground mb-3">
          Receive real-time notifications when events occur in your project.
        </p>
        <Button variant="outline" size="sm">
          Add Webhook
        </Button>
      </div>
    </div>
  );
}

function PrivacySettings() {
  return (
    <div className="space-y-6">
      <div
        className="border border-border rounded-md p-4"
        style={{ borderWidth: "0.5px" }}
      >
        <h3 className="text-sm font-medium text-foreground mb-4">
          Privacy Rules
        </h3>
        <p className="text-xs text-muted-foreground mb-4">
          Configure what data is captured and masked in bug reports and session
          replays.
        </p>

        <div className="space-y-2">
          {[
            {
              id: "mask-inputs",
              label: "Mask all input fields",
              desc: "Automatically mask input field values in replays",
              defaultChecked: true,
            },
            {
              id: "mask-emails",
              label: "Mask email addresses",
              desc: "Detect and mask email addresses in captured data",
              defaultChecked: true,
            },
            {
              id: "block-network",
              label: "Block network request bodies",
              desc: "Don't capture request/response bodies in network logs",
              defaultChecked: false,
            },
          ].map((item) => (
            <div
              key={item.id}
              className="flex items-center justify-between p-2.5 rounded-md bg-muted/30"
            >
              <div>
                <div className="text-sm text-foreground">{item.label}</div>
                <div className="text-xs text-muted-foreground">{item.desc}</div>
              </div>
              <Switch defaultChecked={item.defaultChecked} />
            </div>
          ))}
        </div>
      </div>

      <div
        className="border border-border rounded-md p-4"
        style={{ borderWidth: "0.5px" }}
      >
        <h3 className="text-sm font-medium text-foreground mb-3">
          Custom Selectors
        </h3>
        <p className="text-xs text-muted-foreground mb-3">
          Add CSS selectors to mask or block specific elements.
        </p>
        <div className="space-y-3">
          <div className="grid gap-1.5">
            <Label className="text-xs text-muted-foreground">
              Mask selectors
            </Label>
            <Input
              placeholder=".sensitive-data, [data-private]"
              className="font-mono text-sm"
            />
          </div>
          <div className="grid gap-1.5">
            <Label className="text-xs text-muted-foreground">
              Block selectors
            </Label>
            <Input
              placeholder=".credit-card, .ssn"
              className="font-mono text-sm"
            />
          </div>
        </div>
        <Button size="sm" className="mt-4">
          Save Rules
        </Button>
      </div>

      <div
        className="border border-border rounded-md p-4"
        style={{ borderWidth: "0.5px" }}
      >
        <h3 className="text-sm font-medium text-foreground mb-3">
          Data Retention
        </h3>
        <div className="space-y-2">
          {[
            {
              label: "Bug reports & feedback",
              options: ["365 days", "180 days", "90 days", "30 days"],
              default: "365 days",
            },
            {
              label: "Session replays",
              options: ["30 days", "14 days", "7 days"],
              default: "30 days",
            },
            {
              label: "Audit logs",
              options: ["2 years", "1 year"],
              default: "2 years",
            },
          ].map((item) => (
            <div key={item.label} className="flex items-center justify-between">
              <span className="text-sm text-foreground">{item.label}</span>
              <Select defaultValue={item.default}>
                <SelectTrigger className="w-32 h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {item.options.map((opt) => (
                    <SelectItem key={opt} value={opt}>
                      {opt}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ))}
        </div>
        <Button size="sm" className="mt-4">
          Save Retention Settings
        </Button>
      </div>
    </div>
  );
}

function BillingSettings() {
  const { currentProject } = useAuthStore();

  const { data: billing, isLoading } = trpc.billing.getSubscription.useQuery(
    { projectId: currentProject?.id || "" },
    { enabled: !!currentProject?.id },
  );

  const { data: invoices } = trpc.billing.getInvoices.useQuery(
    { projectId: currentProject?.id || "", limit: 5 },
    { enabled: !!currentProject?.id },
  );

  const checkoutMutation = trpc.billing.createCheckoutSession.useMutation({
    onSuccess: (data) => {
      if (data.url) {
        window.location.href = data.url;
      }
    },
  });

  const portalMutation = trpc.billing.createPortalSession.useMutation({
    onSuccess: (data) => {
      if (data.url) {
        window.location.href = data.url;
      }
    },
  });

  const handleUpgrade = (interval: "monthly" | "yearly") => {
    if (!currentProject?.id) return;
    const baseUrl = window.location.origin;
    checkoutMutation.mutate({
      projectId: currentProject.id,
      plan: "pro",
      interval,
      successUrl: `${baseUrl}/dashboard/settings?success=true`,
      cancelUrl: `${baseUrl}/dashboard/settings?canceled=true`,
    });
  };

  const handleManageBilling = () => {
    if (!currentProject?.id) return;
    const returnUrl = `${window.location.origin}/dashboard/settings`;
    portalMutation.mutate({
      projectId: currentProject.id,
      returnUrl,
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const isPro = billing?.subscription.plan === "pro";
  const usage = billing?.usage;
  const limits = billing?.limits;

  const formatUsage = (current: number, limit: number) =>
    `${current.toLocaleString()} / ${limit.toLocaleString()}`;

  const formatStorage = (bytes: number, limitGb: number) => {
    const gb = bytes / (1024 * 1024 * 1024);
    return `${gb.toFixed(1)} GB / ${limitGb} GB`;
  };

  const getUsagePercent = (current: number, limit: number) =>
    Math.min(100, (current / limit) * 100);

  return (
    <div className="space-y-6">
      {/* Current Plan */}
      <div
        className="border border-border rounded-md p-4"
        style={{ borderWidth: "0.5px" }}
      >
        <h3 className="text-sm font-medium text-foreground mb-3">
          Current Plan
        </h3>
        <div className="flex items-center justify-between p-2.5 bg-muted/30 rounded-md">
          <div>
            <div className="text-sm font-medium text-foreground">
              {billing?.planDetails.name} Plan
            </div>
            <div className="text-xs text-muted-foreground">
              {isPro ? `$${billing?.planDetails.price}/month` : "Free"}
            </div>
          </div>
          {isPro ? (
            <Button
              variant="outline"
              size="sm"
              onClick={handleManageBilling}
              disabled={portalMutation.isPending}
            >
              {portalMutation.isPending ? "Loading..." : "Manage"}
            </Button>
          ) : billing?.stripeConfigured ? (
            <Button
              size="sm"
              onClick={() => handleUpgrade("monthly")}
              disabled={checkoutMutation.isPending}
            >
              {checkoutMutation.isPending ? "Loading..." : "Upgrade to Pro"}
            </Button>
          ) : (
            <span className="text-xs text-muted-foreground">
              Billing not configured
            </span>
          )}
        </div>

        {/* Usage Metrics */}
        {usage && limits && (
          <div className="mt-4 space-y-3">
            {[
              {
                label: "Monthly interactions",
                current: usage.interactions,
                limit: limits.interactions,
              },
              {
                label: "Session replays",
                current: usage.replays,
                limit: limits.replays,
              },
              {
                label: "Team members",
                current: usage.teamMembers,
                limit: limits.teamMembers,
              },
            ].map((item) => (
              <div key={item.label}>
                <div className="flex items-center justify-between text-xs mb-1">
                  <span className="text-muted-foreground">{item.label}</span>
                  <span className="text-foreground">
                    {formatUsage(item.current, item.limit)}
                  </span>
                </div>
                <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                  <div
                    className={cn(
                      "h-full rounded-full transition-all",
                      getUsagePercent(item.current, item.limit) > 90
                        ? "bg-red-500"
                        : getUsagePercent(item.current, item.limit) > 75
                          ? "bg-amber-500"
                          : "bg-emerald-500",
                    )}
                    style={{
                      width: `${getUsagePercent(item.current, item.limit)}%`,
                    }}
                  />
                </div>
              </div>
            ))}
            <div>
              <div className="flex items-center justify-between text-xs mb-1">
                <span className="text-muted-foreground">Storage used</span>
                <span className="text-foreground">
                  {formatStorage(usage.storageBytes, limits.storageGb)}
                </span>
              </div>
              <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                <div
                  className={cn(
                    "h-full rounded-full transition-all",
                    getUsagePercent(
                      usage.storageBytes / (1024 * 1024 * 1024),
                      limits.storageGb,
                    ) > 90
                      ? "bg-red-500"
                      : getUsagePercent(
                            usage.storageBytes / (1024 * 1024 * 1024),
                            limits.storageGb,
                          ) > 75
                        ? "bg-amber-500"
                        : "bg-emerald-500",
                  )}
                  style={{
                    width: `${getUsagePercent(usage.storageBytes / (1024 * 1024 * 1024), limits.storageGb)}%`,
                  }}
                />
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Upgrade Options (only for free plan) */}
      {!isPro && billing?.stripeConfigured && (
        <div
          className="border border-border rounded-md p-4"
          style={{ borderWidth: "0.5px" }}
        >
          <h3 className="text-sm font-medium text-foreground mb-3">
            Upgrade to Pro
          </h3>
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 border border-border rounded-md">
              <div className="text-sm font-medium text-foreground">Monthly</div>
              <div className="text-lg font-bold text-foreground">$49/mo</div>
              <Button
                size="sm"
                className="w-full mt-2"
                onClick={() => handleUpgrade("monthly")}
                disabled={checkoutMutation.isPending}
              >
                Select
              </Button>
            </div>
            <div className="p-3 border border-primary/50 rounded-md bg-primary/5">
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-medium text-foreground">
                  Yearly
                </span>
                <span className="text-[10px] bg-primary/20 text-primary px-1.5 py-0.5 rounded">
                  Save 20%
                </span>
              </div>
              <div className="text-lg font-bold text-foreground">$39/mo</div>
              <Button
                size="sm"
                className="w-full mt-2"
                onClick={() => handleUpgrade("yearly")}
                disabled={checkoutMutation.isPending}
              >
                Select
              </Button>
            </div>
          </div>
          <ul className="mt-4 space-y-1.5 text-xs text-muted-foreground">
            {billing?.planDetails.features.slice(0, 4).map((feature, i) => (
              <li key={i} className="flex items-center gap-1.5">
                <Check className="h-3 w-3 text-emerald-500" />
                {feature}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Payment Management (only for pro plan) */}
      {isPro && billing?.stripeConfigured && (
        <div
          className="border border-border rounded-md p-4"
          style={{ borderWidth: "0.5px" }}
        >
          <h3 className="text-sm font-medium text-foreground mb-3">
            Payment Method
          </h3>
          <p className="text-xs text-muted-foreground mb-3">
            Manage your payment method and billing details in the Stripe
            Customer Portal.
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={handleManageBilling}
            disabled={portalMutation.isPending}
          >
            {portalMutation.isPending ? "Loading..." : "Manage Payment Method"}
          </Button>
        </div>
      )}

      {/* Billing History */}
      <div
        className="border border-border rounded-md p-4"
        style={{ borderWidth: "0.5px" }}
      >
        <h3 className="text-sm font-medium text-foreground mb-3">
          Billing History
        </h3>
        {invoices && invoices.length > 0 ? (
          <div className="text-sm">
            {invoices.map((invoice) => (
              <div
                key={invoice.id}
                className="flex items-center justify-between py-2 border-b border-border last:border-0"
                style={{ borderBottomWidth: "0.5px" }}
              >
                <span className="text-foreground">
                  {invoice.createdAt
                    ? new Date(invoice.createdAt).toLocaleDateString()
                    : "—"}
                </span>
                <span className="text-foreground">
                  ${(invoice.amountDue / 100).toFixed(2)}
                </span>
                <span
                  className={cn(
                    "text-xs",
                    invoice.status === "paid"
                      ? "text-emerald-400"
                      : invoice.status === "open"
                        ? "text-amber-400"
                        : "text-muted-foreground",
                  )}
                >
                  {invoice.status}
                </span>
                {invoice.invoiceUrl && (
                  <a
                    href={invoice.invoiceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Invoice
                  </a>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">No invoices yet.</p>
        )}
      </div>
    </div>
  );
}

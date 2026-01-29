"use client";

import { useState } from "react";
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
            <Input id="project-name" defaultValue="My Project" />
          </div>
          <div className="grid gap-1.5">
            <Label
              htmlFor="project-url"
              className="text-xs text-muted-foreground"
            >
              Project URL
            </Label>
            <Input id="project-url" defaultValue="https://myapp.com" />
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
        <Button size="sm" className="mt-4">
          Save Changes
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
  const members = [
    { email: "admin@relay.dev", role: "Owner", status: "active" },
    { email: "alice@relay.dev", role: "Admin", status: "active" },
    { email: "bob@relay.dev", role: "Agent", status: "active" },
    { email: "pending@example.com", role: "Viewer", status: "pending" },
  ];

  return (
    <div className="space-y-6">
      <div
        className="border border-border rounded-md p-4"
        style={{ borderWidth: "0.5px" }}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-medium text-foreground">Team Members</h3>
          <Button size="sm">Invite</Button>
        </div>
        <div className="space-y-1">
          {members.map((member) => (
            <div
              key={member.email}
              className="flex items-center justify-between p-2.5 rounded-md hover:bg-accent/30 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="w-7 h-7 rounded-full bg-foreground/10 text-foreground flex items-center justify-center text-xs font-medium">
                  {member.email.charAt(0).toUpperCase()}
                </div>
                <div>
                  <div className="text-sm text-foreground">{member.email}</div>
                  <div className="text-xs text-muted-foreground">
                    {member.role}
                  </div>
                </div>
              </div>
              {member.status === "pending" ? (
                <span className="text-xs text-amber-400">Pending</span>
              ) : (
                <button className="text-xs text-muted-foreground hover:text-foreground transition-colors">
                  Edit
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      <div
        className="border border-border rounded-md p-4"
        style={{ borderWidth: "0.5px" }}
      >
        <h3 className="text-sm font-medium text-foreground mb-3">Roles</h3>
        <div className="space-y-1 text-sm">
          {[
            { role: "Owner", desc: "Full access, billing" },
            { role: "Admin", desc: "Full access, no billing" },
            { role: "Agent", desc: "Manage interactions, chat" },
            { role: "Viewer", desc: "Read-only access" },
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

function IntegrationsSettings() {
  const integrations = [
    {
      name: "Linear",
      description: "Create Linear issues from bug reports",
      connected: true,
      icon: "📋",
    },
    {
      name: "Slack",
      description: "Get notifications in Slack",
      connected: true,
      icon: "💬",
    },
    {
      name: "Jira",
      description: "Create Jira tickets from bug reports",
      connected: false,
      icon: "🎫",
    },
    {
      name: "GitHub",
      description: "Create GitHub issues from bug reports",
      connected: false,
      icon: "🐙",
    },
  ];

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
          {integrations.map((integration) => (
            <div
              key={integration.name}
              className="flex items-center justify-between p-2.5 rounded-md hover:bg-accent/30 transition-colors"
            >
              <div className="flex items-center gap-3">
                <span className="text-lg">{integration.icon}</span>
                <div>
                  <div className="text-sm text-foreground">
                    {integration.name}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {integration.description}
                  </div>
                </div>
              </div>
              {integration.connected ? (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-emerald-400">Connected</span>
                  <Button variant="outline" size="sm" className="h-7 text-xs">
                    Configure
                  </Button>
                </div>
              ) : (
                <Button variant="outline" size="sm" className="h-7 text-xs">
                  Connect
                </Button>
              )}
            </div>
          ))}
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
  return (
    <div className="space-y-6">
      <div
        className="border border-border rounded-md p-4"
        style={{ borderWidth: "0.5px" }}
      >
        <h3 className="text-sm font-medium text-foreground mb-3">
          Current Plan
        </h3>
        <div className="flex items-center justify-between p-2.5 bg-muted/30 rounded-md">
          <div>
            <div className="text-sm font-medium text-foreground">Pro Plan</div>
            <div className="text-xs text-muted-foreground">$49/month</div>
          </div>
          <Button variant="outline" size="sm">
            Change Plan
          </Button>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
          {[
            { label: "Monthly interactions", value: "2,450 / 10,000" },
            { label: "Session replays", value: "156 / 1,000" },
            { label: "Team members", value: "4 / 10" },
            { label: "Storage used", value: "2.3 GB / 10 GB" },
          ].map((item) => (
            <div key={item.label}>
              <div className="text-xs text-muted-foreground">{item.label}</div>
              <div className="text-foreground">{item.value}</div>
            </div>
          ))}
        </div>
      </div>

      <div
        className="border border-border rounded-md p-4"
        style={{ borderWidth: "0.5px" }}
      >
        <h3 className="text-sm font-medium text-foreground mb-3">
          Payment Method
        </h3>
        <div className="flex items-center gap-3 p-2.5 bg-muted/30 rounded-md">
          <span className="text-lg">💳</span>
          <div className="flex-1">
            <div className="text-sm text-foreground">•••• •••• •••• 4242</div>
            <div className="text-xs text-muted-foreground">Expires 12/25</div>
          </div>
          <button className="text-xs text-muted-foreground hover:text-foreground transition-colors">
            Update
          </button>
        </div>
      </div>

      <div
        className="border border-border rounded-md p-4"
        style={{ borderWidth: "0.5px" }}
      >
        <h3 className="text-sm font-medium text-foreground mb-3">
          Billing History
        </h3>
        <div className="text-sm">
          {[
            { date: "Jan 1, 2024", amount: "$49.00", status: "Paid" },
            { date: "Dec 1, 2023", amount: "$49.00", status: "Paid" },
          ].map((item, i) => (
            <div
              key={i}
              className="flex items-center justify-between py-2 border-b border-border last:border-0"
              style={{ borderBottomWidth: "0.5px" }}
            >
              <span className="text-foreground">{item.date}</span>
              <span className="text-foreground">{item.amount}</span>
              <span className="text-xs text-emerald-400">{item.status}</span>
              <button className="text-xs text-muted-foreground hover:text-foreground transition-colors">
                Invoice
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

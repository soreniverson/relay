"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
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
import { Loader2, CheckCircle, Copy, Check, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

type Step = "project" | "setup" | "complete";
type Framework = "react" | "nextjs" | "vue" | "vanilla";

const FRAMEWORK_OPTIONS: {
  id: Framework;
  name: string;
  icon: string;
}[] = [
  { id: "react", name: "React", icon: "⚛️" },
  { id: "nextjs", name: "Next.js", icon: "▲" },
  { id: "vue", name: "Vue", icon: "💚" },
  { id: "vanilla", name: "Vanilla JS", icon: "🟨" },
];

function getInstallCommand(framework: Framework): string {
  switch (framework) {
    case "nextjs":
    case "react":
      return "npm install @relay/sdk";
    case "vue":
      return "npm install @relay/sdk";
    case "vanilla":
      return '<script src="https://cdn.relay.dev/sdk/v1/relay.min.js"></script>';
  }
}

function getInitSnippet(framework: Framework, apiKey: string): string {
  switch (framework) {
    case "react":
      return `// App.tsx or index.tsx
import Relay from '@relay/sdk';

// Initialize at app start
Relay.init({
  apiKey: '${apiKey}',
});

// Identify users (optional but recommended)
Relay.identify({
  userId: user.id,
  email: user.email,
  name: user.name,
});`;

    case "nextjs":
      return `// app/providers.tsx (App Router)
'use client';
import { useEffect } from 'react';
import Relay from '@relay/sdk';

export function Providers({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    Relay.init({
      apiKey: '${apiKey}',
    });
  }, []);

  return <>{children}</>;
}

// Or for Pages Router (pages/_app.tsx)
import Relay from '@relay/sdk';

Relay.init({
  apiKey: '${apiKey}',
});`;

    case "vue":
      return `// main.ts
import { createApp } from 'vue';
import Relay from '@relay/sdk';
import App from './App.vue';

Relay.init({
  apiKey: '${apiKey}',
});

createApp(App).mount('#app');

// Identify users (optional but recommended)
Relay.identify({
  userId: user.id,
  email: user.email,
});`;

    case "vanilla":
      return `<!-- Add before closing </body> tag -->
<script src="https://cdn.relay.dev/sdk/v1/relay.min.js"></script>
<script>
  Relay.init({
    apiKey: '${apiKey}',
  });

  // Identify users (optional but recommended)
  Relay.identify({
    userId: 'user-123',
    email: 'user@example.com',
  });
</script>`;
  }
}

export default function OnboardingPage() {
  const router = useRouter();
  const { user, setCurrentProject, setUser } = useAuthStore();
  const [step, setStep] = useState<Step>("project");
  const [projectName, setProjectName] = useState("");
  const [region, setRegion] = useState<"us-west" | "eu-west">("us-west");
  const [createdProject, setCreatedProject] = useState<{
    id: string;
    name: string;
    apiKey: string;
  } | null>(null);
  const [copied, setCopied] = useState(false);
  const [framework, setFramework] = useState<Framework>("react");

  const createProjectMutation = trpc.auth.createProject.useMutation({
    onSuccess: (data) => {
      // Update auth store with new project
      const newProject = {
        id: data.project.id,
        name: data.project.name,
        region: data.project.region,
        role: "owner",
      };

      setCreatedProject({
        id: data.project.id,
        name: data.project.name,
        apiKey: data.apiKey,
      });

      // Update user's projects list
      if (user) {
        setUser({
          ...user,
          projects: [...(user.projects || []), newProject],
        });
      }

      setCurrentProject(newProject);
      setStep("setup");
    },
  });

  const handleCreateProject = () => {
    if (!projectName.trim()) return;
    createProjectMutation.mutate({
      name: projectName,
      region,
    });
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleComplete = () => {
    router.push("/dashboard/inbox");
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-xl">
        {/* Progress indicator */}
        <div className="flex items-center justify-center gap-2 mb-8">
          {(["project", "setup", "complete"] as const).map((s, i) => (
            <div key={s} className="flex items-center">
              <div
                className={cn(
                  "w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors",
                  step === s
                    ? "bg-foreground text-background"
                    : ["setup", "complete"].indexOf(step) >
                        ["project", "setup", "complete"].indexOf(s)
                      ? "bg-emerald-500 text-white"
                      : "bg-muted text-muted-foreground",
                )}
              >
                {["setup", "complete"].indexOf(step) >
                ["project", "setup", "complete"].indexOf(s) ? (
                  <CheckCircle className="h-4 w-4" />
                ) : (
                  i + 1
                )}
              </div>
              {i < 2 && (
                <div
                  className={cn(
                    "w-12 h-0.5 mx-2",
                    ["setup", "complete"].indexOf(step) > i
                      ? "bg-emerald-500"
                      : "bg-muted",
                  )}
                />
              )}
            </div>
          ))}
        </div>

        {/* Step 1: Create Project */}
        {step === "project" && (
          <div
            className="bg-card border border-border rounded-lg p-6"
            style={{ borderWidth: "0.5px" }}
          >
            <div className="text-center mb-6">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-foreground text-background font-bold text-xl mb-4">
                R
              </div>
              <h1 className="text-2xl font-bold">Welcome to Relay</h1>
              <p className="text-muted-foreground mt-2">
                Let's create your first project to get started.
              </p>
            </div>

            <div className="space-y-4">
              <div className="grid gap-1.5">
                <Label htmlFor="project-name">Project Name</Label>
                <Input
                  id="project-name"
                  placeholder="My App"
                  value={projectName}
                  onChange={(e) => setProjectName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && projectName.trim()) {
                      handleCreateProject();
                    }
                  }}
                />
                <p className="text-xs text-muted-foreground">
                  The name of your application or product.
                </p>
              </div>

              <div className="grid gap-1.5">
                <Label htmlFor="region">Data Region</Label>
                <Select
                  value={region}
                  onValueChange={(v) => setRegion(v as "us-west" | "eu-west")}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="us-west">
                      <span className="flex items-center gap-2">
                        <span>🇺🇸</span> US West (Oregon)
                      </span>
                    </SelectItem>
                    <SelectItem value="eu-west">
                      <span className="flex items-center gap-2">
                        <span>🇪🇺</span> EU West (Frankfurt)
                      </span>
                    </SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Where your data will be stored. This cannot be changed later.
                </p>
              </div>

              <Button
                className="w-full mt-4"
                onClick={handleCreateProject}
                disabled={
                  !projectName.trim() || createProjectMutation.isPending
                }
              >
                {createProjectMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    Create Project
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </>
                )}
              </Button>

              {createProjectMutation.error && (
                <p className="text-sm text-destructive text-center">
                  {createProjectMutation.error.message}
                </p>
              )}
            </div>
          </div>
        )}

        {/* Step 2: Setup Instructions */}
        {step === "setup" && createdProject && (
          <div
            className="bg-card border border-border rounded-lg p-6"
            style={{ borderWidth: "0.5px" }}
          >
            <div className="text-center mb-6">
              <CheckCircle className="h-12 w-12 mx-auto text-emerald-500 mb-4" />
              <h1 className="text-2xl font-bold">Project Created!</h1>
              <p className="text-muted-foreground mt-2">
                Now let's add Relay to your app.
              </p>
            </div>

            <div className="space-y-6">
              {/* API Key */}
              <div>
                <Label className="text-xs text-muted-foreground">
                  Your API Key
                </Label>
                <div className="flex items-center gap-2 mt-1.5 p-3 bg-muted rounded-md font-mono text-sm">
                  <code className="flex-1 break-all">
                    {createdProject.apiKey}
                  </code>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleCopy(createdProject.apiKey)}
                  >
                    {copied ? (
                      <Check className="h-4 w-4" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground mt-1.5">
                  Keep this safe. You won't be able to see it again.
                </p>
              </div>

              {/* Framework Selector */}
              <div>
                <Label className="text-xs text-muted-foreground mb-2 block">
                  Select your framework
                </Label>
                <div className="grid grid-cols-4 gap-2">
                  {FRAMEWORK_OPTIONS.map((fw) => (
                    <button
                      key={fw.id}
                      onClick={() => setFramework(fw.id)}
                      className={cn(
                        "p-2 rounded-md border text-center transition-colors",
                        framework === fw.id
                          ? "border-foreground bg-foreground/5"
                          : "border-border hover:border-foreground/50",
                      )}
                    >
                      <span className="text-lg">{fw.icon}</span>
                      <div className="text-xs mt-0.5 text-foreground">
                        {fw.name}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Install SDK */}
              <div>
                <Label className="text-xs text-muted-foreground">
                  1.{" "}
                  {framework === "vanilla"
                    ? "Add the script"
                    : "Install the SDK"}
                </Label>
                <div className="mt-1.5 p-3 bg-zinc-900 rounded-md font-mono text-sm text-zinc-100 overflow-x-auto">
                  <code>{getInstallCommand(framework)}</code>
                </div>
              </div>

              {/* Initialize */}
              <div>
                <Label className="text-xs text-muted-foreground">
                  2. Initialize Relay
                </Label>
                <div className="mt-1.5 p-3 bg-zinc-900 rounded-md font-mono text-sm text-zinc-100 overflow-x-auto">
                  <pre className="whitespace-pre-wrap">
                    {getInitSnippet(framework, createdProject.apiKey)}
                  </pre>
                </div>
              </div>

              <Button className="w-full" onClick={() => setStep("complete")}>
                Continue
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        {/* Step 3: Complete */}
        {step === "complete" && (
          <div
            className="bg-card border border-border rounded-lg p-6"
            style={{ borderWidth: "0.5px" }}
          >
            <div className="text-center mb-6">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/10 mb-4">
                <CheckCircle className="h-8 w-8 text-emerald-500" />
              </div>
              <h1 className="text-2xl font-bold">You're all set!</h1>
              <p className="text-muted-foreground mt-2">
                Your project is ready. Start collecting feedback from your
                users.
              </p>
            </div>

            <div className="space-y-3">
              <Button className="w-full" onClick={handleComplete}>
                Go to Dashboard
              </Button>
              <Button
                variant="outline"
                className="w-full"
                onClick={() => window.open("https://docs.relay.dev", "_blank")}
              >
                Read the Docs
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Inbox,
  MessageSquare,
  Lightbulb,
  Map,
  ClipboardList,
  Settings,
  LogOut,
  Moon,
  Sun,
  ChevronDown,
  BookOpen,
  Navigation,
  Zap,
  Megaphone,
  Loader2,
  PanelLeftClose,
  PanelLeft,
} from "lucide-react";
import { useTheme } from "next-themes";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/stores/auth";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ErrorBoundary } from "@/components/error-boundary";

const navigation = [
  { name: "Inbox", href: "/dashboard/inbox", icon: Inbox, count: 12 },
  {
    name: "Conversations",
    href: "/dashboard/conversations",
    icon: MessageSquare,
  },
  { name: "Feedback", href: "/dashboard/feedback", icon: Lightbulb },
  { name: "Roadmap", href: "/dashboard/roadmap", icon: Map },
  { name: "Surveys", href: "/dashboard/surveys", icon: ClipboardList },
  { name: "Knowledge", href: "/dashboard/knowledge", icon: BookOpen },
  { name: "Tours", href: "/dashboard/tours", icon: Navigation },
  { name: "Workflows", href: "/dashboard/workflows", icon: Zap },
  { name: "Announcements", href: "/dashboard/announcements", icon: Megaphone },
];

const bottomNavigation = [
  { name: "Settings", href: "/dashboard/settings", icon: Settings },
];

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const { user, token, currentProject, logout, setCurrentProject } =
    useAuthStore();
  const [mounted, setMounted] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    setMounted(true);
    // Load collapsed state from localStorage
    const saved = localStorage.getItem("sidebar-collapsed");
    if (saved !== null) {
      setCollapsed(saved === "true");
    }
  }, []);

  const toggleCollapsed = () => {
    const newValue = !collapsed;
    setCollapsed(newValue);
    localStorage.setItem("sidebar-collapsed", String(newValue));
  };

  useEffect(() => {
    if (mounted && !token) {
      router.push("/auth/login");
    }
    // Redirect to onboarding if no projects
    if (
      mounted &&
      token &&
      user &&
      (!user.projects || user.projects.length === 0)
    ) {
      router.push("/onboarding");
    }
  }, [mounted, token, user, router]);

  if (!mounted) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!token) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-background">
      {/* Sidebar */}
      <div
        className={cn(
          "flex flex-col border-r border-border bg-card/50 transition-all duration-200",
          collapsed ? "w-14" : "w-56",
        )}
        style={{ borderRightWidth: "0.5px" }}
      >
        {/* Logo & Project Selector */}
        <div className="p-3">
          {collapsed ? (
            <div className="flex justify-center">
              <div className="flex h-6 w-6 items-center justify-center rounded bg-foreground text-background text-xs font-semibold">
                R
              </div>
            </div>
          ) : (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 hover:bg-accent transition-colors">
                  <div className="flex h-6 w-6 items-center justify-center rounded bg-foreground text-background text-xs font-semibold shrink-0">
                    R
                  </div>
                  <span className="flex-1 text-left text-sm font-medium truncate">
                    {currentProject?.name || "Relay"}
                  </span>
                  <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-52">
                {user?.projects?.map((project: any) => (
                  <DropdownMenuItem
                    key={project.id}
                    onClick={() => setCurrentProject(project)}
                    className="text-sm"
                  >
                    <span className="truncate">{project.name}</span>
                    {project.id === currentProject?.id && (
                      <span className="ml-auto text-muted-foreground">✓</span>
                    )}
                  </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() =>
                    router.push("/dashboard/settings/projects/new")
                  }
                  className="text-sm"
                >
                  + Create Project
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-2">
          <div className="space-y-0.5">
            {navigation.map((item) => {
              const isActive = pathname.startsWith(item.href);
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  title={collapsed ? item.name : undefined}
                  className={cn(
                    "flex items-center rounded-md py-1.5 text-sm transition-colors",
                    collapsed ? "justify-center px-0" : "gap-2 px-2",
                    isActive
                      ? "bg-accent text-foreground"
                      : "text-muted-foreground hover:bg-accent hover:text-foreground",
                  )}
                >
                  <item.icon className="h-4 w-4 shrink-0" />
                  {!collapsed && (
                    <>
                      <span className="flex-1">{item.name}</span>
                      {item.count && (
                        <span className="text-xs text-muted-foreground">
                          {item.count}
                        </span>
                      )}
                    </>
                  )}
                </Link>
              );
            })}
          </div>
        </nav>

        {/* Bottom Navigation */}
        <div
          className="border-t border-border px-3 py-2"
          style={{ borderTopWidth: "0.5px" }}
        >
          <div className="space-y-0.5">
            {bottomNavigation.map((item) => {
              const isActive = pathname.startsWith(item.href);
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  title={collapsed ? item.name : undefined}
                  className={cn(
                    "flex items-center rounded-md py-1.5 text-sm transition-colors",
                    collapsed ? "justify-center px-0" : "gap-2 px-2",
                    isActive
                      ? "bg-accent text-foreground"
                      : "text-muted-foreground hover:bg-accent hover:text-foreground",
                  )}
                >
                  <item.icon className="h-4 w-4 shrink-0" />
                  {!collapsed && <span>{item.name}</span>}
                </Link>
              );
            })}
            {/* Collapse Toggle */}
            <button
              onClick={toggleCollapsed}
              title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
              className={cn(
                "flex items-center rounded-md py-1.5 text-sm transition-colors w-full text-muted-foreground hover:bg-accent hover:text-foreground",
                collapsed ? "justify-center px-0" : "gap-2 px-2",
              )}
            >
              {collapsed ? (
                <PanelLeft className="h-4 w-4 shrink-0" />
              ) : (
                <>
                  <PanelLeftClose className="h-4 w-4 shrink-0" />
                  <span>Collapse</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* User Menu */}
        <div
          className="border-t border-border p-3"
          style={{ borderTopWidth: "0.5px" }}
        >
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className={cn(
                  "flex items-center rounded-md py-1.5 hover:bg-accent transition-colors",
                  collapsed
                    ? "justify-center w-full px-0"
                    : "w-full gap-2 px-2",
                )}
              >
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-accent text-muted-foreground text-xs font-medium shrink-0">
                  {user?.name?.[0] || user?.email?.[0] || "U"}
                </div>
                {!collapsed && (
                  <span className="flex-1 text-left text-sm truncate text-muted-foreground">
                    {user?.name || user?.email || "User"}
                  </span>
                )}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align={collapsed ? "center" : "start"}
              className="w-52"
            >
              <DropdownMenuItem
                onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              >
                {theme === "dark" ? (
                  <Sun className="mr-2 h-4 w-4" />
                ) : (
                  <Moon className="mr-2 h-4 w-4" />
                )}
                {theme === "dark" ? "Light Mode" : "Dark Mode"}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={logout} className="text-destructive">
                <LogOut className="mr-2 h-4 w-4" />
                Log out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Main Content */}
      <main className="flex-1 overflow-auto bg-background">
        <ErrorBoundary>{children}</ErrorBoundary>
      </main>
    </div>
  );
}

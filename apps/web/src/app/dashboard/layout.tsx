"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Inbox,
  MessageSquare,
  Map,
  Settings,
  LogOut,
  Moon,
  Sun,
  ChevronDown,
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
  { name: "Inbox", href: "/dashboard/inbox", icon: Inbox },
  { name: "Conversations", href: "/dashboard/conversations", icon: MessageSquare },
  { name: "Roadmap", href: "/dashboard/roadmap", icon: Map },
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
        <Loader2 className="h-6 w-6 animate-spin text-text-muted" strokeWidth={1.5} />
      </div>
    );
  }

  if (!token) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-text-muted" strokeWidth={1.5} />
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-background">
      {/* Sidebar */}
      <div
        className={cn(
          "flex flex-col border-r border-border bg-surface transition-all duration-200",
          collapsed ? "w-14" : "w-56",
        )}
      >
        {/* Logo & Project Selector */}
        <div className="p-3">
          {collapsed ? (
            <div className="flex justify-center">
              <div className="flex h-6 w-6 items-center justify-center rounded-md bg-text-primary text-background text-meta font-medium">
                R
              </div>
            </div>
          ) : (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-[#141414] transition-colors">
                  <div className="flex h-6 w-6 items-center justify-center rounded-md bg-text-primary text-background text-meta font-medium shrink-0">
                    R
                  </div>
                  <span className="flex-1 text-left text-secondary font-light text-text-primary truncate">
                    {currentProject?.name || "Relay"}
                  </span>
                  <ChevronDown className="h-4 w-4 text-text-muted shrink-0" strokeWidth={1.5} />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-52">
                {user?.projects?.map((project: any) => (
                  <DropdownMenuItem
                    key={project.id}
                    onClick={() => setCurrentProject(project)}
                  >
                    <span className="truncate">{project.name}</span>
                    {project.id === currentProject?.id && (
                      <span className="ml-auto text-text-muted">✓</span>
                    )}
                  </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() =>
                    router.push("/dashboard/settings/projects/new")
                  }
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
                    "flex items-center rounded-lg py-1.5 text-secondary font-light transition-colors",
                    collapsed ? "justify-center px-0" : "gap-2 px-2",
                    isActive
                      ? "bg-[#141414] text-text-primary"
                      : "text-text-secondary hover:bg-[#141414] hover:text-text-primary",
                  )}
                >
                  <item.icon className="h-4 w-4 shrink-0" strokeWidth={1.5} />
                  {!collapsed && (
                    <>
                      <span className="flex-1">{item.name}</span>
                      {item.count && (
                        <span className="text-meta text-text-muted">
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
        <div className="border-t border-border px-3 py-2">
          <div className="space-y-0.5">
            {bottomNavigation.map((item) => {
              const isActive = pathname.startsWith(item.href);
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  title={collapsed ? item.name : undefined}
                  className={cn(
                    "flex items-center rounded-lg py-1.5 text-secondary font-light transition-colors",
                    collapsed ? "justify-center px-0" : "gap-2 px-2",
                    isActive
                      ? "bg-[#141414] text-text-primary"
                      : "text-text-secondary hover:bg-[#141414] hover:text-text-primary",
                  )}
                >
                  <item.icon className="h-4 w-4 shrink-0" strokeWidth={1.5} />
                  {!collapsed && <span>{item.name}</span>}
                </Link>
              );
            })}
            {/* Collapse Toggle */}
            <button
              onClick={toggleCollapsed}
              title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
              className={cn(
                "flex items-center rounded-lg py-1.5 text-secondary font-light transition-colors w-full text-text-secondary hover:bg-[#141414] hover:text-text-primary",
                collapsed ? "justify-center px-0" : "gap-2 px-2",
              )}
            >
              {collapsed ? (
                <PanelLeft className="h-4 w-4 shrink-0" strokeWidth={1.5} />
              ) : (
                <>
                  <PanelLeftClose className="h-4 w-4 shrink-0" strokeWidth={1.5} />
                  <span>Collapse</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* User Menu */}
        <div className="border-t border-border p-3">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className={cn(
                  "flex items-center rounded-lg py-1.5 hover:bg-[#141414] transition-colors",
                  collapsed
                    ? "justify-center w-full px-0"
                    : "w-full gap-2 px-2",
                )}
              >
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-[#1a1a1a] text-text-secondary text-meta font-light shrink-0">
                  {user?.name?.[0] || user?.email?.[0] || "U"}
                </div>
                {!collapsed && (
                  <span className="flex-1 text-left text-secondary font-light truncate text-text-secondary">
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
                  <Sun className="mr-2 h-4 w-4" strokeWidth={1.5} />
                ) : (
                  <Moon className="mr-2 h-4 w-4" strokeWidth={1.5} />
                )}
                {theme === "dark" ? "Light Mode" : "Dark Mode"}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={logout} className="text-destructive">
                <LogOut className="mr-2 h-4 w-4" strokeWidth={1.5} />
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

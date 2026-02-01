import { TRPCError } from "@trpc/server";
import { middleware } from "../lib/trpc";

// Role hierarchy - higher number = more permissions
type Role = "owner" | "admin" | "agent" | "viewer";

const roleHierarchy: Record<Role, number> = {
  owner: 4,
  admin: 3,
  agent: 2,
  viewer: 1,
};

/**
 * Middleware to require a minimum role level
 * Must be used after projectProcedure which sets ctx.membership
 */
export function requireRole(minimumRole: Role) {
  return middleware(async ({ ctx, next }) => {
    const membership = (ctx as any).membership;

    if (!membership) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Not a project member",
      });
    }

    const userRole = membership.role as Role;
    if (roleHierarchy[userRole] < roleHierarchy[minimumRole]) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: `This action requires ${minimumRole} role or higher`,
      });
    }

    return next();
  });
}

/**
 * Check if a role can perform an action on another role
 * (e.g., admin can't demote owner, can't promote to owner)
 */
export function canManageRole(actorRole: Role, targetRole: Role): boolean {
  // Owner can manage anyone
  if (actorRole === "owner") return true;

  // Admin can manage agents and viewers
  if (actorRole === "admin") {
    return targetRole === "agent" || targetRole === "viewer";
  }

  // Agents and viewers can't manage roles
  return false;
}

/**
 * Get available roles that an actor can assign
 */
export function getAssignableRoles(actorRole: Role): Role[] {
  if (actorRole === "owner") {
    return ["admin", "agent", "viewer"];
  }
  if (actorRole === "admin") {
    return ["agent", "viewer"];
  }
  return [];
}

import { z } from "zod";
import { router, projectProcedure } from "../lib/trpc";
import { TRPCError } from "@trpc/server";
import { requireRole, canManageRole, getAssignableRoles } from "../middleware/permissions";
import { randomBytes } from "crypto";

export const teamsRouter = router({
  // List all members of a project
  listMembers: projectProcedure
    .input(z.object({ projectId: z.string() }))
    .query(async ({ ctx, input }) => {
      const members = await ctx.prisma.projectMembership.findMany({
        where: { projectId: input.projectId },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              name: true,
              avatarUrl: true,
            },
          },
        },
        orderBy: { joinedAt: "asc" },
      });

      return members.map((m) => ({
        id: m.id,
        userId: m.userId,
        email: m.user.email,
        name: m.user.name,
        avatarUrl: m.user.avatarUrl,
        role: m.role,
        joinedAt: m.joinedAt,
      }));
    }),

  // List pending invitations
  listInvitations: projectProcedure
    .input(z.object({ projectId: z.string() }))
    .query(async ({ ctx, input }) => {
      const invitations = await ctx.prisma.projectInvitation.findMany({
        where: {
          projectId: input.projectId,
          expiresAt: { gt: new Date() },
        },
        orderBy: { createdAt: "desc" },
      });

      return invitations.map((i) => ({
        id: i.id,
        email: i.email,
        role: i.role,
        createdAt: i.createdAt,
        expiresAt: i.expiresAt,
      }));
    }),

  // Invite a user to the project
  invite: projectProcedure
    .use(requireRole("admin"))
    .input(
      z.object({
        projectId: z.string(),
        email: z.string().email(),
        role: z.enum(["admin", "agent", "viewer"]),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const membership = (ctx as any).membership;
      const actorRole = membership.role as "owner" | "admin" | "agent" | "viewer";

      // Check if actor can assign this role
      const assignableRoles = getAssignableRoles(actorRole);
      if (!assignableRoles.includes(input.role as any)) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: `You cannot invite users with ${input.role} role`,
        });
      }

      // Check if user is already a member
      const existingUser = await ctx.prisma.adminUser.findUnique({
        where: { email: input.email },
      });

      if (existingUser) {
        const existingMembership = await ctx.prisma.projectMembership.findUnique({
          where: {
            userId_projectId: {
              userId: existingUser.id,
              projectId: input.projectId,
            },
          },
        });

        if (existingMembership) {
          throw new TRPCError({
            code: "CONFLICT",
            message: "User is already a member of this project",
          });
        }

        // Add existing user directly
        const membership = await ctx.prisma.projectMembership.create({
          data: {
            userId: existingUser.id,
            projectId: input.projectId,
            role: input.role,
          },
        });

        return {
          type: "added" as const,
          membershipId: membership.id,
        };
      }

      // Check for existing pending invitation
      const existingInvite = await ctx.prisma.projectInvitation.findFirst({
        where: {
          projectId: input.projectId,
          email: input.email,
          expiresAt: { gt: new Date() },
        },
      });

      if (existingInvite) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "An invitation has already been sent to this email",
        });
      }

      // Create invitation
      const token = randomBytes(32).toString("hex");
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7); // 7 days

      const invitation = await ctx.prisma.projectInvitation.create({
        data: {
          projectId: input.projectId,
          email: input.email,
          role: input.role,
          token,
          expiresAt,
        },
      });

      // TODO: Send invitation email with link containing token

      return {
        type: "invited" as const,
        invitationId: invitation.id,
        expiresAt: invitation.expiresAt,
      };
    }),

  // Accept an invitation
  acceptInvitation: projectProcedure
    .input(z.object({ token: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const invitation = await ctx.prisma.projectInvitation.findUnique({
        where: { token: input.token },
      });

      if (!invitation) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Invitation not found",
        });
      }

      if (invitation.expiresAt < new Date()) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Invitation has expired",
        });
      }

      // Get or create user
      let user = await ctx.prisma.adminUser.findUnique({
        where: { email: invitation.email },
      });

      if (!user) {
        user = await ctx.prisma.adminUser.create({
          data: { email: invitation.email },
        });
      }

      // Create membership
      const membership = await ctx.prisma.projectMembership.create({
        data: {
          userId: user.id,
          projectId: invitation.projectId,
          role: invitation.role,
        },
      });

      // Delete invitation
      await ctx.prisma.projectInvitation.delete({
        where: { id: invitation.id },
      });

      return { membershipId: membership.id };
    }),

  // Update a member's role
  updateRole: projectProcedure
    .use(requireRole("admin"))
    .input(
      z.object({
        projectId: z.string(),
        userId: z.string(),
        role: z.enum(["admin", "agent", "viewer"]),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const membership = (ctx as any).membership;
      const actorRole = membership.role as "owner" | "admin" | "agent" | "viewer";

      // Get target membership
      const targetMembership = await ctx.prisma.projectMembership.findUnique({
        where: {
          userId_projectId: {
            userId: input.userId,
            projectId: input.projectId,
          },
        },
      });

      if (!targetMembership) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Member not found",
        });
      }

      const targetRole = targetMembership.role as "owner" | "admin" | "agent" | "viewer";

      // Check if actor can manage this role
      if (!canManageRole(actorRole, targetRole)) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: `You cannot modify a ${targetRole}'s role`,
        });
      }

      // Check if actor can assign the new role
      const assignableRoles = getAssignableRoles(actorRole);
      if (!assignableRoles.includes(input.role as any)) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: `You cannot assign ${input.role} role`,
        });
      }

      // Update role
      await ctx.prisma.projectMembership.update({
        where: { id: targetMembership.id },
        data: { role: input.role },
      });

      return { success: true };
    }),

  // Remove a member from the project
  removeMember: projectProcedure
    .use(requireRole("admin"))
    .input(
      z.object({
        projectId: z.string(),
        userId: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const membership = (ctx as any).membership;
      const actorRole = membership.role as "owner" | "admin" | "agent" | "viewer";

      // Can't remove yourself (use leave instead)
      if (input.userId === ctx.adminUser?.id) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "You cannot remove yourself. Use 'Leave project' instead.",
        });
      }

      // Get target membership
      const targetMembership = await ctx.prisma.projectMembership.findUnique({
        where: {
          userId_projectId: {
            userId: input.userId,
            projectId: input.projectId,
          },
        },
      });

      if (!targetMembership) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Member not found",
        });
      }

      const targetRole = targetMembership.role as "owner" | "admin" | "agent" | "viewer";

      // Check if actor can manage this role
      if (!canManageRole(actorRole, targetRole)) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: `You cannot remove a ${targetRole}`,
        });
      }

      // Delete membership
      await ctx.prisma.projectMembership.delete({
        where: { id: targetMembership.id },
      });

      return { success: true };
    }),

  // Cancel a pending invitation
  cancelInvitation: projectProcedure
    .use(requireRole("admin"))
    .input(z.object({ invitationId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.prisma.projectInvitation.delete({
        where: { id: input.invitationId },
      });

      return { success: true };
    }),

  // Leave a project (self-removal)
  leave: projectProcedure
    .input(z.object({ projectId: z.string() }))
    .mutation(async ({ ctx, input }) => {
      const membership = (ctx as any).membership;

      // Owners can't leave (must transfer ownership first)
      if (membership.role === "owner") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Owners cannot leave. Transfer ownership first.",
        });
      }

      await ctx.prisma.projectMembership.delete({
        where: { id: membership.id },
      });

      return { success: true };
    }),

  // Transfer ownership (owner only)
  transferOwnership: projectProcedure
    .use(requireRole("owner"))
    .input(
      z.object({
        projectId: z.string(),
        newOwnerId: z.string(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const membership = (ctx as any).membership;

      // Get new owner's membership
      const newOwnerMembership = await ctx.prisma.projectMembership.findUnique({
        where: {
          userId_projectId: {
            userId: input.newOwnerId,
            projectId: input.projectId,
          },
        },
      });

      if (!newOwnerMembership) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "User is not a member of this project",
        });
      }

      // Update roles in a transaction
      await ctx.prisma.$transaction([
        // Demote current owner to admin
        ctx.prisma.projectMembership.update({
          where: { id: membership.id },
          data: { role: "admin" },
        }),
        // Promote new owner
        ctx.prisma.projectMembership.update({
          where: { id: newOwnerMembership.id },
          data: { role: "owner" },
        }),
      ]);

      return { success: true };
    }),
});

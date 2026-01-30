import { z } from "zod";
import {
  router,
  projectProcedure,
  publicProcedure,
  sdkProcedure,
} from "../lib/trpc";
import { TRPCError } from "@trpc/server";
import { Prisma } from "@prisma/client";

export const knowledgeRouter = router({
  // ============================================================================
  // ARTICLES
  // ============================================================================

  listArticles: projectProcedure
    .input(
      z.object({
        projectId: z.string(),
        status: z.enum(["draft", "published", "archived"]).optional(),
        categoryId: z.string().optional(),
        search: z.string().optional(),
        page: z.number().default(1),
        pageSize: z.number().default(20),
      }),
    )
    .query(async ({ ctx, input }) => {
      const where: Prisma.ArticleWhereInput = {
        projectId: input.projectId,
        ...(input.status && { status: input.status }),
        ...(input.categoryId && { categoryId: input.categoryId }),
        ...(input.search && {
          OR: [
            { title: { contains: input.search, mode: "insensitive" } },
            { content: { contains: input.search, mode: "insensitive" } },
          ],
        }),
      };

      const [articles, total] = await Promise.all([
        ctx.prisma.article.findMany({
          where,
          include: { category: true },
          orderBy: { updatedAt: "desc" },
          skip: (input.page - 1) * input.pageSize,
          take: input.pageSize,
        }),
        ctx.prisma.article.count({ where }),
      ]);

      return {
        articles,
        pagination: {
          page: input.page,
          pageSize: input.pageSize,
          total,
          totalPages: Math.ceil(total / input.pageSize),
        },
      };
    }),

  getArticle: projectProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const article = await ctx.prisma.article.findUnique({
        where: { id: input.id },
        include: { category: true },
      });

      if (!article) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Article not found",
        });
      }

      return article;
    }),

  getArticleBySlug: publicProcedure
    .input(z.object({ projectId: z.string(), slug: z.string() }))
    .query(async ({ ctx, input }) => {
      const article = await ctx.prisma.article.findUnique({
        where: {
          projectId_slug: {
            projectId: input.projectId,
            slug: input.slug,
          },
        },
        include: { category: true },
      });

      if (!article || article.status !== "published") {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Article not found",
        });
      }

      // Increment view count
      await ctx.prisma.article.update({
        where: { id: article.id },
        data: { viewCount: { increment: 1 } },
      });

      return article;
    }),

  createArticle: projectProcedure
    .input(
      z.object({
        projectId: z.string(),
        title: z.string().min(1),
        slug: z.string().min(1),
        content: z.string(),
        excerpt: z.string().optional(),
        categoryId: z.string().optional(),
        status: z.enum(["draft", "published", "archived"]).default("draft"),
        visibility: z.enum(["public", "private"]).default("public"),
        metaTitle: z.string().optional(),
        metaDescription: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      // Generate HTML from markdown (simplified - in production use a proper parser)
      const contentHtml = input.content; // TODO: Parse markdown to HTML

      const article = await ctx.prisma.article.create({
        data: {
          projectId: input.projectId,
          title: input.title,
          slug: input.slug,
          content: input.content,
          contentHtml,
          excerpt: input.excerpt,
          categoryId: input.categoryId,
          status: input.status,
          visibility: input.visibility,
          metaTitle: input.metaTitle,
          metaDescription: input.metaDescription,
          createdBy: ctx.adminUser?.id,
          publishedAt: input.status === "published" ? new Date() : null,
        },
        include: { category: true },
      });

      // TODO: Generate embedding for RAG
      // await generateArticleEmbedding(article.id);

      return article;
    }),

  updateArticle: projectProcedure
    .input(
      z.object({
        id: z.string(),
        title: z.string().min(1).optional(),
        slug: z.string().min(1).optional(),
        content: z.string().optional(),
        excerpt: z.string().optional(),
        categoryId: z.string().nullable().optional(),
        status: z.enum(["draft", "published", "archived"]).optional(),
        visibility: z.enum(["public", "private"]).optional(),
        metaTitle: z.string().optional(),
        metaDescription: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;

      const existing = await ctx.prisma.article.findUnique({ where: { id } });
      if (!existing) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Article not found",
        });
      }

      // If publishing for first time, set publishedAt
      const publishedAt =
        data.status === "published" && existing.status !== "published"
          ? new Date()
          : undefined;

      // If content changed, regenerate HTML
      const contentHtml = data.content ? data.content : undefined;

      const article = await ctx.prisma.article.update({
        where: { id },
        data: {
          ...data,
          contentHtml,
          publishedAt,
          version: data.content ? { increment: 1 } : undefined,
        },
        include: { category: true },
      });

      // TODO: Regenerate embedding if content changed

      return article;
    }),

  deleteArticle: projectProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await ctx.prisma.article.delete({ where: { id: input.id } });
      return { success: true };
    }),

  articleFeedback: publicProcedure
    .input(
      z.object({
        articleId: z.string(),
        helpful: z.boolean(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      await ctx.prisma.article.update({
        where: { id: input.articleId },
        data: input.helpful
          ? { helpfulCount: { increment: 1 } }
          : { notHelpfulCount: { increment: 1 } },
      });

      return { success: true };
    }),

  // ============================================================================
  // CATEGORIES
  // ============================================================================

  listCategories: projectProcedure
    .input(z.object({ projectId: z.string() }))
    .query(async ({ ctx, input }) => {
      const categories = await ctx.prisma.articleCategory.findMany({
        where: { projectId: input.projectId },
        include: {
          _count: { select: { articles: true } },
          children: true,
        },
        orderBy: { sortOrder: "asc" },
      });

      return categories;
    }),

  createCategory: projectProcedure
    .input(
      z.object({
        projectId: z.string(),
        name: z.string().min(1),
        slug: z.string().min(1),
        description: z.string().optional(),
        icon: z.string().optional(),
        parentId: z.string().optional(),
        sortOrder: z.number().default(0),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const category = await ctx.prisma.articleCategory.create({
        data: input,
      });

      return category;
    }),

  updateCategory: projectProcedure
    .input(
      z.object({
        id: z.string(),
        name: z.string().min(1).optional(),
        slug: z.string().min(1).optional(),
        description: z.string().optional(),
        icon: z.string().optional(),
        parentId: z.string().nullable().optional(),
        sortOrder: z.number().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const { id, ...data } = input;

      const category = await ctx.prisma.articleCategory.update({
        where: { id },
        data,
      });

      return category;
    }),

  deleteCategory: projectProcedure
    .input(z.object({ id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      // Move articles to uncategorized
      await ctx.prisma.article.updateMany({
        where: { categoryId: input.id },
        data: { categoryId: null },
      });

      await ctx.prisma.articleCategory.delete({ where: { id: input.id } });

      return { success: true };
    }),

  // ============================================================================
  // SEARCH (for SDK/public)
  // ============================================================================

  searchArticles: publicProcedure
    .input(
      z.object({
        projectId: z.string(),
        query: z.string().min(1),
        limit: z.number().default(5),
      }),
    )
    .query(async ({ ctx, input }) => {
      // Simple text search - in production, use pgvector for semantic search
      const articles = await ctx.prisma.article.findMany({
        where: {
          projectId: input.projectId,
          status: "published",
          visibility: "public",
          OR: [
            { title: { contains: input.query, mode: "insensitive" } },
            { content: { contains: input.query, mode: "insensitive" } },
            { excerpt: { contains: input.query, mode: "insensitive" } },
          ],
        },
        select: {
          id: true,
          title: true,
          slug: true,
          excerpt: true,
          category: { select: { name: true, slug: true } },
        },
        take: input.limit,
      });

      return articles;
    }),

  // ============================================================================
  // PUBLIC HELP CENTER
  // ============================================================================

  getPublicHelpCenter: publicProcedure
    .input(z.object({ projectId: z.string() }))
    .query(async ({ ctx, input }) => {
      const [categories, popularArticles] = await Promise.all([
        ctx.prisma.articleCategory.findMany({
          where: { projectId: input.projectId },
          include: {
            articles: {
              where: { status: "published", visibility: "public" },
              select: { id: true, title: true, slug: true, excerpt: true },
              take: 5,
              orderBy: { viewCount: "desc" },
            },
          },
          orderBy: { sortOrder: "asc" },
        }),
        ctx.prisma.article.findMany({
          where: {
            projectId: input.projectId,
            status: "published",
            visibility: "public",
          },
          select: {
            id: true,
            title: true,
            slug: true,
            excerpt: true,
            viewCount: true,
          },
          orderBy: { viewCount: "desc" },
          take: 10,
        }),
      ]);

      return { categories, popularArticles };
    }),

  // ============================================================================
  // SDK ENDPOINTS (resolve project from API key)
  // ============================================================================

  getPublicCategories: sdkProcedure.query(async ({ ctx }) => {
    const categories = await ctx.prisma.articleCategory.findMany({
      where: { projectId: ctx.projectId },
      select: {
        id: true,
        name: true,
        description: true,
        _count: {
          select: {
            articles: { where: { status: "published", visibility: "public" } },
          },
        },
      },
      orderBy: { sortOrder: "asc" },
    });

    return categories.map((c) => ({
      id: c.id,
      name: c.name,
      description: c.description,
      articleCount: c._count.articles,
    }));
  }),

  getPublicArticles: sdkProcedure
    .input(z.object({ categoryId: z.string().optional() }).optional())
    .query(async ({ ctx, input }) => {
      const articles = await ctx.prisma.article.findMany({
        where: {
          projectId: ctx.projectId,
          status: "published",
          visibility: "public",
          ...(input?.categoryId && { categoryId: input.categoryId }),
        },
        select: {
          id: true,
          slug: true,
          title: true,
          excerpt: true,
          category: { select: { id: true, name: true } },
        },
        orderBy: { viewCount: "desc" },
        take: 20,
      });

      return articles.map((a) => ({
        id: a.id,
        slug: a.slug,
        title: a.title,
        excerpt: a.excerpt,
        categoryId: a.category?.id,
        categoryName: a.category?.name,
      }));
    }),

  sdkSearchArticles: sdkProcedure
    .input(
      z.object({ query: z.string().min(1), limit: z.number().default(10) }),
    )
    .query(async ({ ctx, input }) => {
      const articles = await ctx.prisma.article.findMany({
        where: {
          projectId: ctx.projectId,
          status: "published",
          visibility: "public",
          OR: [
            { title: { contains: input.query, mode: "insensitive" } },
            { content: { contains: input.query, mode: "insensitive" } },
            { excerpt: { contains: input.query, mode: "insensitive" } },
          ],
        },
        select: {
          id: true,
          slug: true,
          title: true,
          excerpt: true,
          category: { select: { id: true, name: true } },
        },
        take: input.limit,
      });

      return articles.map((a) => ({
        id: a.id,
        slug: a.slug,
        title: a.title,
        excerpt: a.excerpt,
        categoryId: a.category?.id,
        categoryName: a.category?.name,
      }));
    }),

  sdkGetArticle: sdkProcedure
    .input(z.object({ slug: z.string() }))
    .query(async ({ ctx, input }) => {
      const article = await ctx.prisma.article.findUnique({
        where: {
          projectId_slug: {
            projectId: ctx.projectId,
            slug: input.slug,
          },
        },
        include: { category: true },
      });

      if (
        !article ||
        article.status !== "published" ||
        article.visibility !== "public"
      ) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Article not found",
        });
      }

      // Increment view count
      await ctx.prisma.article.update({
        where: { id: article.id },
        data: { viewCount: { increment: 1 } },
      });

      return {
        id: article.id,
        slug: article.slug,
        title: article.title,
        content: article.content,
        contentHtml: article.contentHtml,
        excerpt: article.excerpt,
        categoryId: article.category?.id,
        categoryName: article.category?.name,
      };
    }),
});

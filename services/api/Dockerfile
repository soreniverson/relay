# Build stage
FROM node:20-alpine AS builder

# Install build dependencies
RUN apk add --no-cache openssl

# Install pnpm
RUN corepack enable && corepack prepare pnpm@9 --activate

WORKDIR /app

# Copy workspace files
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY packages/shared/package.json packages/shared/
COPY services/api/package.json services/api/

# Install dependencies
RUN pnpm install --frozen-lockfile

# Copy source
COPY packages/shared packages/shared
COPY services/api services/api

# Generate Prisma client
RUN cd services/api && pnpm exec prisma generate

# Build packages
RUN pnpm --filter @relay/shared build
RUN pnpm --filter @relay/api build

# Production stage
FROM node:20-alpine AS runner

# Install runtime dependencies
RUN apk add --no-cache openssl

WORKDIR /app

# Create non-root user
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 relay

# Copy everything from builder
COPY --from=builder --chown=relay:nodejs /app/node_modules node_modules
COPY --from=builder --chown=relay:nodejs /app/packages/shared packages/shared
COPY --from=builder --chown=relay:nodejs /app/services/api services/api
COPY --from=builder /app/package.json /app/pnpm-lock.yaml /app/pnpm-workspace.yaml ./

# Switch to non-root user
USER relay

WORKDIR /app/services/api

# Expose port
EXPOSE 3001

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3001/health || exit 1

# Start the app (skip migrations for faster startup, run separately if needed)
CMD ["node", "dist/index.js"]

import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { createContext } from "./lib/trpc";
import { appRouter } from "./routers";
import { logger } from "./lib/logger";
import { initializeBuckets } from "./lib/storage";
import { WebSocketServer } from "ws";
import http from "http";
import { pubsub, redis } from "./lib/redis";
import { handleStripeWebhook } from "./webhooks/stripe";
import { handleLinearWebhook } from "./webhooks/linear";

const PORT = process.env.PORT || 3001;
const REGION = process.env.REGION || "us-west";

async function main() {
  const app = express();

  // Security middleware
  app.use(
    helmet({
      contentSecurityPolicy: false, // Disable for API
    }),
  );

  // CORS - allow any origin for SDK embeds
  app.use(
    cors({
      origin: true, // Allow all origins (SDK can be embedded anywhere)
      credentials: true,
    }),
  );

  // Body parsing
  app.use(express.json({ limit: "10mb" }));

  // Health check
  app.get("/health", (req, res) => {
    res.json({
      status: "ok",
      region: REGION,
      timestamp: new Date().toISOString(),
    });
  });

  // Stripe webhook endpoint (needs raw body)
  app.post(
    "/webhooks/stripe",
    express.raw({ type: "application/json" }),
    handleStripeWebhook,
  );

  // Linear webhook endpoint
  app.post("/webhooks/linear", handleLinearWebhook);

  // tRPC middleware
  app.use(
    "/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
      onError: ({ error, path }) => {
        logger.error({ path, error: error.message }, "tRPC error");
      },
    }),
  );

  // Create HTTP server
  const server = http.createServer(app);

  // WebSocket server for realtime
  const wss = new WebSocketServer({ server, path: "/ws" });

  wss.on("connection", async (ws, req) => {
    const url = new URL(req.url || "", `http://${req.headers.host}`);
    const projectId = url.searchParams.get("projectId");
    const token = url.searchParams.get("token");

    if (!projectId) {
      ws.close(4001, "Missing projectId");
      return;
    }

    // TODO: Validate token/API key

    logger.info({ projectId }, "WebSocket connected");

    // Subscribe to project channel (only if Redis is available)
    const subscriber = pubsub.createSubscriber();
    if (subscriber) {
      await subscriber.subscribe(`project:${projectId}`);

      subscriber.on("message", (channel, message) => {
        if (ws.readyState === ws.OPEN) {
          ws.send(message);
        }
      });

      ws.on("close", () => {
        subscriber.unsubscribe(`project:${projectId}`);
        subscriber.quit();
        logger.info({ projectId }, "WebSocket disconnected");
      });
    } else {
      // No Redis - just handle close event
      ws.on("close", () => {
        logger.info({ projectId }, "WebSocket disconnected");
      });
    }

    ws.on("error", (error) => {
      logger.error({ projectId, error }, "WebSocket error");
    });

    // Send initial connected message
    ws.send(JSON.stringify({ type: "connected", projectId }));
  });

  // Initialize storage buckets
  try {
    await initializeBuckets(REGION);
    logger.info({ region: REGION }, "Storage buckets initialized");
  } catch (error) {
    logger.warn(
      { error },
      "Failed to initialize storage buckets (MinIO may not be running)",
    );
  }

  // Verify Redis connection (if available)
  if (redis) {
    try {
      await redis.ping();
      logger.info("Redis connected");
    } catch (error) {
      logger.warn({ error }, "Failed to connect to Redis");
    }
  } else {
    logger.info("Running without Redis (development mode)");
  }

  // Start server
  server.listen(PORT, () => {
    logger.info({ port: PORT, region: REGION }, `API server started`);
  });

  // Graceful shutdown
  const shutdown = async () => {
    logger.info("Shutting down...");

    wss.close();
    server.close();
    if (redis) {
      await redis.quit();
    }

    process.exit(0);
  };

  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
}

main().catch((error) => {
  logger.error({ error }, "Failed to start server");
  process.exit(1);
});

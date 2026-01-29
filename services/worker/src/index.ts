import { Worker, Queue } from 'bullmq';
import IORedis from 'ioredis';
import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';

import { aiSummarizeProcessor } from './processors/ai-summarize.js';
import { aiLabelProcessor } from './processors/ai-label.js';
import { aiDedupeProcessor } from './processors/ai-dedupe.js';
import { linearSyncProcessor } from './processors/linear-sync.js';
import { slackNotifyProcessor } from './processors/slack-notify.js';
import { emailSendProcessor } from './processors/email-send.js';
import { replayProcessProcessor } from './processors/replay-process.js';
import { retentionCleanupProcessor } from './processors/retention-cleanup.js';

dotenv.config();

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
const connection = new IORedis(redisUrl, { maxRetriesPerRequest: null });

export const prisma = new PrismaClient();

// Queue definitions
export const queues = {
  aiSummarize: new Queue('ai-summarize', { connection }),
  aiLabel: new Queue('ai-label', { connection }),
  aiDedupe: new Queue('ai-dedupe', { connection }),
  linearSync: new Queue('linear-sync', { connection }),
  slackNotify: new Queue('slack-notify', { connection }),
  emailSend: new Queue('email-send', { connection }),
  replayProcess: new Queue('replay-process', { connection }),
  retentionCleanup: new Queue('retention-cleanup', { connection }),
};

// Worker configurations
const workerOptions = {
  connection,
  concurrency: 5,
};

// Initialize workers
const workers: Worker[] = [];

async function start() {
  console.log('Starting Relay Worker Service...');

  // AI Workers
  workers.push(
    new Worker('ai-summarize', aiSummarizeProcessor, {
      ...workerOptions,
      concurrency: 3,
    })
  );

  workers.push(
    new Worker('ai-label', aiLabelProcessor, {
      ...workerOptions,
      concurrency: 3,
    })
  );

  workers.push(
    new Worker('ai-dedupe', aiDedupeProcessor, {
      ...workerOptions,
      concurrency: 2,
    })
  );

  // Integration Workers
  workers.push(
    new Worker('linear-sync', linearSyncProcessor, workerOptions)
  );

  workers.push(
    new Worker('slack-notify', slackNotifyProcessor, workerOptions)
  );

  workers.push(
    new Worker('email-send', emailSendProcessor, workerOptions)
  );

  // Replay Processing
  workers.push(
    new Worker('replay-process', replayProcessProcessor, {
      ...workerOptions,
      concurrency: 2,
    })
  );

  // Retention/Cleanup (runs less frequently)
  workers.push(
    new Worker('retention-cleanup', retentionCleanupProcessor, {
      ...workerOptions,
      concurrency: 1,
    })
  );

  // Set up scheduled jobs
  await setupScheduledJobs();

  console.log(`Started ${workers.length} workers`);

  // Graceful shutdown
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

async function setupScheduledJobs() {
  // Retention cleanup - daily at 3am
  await queues.retentionCleanup.add(
    'daily-cleanup',
    {},
    {
      repeat: {
        pattern: '0 3 * * *',
      },
    }
  );

  // AI dedupe scan - every 6 hours
  await queues.aiDedupe.add(
    'periodic-scan',
    { type: 'periodic' },
    {
      repeat: {
        pattern: '0 */6 * * *',
      },
    }
  );

  console.log('Scheduled jobs configured');
}

async function shutdown() {
  console.log('Shutting down workers...');

  await Promise.all(workers.map((w) => w.close()));
  await Promise.all(Object.values(queues).map((q) => q.close()));
  await connection.quit();
  await prisma.$disconnect();

  console.log('Workers shut down gracefully');
  process.exit(0);
}

start().catch((err) => {
  console.error('Failed to start worker:', err);
  process.exit(1);
});

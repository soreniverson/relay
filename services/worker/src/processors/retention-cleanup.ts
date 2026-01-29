import { Job } from 'bullmq';
import { prisma } from '../index.js';
import { S3Client, DeleteObjectsCommand, ListObjectsV2Command } from '@aws-sdk/client-s3';

interface RetentionCleanupJob {
  projectId?: string;
  force?: boolean;
}

const s3 = new S3Client({
  region: process.env.AWS_REGION || 'us-east-1',
  endpoint: process.env.S3_ENDPOINT,
  forcePathStyle: true,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
  },
});

const bucket = process.env.AWS_BUCKET || 'relay-media';

export async function retentionCleanupProcessor(job: Job<RetentionCleanupJob>) {
  const { projectId, force } = job.data;

  console.log('Running retention cleanup...');

  let totalDeleted = {
    interactions: 0,
    sessions: 0,
    replays: 0,
    media: 0,
    logs: 0,
    auditLogs: 0,
  };

  // Get all projects or specific one
  const projects = projectId
    ? [await prisma.project.findUnique({ where: { id: projectId } })]
    : await prisma.project.findMany();

  for (const project of projects) {
    if (!project) continue;

    const settings = project.settings as Record<string, unknown> | null;
    const retention = (settings?.retention as Record<string, number>) || {
      interactions: 365, // days
      sessions: 90,
      replays: 30,
      auditLogs: 730, // 2 years
    };

    console.log(`Processing project ${project.id} with retention:`, retention);

    // Clean up interactions
    const interactionCutoff = new Date();
    interactionCutoff.setDate(interactionCutoff.getDate() - retention.interactions);

    const deletedInteractions = await cleanupInteractions(
      project.id,
      interactionCutoff
    );
    totalDeleted.interactions += deletedInteractions;

    // Clean up sessions
    const sessionCutoff = new Date();
    sessionCutoff.setDate(sessionCutoff.getDate() - retention.sessions);

    const deletedSessions = await cleanupSessions(project.id, sessionCutoff);
    totalDeleted.sessions += deletedSessions;

    // Clean up replays
    const replayCutoff = new Date();
    replayCutoff.setDate(replayCutoff.getDate() - retention.replays);

    const deletedReplays = await cleanupReplays(project.id, replayCutoff);
    totalDeleted.replays += deletedReplays;

    // Clean up audit logs
    const auditCutoff = new Date();
    auditCutoff.setDate(auditCutoff.getDate() - retention.auditLogs);

    const deletedAuditLogs = await cleanupAuditLogs(project.id, auditCutoff);
    totalDeleted.auditLogs += deletedAuditLogs;
  }

  // Clean up orphaned media in S3
  const orphanedMedia = await cleanupOrphanedMedia();
  totalDeleted.media = orphanedMedia;

  console.log('Retention cleanup complete:', totalDeleted);

  return { success: true, deleted: totalDeleted };
}

async function cleanupInteractions(
  projectId: string,
  cutoffDate: Date
): Promise<number> {
  // Find interactions to delete
  const toDelete = await prisma.interaction.findMany({
    where: {
      projectId,
      createdAt: { lt: cutoffDate },
      // Don't delete if linked to external issue (might need reference)
      linkedIssueId: null,
    },
    select: { id: true },
    take: 1000, // Batch for safety
  });

  if (toDelete.length === 0) return 0;

  const ids = toDelete.map((i) => i.id);

  // Delete related data first
  await prisma.interactionLog.deleteMany({
    where: { interactionId: { in: ids } },
  });

  await prisma.media.deleteMany({
    where: { interactionId: { in: ids } },
  });

  await prisma.feedbackLink.deleteMany({
    where: { interactionId: { in: ids } },
  });

  // Delete interactions
  const result = await prisma.interaction.deleteMany({
    where: { id: { in: ids } },
  });

  return result.count;
}

async function cleanupSessions(
  projectId: string,
  cutoffDate: Date
): Promise<number> {
  // First, get sessions without recent interactions
  const sessionsWithInteractions = await prisma.interaction.findMany({
    where: {
      projectId,
      createdAt: { gte: cutoffDate },
    },
    select: { sessionId: true },
    distinct: ['sessionId'],
  });

  const activeSessionIds = new Set(
    sessionsWithInteractions.map((i) => i.sessionId).filter(Boolean)
  );

  // Find old sessions that have no recent interactions
  const toDelete = await prisma.session.findMany({
    where: {
      projectId,
      lastSeenAt: { lt: cutoffDate },
      id: { notIn: Array.from(activeSessionIds) as string[] },
    },
    select: { id: true },
    take: 1000,
  });

  if (toDelete.length === 0) return 0;

  const ids = toDelete.map((s) => s.id);

  // Delete related replays first
  await prisma.replay.deleteMany({
    where: { sessionId: { in: ids } },
  });

  // Delete sessions
  const result = await prisma.session.deleteMany({
    where: { id: { in: ids } },
  });

  return result.count;
}

async function cleanupReplays(
  projectId: string,
  cutoffDate: Date
): Promise<number> {
  // Find old replays
  const toDelete = await prisma.replay.findMany({
    where: {
      projectId,
      startedAt: { lt: cutoffDate },
    },
    select: { id: true, chunks: true },
    take: 500,
  });

  if (toDelete.length === 0) return 0;

  // Collect S3 keys to delete
  const keysToDelete: string[] = [];

  for (const replay of toDelete) {
    const chunks = replay.chunks as Array<{ storageKey: string }> | null;
    if (chunks) {
      for (const chunk of chunks) {
        keysToDelete.push(chunk.storageKey);
        // Also add sanitized version
        keysToDelete.push(chunk.storageKey.replace('.json', '.sanitized.json'));
      }
    }
  }

  // Delete from S3 in batches
  await deleteFromS3(keysToDelete);

  // Delete replay records
  const result = await prisma.replay.deleteMany({
    where: { id: { in: toDelete.map((r) => r.id) } },
  });

  return result.count;
}

async function cleanupAuditLogs(
  projectId: string,
  cutoffDate: Date
): Promise<number> {
  const result = await prisma.auditLog.deleteMany({
    where: {
      projectId,
      createdAt: { lt: cutoffDate },
    },
  });

  return result.count;
}

async function cleanupOrphanedMedia(): Promise<number> {
  // Media records have cascading delete from interactions, so they are
  // automatically cleaned up when the parent interaction is deleted.
  // This function is a no-op but kept for future use if schema changes.
  return 0;
}

async function deleteFromS3(keys: string[]): Promise<void> {
  if (keys.length === 0) return;

  // S3 DeleteObjects limit is 1000
  const batches = [];
  for (let i = 0; i < keys.length; i += 1000) {
    batches.push(keys.slice(i, i + 1000));
  }

  for (const batch of batches) {
    try {
      const command = new DeleteObjectsCommand({
        Bucket: bucket,
        Delete: {
          Objects: batch.map((key) => ({ Key: key })),
          Quiet: true,
        },
      });

      await s3.send(command);
    } catch (error) {
      console.error('S3 delete error:', error);
      // Continue with other batches
    }
  }
}

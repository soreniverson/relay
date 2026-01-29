import { Job } from 'bullmq';
import { prisma } from '../index.js';
import {
  S3Client,
  GetObjectCommand,
  PutObjectCommand,
} from '@aws-sdk/client-s3';
import { Readable } from 'stream';

interface ReplayProcessJob {
  replayId: string;
  projectId: string;
}

const s3 = new S3Client({
  region: process.env.AWS_REGION || 'us-east-1',
  endpoint: process.env.S3_ENDPOINT,
  forcePathStyle: true, // For MinIO compatibility
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
  },
});

const bucket = process.env.AWS_BUCKET || 'relay-media';

export async function replayProcessProcessor(job: Job<ReplayProcessJob>) {
  const { replayId, projectId } = job.data;

  console.log(`Processing replay ${replayId}`);

  // Fetch replay record
  const replay = await prisma.replay.findUnique({
    where: { id: replayId },
  });

  if (!replay) {
    throw new Error(`Replay ${replayId} not found`);
  }

  if (replay.status === 'ready') {
    return { skipped: true, reason: 'already_processed' };
  }

  try {
    // Update status to processing
    await prisma.replay.update({
      where: { id: replayId },
      data: { status: 'processing' },
    });

    const chunks = replay.chunks as Array<{
      index: number;
      storageKey: string;
      eventCount: number;
      startTime: number;
      endTime: number;
    }>;

    if (!chunks || chunks.length === 0) {
      throw new Error('No chunks found for replay');
    }

    // Process and validate chunks
    const processedChunks: typeof chunks = [];
    let totalEvents = 0;
    let minTime = Infinity;
    let maxTime = 0;

    for (const chunk of chunks) {
      // Validate chunk exists in S3
      const data = await fetchChunk(chunk.storageKey);
      if (!data) {
        console.warn(`Chunk ${chunk.index} not found, skipping`);
        continue;
      }

      // Parse and validate events
      const events = JSON.parse(data);
      if (!Array.isArray(events)) {
        console.warn(`Invalid chunk ${chunk.index}, skipping`);
        continue;
      }

      // Apply privacy transformations
      const sanitizedEvents = sanitizeEvents(events);

      // Upload sanitized version
      const sanitizedKey = chunk.storageKey.replace('.json', '.sanitized.json');
      await uploadChunk(sanitizedKey, JSON.stringify(sanitizedEvents));

      totalEvents += sanitizedEvents.length;

      // Update time range
      for (const event of sanitizedEvents) {
        if (event.timestamp) {
          minTime = Math.min(minTime, event.timestamp);
          maxTime = Math.max(maxTime, event.timestamp);
        }
      }

      processedChunks.push({
        ...chunk,
        storageKey: sanitizedKey,
        eventCount: sanitizedEvents.length,
      });
    }

    // Calculate duration
    const duration = maxTime > minTime ? maxTime - minTime : 0;

    // Update replay with processed data
    await prisma.replay.update({
      where: { id: replayId },
      data: {
        status: 'ready',
        chunks: processedChunks,
        eventCount: totalEvents,
        duration,
        endedAt: new Date(maxTime),
      },
    });

    return {
      success: true,
      eventCount: totalEvents,
      duration,
      chunkCount: processedChunks.length,
    };
  } catch (error) {
    // Update status to failed
    await prisma.replay.update({
      where: { id: replayId },
      data: { status: 'failed' },
    });

    throw error;
  }
}

async function fetchChunk(storageKey: string): Promise<string | null> {
  try {
    const command = new GetObjectCommand({
      Bucket: bucket,
      Key: storageKey,
    });

    const response = await s3.send(command);
    const body = response.Body;

    if (!body) return null;

    // Convert stream to string
    if (body instanceof Readable) {
      const chunks: Buffer[] = [];
      for await (const chunk of body) {
        chunks.push(chunk);
      }
      return Buffer.concat(chunks).toString('utf-8');
    }

    return null;
  } catch (error: any) {
    if (error.name === 'NoSuchKey') {
      return null;
    }
    throw error;
  }
}

async function uploadChunk(storageKey: string, data: string): Promise<void> {
  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: storageKey,
    Body: data,
    ContentType: 'application/json',
  });

  await s3.send(command);
}

function sanitizeEvents(events: any[]): any[] {
  return events.map((event) => sanitizeEvent(event));
}

function sanitizeEvent(event: any): any {
  // Clone to avoid mutation
  const sanitized = { ...event };

  // Handle rrweb event types
  switch (event.type) {
    case 2: // Full snapshot
      if (sanitized.data?.node) {
        sanitized.data.node = sanitizeNode(sanitized.data.node);
      }
      break;

    case 3: // Incremental snapshot
      if (sanitized.data?.source === 0) {
        // Mutation
        if (sanitized.data?.adds) {
          sanitized.data.adds = sanitized.data.adds.map((add: any) => ({
            ...add,
            node: add.node ? sanitizeNode(add.node) : add.node,
          }));
        }
        if (sanitized.data?.texts) {
          sanitized.data.texts = sanitized.data.texts.map((text: any) => ({
            ...text,
            value: sanitizeText(text.value),
          }));
        }
        if (sanitized.data?.attributes) {
          sanitized.data.attributes = sanitized.data.attributes.map(
            (attr: any) => ({
              ...attr,
              attributes: sanitizeAttributes(attr.attributes),
            })
          );
        }
      } else if (sanitized.data?.source === 5) {
        // Input
        if (sanitized.data?.text) {
          sanitized.data.text = maskSensitiveInput(sanitized.data.text);
        }
      }
      break;

    case 6: // Plugin
      // Remove potentially sensitive plugin data
      if (sanitized.data?.plugin === 'rrweb/console@1') {
        if (sanitized.data?.payload?.payload) {
          sanitized.data.payload.payload = sanitized.data.payload.payload.map(
            (p: any) => (typeof p === 'string' ? sanitizeText(p) : p)
          );
        }
      }
      break;
  }

  return sanitized;
}

function sanitizeNode(node: any): any {
  if (!node) return node;

  const sanitized = { ...node };

  // Mask text content
  if (sanitized.textContent) {
    sanitized.textContent = sanitizeText(sanitized.textContent);
  }

  // Sanitize attributes
  if (sanitized.attributes) {
    sanitized.attributes = sanitizeAttributes(sanitized.attributes);
  }

  // Handle input values
  if (sanitized.tagName === 'input' || sanitized.tagName === 'INPUT') {
    const type = sanitized.attributes?.type?.toLowerCase();
    if (['password', 'email', 'tel', 'ssn', 'credit-card'].includes(type)) {
      if (sanitized.attributes?.value) {
        sanitized.attributes.value = '********';
      }
    }
  }

  // Recurse into children
  if (sanitized.childNodes && Array.isArray(sanitized.childNodes)) {
    sanitized.childNodes = sanitized.childNodes.map(sanitizeNode);
  }

  return sanitized;
}

function sanitizeAttributes(attributes: Record<string, any>): Record<string, any> {
  if (!attributes) return attributes;

  const sanitized = { ...attributes };

  // Mask sensitive attributes
  const sensitiveAttrs = [
    'data-email',
    'data-phone',
    'data-ssn',
    'data-cc',
    'data-user-id',
  ];

  for (const attr of sensitiveAttrs) {
    if (sanitized[attr]) {
      sanitized[attr] = '********';
    }
  }

  // Mask placeholder emails/phones in value
  if (sanitized.value && typeof sanitized.value === 'string') {
    sanitized.value = maskSensitiveInput(sanitized.value);
  }

  return sanitized;
}

function sanitizeText(text: string): string {
  if (!text || typeof text !== 'string') return text;

  // Mask email addresses
  text = text.replace(
    /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
    '***@***.***'
  );

  // Mask phone numbers
  text = text.replace(
    /(\+?1?[-.\s]?)?\(?[0-9]{3}\)?[-.\s]?[0-9]{3}[-.\s]?[0-9]{4}/g,
    '***-***-****'
  );

  // Mask credit card numbers
  text = text.replace(/\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/g, '**** **** **** ****');

  // Mask SSN
  text = text.replace(/\b\d{3}[-\s]?\d{2}[-\s]?\d{4}\b/g, '***-**-****');

  return text;
}

function maskSensitiveInput(value: string): string {
  if (!value || typeof value !== 'string') return value;

  // Check if it looks like an email
  if (value.includes('@') && value.includes('.')) {
    return '***@***.***';
  }

  // Check if it looks like a phone number
  if (/^\+?[\d\s()-]{10,}$/.test(value)) {
    return '***-***-****';
  }

  // Check if it looks like a credit card
  if (/^\d{13,19}$/.test(value.replace(/[\s-]/g, ''))) {
    return '**** **** **** ****';
  }

  // For password fields, always mask
  return value.length > 0 ? '********' : '';
}

import { Client } from 'minio';
import { nanoid } from 'nanoid';

const minioEndpoint = process.env.MINIO_ENDPOINT || 'localhost';
const minioPort = parseInt(process.env.MINIO_PORT || '9000', 10);
const minioAccessKey = process.env.MINIO_ACCESS_KEY || 'minioadmin';
const minioSecretKey = process.env.MINIO_SECRET_KEY || 'minioadmin';
const minioUseSSL = process.env.MINIO_USE_SSL === 'true';

export const minio = new Client({
  endPoint: minioEndpoint,
  port: minioPort,
  useSSL: minioUseSSL,
  accessKey: minioAccessKey,
  secretKey: minioSecretKey,
});

// Bucket names per region
export function getBucketName(region: string, type: 'media' | 'replay'): string {
  return `relay-${region}-${type}`;
}

// Initialize buckets
export async function initializeBuckets(region: string): Promise<void> {
  const buckets = ['media', 'replay'] as const;

  for (const type of buckets) {
    const bucketName = getBucketName(region, type);
    const exists = await minio.bucketExists(bucketName);

    if (!exists) {
      await minio.makeBucket(bucketName);
      console.log(`Created bucket: ${bucketName}`);
    }
  }
}

// Generate storage key
export function generateStorageKey(projectId: string, kind: string, extension: string): string {
  const date = new Date().toISOString().slice(0, 10).replace(/-/g, '/');
  const id = nanoid(16);
  return `${projectId}/${date}/${kind}/${id}.${extension}`;
}

// Get presigned URL for upload
export async function getPresignedUploadUrl(
  bucket: string,
  key: string,
  contentType: string,
  expirySeconds = 3600
): Promise<string> {
  // MinIO doesn't support presignedPutObject with content-type restrictions directly
  // In production, you'd use S3's presigned POST or add content-type validation
  return minio.presignedPutObject(bucket, key, expirySeconds);
}

// Get presigned URL for download
export async function getPresignedDownloadUrl(
  bucket: string,
  key: string,
  expirySeconds = 3600
): Promise<string> {
  return minio.presignedGetObject(bucket, key, expirySeconds);
}

// Upload file directly (for small files)
export async function uploadFile(
  bucket: string,
  key: string,
  data: Buffer,
  contentType: string
): Promise<void> {
  await minio.putObject(bucket, key, data, data.length, {
    'Content-Type': contentType,
  });
}

// Download file
export async function downloadFile(bucket: string, key: string): Promise<Buffer> {
  const stream = await minio.getObject(bucket, key);
  const chunks: Buffer[] = [];

  return new Promise((resolve, reject) => {
    stream.on('data', (chunk: Buffer) => chunks.push(chunk));
    stream.on('end', () => resolve(Buffer.concat(chunks)));
    stream.on('error', reject);
  });
}

// Delete file
export async function deleteFile(bucket: string, key: string): Promise<void> {
  await minio.removeObject(bucket, key);
}

// Get file stats
export async function getFileStats(bucket: string, key: string): Promise<{
  size: number;
  lastModified: Date;
  contentType?: string;
}> {
  const stat = await minio.statObject(bucket, key);
  return {
    size: stat.size,
    lastModified: stat.lastModified,
    contentType: stat.metaData?.['content-type'],
  };
}

// Extension helpers
export function getExtensionFromContentType(contentType: string): string {
  const map: Record<string, string> = {
    'image/png': 'png',
    'image/jpeg': 'jpg',
    'image/webp': 'webp',
    'video/webm': 'webm',
    'video/mp4': 'mp4',
    'application/json': 'json',
    'application/pdf': 'pdf',
    'text/plain': 'txt',
  };
  return map[contentType] || 'bin';
}

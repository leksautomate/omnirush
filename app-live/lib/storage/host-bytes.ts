// Rehost generated binary assets (TTS audio, generated images, …) to durable storage
// right after generation, so the returned URL never depends on a third-party
// provider's short-lived presigned link. R2/S3 if configured, else a local public/
// file when running locally (not a real cloud deployment), else a data: URI as a
// last resort.
import { PutObjectCommand } from '@aws-sdk/client-s3'
import { mkdir, writeFile } from 'fs/promises'
import path from 'path'

import {
  getR2Client,
  getSignedFileUrl,
  isObjectStorageConfigured,
  R2_BUCKET_NAME,
  R2_PUBLIC_URL
} from '@/lib/storage/r2-client'

// A local process (not a real cloud deployment) can serve files straight out of
// public/ — Next.js serves that directory statically.
function canWriteLocalPublicFile(): boolean {
  return process.env.KAKKAO_CLOUD_DEPLOYMENT !== 'true' && !process.env.VERCEL
}

async function hostBytesLocally(
  bytes: Buffer,
  localSubdir: string,
  filename: string
): Promise<string> {
  const dir = path.join(process.cwd(), 'public', 'generated', localSubdir)
  await mkdir(dir, { recursive: true })
  await writeFile(path.join(dir, filename), bytes)
  return `/generated/${localSubdir}/${filename}`
}

export interface HostGeneratedBytesOptions {
  /** R2/S3 object key becomes `${r2KeyPrefix}/${filename}`. */
  r2KeyPrefix: string
  /** Local dev path becomes `/generated/${localSubdir}/${filename}`. */
  localSubdir: string
  filename: string
  contentType: string
  /** Signed-URL fallback lifetime when no public bucket URL is configured. */
  signedUrlTtlSeconds?: number
}

export async function hostGeneratedBytes(
  bytes: Buffer,
  {
    r2KeyPrefix,
    localSubdir,
    filename,
    contentType,
    signedUrlTtlSeconds = 60 * 60 * 24
  }: HostGeneratedBytesOptions
): Promise<string> {
  if (isObjectStorageConfigured()) {
    const key = `${r2KeyPrefix}/${filename}`
    await getR2Client().send(
      new PutObjectCommand({
        Bucket: R2_BUCKET_NAME,
        Key: key,
        Body: bytes,
        ContentType: contentType
      })
    )
    return R2_PUBLIC_URL
      ? `${R2_PUBLIC_URL.replace(/\/+$/, '')}/${key}`
      : await getSignedFileUrl(key, signedUrlTtlSeconds)
  }

  if (canWriteLocalPublicFile()) {
    try {
      return await hostBytesLocally(bytes, localSubdir, filename)
    } catch (err) {
      console.warn(
        `[storage] Local ${localSubdir} file write failed, falling back to data URI:`,
        err
      )
    }
  }

  return `data:${contentType};base64,${bytes.toString('base64')}`
}

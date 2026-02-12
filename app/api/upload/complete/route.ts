import { NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { DEFAULT_THUMBNAIL } from '@/lib/placeholders';
import { getSession } from '@/app/actions/auth';
import {
  inferSegmentFromParam,
  updateVideoRecord,
  upsertVideoRecord,
} from '@/lib/server/videoRepository';
import type { Video } from '@/types';
import { mediaUrlFromKey, saveMediaAsset, mediaKey } from '@/lib/server/mediaStorage';

export const runtime = 'nodejs';
export const preferredRegion = 'auto';
export const dynamic = 'force-dynamic';

const MAX_UPLOAD_BYTES = 100 * 1024 * 1024; // 100MB

interface CompleteUploadPayload {
  blobKey?: string;
  fileName?: string;
  contentType?: string;
  size?: number;
  duration?: string;
  title?: string;
  description?: string;
  thumbnail?: string | null;
  isMpu?: boolean;
  videoId?: string;
}

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = (await request.json()) as CompleteUploadPayload;
    const {
      blobKey,
      fileName,
      contentType = 'application/octet-stream',
      size = 0,
      duration = '0:00',
      title,
      description,
      thumbnail,
      isMpu = false,
      videoId,
    } = body;

    if (!blobKey) {
      return NextResponse.json({ error: 'blobKey is required' }, { status: 400 });
    }

    if (!fileName) {
      return NextResponse.json({ error: 'fileName is required' }, { status: 400 });
    }

    if (!Number.isFinite(size) || size <= 0) {
      return NextResponse.json({ error: 'File size must be a positive number' }, { status: 400 });
    }

    if (size > MAX_UPLOAD_BYTES) {
      return NextResponse.json({ error: 'File is too large. Maximum size is 100MB' }, { status: 400 });
    }

    if (!blobKey.startsWith('uploads/')) {
      return NextResponse.json({ error: 'Invalid blob key' }, { status: 400 });
    }

    const safeTitle = title?.trim() || fileName.replace(/\.[^/.]+$/, '');
    const safeDescription = description?.trim() || '';
    const segment = inferSegmentFromParam(isMpu ? 'mpu' : null);

    let thumbnailUrl = DEFAULT_THUMBNAIL;
    if (thumbnail && typeof thumbnail === 'string' && thumbnail.startsWith('data:image')) {
      try {
        const [meta, base64Data] = thumbnail.split(',');
        const extensionMatch = meta?.match(/data:image\/(\w+);/);
        const extension = extensionMatch?.[1]?.toLowerCase() || 'jpeg';
        const bufferThumb = Buffer.from(base64Data, 'base64');
        const thumbKey = mediaKey(
          'videos',
          'thumbnails',
          `${blobKey.split('/').pop()?.replace(/\.[^/.]+$/, '')}-thumb.${extension === 'jpeg' ? 'jpg' : extension}`
        );
        const savedThumb = await saveMediaAsset(thumbKey, bufferThumb, `image/${extension}`);
        thumbnailUrl = savedThumb.url;
      } catch (error) {
        console.warn('Failed to persist thumbnail, using default placeholder.', error);
      }
    }

    const commonFields: Partial<Video> = {
      title: safeTitle,
      description: safeDescription,
      fileName,
      filePath: mediaUrlFromKey(blobKey),
      uploadedAt: new Date().toISOString(),
      duration,
      size: formatFileSize(size),
      uploader: session.username,
      thumbnailUrl,
    };

    if (videoId) {
      const updatedVideo = await updateVideoRecord(videoId, commonFields, segment);
      return NextResponse.json(updatedVideo);
    }

    const video: Video = {
      id: randomUUID(),
      status: 'pending',
      comments: [],
      ...commonFields,
    } as Video;

    await upsertVideoRecord(video, segment);
    return NextResponse.json(video, { status: 201 });
  } catch (error) {
    console.error('Failed to finalize upload:', error);
    return NextResponse.json({ error: 'Failed to finalize upload' }, { status: 500 });
  }
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

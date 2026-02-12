import { NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { DEFAULT_THUMBNAIL } from '@/lib/placeholders';
import { getSession } from '@/app/actions/auth';
import { mediaKey, mediaUrlFromKey, saveMediaAsset } from '@/lib/server/mediaStorage';
import {
  inferSegmentFromParam,
  updateVideoRecord,
  upsertVideoRecord,
} from '@/lib/server/videoRepository';
import type { Video } from '@/types';

export const runtime = 'nodejs';
export const preferredRegion = 'auto';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File;
    const title = formData.get('title') as string;
    const description = formData.get('description') as string;
    const thumbnail = formData.get('thumbnail') as string | null;
    const existingId = formData.get('videoId') as string | null;
    const isMpu = formData.get('isMpu') === 'true';
    const segment = inferSegmentFromParam(isMpu ? 'mpu' : null);

    if (!file) {
      return NextResponse.json(
        { error: 'No file uploaded' },
        { status: 400 }
      );
    }

    // Validate file type or extension (some browsers omit MIME type)
    const validMimeTypes = ['video/mp4', 'video/webm', 'video/quicktime'];
    const validExtensions = ['mp4', 'webm', 'mov'];
    const fileType = file.type?.toLowerCase() || '';
    const fileExtension = file.name.split('.').pop()?.toLowerCase();
    const matchesMime = fileType ? validMimeTypes.includes(fileType) : false;
    const matchesExtension = fileExtension ? validExtensions.includes(fileExtension) : false;

    if (!matchesMime && !matchesExtension) {
      return NextResponse.json(
        { error: 'Invalid file type. Please upload a video file (MP4, WebM, or MOV)' },
        { status: 400 }
      );
    }

    // Check file size (max 100MB)
    const maxSize = 100 * 1024 * 1024; // 100MB
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: 'File is too large. Maximum size is 100MB' },
        { status: 400 }
      );
    }

    // Convert file to buffer
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Create a unique storage key (videos/<uuid>.<ext>)
    const safeExt = fileExtension || 'mp4';
    const videoKey = mediaKey('videos', `${randomUUID()}.${safeExt}`);
    const savedVideo = await saveMediaAsset(videoKey, buffer, fileType);

    // Get duration from form data (calculated in the frontend)
    const duration = formData.get('duration') as string || '0:00';

    // In a real app, you would save this to a database
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
          `${videoKey.split('/').pop()?.replace(/\.[^/.]+$/, '')}-thumb.${extension === 'jpeg' ? 'jpg' : extension}`
        );
        const savedThumb = await saveMediaAsset(thumbKey, bufferThumb, `image/${extension}`);
        thumbnailUrl = savedThumb.url;
      } catch (error) {
        console.warn('Failed to persist thumbnail, using default placeholder.', error);
      }
    }

    const commonFields = {
      title: title || file.name.replace(/\.[^/.]+$/, ''),
      description: description || '',
      fileName: file.name,
      filePath: savedVideo.url || mediaUrlFromKey(videoKey),
      uploadedAt: new Date().toISOString(),
      duration,
      size: formatFileSize(file.size),
      uploader: session.username,
      thumbnailUrl,
    } satisfies Partial<Video>;

    if (existingId) {
      const updatedVideo = await updateVideoRecord(existingId, commonFields, segment);
      return NextResponse.json(updatedVideo);
    }

    const video: Video = {
      id: randomUUID(),
      status: 'pending',
      comments: [],
      ...commonFields,
    };

    await upsertVideoRecord(video, segment);
    return NextResponse.json(video, { status: 201 });
  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json(
      { error: 'Failed to upload file' },
      { status: 500 }
    );
  }
}

// Helper function to format file size
function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

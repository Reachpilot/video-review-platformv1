import { NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { getSession } from '@/app/actions/auth';
import { generateSignedBlobUploadUrl, mediaKey, mediaUrlFromKey } from '@/lib/server/mediaStorage';

export const runtime = 'nodejs';
export const preferredRegion = 'auto';
export const dynamic = 'force-dynamic';

const MAX_UPLOAD_BYTES = 100 * 1024 * 1024; // 100MB
const VALID_EXTENSIONS = ['mp4', 'webm', 'mov'];
const VALID_MIME_TYPES = ['video/mp4', 'video/webm', 'video/quicktime'];

interface SignedUploadRequest {
  fileName?: string;
  contentType?: string;
  fileSize?: number;
}

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = (await request.json()) as SignedUploadRequest;
    const fileName = body.fileName?.trim();
    const contentType = (body.contentType || '').toLowerCase();
    const fileSize = Number(body.fileSize || 0);

    if (!fileName) {
      return NextResponse.json({ error: 'fileName is required' }, { status: 400 });
    }

    if (!Number.isFinite(fileSize) || fileSize <= 0) {
      return NextResponse.json({ error: 'fileSize must be a positive number' }, { status: 400 });
    }

    if (fileSize > MAX_UPLOAD_BYTES) {
      return NextResponse.json({ error: 'File is too large. Maximum size is 100MB' }, { status: 400 });
    }

    const extension = fileName.split('.').pop()?.toLowerCase();
    if (!extension || !VALID_EXTENSIONS.includes(extension)) {
      return NextResponse.json(
        { error: 'Invalid file extension. Please upload an MP4, WebM, or MOV video.' },
        { status: 400 }
      );
    }

    if (contentType && !VALID_MIME_TYPES.includes(contentType)) {
      return NextResponse.json(
        { error: 'Invalid file type. Please upload a video file (MP4, WebM, or MOV).' },
        { status: 400 }
      );
    }

    const videoKey = mediaKey('videos', `${randomUUID()}.${extension}`);
    const uploadUrl = await generateSignedBlobUploadUrl(videoKey);

    return NextResponse.json({
      uploadUrl,
      blobKey: videoKey,
      publicUrl: mediaUrlFromKey(videoKey),
      maxUploadBytes: MAX_UPLOAD_BYTES,
    });
  } catch (error) {
    console.error('Failed to create signed upload URL:', error);
    return NextResponse.json({ error: 'Failed to prepare upload' }, { status: 500 });
  }
}

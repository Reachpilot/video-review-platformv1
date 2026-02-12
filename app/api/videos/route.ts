import { NextRequest, NextResponse } from 'next/server';
import { randomUUID } from 'crypto';
import { getSession } from '@/app/actions/auth';
import { DEFAULT_THUMBNAIL } from '@/lib/placeholders';
import type { Video } from '@/types';
import {
  deleteVideoRecord,
  inferSegmentFromParam,
  listVideos,
  updateVideoRecord,
  upsertVideoRecord,
} from '@/lib/server/videoRepository';

const formatFileSize = (bytes: number) => {
  if (!bytes) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.min(Math.floor(Math.log(bytes) / Math.log(k)), sizes.length - 1);
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
};

const requireSession = async () => {
  const session = await getSession();
  if (!session) {
    throw new NextResponse('Unauthorized', { status: 401 });
  }
  return session;
};

export async function GET(request: NextRequest) {
  try {
    const session = await requireSession();
    const { searchParams } = new URL(request.url);
    const segment = inferSegmentFromParam(searchParams.get('mpu'));
    const statusFilter = searchParams.get('status');

    const videos = await listVideos(segment);
    const result = statusFilter ? videos.filter(video => video.status === statusFilter) : videos;
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof NextResponse) {
      return error;
    }
    console.error('Failed to load videos:', error);
    return NextResponse.json({ error: 'Failed to load videos' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await requireSession();
    const formData = await request.formData();
    const title = (formData.get('title') as string) || '';
    const description = (formData.get('description') as string) || '';
    const duration = (formData.get('duration') as string) || '0:00';
    const thumbnail = formData.get('thumbnail') as string | null;
    const segment = inferSegmentFromParam(formData.get('isMpu') === 'true' ? 'mpu' : null);
    const fileName = (formData.get('fileName') as string) || '';
    const fileSize = Number(formData.get('fileSize') || 0);
    const filePath = (formData.get('filePath') as string) || '';

    if (!fileName || !filePath) {
      return NextResponse.json({ error: 'Missing uploaded file metadata' }, { status: 400 });
    }

    const video: Video = {
      id: (formData.get('videoId') as string) || randomUUID(),
      title: title || fileName.replace(/\.[^/.]+$/, ''),
      description,
      fileName,
      filePath,
      thumbnailUrl: thumbnail || DEFAULT_THUMBNAIL,
      status: 'pending',
      uploadedAt: new Date().toISOString(),
      duration,
      size: formatFileSize(fileSize),
      uploader: session.username,
      comments: [],
    };

    await upsertVideoRecord(video, segment);
    return NextResponse.json(video, { status: 201 });
  } catch (error) {
    if (error instanceof NextResponse) {
      return error;
    }
    console.error('Failed to create video record:', error);
    return NextResponse.json({ error: 'Failed to create video record' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    await requireSession();
    const body = await request.json();
    const { id, updates, segment } = body as { id: string; updates: Partial<Video>; segment?: 'default' | 'mpu' };

    if (!id) {
      return NextResponse.json({ error: 'Video ID is required' }, { status: 400 });
    }

    const normalizedSegment = inferSegmentFromParam(segment === 'mpu' ? 'mpu' : null);
    const updatedVideo = await updateVideoRecord(id, updates, normalizedSegment);
    return NextResponse.json(updatedVideo);
  } catch (error) {
    if (error instanceof NextResponse) {
      return error;
    }
    console.error('Failed to update video record:', error);
    return NextResponse.json({ error: 'Failed to update video record' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    await requireSession();
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const segment = inferSegmentFromParam(searchParams.get('mpu'));

    if (!id) {
      return NextResponse.json({ error: 'Video ID is required' }, { status: 400 });
    }

    await deleteVideoRecord(id, segment);
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof NextResponse) {
      return error;
    }
    console.error('Failed to delete video record:', error);
    return NextResponse.json({ error: 'Failed to delete video record' }, { status: 500 });
  }
}

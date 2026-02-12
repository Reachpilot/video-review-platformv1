import { NextResponse } from 'next/server';
import { readMediaAsset } from '@/lib/server/mediaStorage';

interface RouteParams {
  params: {
    path: string[];
  };
}

const sanitizeSegments = (segments: string[]) =>
  segments.map(segment => segment.replace(/\.\.|\//g, '')).filter(Boolean);

export async function GET(_request: Request, { params }: RouteParams) {
  try {
    const segments = sanitizeSegments(params.path || []);
    if (segments.length === 0) {
      return NextResponse.json({ error: 'Missing media path' }, { status: 404 });
    }

    const key = segments.join('/');
    const asset = await readMediaAsset(key);

    if (!asset?.data) {
      return NextResponse.json({ error: 'Media not found' }, { status: 404 });
    }

    const contentType = typeof asset.contentType === 'string' && asset.contentType.length > 0
      ? asset.contentType
      : 'application/octet-stream';

    const headers = new Headers({
      'Content-Type': contentType,
      'Cache-Control': 'public, max-age=31536000, immutable',
      'Content-Length': asset.data.length.toString(),
    });

    return new NextResponse(asset.data, { headers });
  } catch (error) {
    console.error('Failed to serve media asset', error);
    return NextResponse.json({ error: 'Failed to load media asset' }, { status: 500 });
  }
}

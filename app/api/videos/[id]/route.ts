import { NextResponse } from 'next/server';

// In-memory storage (import from a shared module in a real app)
let videos: any[] = [];

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const { status } = await request.json();
    const videoIndex = videos.findIndex(v => v.id === params.id);
    
    if (videoIndex === -1) {
      return NextResponse.json(
        { error: 'Video not found' },
        { status: 404 }
      );
    }
    
    const updatedVideo = { 
      ...videos[videoIndex], 
      status,
      updatedAt: new Date().toISOString()
    };
    
    videos[videoIndex] = updatedVideo;
    
    return NextResponse.json(updatedVideo);
  } catch (error) {
    console.error('Error updating video status:', error);
    return NextResponse.json(
      { error: 'Failed to update video status' },
      { status: 500 }
    );
  }
}

export interface Comment {
  id: string;
  text: string;
  timestamp: number;
  time: number;
  userId: string;
  createdAt: Date | string;
}

export interface Video {
  id: string;
  title: string;
  description: string;
  fileName: string;
  filePath: string;
  thumbnailUrl: string;
  status: 'pending' | 'needs_revision' | 'approved';
  scheduledDate?: string | null;
  uploadedAt: Date | string;
  comments: Comment[];
  duration: string;
  size: string;
  uploader: string;
  cloudinaryPublicId?: string;
  cloudinaryResourceType?: string;
  cloudinaryFormat?: string;
}

export type VideoStatus = Video['status'];

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
  status: 'pending' | 'needs_revision' | 'approved' | 'uploaded';
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

export const VIDEO_STATUS_OPTIONS = [
  { value: 'pending', label: 'Pending' },
  { value: 'needs_revision', label: 'Needs Revision' },
  { value: 'approved', label: 'Approved' },
  { value: 'uploaded', label: 'Uploaded' },
] as const;

export type VideoStatus = typeof VIDEO_STATUS_OPTIONS[number]['value'];

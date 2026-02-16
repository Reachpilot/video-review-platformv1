import { Video } from '@/types';
import { DEFAULT_THUMBNAIL } from './placeholders';

const API_BASE = (process.env.NEXT_PUBLIC_API_URL || '').replace(/\/$/, '');

const withBase = (path: string) => `${API_BASE}${path}`;

const buildQuery = (params: Record<string, string | null | undefined>) => {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      query.set(key, value);
    }
  });
  const qs = query.toString();
  return qs ? `?${qs}` : '';
};

const readErrorMessage = async (response: Response) => {
  const bodyText = await response.text();

  if (!bodyText) {
    return '';
  }

  try {
    const data = JSON.parse(bodyText);
    if (typeof data === 'string') return data;
    if (data?.error) return data.error;
    return JSON.stringify(data);
  } catch {
    return bodyText;
  }
};

const normalizeVideo = (video: Video, thumbnailOverride?: string): Video => ({
  ...video,
  thumbnailUrl: thumbnailOverride || video.thumbnailUrl || DEFAULT_THUMBNAIL,
  comments: video.comments || [],
});

const requestJson = async <T>(input: RequestInfo, init?: RequestInit): Promise<T> => {
  const response = await fetch(input, {
    credentials: 'include',
    ...init,
  });

  if (!response.ok) {
    const message = await readErrorMessage(response);
    throw new Error(message || 'Request failed');
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
};

type VideoBuckets = {
  default?: Video[];
  mpu?: Video[];
};

const fetchStaticVideos = async (): Promise<VideoBuckets> => {
  const response = await fetch('/uploads/data/videos.json', { cache: 'no-store' });
  if (!response.ok) {
    throw new Error('Static videos.json not available');
  }
  return (await response.json()) as VideoBuckets;
};

const updateVideoMetadata = async (id: string, updates: Partial<Video>, isMpu = false) => {
  const payload = {
    id,
    updates,
    segment: isMpu ? 'mpu' : 'default',
  };

  return requestJson<Video>(withBase('/api/videos'), {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });
};

const uploadViaServer = async (
  file: File,
  title: string,
  description: string,
  duration: string,
  thumbnailDataUrl: string,
  isMpu: boolean,
  videoId?: string
) => {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('title', title);
  formData.append('description', description);
  formData.append('duration', duration);
  formData.append('isMpu', isMpu ? 'true' : 'false');
  if (thumbnailDataUrl) {
    formData.append('thumbnail', thumbnailDataUrl);
  }
  if (videoId) {
    formData.append('videoId', videoId);
  }

  const response = await fetch(withBase('/api/upload'), {
    method: 'POST',
    body: formData,
    credentials: 'include',
  });

  if (!response.ok) {
    const message = await readErrorMessage(response);
    throw new Error(message || 'Upload failed');
  }

  return (await response.json()) as Video;
};

export async function getVideos(isMpu = false): Promise<Video[]> {
  const query = buildQuery({ mpu: isMpu ? 'true' : null, t: Date.now().toString() });
  try {
    return await requestJson<Video[]>(withBase(`/api/videos${query}`), {
      cache: 'no-store',
    });
  } catch (error) {
    console.warn('Falling back to static videos.json:', error);
    const fallback = await fetchStaticVideos();
    return (isMpu ? fallback.mpu : fallback.default) ?? [];
  }
}

export async function uploadVideo(
  file: File,
  title: string,
  description: string,
  duration: string,
  thumbnailDataUrl = '',
  isMpu = false
): Promise<Video> {
  const uploadedVideo = await uploadViaServer(
    file,
    title,
    description,
    duration,
    thumbnailDataUrl,
    isMpu
  );
  return normalizeVideo(uploadedVideo, thumbnailDataUrl);
}

export async function replaceVideoFile(
  video: Video,
  file: File,
  duration: string,
  thumbnailDataUrl = '',
  isMpu = false
): Promise<Video> {
  const uploadedVideo = await uploadViaServer(
    file,
    video.title,
    video.description || '',
    duration,
    thumbnailDataUrl,
    isMpu,
    video.id
  );
  return normalizeVideo({ ...video, ...uploadedVideo }, thumbnailDataUrl || uploadedVideo.thumbnailUrl);
}

export async function updateVideoStatus(
  id: string,
  status: 'pending' | 'needs_revision' | 'approved',
  isMpu = false
): Promise<Video> {
  return updateVideoMetadata(id, { status }, isMpu);
}

export async function saveVideo(updatedVideo: Video, isMpu = false): Promise<Video> {
  return updateVideoMetadata(updatedVideo.id, updatedVideo, isMpu);
}

export async function deleteVideo(id: string, isMpu = false): Promise<boolean> {
  const query = buildQuery({ id, mpu: isMpu ? 'true' : null });
  await requestJson(withBase(`/api/videos${query}`), {
    method: 'DELETE',
  });
  return true;
}

import { Video } from '@/types';
import { DEFAULT_THUMBNAIL } from '@/lib/placeholders';
import { mediaKey, readMediaAsset, saveMediaAsset } from './mediaStorage';

export type VideoSegment = 'default' | 'mpu';

interface VideoStore {
  default: Video[];
  mpu: Video[];
}

const VIDEO_STORE_KEY = mediaKey('data', 'videos.json');

const demoVideos: Video[] = [
  {
    id: 'vid-demo-1',
    title: 'Onboarding Clip',
    description: 'Kurze Einführung in den Ablauf.',
    fileName: 'onboarding.mp4',
    filePath: '/videos/demo1.mp4',
    thumbnailUrl: DEFAULT_THUMBNAIL,
    status: 'pending',
    uploadedAt: new Date(2026, 0, 28, 9, 0).toISOString(),
    duration: '02:45',
    size: '54 MB',
    uploader: 'Nina',
    comments: [],
  },
  {
    id: 'vid-demo-2',
    title: 'Produkt Teaser',
    description: '30 Sekunden Social Spot.',
    fileName: 'teaser.mp4',
    filePath: '/videos/demo2.mp4',
    thumbnailUrl: DEFAULT_THUMBNAIL,
    status: 'needs_revision',
    uploadedAt: new Date(2026, 0, 27, 14, 30).toISOString(),
    duration: '00:30',
    size: '12 MB',
    uploader: 'Lea',
    comments: [],
  },
];

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value));

const getInitialStore = (): VideoStore => ({
  default: clone(demoVideos),
  mpu: [],
});

const parseStore = (raw: Buffer | undefined | null): VideoStore => {
  if (!raw || raw.length === 0) {
    return getInitialStore();
  }

  try {
    const parsed = JSON.parse(raw.toString('utf8')) as Partial<VideoStore>;
    return {
      default: Array.isArray(parsed.default) ? parsed.default : getInitialStore().default,
      mpu: Array.isArray(parsed.mpu) ? parsed.mpu : [],
    };
  } catch (error) {
    console.warn('Failed to parse video store, recreating default.', error);
    return getInitialStore();
  }
};

const persistStore = async (store: VideoStore) => {
  await saveMediaAsset(VIDEO_STORE_KEY, Buffer.from(JSON.stringify(store, null, 2)), 'application/json');
};

const loadStore = async (): Promise<VideoStore> => {
  const asset = await readMediaAsset(VIDEO_STORE_KEY);
  if (!asset?.data) {
    const initial = getInitialStore();
    await persistStore(initial);
    return initial;
  }

  return parseStore(asset.data);
};

const normalizeSegment = (segment?: string | null): VideoSegment => (segment === 'mpu' ? 'mpu' : 'default');

export const listVideos = async (segment: VideoSegment = 'default') => {
  const store = await loadStore();
  return store[segment];
};

export const upsertVideoRecord = async (video: Video, segment: VideoSegment = 'default') => {
  const store = await loadStore();
  const filtered = store[segment].filter(existing => existing.id !== video.id);
  store[segment] = [video, ...filtered];
  await persistStore(store);
  return video;
};

export const updateVideoRecord = async (
  videoId: string,
  updates: Partial<Video>,
  segment: VideoSegment = 'default'
) => {
  const store = await loadStore();
  const idx = store[segment].findIndex(video => video.id === videoId);
  if (idx === -1) {
    throw new Error('Video not found');
  }

  const updated = {
    ...store[segment][idx],
    ...updates,
  } as Video;

  store[segment][idx] = updated;
  await persistStore(store);
  return updated;
};

export const deleteVideoRecord = async (videoId: string, segment: VideoSegment = 'default') => {
  const store = await loadStore();
  const originalLength = store[segment].length;
  store[segment] = store[segment].filter(video => video.id !== videoId);
  if (store[segment].length === originalLength) {
    throw new Error('Video not found');
  }

  await persistStore(store);
};

export const inferSegmentFromParam = (value?: string | null) => normalizeSegment(value);

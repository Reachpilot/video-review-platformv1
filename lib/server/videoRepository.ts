import { readdir, stat } from 'fs/promises';
import { existsSync } from 'fs';
import { join, extname, basename } from 'path';
import { execFile } from 'child_process';
import { promisify } from 'util';
import ffprobe from 'ffprobe-static';

import { Video } from '@/types';
import { DEFAULT_THUMBNAIL } from '@/lib/placeholders';
import { mediaKey, mediaUrlFromKey, readMediaAsset, saveMediaAsset } from './mediaStorage';

export type VideoSegment = 'default' | 'mpu';

interface VideoStore {
  default: Video[];
  mpu: Video[];
}

const VIDEO_STORE_KEY = mediaKey('data', 'videos.json');

const PUBLIC_UPLOADS_DIR = join(process.cwd(), 'public', 'uploads');
const PUBLIC_VIDEOS_DIR = join(PUBLIC_UPLOADS_DIR, 'videos');
const PUBLIC_THUMBS_DIR = join(PUBLIC_VIDEOS_DIR, 'thumbnails');
const DATA_FILE_KEY = mediaKey('data', 'videos.json');
const SUPPORTED_EXTENSIONS = new Set(['.mp4', '.mov', '.webm', '.mkv', '.avi']);
const IGNORED_FILES = new Set(['.gitkeep', '.DS_Store']);
const DEFAULT_UPLOADER = process.env.MANUAL_UPLOAD_UPLOADER || 'Manueller Upload';
const DEFAULT_STATUS: Video['status'] = 'pending';

const getInitialStore = (): VideoStore => ({
  default: [],
  mpu: [],
});

const slugify = (value: string) =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');

const toTitleCase = (value: string) =>
  value
    .split('-')
    .filter(Boolean)
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');

const formatBytes = (bytes: number) => {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)));
  const value = bytes / Math.pow(1024, i);
  return `${value.toFixed(i === 0 ? 0 : 2)} ${units[i]}`;
};

const formatDuration = (seconds: number) => {
  if (!Number.isFinite(seconds) || seconds <= 0) return '00:00';
  const totalSeconds = Math.round(seconds);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const secs = totalSeconds % 60;
  const pad = (val: number) => String(val).padStart(2, '0');
  if (hours > 0) {
    return `${pad(hours)}:${pad(minutes)}:${pad(secs)}`;
  }
  return `${pad(minutes)}:${pad(secs)}`;
};

interface FileListResult {
  entries: import('fs').Dirent[];
  exists: boolean;
}

const readVideoDirectory = async (): Promise<FileListResult> => {
  try {
    const entries = await readdir(PUBLIC_VIDEOS_DIR, { withFileTypes: true });
    return { entries: entries.filter(entry => entry.isFile()), exists: true };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return { entries: [], exists: false };
    }
    throw error;
  }
};

const execFileAsync = promisify(execFile);

const probeDurationSeconds = async (absolutePath: string) => {
  const ffprobePath = typeof ffprobe === 'string' ? ffprobe : (ffprobe as { path?: string } | undefined)?.path;
  if (!ffprobePath) {
    throw new Error('ffprobe binary not available');
  }

  const args = [
    '-v',
    'error',
    '-show_entries',
    'format=duration',
    '-of',
    'default=noprint_wrappers=1:nokey=1',
    absolutePath,
  ];

  const { stdout } = await execFileAsync(ffprobePath, args);
  const seconds = parseFloat(String(stdout).trim());
  if (!Number.isFinite(seconds)) {
    throw new Error('Invalid duration output');
  }
  return seconds;
};

const getDurationLabel = async (absolutePath: string) => {
  try {
    const seconds = await probeDurationSeconds(absolutePath);
    return formatDuration(seconds);
  } catch (error) {
    console.warn('Failed to determine duration for %s: %s', absolutePath, (error as Error)?.message || error);
    return '00:00';
  }
};

const buildVideoRecord = async (fileName: string): Promise<Video> => {
  const absolutePath = join(PUBLIC_VIDEOS_DIR, fileName);
  const fileStats = await stat(absolutePath);
  const base = basename(fileName, extname(fileName));
  const slug = slugify(base) || `video-${fileStats.mtimeMs}`;
  const thumbPath = join(PUBLIC_THUMBS_DIR, `${slug}.jpg`);
  const hasThumbnail = existsSync(thumbPath);
  const videoKey = mediaKey('videos', fileName);
  const thumbKey = mediaKey('videos', 'thumbnails', `${slug}.jpg`);
  const duration = await getDurationLabel(absolutePath);

  return {
    id: `vid-${slug}`,
    title: toTitleCase(slug) || fileName,
    description: '',
    fileName,
    filePath: mediaUrlFromKey(videoKey),
    thumbnailUrl: hasThumbnail ? mediaUrlFromKey(thumbKey) : DEFAULT_THUMBNAIL,
    status: DEFAULT_STATUS,
    uploadedAt: fileStats.mtime.toISOString(),
    duration,
    size: formatBytes(fileStats.size),
    uploader: DEFAULT_UPLOADER,
    comments: [],
  };
};

const syncStoreWithFilesystem = async (store: VideoStore): Promise<VideoStore> => {
  const { entries: fileEntries, exists } = await readVideoDirectory();
  if (!exists) {
    // On serverless builds, the uploads directory might not be present (static assets served via CDN).
    // In that case, keep the existing store as-is.
    return store;
  }
  const validEntries = fileEntries
    .map(entry => entry.name)
    .filter(name => !IGNORED_FILES.has(name))
    .filter(name => SUPPORTED_EXTENSIONS.has(extname(name).toLowerCase()));

  const existingByFile = new Map(store.default.map(video => [video.fileName, video] as const));
  let needsPersist = false;

  const retained: Video[] = [];
  const newlyDiscovered: Video[] = [];
  for (const fileName of validEntries) {
    const existing = existingByFile.get(fileName);
    const metadata = await buildVideoRecord(fileName);
    if (existing) {
      const durationFallback = metadata.duration && metadata.duration !== '00:00' ? metadata.duration : existing.duration;
      const sizeFallback = metadata.size && metadata.size !== '0 B' ? metadata.size : existing.size;
      const uploadedAtFallback = existing.uploadedAt || metadata.uploadedAt;

      const merged = {
        ...existing,
        fileName: existing.fileName || metadata.fileName,
        filePath: metadata.filePath,
        thumbnailUrl:
          existing.thumbnailUrl && existing.thumbnailUrl !== DEFAULT_THUMBNAIL
            ? existing.thumbnailUrl
            : metadata.thumbnailUrl,
        duration: durationFallback || metadata.duration,
        size: sizeFallback || metadata.size,
        uploadedAt: uploadedAtFallback,
        description: existing.description ?? metadata.description,
        uploader: existing.uploader || metadata.uploader,
        comments: existing.comments || metadata.comments,
      } satisfies Video;

      if (
        merged.filePath !== existing.filePath ||
        merged.thumbnailUrl !== existing.thumbnailUrl ||
        merged.duration !== existing.duration ||
        merged.size !== existing.size ||
        merged.uploadedAt !== existing.uploadedAt
      ) {
        needsPersist = true;
      }

      retained.push(merged);
      continue;
    }
    // New file -> create default record
    newlyDiscovered.push(metadata);
    needsPersist = true;
  }

  const existingFiles = new Set(validEntries);
  const removedCount = store.default.filter(video => !existingFiles.has(video.fileName)).length;
  if (removedCount > 0) {
    needsPersist = true;
  }

  const merged = [...retained, ...newlyDiscovered]
    .sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime());

  const nextStore: VideoStore = {
    default: merged,
    mpu: store.mpu || [],
  };

  if (needsPersist) {
    await persistStore(nextStore);
    return nextStore;
  }

  return store;
};

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
  await saveMediaAsset(DATA_FILE_KEY, Buffer.from(JSON.stringify(store, null, 2)), 'application/json');
};

const loadStore = async (): Promise<VideoStore> => {
  try {
    const asset = await readMediaAsset(DATA_FILE_KEY, true); // force read from static
    if (asset?.data) {
      const parsed = parseStore(asset.data);
      return syncStoreWithFilesystem(parsed);
    }
  } catch (error) {
    // ignore, fallback to blob
  }
  const asset = await readMediaAsset(DATA_FILE_KEY);
  if (!asset?.data) {
    const initial = getInitialStore();
    await persistStore(initial);
    return syncStoreWithFilesystem(initial);
  }
  const parsed = parseStore(asset.data);
  return syncStoreWithFilesystem(parsed);
};

const normalizeSegment = (segment?: string | null): VideoSegment => (segment === 'mpu' ? 'mpu' : 'default');

export const listVideos = async (segment: VideoSegment = 'default') => {
  const store = await loadStore();
  return [...store[segment]].sort(
    (a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime()
  );
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

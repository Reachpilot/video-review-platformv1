#!/usr/bin/env node
/*
 * Synchronizes all videos stored under public/uploads/videos into
 * public/uploads/data/videos.json and generates thumbnails via ffmpeg.
 */
const fs = require('fs/promises');
const { existsSync } = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const { getVideoDurationInSeconds } = require('get-video-duration');

const ROOT = path.join(__dirname, '..');
const UPLOADS_ROOT = path.join(ROOT, 'public', 'uploads');
const VIDEOS_DIR = path.join(UPLOADS_ROOT, 'videos');
const THUMBS_DIR = path.join(VIDEOS_DIR, 'thumbnails');
const DATA_DIR = path.join(UPLOADS_ROOT, 'data');
const DATA_FILE = path.join(DATA_DIR, 'videos.json');
const useMediaProxy = process.env.USE_BLOB_STORAGE === 'true';
const mediaUrlFromKey = key => (useMediaProxy ? `/api/media/${key}` : `/${key}`);

const IGNORED_FILES = new Set(['.gitkeep']);
const SUPPORTED_EXTENSIONS = new Set(['.mp4', '.mov', '.webm', '.mkv', '.avi']);

const DEFAULT_UPLOADER = process.env.MANUAL_UPLOAD_UPLOADER || 'Manual Import';
const DEFAULT_STATUS = process.env.MANUAL_UPLOAD_STATUS || 'pending';

const ensureDir = async dir => fs.mkdir(dir, { recursive: true });

const pad = value => value.toString().padStart(2, '0');

const formatDuration = seconds => {
  if (!Number.isFinite(seconds)) return '00:00';
  const totalSeconds = Math.max(0, Math.round(seconds));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const secs = totalSeconds % 60;
  if (hours > 0) {
    return `${pad(hours)}:${pad(minutes)}:${pad(secs)}`;
  }
  return `${pad(minutes)}:${pad(secs)}`;
};

const formatBytes = bytes => {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const value = bytes / Math.pow(1024, i);
  return `${value.toFixed(i === 0 ? 0 : 2)} ${units[i]}`;
};

const slugify = value =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');

const startCase = value =>
  value
    .split('-')
    .filter(Boolean)
    .map(part => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');

const FFMPEG_BIN = process.env.FFMPEG_PATH || process.env.FFMPEG_BIN || 'ffmpeg';

const ensureThumbnail = async (videoPath, thumbnailPath) => {
  const needsRefresh = async () => {
    if (!existsSync(thumbnailPath)) return true;
    const [videoStat, thumbStat] = await Promise.all([fs.stat(videoPath), fs.stat(thumbnailPath)]);
    return thumbStat.mtimeMs < videoStat.mtimeMs;
  };

  if (!(await needsRefresh())) {
    return;
  }

  await ensureDir(path.dirname(thumbnailPath));

  await new Promise((resolve, reject) => {
    const ffmpeg = spawn(FFMPEG_BIN, [
      '-y',
      '-i',
      videoPath,
      '-vf',
      'scale=360:-1',
      '-frames:v',
      '1',
      thumbnailPath,
    ]);

    ffmpeg.on('error', error => {
      if (error.code === 'ENOENT') {
        reject(
          new Error(
            `ffmpeg binary not found at "${FFMPEG_BIN}". Install ffmpeg (e.g. via brew install ffmpeg) or set FFMPEG_PATH.`
          )
        );
        return;
      }
      reject(error);
    });
    ffmpeg.on('close', code => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`ffmpeg exited with code ${code}`));
      }
    });
  });
};

const readExistingStore = async () => {
  if (!existsSync(DATA_FILE)) {
    return { default: [], mpu: [] };
  }
  try {
    const raw = await fs.readFile(DATA_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    return {
      default: Array.isArray(parsed.default) ? parsed.default : [],
      mpu: Array.isArray(parsed.mpu) ? parsed.mpu : [],
    };
  } catch (error) {
    console.warn('Failed to parse existing videos.json, recreating.', error);
    return { default: [], mpu: [] };
  }
};

const discoverVideoFiles = async () => {
  try {
    const entries = await fs.readdir(VIDEOS_DIR, { withFileTypes: true });
    return entries
      .filter(entry => entry.isFile())
      .filter(entry => !IGNORED_FILES.has(entry.name))
      .filter(entry => SUPPORTED_EXTENSIONS.has(path.extname(entry.name).toLowerCase()));
  } catch (error) {
    if (error.code === 'ENOENT') {
      return [];
    }
    throw error;
  }
};

const buildVideoRecord = async entry => {
  const absoluteVideoPath = path.join(VIDEOS_DIR, entry.name);
  const slug = slugify(entry.name.replace(path.extname(entry.name), ''));
  const thumbFilename = `${slug}.jpg`;
  const absoluteThumbnailPath = path.join(THUMBS_DIR, thumbFilename);

  try {
    await ensureThumbnail(absoluteVideoPath, absoluteThumbnailPath);
  } catch (error) {
    console.warn(`Failed to generate thumbnail for ${entry.name}:`, error.message);
  }

  let durationLabel = '00:00';
  try {
    const seconds = await getVideoDurationInSeconds(absoluteVideoPath);
    durationLabel = formatDuration(seconds);
  } catch (error) {
    console.warn(`Failed to read duration for ${entry.name}:`, error.message);
  }

  const stats = await fs.stat(absoluteVideoPath);
  const relativeVideoKey = path.posix.join('uploads', 'videos', entry.name);
  const relativeThumbnailKey = path.posix.join('uploads', 'videos', 'thumbnails', thumbFilename);

  return {
    id: `vid-${slug}`,
    title: startCase(slug) || entry.name,
    description: '',
    fileName: entry.name,
    filePath: mediaUrlFromKey(relativeVideoKey),
    thumbnailUrl: mediaUrlFromKey(relativeThumbnailKey),
    status: DEFAULT_STATUS,
    uploadedAt: stats.mtime.toISOString(),
    duration: durationLabel,
    size: formatBytes(stats.size),
    uploader: DEFAULT_UPLOADER,
    comments: [],
  };
};

async function main() {
  await Promise.all([ensureDir(VIDEOS_DIR), ensureDir(THUMBS_DIR), ensureDir(DATA_DIR)]);

  const [existingStore, entries] = await Promise.all([readExistingStore(), discoverVideoFiles()]);

  if (entries.length === 0) {
    console.log('No local videos found – created empty videos.json');
    await fs.writeFile(DATA_FILE, JSON.stringify({ default: [], mpu: existingStore.mpu || [] }, null, 2));
    return;
  }

  const videos = await Promise.all(entries.map(buildVideoRecord));
  videos.sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime());

  const store = {
    default: videos,
    mpu: existingStore.mpu || [],
  };

  await fs.writeFile(DATA_FILE, JSON.stringify(store, null, 2));
  console.log(`Synced ${videos.length} video(s) to ${path.relative(ROOT, DATA_FILE)}`);
}

main().catch(error => {
  console.error('Failed to synchronize local videos.', error);
  process.exitCode = 1;
});

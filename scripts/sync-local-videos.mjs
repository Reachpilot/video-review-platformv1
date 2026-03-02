#!/usr/bin/env node
/*
 * Synchronizes all videos stored under public/uploads/videos into
 * public/uploads/data/videos.json and generates thumbnails via ffmpeg.
 * Also uploads videos and thumbnails to Supabase storage.
 */
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { getVideoDurationInSeconds } from 'get-video-duration';
import { spawn } from 'child_process';
import { promisify } from 'util';
import { readFileSync, existsSync } from 'fs';
import { createClient } from '@supabase/supabase-js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const ROOT = path.join(__dirname, '..');
const UPLOADS_ROOT = path.join(ROOT, 'public', 'uploads');
const VIDEOS_DIR = path.join(UPLOADS_ROOT, 'videos');
const THUMBS_DIR = path.join(VIDEOS_DIR, 'thumbnails');
const DATA_DIR = path.join(UPLOADS_ROOT, 'data');
const DATA_FILE = path.join(DATA_DIR, 'videos.json');
const useMediaProxy = process.env.USE_BLOB_STORAGE === 'true';
const mediaUrlFromKey = key => {
  if (supabaseClient) {
    return supabaseClient.storage.from(BLOB_STORE_NAME).getPublicUrl(key).data.publicUrl;
  } else if (useMediaProxy) {
    return `/api/media/${key}`;
  } else {
    return `/${key}`;
  }
};

// Load .env.local
const envPath = path.join(__dirname, '..', '.env.local');
if (existsSync(envPath)) {
  const envContent = readFileSync(envPath, 'utf8');
  envContent.split('\n').forEach(line => {
    if (line.includes('=')) {
      const [key, value] = line.split('=', 2);
      process.env[key.trim()] = value.trim();
    }
  });
}

// Supabase client
const supabaseClient = process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) : null;
const BLOB_STORE_NAME = 'videos';

// Save media asset function
const saveMediaAsset = async (key, content, contentType) => {
  if (supabaseClient) {
    const { data, error } = await supabaseClient.storage.from(BLOB_STORE_NAME).upload(key, content, { contentType, upsert: true });
    if (error) throw error;
    return data.path;
  } else {
    const filePath = path.join(process.cwd(), 'public', key);
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, content);
    return key;
  }
};

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

const buildVideoRecord = async (entry, existingVideo) => {
  const absoluteVideoPath = path.join(VIDEOS_DIR, entry.name);
  const slug = slugify(entry.name.replace(path.extname(entry.name), ''));
  const videoSlug = slugify(entry.name);
  const thumbFilename = `${slug}.jpg`;
  const absoluteThumbnailPath = path.join(THUMBS_DIR, thumbFilename);

  try {
    await ensureThumbnail(absoluteVideoPath, absoluteThumbnailPath);
  } catch (error) {
    console.warn(`Failed to generate thumbnail for ${entry.name}:`, error.message);
  }

  let durationLabel = existingVideo?.duration || '00:00';
  try {
    const seconds = await getVideoDurationInSeconds(absoluteVideoPath);
    durationLabel = formatDuration(seconds);
  } catch (error) {
    console.warn(`Failed to read duration for ${entry.name}:`, error.message);
  }

  const stats = await fs.stat(absoluteVideoPath);
  const relativeVideoKey = path.posix.join('uploads', 'videos', videoSlug);
  const relativeThumbnailKey = path.posix.join('uploads', 'videos', 'thumbnails', thumbFilename);

  // Upload video to Supabase
  const videoContent = await fs.readFile(absoluteVideoPath);
  await saveMediaAsset(relativeVideoKey, videoContent, 'video/mp4'); // TODO: detect mime type

  // Upload thumbnail to Supabase
  const thumbContent = await fs.readFile(absoluteThumbnailPath);
  await saveMediaAsset(relativeThumbnailKey, thumbContent, 'image/jpeg');

  return {
    id: existingVideo?.id || `vid-${slug}`,
    title: existingVideo?.title || startCase(slug) || entry.name,
    description: existingVideo?.description || '',
    fileName: entry.name,
    filePath: mediaUrlFromKey(relativeVideoKey),
    thumbnailUrl: mediaUrlFromKey(relativeThumbnailKey),
    status: existingVideo?.status || DEFAULT_STATUS,
    uploadedAt: stats.mtime.toISOString(),
    duration: durationLabel,
    size: existingVideo?.size || formatBytes(stats.size),
    uploader: existingVideo?.uploader || DEFAULT_UPLOADER,
    comments: existingVideo?.comments || [],
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

  const existingByFile = new Map((existingStore.default || []).map(video => [video.fileName, video]));
  const videos = await Promise.all(entries.map(entry => buildVideoRecord(entry, existingByFile.get(entry.name))));
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

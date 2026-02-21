import { mkdir, readFile, writeFile } from 'fs/promises';
import { existsSync } from 'fs';
import { dirname, join, normalize } from 'path';
import { put, del } from '@vercel/blob';

const MEDIA_ROOT = 'uploads';

const contentTypeMap: Record<string, string> = {
  mp4: 'video/mp4',
  webm: 'video/webm',
  mov: 'video/quicktime',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  gif: 'image/gif',
  webp: 'image/webp',
};

const hasBlobContext = Boolean(process.env.VERCEL);
const wantsBlobStorage = process.env.USE_BLOB_STORAGE === 'true';
const allowBlobStorage = wantsBlobStorage && hasBlobContext;
export const staticMediaMode = !allowBlobStorage;
const isBlobEnv = allowBlobStorage;

const uploadsRoot = join(process.cwd(), 'public', MEDIA_ROOT);

const readLocalAsset = async (key: string) => {
  const pathsToCheck = [
    join(process.cwd(), 'public', key),
    join(process.cwd(), key),
  ];

  for (const absolutePath of pathsToCheck) {
    const normalized = normalize(absolutePath);
    // Allow reading from public/uploads or uploads
    if (!normalized.startsWith(join(process.cwd(), 'public', MEDIA_ROOT)) && !normalized.startsWith(join(process.cwd(), MEDIA_ROOT))) {
      continue;
    }

    try {
      const data = await readFile(normalized);
      return {
        data,
        contentType: guessContentType(key),
      };
    } catch (error) {
      // Continue to next path
    }
  }

  return null;
};

type BinaryData = ArrayBuffer | SharedArrayBuffer | Buffer | Uint8Array;

const hasSharedArrayBuffer = typeof SharedArrayBuffer !== 'undefined';
const isSharedBuffer = (value: unknown): value is SharedArrayBuffer =>
  hasSharedArrayBuffer && value instanceof SharedArrayBuffer;

const toBuffer = (data: BinaryData): Buffer => {
  if (Buffer.isBuffer(data)) return data;
  if (data instanceof ArrayBuffer) return Buffer.from(data);
  if (isSharedBuffer(data)) return Buffer.from(new Uint8Array(data));
  if (data instanceof Uint8Array) return Buffer.from(data);
  throw new Error('Unsupported data type');
};

const toArrayBuffer = (data: BinaryData): ArrayBuffer => {
  if (data instanceof ArrayBuffer) return data;
  if (isSharedBuffer(data)) {
    const copy = Buffer.from(new Uint8Array(data));
    return copy.buffer.slice(copy.byteOffset, copy.byteOffset + copy.byteLength) as ArrayBuffer;
  }
  const buffer = toBuffer(data);
  return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer;
};

const ensureLocalDir = async (targetPath: string) => {
  const dir = dirname(targetPath);
  if (!existsSync(dir)) {
    await mkdir(dir, { recursive: true });
  }
};

export const mediaKey = (...segments: string[]) => {
  const cleanSegments = segments.map(segment => segment.replace(/^\/+|\/+$|\.\.+/g, ''));
  return [MEDIA_ROOT, ...cleanSegments].join('/');
};

export const mediaUrlFromKey = (key: string) => `/api/media/${key}`;

export const guessContentType = (key: string) => {
  const extMatch = key.split('.').pop()?.toLowerCase();
  return (extMatch && contentTypeMap[extMatch]) || 'application/octet-stream';
};

export const isBlobStorageEnabled = () => isBlobEnv;

export const saveMediaAsset = async (
  key: string,
  data: ArrayBuffer | Buffer | Uint8Array,
  contentType?: string
) => {
  if (isBlobEnv) {
    const result = await put(key, toBuffer(data), { access: 'public' });
    return {
      key: result.url,
      url: result.url,
    };
  } else {
    const targetPath = join(process.cwd(), 'public', key);
    await ensureLocalDir(targetPath);
    await writeFile(targetPath, toBuffer(data));

    return {
      key,
      url: mediaUrlFromKey(key),
    };
  }
};

export const readMediaAsset = async (key: string, forceStatic: boolean = false) => {
  if (key.startsWith('https://')) {
    const response = await fetch(key);
    if (!response.ok) return null;
    const data = await response.arrayBuffer();
    return {
      data: Buffer.from(data),
      contentType: guessContentType(key),
    };
  }

  return readLocalAsset(key);
};

export const deleteMediaAsset = async (key: string) => {
  if (key.startsWith('https://')) {
    await del(key);
    return;
  }

  const absolutePath = join(process.cwd(), 'public', key);
  const normalized = normalize(absolutePath);
  if (!normalized.startsWith(uploadsRoot)) {
    return;
  }

  try {
    const { unlink } = await import('fs/promises');
    await unlink(normalized);
  } catch (error) {
    // Ignore missing files
  }
};

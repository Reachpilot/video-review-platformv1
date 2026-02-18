import { mkdir, readFile, writeFile } from 'fs/promises';
import { existsSync } from 'fs';
import { dirname, join, normalize } from 'path';
import {
  getStore,
  setEnvironmentContext,
  type EnvironmentContext,
  type GetStoreOptions,
} from '@netlify/blobs';

declare global {
  // eslint-disable-next-line no-var
  var netlifyBlobsContext: unknown | undefined;
}

export const BLOB_STORE_NAME = process.env.NETLIFY_BLOBS_STORE || 'video-uploads';
const MEDIA_ROOT = 'uploads';

type ManualBlobOptions = Omit<GetStoreOptions, 'name'>;

const decodeContextFromEnv = (): EnvironmentContext | null => {
  const encoded = process.env.NETLIFY_BLOBS_CONTEXT;
  if (!encoded) return null;
  try {
    const json = Buffer.from(encoded, 'base64').toString('utf8');
    return JSON.parse(json) as EnvironmentContext;
  } catch (error) {
    console.warn('Failed to parse NETLIFY_BLOBS_CONTEXT', error);
    return null;
  }
};

const resolveEnvironmentContext = (): EnvironmentContext | null => {
  if (globalThis.netlifyBlobsContext && typeof globalThis.netlifyBlobsContext === 'object') {
    return globalThis.netlifyBlobsContext as EnvironmentContext;
  }
  return decodeContextFromEnv();
};

const netlifyContext = resolveEnvironmentContext();
if (netlifyContext) {
  setEnvironmentContext(netlifyContext);
}

const manualBlobOptions: ManualBlobOptions | undefined =
  process.env.NETLIFY_BLOBS_SITE_ID && process.env.NETLIFY_BLOBS_TOKEN
    ? {
        siteID: process.env.NETLIFY_BLOBS_SITE_ID,
        token: process.env.NETLIFY_BLOBS_TOKEN,
        edgeURL: process.env.NETLIFY_BLOBS_EDGE_URL,
        apiURL: process.env.NETLIFY_BLOBS_API_URL,
      }
    : undefined;

const hasBlobContext = Boolean(netlifyContext || manualBlobOptions);
const blobPreference = process.env.USE_BLOB_STORAGE;
const wantsBlobStorage =
  blobPreference === 'true'
    ? true
    : blobPreference === 'false'
    ? false
    : hasBlobContext;
const allowBlobStorage = wantsBlobStorage && hasBlobContext;
export const staticMediaMode = !allowBlobStorage;
const requiresBlobStorage = blobPreference === 'true';
const isBlobEnv = allowBlobStorage;

const ensureBlobConfigured = () => {
  if (requiresBlobStorage && !isBlobEnv) {
    throw new Error(
      'Netlify Blobs storage is not configured. Please set NETLIFY_BLOBS_SITE_ID/NETLIFY_BLOBS_TOKEN or provide NETLIFY_BLOBS_CONTEXT.'
    );
  }
};

const getMediaStore = () => {
  if (manualBlobOptions) {
    return getStore({ name: BLOB_STORE_NAME, ...manualBlobOptions });
  }
  return getStore(BLOB_STORE_NAME);
};

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

const uploadsRoot = join(process.cwd(), 'public', MEDIA_ROOT);

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

export const mediaUrlFromKey = (key: string) => (staticMediaMode ? `/${key}` : `/api/media/${key}`);

export const guessContentType = (key: string) => {
  const extMatch = key.split('.').pop()?.toLowerCase();
  return (extMatch && contentTypeMap[extMatch]) || 'application/octet-stream';
};

export const isBlobStorageEnabled = () => isBlobEnv;

export const generateSignedBlobUploadUrl = async (_key: string) => {
  if (staticMediaMode) {
    throw new Error('Direct blob uploads are disabled when using static media.');
  }
  throw new Error('Direct blob uploads are temporarily disabled.');
};

export const saveMediaAsset = async (
  key: string,
  data: ArrayBuffer | Buffer | Uint8Array,
  contentType?: string
) => {
  if (!isBlobEnv) {
    const targetPath = join(process.cwd(), 'public', key);
    await ensureLocalDir(targetPath);
    await writeFile(targetPath, toBuffer(data));

    return {
      key,
      url: mediaUrlFromKey(key),
    };
  }

  ensureBlobConfigured();
  const store = getMediaStore();
  await store.set(key, toArrayBuffer(data), {
    metadata: {
      contentType: contentType || guessContentType(key),
    },
  });

  return {
    key,
    url: mediaUrlFromKey(key),
  };
};

export const readMediaAsset = async (key: string) => {
  const sanitized = key.replace(/\\/g, '/');
  if (!sanitized.startsWith(`${MEDIA_ROOT}/`)) {
    return null;
  }

  if (isBlobEnv) {
    ensureBlobConfigured();
    const store = getMediaStore();
    const entry = await store.getWithMetadata(sanitized, { type: 'arrayBuffer' });
    if (!entry?.data) {
      return null;
    }

    return {
      data: Buffer.from(entry.data),
      contentType: entry.metadata?.contentType || guessContentType(sanitized),
    };
  }

  const absolutePath = join(process.cwd(), 'public', sanitized);
  const normalized = normalize(absolutePath);
  if (!normalized.startsWith(uploadsRoot)) {
    return null;
  }

  try {
    const data = await readFile(normalized);
    return {
      data,
      contentType: guessContentType(sanitized),
    };
  } catch (error) {
    return null;
  }
};

export const deleteMediaAsset = async (key: string) => {
  if (!key.startsWith(`${MEDIA_ROOT}/`)) return;

  ensureBlobConfigured();
  if (isBlobEnv) {
    const store = getMediaStore();
    await store.delete(key);
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

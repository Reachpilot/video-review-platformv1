import { mkdir, readFile, writeFile } from 'fs/promises';
import { existsSync } from 'fs';
import { dirname, join, normalize } from 'path';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

let supabase: any = null;
if (supabaseUrl && supabaseKey) {
  supabase = createClient(supabaseUrl, supabaseKey);
} else {
  console.warn('Supabase credentials not found, falling back to local storage');
}

export const BLOB_STORE_NAME = 'videos'; // Supabase bucket name
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
  json: 'application/json',
};

const uploadsRoot = join(process.cwd(), 'public', MEDIA_ROOT);

const readLocalAsset = async (key: string) => {
  const absolutePath = join(process.cwd(), 'public', key);
  const normalized = normalize(absolutePath);
  if (!normalized.startsWith(uploadsRoot)) {
    return null;
  }

  try {
    const data = await readFile(normalized);
    return {
      data,
      contentType: guessContentType(key),
    };
  } catch (error) {
    return null;
  }
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

export const mediaUrlFromKey = (key: string) => {
  if (supabase) {
    // For Supabase, use the public URL
    const filePath = key.replace(`${MEDIA_ROOT}/`, '');
    const { data } = supabase.storage.from(BLOB_STORE_NAME).getPublicUrl(filePath);
    return data.publicUrl;
  } else {
    // Fallback to local static files
    return `/${key}`;
  }
};

export const guessContentType = (key: string) => {
  const extMatch = key.split('.').pop()?.toLowerCase();
  return (extMatch && contentTypeMap[extMatch]) || 'application/octet-stream';
};

export const isBlobStorageEnabled = () => true; // Always use Supabase

export const generateSignedBlobUploadUrl = async (key: string) => {
  const filePath = key.replace(`${MEDIA_ROOT}/`, '');
  const { data, error } = await supabase.storage
    .from(BLOB_STORE_NAME)
    .createSignedUploadUrl(filePath);

  if (error) {
    throw new Error(`Failed to generate upload URL: ${error.message}`);
  }

  return data.signedUrl;
};

export const saveMediaAsset = async (
  key: string,
  data: ArrayBuffer | Buffer | Uint8Array,
  contentType?: string
) => {
  const buffer = toBuffer(data);

  if (supabase) {
    const filePath = key.replace(`${MEDIA_ROOT}/`, '');

    const { error } = await supabase.storage
      .from(BLOB_STORE_NAME)
      .upload(filePath, buffer, {
        contentType: contentType || guessContentType(key),
        upsert: true,
      });

    if (error) {
      throw new Error(`Failed to upload to Supabase: ${error.message}`);
    }
  } else {
    // Fallback to local storage
    const targetPath = join(process.cwd(), 'public', key);
    await ensureLocalDir(targetPath);
    await writeFile(targetPath, buffer);
  }

  // Also write locally for development/fallback
  try {
    const targetPath = join(process.cwd(), 'public', key);
    await ensureLocalDir(targetPath);
    await writeFile(targetPath, buffer);
  } catch (error) {
    // Ignore local write errors in production
  }

  return {
    key,
    url: mediaUrlFromKey(key),
  };
};

export const readMediaAsset = async (key: string, forceStatic: boolean = false) => {
  const sanitized = key.replace(/\\/g, '/');
  if (!sanitized.startsWith(`${MEDIA_ROOT}/`)) {
    return null;
  }

  if (forceStatic) {
    return readLocalAsset(sanitized);
  }

  if (supabase) {
    const filePath = sanitized.replace(`${MEDIA_ROOT}/`, '');

    try {
      const { data, error } = await supabase.storage
        .from(BLOB_STORE_NAME)
        .download(filePath);

      if (error || !data) {
        return readLocalAsset(sanitized);
      }

      const arrayBuffer = await data.arrayBuffer();
      return {
        data: Buffer.from(arrayBuffer),
        contentType: guessContentType(sanitized),
      };
    } catch (error) {
      return readLocalAsset(sanitized);
    }
  } else {
    return readLocalAsset(sanitized);
  }
};

export const deleteMediaAsset = async (key: string) => {
  if (!key.startsWith(`${MEDIA_ROOT}/`)) return;

  if (supabase) {
    const filePath = key.replace(`${MEDIA_ROOT}/`, '');

    const { error } = await supabase.storage
      .from(BLOB_STORE_NAME)
      .remove([filePath]);

    if (error) {
      console.warn(`Failed to delete from Supabase: ${error.message}`);
    }
  }

  // Also delete locally
  const absolutePath = join(process.cwd(), 'public', key);
  const normalized = normalize(absolutePath);
  if (normalized.startsWith(uploadsRoot)) {
    try {
      const { unlink } = await import('fs/promises');
      await unlink(normalized);
    } catch (error) {
      // Ignore missing files
    }
  }
};

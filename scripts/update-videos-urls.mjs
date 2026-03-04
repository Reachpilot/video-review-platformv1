#!/usr/bin/env node
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';
import { readFileSync, existsSync } from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const DATA_DIR = path.join(ROOT, 'public', 'uploads', 'data');
const DATA_FILE = path.join(DATA_DIR, 'videos.json');

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

const slugify = value =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');

async function main() {
  if (!supabaseClient) {
    console.error('Supabase client not configured');
    process.exit(1);
  }

  const raw = await fs.readFile(DATA_FILE, 'utf8');
  const store = JSON.parse(raw);

  for (const video of store.default) {
    const videoSlug = slugify(video.fileName);
    const relativeVideoKey = path.posix.join('uploads', 'videos', videoSlug);
    video.filePath = supabaseClient.storage.from(BLOB_STORE_NAME).getPublicUrl(relativeVideoKey).data.publicUrl;

    const thumbSlug = slugify(video.fileName.replace(path.extname(video.fileName), ''));
    const thumbFilename = `${thumbSlug}.jpg`;
    const relativeThumbnailKey = path.posix.join('uploads', 'videos', 'thumbnails', thumbFilename);
    video.thumbnailUrl = supabaseClient.storage.from(BLOB_STORE_NAME).getPublicUrl(relativeThumbnailKey).data.publicUrl;
  }

  await fs.writeFile(DATA_FILE, JSON.stringify(store, null, 2));
  console.log('Updated videos.json with Supabase URLs');
}

main().catch(error => {
  console.error('Failed to update URLs.', error);
  process.exitCode = 1;
});

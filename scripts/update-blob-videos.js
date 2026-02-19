#!/usr/bin/env node

import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { getStore } from '@netlify/blobs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ROOT = path.join(__dirname, '..');

async function main() {
  const jsonPath = path.join(ROOT, 'public', 'uploads', 'data', 'videos.json');
  const jsonContent = readFileSync(jsonPath, 'utf8');
  const store = getStore({
    name: 'uploads',
    siteID: process.env.NETLIFY_BLOBS_SITE_ID,
    token: process.env.NETLIFY_BLOBS_TOKEN,
  });
  await store.setJSON('data/videos.json', JSON.parse(jsonContent));
  console.log('Updated blob with current videos.json');
}

main().catch(console.error);

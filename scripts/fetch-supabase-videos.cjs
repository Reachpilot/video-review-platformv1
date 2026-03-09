const { createClient } = require('@supabase/supabase-js');
const fs = require('fs').promises;
const { existsSync, readFileSync } = require('fs');
const path = require('path');

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

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
const BLOB_STORE_NAME = 'videos';
const DATA_FILE = path.join(__dirname, '..', 'public', 'uploads', 'data', 'videos.json');

async function main() {
  const { data, error } = await supabase.storage.from(BLOB_STORE_NAME).list('uploads/videos', {
    limit: 1000,
    sortBy: { column: 'name', order: 'asc' }
  });
  if (error) throw error;

  console.log('Files in uploads/videos:', data.length);

  const videos = data.filter(item => item.name.endsWith('-mp4')).map(item => {
    const filename = item.name.replace('-mp4', '.mp4');
    const slug = filename.replace('.mp4', '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    const title = slug.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
    return {
      id: `vid-${slug}`,
      title,
      description: '',
      fileName: filename,
      filePath: supabase.storage.from(BLOB_STORE_NAME).getPublicUrl(`uploads/videos/${item.name}`).data.publicUrl,
      thumbnailUrl: supabase.storage.from(BLOB_STORE_NAME).getPublicUrl(`uploads/videos/thumbnails/${slug}.jpg`).data.publicUrl,
      status: 'pending',
      uploadedAt: item.created_at,
      duration: '00:00',
      size: `${(item.metadata?.size / (1024 * 1024)).toFixed(2)} MB` || '0 MB',
      uploader: 'Manual Import',
      comments: []
    };
  });

  const store = { default: videos, mpu: [] };
  await fs.writeFile(DATA_FILE, JSON.stringify(store, null, 2));
  const jsonBuffer = Buffer.from(JSON.stringify(store, null, 2));
  await supabase.storage.from(BLOB_STORE_NAME).upload('uploads/data/videos.json', jsonBuffer, {
    contentType: 'application/json',
    upsert: true
  });
  console.log(`Fetched ${videos.length} videos from Supabase and uploaded to storage`);
}

main().catch(console.error);

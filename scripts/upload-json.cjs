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
  const jsonContent = await fs.readFile(DATA_FILE, 'utf8');
  const jsonBuffer = Buffer.from(jsonContent);
  const { error } = await supabase.storage.from(BLOB_STORE_NAME).upload('uploads/data/videos.json', jsonBuffer, {
    contentType: 'application/json',
    upsert: true
  });
  if (error) throw error;
  console.log('Uploaded videos.json to Supabase');
}

main().catch(console.error);

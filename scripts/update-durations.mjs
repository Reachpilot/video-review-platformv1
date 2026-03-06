import fs from 'fs/promises';
import { execSync } from 'child_process';

const DATA_FILE = 'public/uploads/data/videos.json';

async function updateDurations() {
  const store = JSON.parse(await fs.readFile(DATA_FILE, 'utf8'));
  
  for (const video of store.default) {
    try {
      const output = execSync(`ffprobe -v quiet -print_format json -show_format "${video.filePath}"`, { encoding: 'utf8' });
      const data = JSON.parse(output);
      const durationSec = parseFloat(data.format.duration);
      const minutes = Math.floor(durationSec / 60);
      const seconds = Math.floor(durationSec % 60);
      video.duration = `${minutes.toString().padStart(2,'0')}:${seconds.toString().padStart(2,'0')}`;
      console.log(`Updated ${video.title}: ${video.duration}`);
    } catch (error) {
      console.log(`Failed to get duration for ${video.title}: ${error.message}`);
    }
  }
  
  await fs.writeFile(DATA_FILE, JSON.stringify(store, null, 2));
  console.log('Updated all durations');
}

updateDurations();

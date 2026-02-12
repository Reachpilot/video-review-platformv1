const { rm } = require('fs/promises');
const { join } = require('path');

const TARGETS = [
  join(__dirname, '..', 'public', 'uploads'),
  join(__dirname, '..', 'uploads'),
];

const shouldPurge = process.env.PURGE_UPLOADS === 'true';

async function deleteFolder(target) {
  try {
    await rm(target, { recursive: true, force: true });
    console.log(`Removed ${target} before build`);
  } catch (error) {
    console.warn(`Unable to remove ${target}`, error);
  }
}

async function main() {
  if (!shouldPurge) {
    console.log('Skipping uploads cleanup (set PURGE_UPLOADS=true to enable).');
    return;
  }
  await Promise.all(TARGETS.map(deleteFolder));
}

main();

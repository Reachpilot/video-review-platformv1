const { writeFile, mkdir, readdir } = require('fs/promises');
const { join, dirname } = require('path');

const STUB_CONTENT = JSON.stringify({ version: 3, sources: [], names: [], mappings: '' });
const TARGET_DIRECTORIES = [
  join(
    __dirname,
    '..',
    'node_modules',
    'next',
    'dist',
    'client',
    'components',
    'react-dev-overlay',
    'internal',
    'helpers'
  ),
  join(
    __dirname,
    '..',
    'node_modules',
    'next',
    'dist',
    'client',
    'components'
  )
];

async function ensureSourceMap(targetPath) {
  try {
    await mkdir(dirname(targetPath), { recursive: true });
    await writeFile(targetPath, STUB_CONTENT, { flag: 'wx' });
    console.log(`Created missing ${targetPath} for Netlify build`);
  } catch (error) {
    if (error.code === 'EEXIST') {
      return;
    }
    console.warn(`Unable to prepare ${targetPath}`, error);
  }
}

async function scanDirectoryForJs(targetDir) {
  try {
    const entries = await readdir(targetDir, { withFileTypes: true });
    for (const entry of entries) {
      const entryPath = join(targetDir, entry.name);
      if (entry.isDirectory()) {
        await scanDirectoryForJs(entryPath);
      } else if (entry.isFile() && entry.name.endsWith('.js')) {
        await ensureSourceMap(entryPath.replace(/\.js$/, '.js.map'));
      }
    }
  } catch (error) {
    console.warn(`Unable to scan ${targetDir} for source maps`, error);
  }
}

async function main() {
  await Promise.all(TARGET_DIRECTORIES.map((dir) => scanDirectoryForJs(dir)));
}

main();

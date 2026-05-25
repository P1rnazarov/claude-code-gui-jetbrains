import { readdir } from 'fs/promises';
import { basename, extname, join } from 'path';
import { homedir } from 'os';

export interface SystemSound {
  id: string;
  label: string;
  path: string;
}

interface Platform {
  directories: string[];
  extensions: string[];
  /**
   * When true, only the first directory that yields at least one matching file
   * is used. When false, all directories are scanned and merged.
   */
  firstNonEmpty: boolean;
}

let cache: SystemSound[] | null = null;

function getPlatformConfig(): Platform | null {
  switch (process.platform) {
    case 'darwin':
      return {
        directories: [
          '/System/Library/Sounds',
          '/Library/Sounds',
          join(homedir(), 'Library', 'Sounds'),
        ],
        extensions: ['.aiff'],
        firstNonEmpty: false,
      };
    case 'win32':
      return {
        directories: ['C:\\Windows\\Media'],
        extensions: ['.wav'],
        firstNonEmpty: false,
      };
    case 'linux':
      return {
        directories: [
          '/usr/share/sounds/freedesktop/stereo',
          '/usr/share/sounds/alsa',
          '/usr/share/sounds/sounds-events',
        ],
        extensions: ['.oga', '.ogg', '.wav'],
        firstNonEmpty: true,
      };
    default:
      return null;
  }
}

async function readDirSafe(dir: string): Promise<string[]> {
  try {
    return await readdir(dir);
  } catch {
    return [];
  }
}

function buildSounds(
  files: string[],
  dir: string,
  extensions: string[],
  seenIds: Set<string>,
): SystemSound[] {
  const sounds: SystemSound[] = [];
  for (const file of files) {
    const ext = extname(file).toLowerCase();
    if (!extensions.includes(ext)) {
      continue;
    }
    const id = basename(file, extname(file));
    if (seenIds.has(id)) {
      continue;
    }
    seenIds.add(id);
    sounds.push({
      id,
      label: id,
      path: join(dir, file),
    });
  }
  return sounds;
}

export async function scanSystemSounds(): Promise<SystemSound[]> {
  if (cache) {
    return cache;
  }

  const config = getPlatformConfig();
  if (!config) {
    cache = [];
    return cache;
  }

  const seenIds = new Set<string>();
  const results: SystemSound[] = [];

  for (const dir of config.directories) {
    const files = await readDirSafe(dir);
    if (files.length === 0) {
      continue;
    }
    const sounds = buildSounds(files, dir, config.extensions, seenIds);
    if (sounds.length === 0) {
      continue;
    }
    results.push(...sounds);
    if (config.firstNonEmpty) {
      break;
    }
  }

  results.sort((a, b) => a.id.localeCompare(b.id));
  cache = results;
  return cache;
}

export function clearScanCache(): void {
  cache = null;
}

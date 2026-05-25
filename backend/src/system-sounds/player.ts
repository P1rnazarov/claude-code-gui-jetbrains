import { spawn, type ChildProcess } from 'child_process';
import { scanSystemSounds, type SystemSound } from './scanner';

const POWERSHELL_UNSAFE_CHARS = /["'`$]/;

/**
 * Spawn a process fire-and-forget. Resolves once the spawn attempt has had a
 * chance to surface synchronous/immediate errors (ENOENT, etc). The caller
 * does not wait for the child to exit.
 */
function spawnNoShell(command: string, args: string[]): Promise<ChildProcess> {
  return new Promise((resolve, reject) => {
    let settled = false;
    let child: ChildProcess;
    try {
      child = spawn(command, args);
    } catch (err) {
      reject(err);
      return;
    }
    child.once('error', (err) => {
      if (settled) {
        return;
      }
      settled = true;
      reject(err);
    });
    // Wait one macrotask so that an immediate 'error' event (e.g. ENOENT) wins
    // over the resolve. Node emits spawn errors asynchronously via process.nextTick.
    setImmediate(() => {
      if (settled) {
        return;
      }
      settled = true;
      resolve(child);
    });
  });
}

async function playOnDarwin(sound: SystemSound): Promise<void> {
  await spawnNoShell('afplay', [sound.path]);
}

async function playOnWindows(sound: SystemSound): Promise<void> {
  if (POWERSHELL_UNSAFE_CHARS.test(sound.path)) {
    throw new Error(`Unsafe character in sound path: ${sound.path}`);
  }
  const script = `(New-Object Media.SoundPlayer "${sound.path}").PlaySync()`;
  await spawnNoShell('powershell', ['-NoProfile', '-Command', script]);
}

async function playOnLinux(sound: SystemSound): Promise<void> {
  try {
    await spawnNoShell('paplay', [sound.path]);
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === 'ENOENT') {
      await spawnNoShell('aplay', [sound.path]);
      return;
    }
    throw err;
  }
}

export async function playSystemSound(soundId: string): Promise<void> {
  const sounds = await scanSystemSounds();
  const sound = sounds.find((s) => s.id === soundId);
  if (!sound) {
    throw new Error(`Unknown sound id: ${soundId}`);
  }

  switch (process.platform) {
    case 'darwin':
      await playOnDarwin(sound);
      return;
    case 'win32':
      await playOnWindows(sound);
      return;
    case 'linux':
      await playOnLinux(sound);
      return;
    default:
      throw new Error(`Unsupported platform: ${process.platform}`);
  }
}

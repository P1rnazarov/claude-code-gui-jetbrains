import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EventEmitter } from 'events';

vi.mock('child_process', () => ({
  spawn: vi.fn(),
}));

vi.mock('../scanner', () => ({
  scanSystemSounds: vi.fn(),
}));

import { spawn } from 'child_process';
import { scanSystemSounds } from '../scanner';
import { playSystemSound } from '../player';

const mockSpawn = vi.mocked(spawn);
const mockScan = vi.mocked(scanSystemSounds);

const originalPlatform = process.platform;

function setPlatform(platform: NodeJS.Platform) {
  Object.defineProperty(process, 'platform', { value: platform, configurable: true });
}

function restorePlatform() {
  Object.defineProperty(process, 'platform', { value: originalPlatform, configurable: true });
}

function makeChild(): EventEmitter {
  // Minimal stub that satisfies the .once('error', ...) contract.
  return new EventEmitter();
}

function spawnReturning(child: EventEmitter) {
  mockSpawn.mockReturnValue(child as never);
}

function spawnSequence(children: EventEmitter[]) {
  let i = 0;
  mockSpawn.mockImplementation(() => {
    const c = children[i++];
    if (!c) throw new Error('no more spawn children configured');
    return c as never;
  });
}

describe('playSystemSound', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockScan.mockResolvedValue([
      { id: 'Glass', label: 'Glass', path: '/System/Library/Sounds/Glass.aiff' },
      { id: 'chimes', label: 'chimes', path: 'C:\\Windows\\Media\\chimes.wav' },
      { id: 'bell', label: 'bell', path: '/usr/share/sounds/freedesktop/stereo/bell.oga' },
      { id: 'evil', label: 'evil', path: 'C:\\Windows\\Media\\evil";rm -rf.wav' },
    ]);
  });

  afterEach(() => {
    restorePlatform();
  });

  it('throws when soundId is not in the whitelist', async () => {
    setPlatform('darwin');

    await expect(playSystemSound('Nonexistent')).rejects.toThrow(/Unknown sound id: Nonexistent/);
    expect(mockSpawn).not.toHaveBeenCalled();
  });

  describe('darwin', () => {
    beforeEach(() => setPlatform('darwin'));

    it('spawns afplay with the resolved path and no shell option', async () => {
      spawnReturning(makeChild());

      await playSystemSound('Glass');

      expect(mockSpawn).toHaveBeenCalledTimes(1);
      const [cmd, args, ...rest] = mockSpawn.mock.calls[0]!;
      expect(cmd).toBe('afplay');
      expect(args).toEqual(['/System/Library/Sounds/Glass.aiff']);
      // No options object passed at all — confirms shell:true is NOT used.
      expect(rest).toEqual([]);
    });

    it('rejects when spawn emits ENOENT', async () => {
      const child = makeChild();
      spawnReturning(child);
      const promise = playSystemSound('Glass');

      // Wait for scanSystemSounds() and the synchronous spawn setup to settle
      // so that the 'error' listener is registered before we emit.
      await Promise.resolve();
      await Promise.resolve();

      const enoent = Object.assign(new Error('spawn afplay ENOENT'), { code: 'ENOENT' });
      child.emit('error', enoent);

      await expect(promise).rejects.toThrow(/ENOENT/);
    });
  });

  describe('win32', () => {
    beforeEach(() => setPlatform('win32'));

    it('spawns powershell with PlaySync script and no shell option', async () => {
      spawnReturning(makeChild());

      await playSystemSound('chimes');

      expect(mockSpawn).toHaveBeenCalledTimes(1);
      const [cmd, args, ...rest] = mockSpawn.mock.calls[0]!;
      expect(cmd).toBe('powershell');
      expect(args).toEqual([
        '-NoProfile',
        '-Command',
        '(New-Object Media.SoundPlayer "C:\\Windows\\Media\\chimes.wav").PlaySync()',
      ]);
      expect(rest).toEqual([]);
    });

    it('throws when path contains unsafe shell characters', async () => {
      await expect(playSystemSound('evil')).rejects.toThrow(/Unsafe character in sound path/);
      expect(mockSpawn).not.toHaveBeenCalled();
    });
  });

  describe('linux', () => {
    beforeEach(() => setPlatform('linux'));

    it('spawns paplay on success', async () => {
      spawnReturning(makeChild());

      await playSystemSound('bell');

      expect(mockSpawn).toHaveBeenCalledTimes(1);
      const [cmd, args, ...rest] = mockSpawn.mock.calls[0]!;
      expect(cmd).toBe('paplay');
      expect(args).toEqual(['/usr/share/sounds/freedesktop/stereo/bell.oga']);
      expect(rest).toEqual([]);
    });

    it('falls back to aplay when paplay spawn ENOENTs', async () => {
      const first = makeChild();
      const second = makeChild();
      spawnSequence([first, second]);

      const promise = playSystemSound('bell');
      await Promise.resolve();
      await Promise.resolve();
      first.emit('error', Object.assign(new Error('spawn paplay ENOENT'), { code: 'ENOENT' }));

      await promise;

      expect(mockSpawn).toHaveBeenCalledTimes(2);
      expect(mockSpawn.mock.calls[0]![0]).toBe('paplay');
      expect(mockSpawn.mock.calls[1]![0]).toBe('aplay');
      expect(mockSpawn.mock.calls[1]![1]).toEqual(['/usr/share/sounds/freedesktop/stereo/bell.oga']);
    });

    it('does not fall back when paplay fails with a non-ENOENT error', async () => {
      const child = makeChild();
      spawnReturning(child);

      const promise = playSystemSound('bell');
      await Promise.resolve();
      await Promise.resolve();
      child.emit('error', Object.assign(new Error('boom'), { code: 'EACCES' }));

      await expect(promise).rejects.toThrow(/boom/);
      expect(mockSpawn).toHaveBeenCalledTimes(1);
    });
  });
});

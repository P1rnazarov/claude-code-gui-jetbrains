import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as fsPromises from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import { readNewBytes, SessionJsonlWatcher } from '../session-jsonl-watcher';

describe('readNewBytes', () => {
  let tempFilePath: string;

  beforeEach(() => {
    tempFilePath = join(tmpdir(), `test-watch-${Date.now()}-${Math.random()}.jsonl`);
  });

  afterEach(async () => {
    try {
      await fsPromises.unlink(tempFilePath);
    } catch {
      // ignore
    }
  });

  it('reads new bytes from startOffset', async () => {
    await fsPromises.writeFile(tempFilePath, 'hello world');
    const res = await readNewBytes(tempFilePath, 6);
    expect(res.bytesRead).toBe(5);
    expect(res.data).toBe('world');
  });

  it('handles truncation/file-shrink by resetting startOffset to 0', async () => {
    await fsPromises.writeFile(tempFilePath, 'hello world long text');
    // Shrink file
    await fsPromises.writeFile(tempFilePath, 'short');
    const res = await readNewBytes(tempFilePath, 10);
    expect(res.bytesRead).toBe(5);
    expect(res.data).toBe('short');
  });
});

describe('SessionJsonlWatcher', () => {
  let tempFilePath: string;
  let watcher: SessionJsonlWatcher;
  let appendSpy: any;

  beforeEach(async () => {
    tempFilePath = join(tmpdir(), `test-watcher-class-${Date.now()}.jsonl`);
    await fsPromises.writeFile(tempFilePath, '{"uuid":"1","type":"user","message":"hello"}\n');
    appendSpy = vi.fn();
    watcher = new SessionJsonlWatcher(appendSpy);
  });

  afterEach(async () => {
    watcher.stopAll();
    try {
      await fsPromises.unlink(tempFilePath);
    } catch {
      // ignore
    }
  });

  it('sets byteOffset to current file size on watch startup and reads new appends', async () => {
    await watcher.watch('conn1', 'sess1', tempFilePath);
    
    // Append a new line
    await fsPromises.appendFile(tempFilePath, '{"uuid":"2","type":"assistant","message":"hi"}\n');
    
    // Trigger tailRead manually for synchronous test testing
    await watcher.tailRead('sess1');

    expect(appendSpy).toHaveBeenCalledTimes(1);
    expect(appendSpy).toHaveBeenCalledWith('conn1', 'sess1', [
      { uuid: '2', type: 'assistant', message: 'hi' },
    ]);
  });

  it('handles multiple connections watching same session (refcounting)', async () => {
    const appendSpy2 = vi.fn();
    const watcherMult = new SessionJsonlWatcher((conn, sess, msgs) => {
      if (conn === 'conn1') appendSpy(conn, sess, msgs);
      else appendSpy2(conn, sess, msgs);
    });

    await watcherMult.watch('conn1', 'sess1', tempFilePath);
    await watcherMult.watch('conn2', 'sess1', tempFilePath);

    await fsPromises.appendFile(tempFilePath, '{"uuid":"2","type":"assistant"}\n');
    await watcherMult.tailRead('sess1');

    expect(appendSpy).toHaveBeenCalledTimes(1);
    expect(appendSpy2).toHaveBeenCalledTimes(1);

    // Unwatch connection 1
    watcherMult.unwatch('conn1', 'sess1');
    await fsPromises.appendFile(tempFilePath, '{"uuid":"3","type":"user"}\n');
    await watcherMult.tailRead('sess1');

    expect(appendSpy).toHaveBeenCalledTimes(1); // still 1
    expect(appendSpy2).toHaveBeenCalledTimes(2); // increased to 2
  });

  it('promoteToOwned immediately stops watching and deletes entry', async () => {
    await watcher.watch('conn1', 'sess1', tempFilePath);
    watcher.promoteToOwned('sess1');

    await fsPromises.appendFile(tempFilePath, '{"uuid":"2","type":"assistant"}\n');
    await watcher.tailRead('sess1'); // should do nothing since entry is deleted

    expect(appendSpy).not.toHaveBeenCalled();
  });
});

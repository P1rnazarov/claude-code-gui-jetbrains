import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mkdtemp, mkdir, writeFile, rm } from 'fs/promises';
import { join } from 'path';
import { realpathSync } from 'fs';
import * as os from 'os';

describe('findBackgroundTaskOutputPath', () => {
  let tmpDir: string;

  beforeEach(async () => {
    // Use realpathSync to resolve symlinks (macOS /var -> /private/var)
    tmpDir = realpathSync(await mkdtemp(join(os.tmpdir(), 'fbto-test-')));
    vi.resetModules();
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  async function createOutputFile(
    runtimeUuid: string,
    taskId: string,
    projectKey: string,
  ): Promise<string> {
    const claudeDir = `claude-${process.getuid?.() ?? 0}`;
    const tasksDir = join(tmpDir, claudeDir, projectKey, runtimeUuid, 'tasks');
    await mkdir(tasksDir, { recursive: true });
    const filePath = join(tasksDir, `${taskId}.output`);
    await writeFile(filePath, 'output content');
    return filePath;
  }

  it('returns null when taskId is empty', async () => {
    vi.stubEnv('CLAUDE_CODE_TMPDIR', tmpDir);
    const { findBackgroundTaskOutputPath } = await import('../findBackgroundTaskOutputPath');
    const result = await findBackgroundTaskOutputPath({ taskId: '', workingDir: '/foo/bar' });
    expect(result).toEqual({ path: null });
  });

  it('returns null when workingDir is empty', async () => {
    vi.stubEnv('CLAUDE_CODE_TMPDIR', tmpDir);
    const { findBackgroundTaskOutputPath } = await import('../findBackgroundTaskOutputPath');
    const result = await findBackgroundTaskOutputPath({ taskId: 'task-123', workingDir: '' });
    expect(result).toEqual({ path: null });
  });

  it('returns null for taskId with path traversal characters (..)', async () => {
    vi.stubEnv('CLAUDE_CODE_TMPDIR', tmpDir);
    const { findBackgroundTaskOutputPath } = await import('../findBackgroundTaskOutputPath');
    const result = await findBackgroundTaskOutputPath({ taskId: '../etc/passwd', workingDir: '/foo/bar' });
    expect(result).toEqual({ path: null });
  });

  it('returns null for taskId with slash characters', async () => {
    vi.stubEnv('CLAUDE_CODE_TMPDIR', tmpDir);
    const { findBackgroundTaskOutputPath } = await import('../findBackgroundTaskOutputPath');
    const result = await findBackgroundTaskOutputPath({ taskId: 'task/bad', workingDir: '/foo/bar' });
    expect(result).toEqual({ path: null });
  });

  it('returns null for relative workingDir', async () => {
    vi.stubEnv('CLAUDE_CODE_TMPDIR', tmpDir);
    const { findBackgroundTaskOutputPath } = await import('../findBackgroundTaskOutputPath');
    const result = await findBackgroundTaskOutputPath({ taskId: 'task-123', workingDir: 'relative/path' });
    expect(result).toEqual({ path: null });
  });

  it('returns null when no matching file exists', async () => {
    vi.stubEnv('CLAUDE_CODE_TMPDIR', tmpDir);
    const { findBackgroundTaskOutputPath } = await import('../findBackgroundTaskOutputPath');
    const result = await findBackgroundTaskOutputPath({
      taskId: 'nonexistent-task',
      workingDir: '/Users/test/project',
    });
    expect(result).toEqual({ path: null });
  });

  it('returns path when single match exists', async () => {
    vi.stubEnv('CLAUDE_CODE_TMPDIR', tmpDir);
    const projectKey = '-Users-test-project';
    const taskId = 'task-abc123';
    const expected = await createOutputFile('runtime-uuid-001', taskId, projectKey);

    const { findBackgroundTaskOutputPath } = await import('../findBackgroundTaskOutputPath');
    const result = await findBackgroundTaskOutputPath({
      taskId,
      workingDir: '/Users/test/project',
    });
    expect(result).toEqual({ path: expected });
  });

  it('returns most recent file when multiple matches exist', async () => {
    vi.stubEnv('CLAUDE_CODE_TMPDIR', tmpDir);
    const projectKey = '-Users-test-project';
    const taskId = 'task-multi';

    const older = await createOutputFile('runtime-uuid-old', taskId, projectKey);
    // Write slightly different content to older to force mtime difference
    await writeFile(older, 'old content');

    // Small delay to ensure mtime differs
    await new Promise((resolve) => setTimeout(resolve, 10));

    const newer = await createOutputFile('runtime-uuid-new', taskId, projectKey);

    const { findBackgroundTaskOutputPath } = await import('../findBackgroundTaskOutputPath');
    const result = await findBackgroundTaskOutputPath({
      taskId,
      workingDir: '/Users/test/project',
    });
    expect(result.path).toBe(newer);
  });

  it('sanitizes workingDir with special characters correctly', async () => {
    vi.stubEnv('CLAUDE_CODE_TMPDIR', tmpDir);
    // replace(/[^a-zA-Z0-9_-]/g, '-')
    // '/Users/my project/test@work' -> '-Users-my-project-test-work'
    const workingDir = '/Users/my project/test@work';
    const projectKey = '-Users-my-project-test-work';
    const taskId = 'task-sanitize';
    const expected = await createOutputFile('runtime-uuid-sanitize', taskId, projectKey);

    const { findBackgroundTaskOutputPath } = await import('../findBackgroundTaskOutputPath');
    const result = await findBackgroundTaskOutputPath({ taskId, workingDir });
    expect(result).toEqual({ path: expected });
  });

  it('sanitizes Korean characters in workingDir', async () => {
    vi.stubEnv('CLAUDE_CODE_TMPDIR', tmpDir);
    // Korean chars are non-ASCII, replaced by '-'
    const workingDir = '/Users/홍길동/project';
    const sanitized = workingDir.replace(/[^a-zA-Z0-9_-]/g, '-');
    const taskId = 'task-korean';
    const expected = await createOutputFile('runtime-korean', taskId, sanitized);

    const { findBackgroundTaskOutputPath } = await import('../findBackgroundTaskOutputPath');
    const result = await findBackgroundTaskOutputPath({ taskId, workingDir });
    expect(result).toEqual({ path: expected });
  });

  it('returns null when process.getuid is not available (uid null)', async () => {
    vi.stubEnv('CLAUDE_CODE_TMPDIR', tmpDir);
    // Simulate environment without getuid (e.g., Windows-like)
    const originalGetuid = process.getuid;
    Object.defineProperty(process, 'getuid', { value: undefined, configurable: true });

    try {
      const { findBackgroundTaskOutputPath } = await import('../findBackgroundTaskOutputPath');
      const result = await findBackgroundTaskOutputPath({
        taskId: 'task-123',
        workingDir: '/Users/test/project',
      });
      expect(result).toEqual({ path: null });
    } finally {
      Object.defineProperty(process, 'getuid', { value: originalGetuid, configurable: true });
    }
  });
});

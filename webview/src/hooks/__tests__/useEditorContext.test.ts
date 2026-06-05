import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useRef } from 'react';

// ---------------------------------------------------------------------------
// BridgeContext mock — captures the EDITOR_CONTEXT handler so tests can
// drive it directly, mirroring how the backend would push a message.
// ---------------------------------------------------------------------------

type Handler = (message: IPCMessage) => void;

const handlers = new Map<string, Handler>();
const unsubscribeMock = vi.fn();

const subscribeMock = vi.fn((type: string, handler: Handler) => {
  handlers.set(type, handler);
  return unsubscribeMock;
});

function emitEditorContext(payload: Record<string, unknown>) {
  const handler = handlers.get('EDITOR_CONTEXT');
  if (!handler) throw new Error('EDITOR_CONTEXT handler not registered');
  handler({ type: 'EDITOR_CONTEXT', payload, timestamp: Date.now() });
}

vi.mock('@/contexts/BridgeContext', () => ({
  useBridgeContext: () => ({
    isConnected: true,
    send: vi.fn(),
    subscribe: subscribeMock,
    lastError: null,
  }),
}));

// Imported AFTER vi.mock so the mock is wired up first.
import {
  useEditorContext,
  buildEditorContextText,
  insertAtCursor,
} from '../useEditorContext';

// ---------------------------------------------------------------------------
// Setup / teardown
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
  handlers.clear();
  vi.useRealTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

// ---------------------------------------------------------------------------
// Pure helper: buildEditorContextText
// ---------------------------------------------------------------------------

describe('buildEditorContextText', () => {
  it('appends #L range when both start and end lines are numbers', () => {
    expect(
      buildEditorContextText({
        absolutePath: '/abs/src/file.ts',
        relativePath: 'src/file.ts',
        startLine: 10,
        endLine: 25,
        workingDir: '/abs',
      }),
    ).toBe('src/file.ts#L10-L25');
  });

  it('returns relativePath only when there is no selection (endLine null)', () => {
    expect(
      buildEditorContextText({
        absolutePath: '/abs/src/file.ts',
        relativePath: 'src/file.ts',
        startLine: 10,
        endLine: null,
        workingDir: '/abs',
      }),
    ).toBe('src/file.ts');
  });

  it('returns relativePath only when startLine is null', () => {
    expect(
      buildEditorContextText({
        absolutePath: '/abs/src/file.ts',
        relativePath: 'src/file.ts',
        startLine: null,
        endLine: 25,
        workingDir: '/abs',
      }),
    ).toBe('src/file.ts');
  });
});

// ---------------------------------------------------------------------------
// Pure helper: insertAtCursor
// ---------------------------------------------------------------------------

describe('insertAtCursor', () => {
  it('inserts text at a mid-string cursor, preserving before/after text', () => {
    const { nextValue, nextCaret } = insertAtCursor('hello world', 'X', 5);
    expect(nextValue).toBe('helloX world');
    expect(nextCaret).toBe(6);
  });

  it('inserts at the end when cursor equals value length', () => {
    const { nextValue, nextCaret } = insertAtCursor('abc', 'src/file.ts ', 3);
    expect(nextValue).toBe('abcsrc/file.ts ');
    expect(nextCaret).toBe(15);
  });

  it('inserts at the start when cursor is 0', () => {
    const { nextValue, nextCaret } = insertAtCursor('abc', 'X ', 0);
    expect(nextValue).toBe('X abc');
    expect(nextCaret).toBe(2);
  });
});

// ---------------------------------------------------------------------------
// Hook integration
// ---------------------------------------------------------------------------

interface HarnessParams {
  value: string;
  currentWorkingDir: string;
  cursor?: number;
}

function renderEditorContext(params: HarnessParams, onChange: (next: string) => void) {
  return renderHook(() => {
    const textareaRef = useRef<HTMLTextAreaElement>(
      {
        value: params.value,
        selectionStart: params.cursor ?? params.value.length,
        focus: vi.fn(),
        setSelectionRange: vi.fn(),
      } as unknown as HTMLTextAreaElement,
    );
    useEditorContext({
      value: params.value,
      onChange,
      textareaRef,
      currentWorkingDir: params.currentWorkingDir,
      shouldFocus: false,
    });
    return { textareaRef };
  });
}

describe('useEditorContext — handler', () => {
  it('registers and cleans up the EDITOR_CONTEXT subscription', () => {
    const onChange = vi.fn();
    const { unmount } = renderEditorContext(
      { value: '', currentWorkingDir: '/work' },
      onChange,
    );
    expect(subscribeMock).toHaveBeenCalledWith('EDITOR_CONTEXT', expect.any(Function));
    unmount();
    expect(unsubscribeMock).toHaveBeenCalled();
  });

  it('inserts "relativePath#L.. " with trailing space at cursor on selection', () => {
    const onChange = vi.fn();
    // Cursor sits between "ab" and "cd"; inserted text keeps both sides intact.
    renderEditorContext(
      { value: 'abcd', currentWorkingDir: '/work', cursor: 2 },
      onChange,
    );

    act(() => {
      emitEditorContext({
        absolutePath: '/work/src/file.ts',
        relativePath: 'src/file.ts',
        startLine: 10,
        endLine: 25,
        workingDir: '/work',
      });
    });

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith('absrc/file.ts#L10-L25 cd');
  });

  it('inserts relativePath only when there is no selection', () => {
    const onChange = vi.fn();
    renderEditorContext({ value: '', currentWorkingDir: '/work' }, onChange);

    act(() => {
      emitEditorContext({
        absolutePath: '/work/src/file.ts',
        relativePath: 'src/file.ts',
        startLine: null,
        endLine: null,
        workingDir: '/work',
      });
    });

    expect(onChange).toHaveBeenCalledWith('src/file.ts ');
  });

  it('ignores payloads whose workingDir does not match currentWorkingDir', () => {
    const onChange = vi.fn();
    renderEditorContext({ value: '', currentWorkingDir: '/work' }, onChange);

    act(() => {
      emitEditorContext({
        absolutePath: '/other/src/file.ts',
        relativePath: 'src/file.ts',
        startLine: 1,
        endLine: 2,
        workingDir: '/other',
      });
    });

    expect(onChange).not.toHaveBeenCalled();
  });

  it('matches workingDir regardless of trailing slash differences', () => {
    const onChange = vi.fn();
    renderEditorContext({ value: '', currentWorkingDir: '/work/' }, onChange);

    act(() => {
      emitEditorContext({
        absolutePath: '/work/src/file.ts',
        relativePath: 'src/file.ts',
        startLine: null,
        endLine: null,
        workingDir: '/work',
      });
    });

    expect(onChange).toHaveBeenCalledWith('src/file.ts ');
  });

  it('ignores payloads missing relativePath', () => {
    const onChange = vi.fn();
    renderEditorContext({ value: '', currentWorkingDir: '/work' }, onChange);

    act(() => {
      emitEditorContext({
        absolutePath: '/work/src/file.ts',
        startLine: 1,
        endLine: 2,
        workingDir: '/work',
      });
    });

    expect(onChange).not.toHaveBeenCalled();
  });

  it('dedups identical payloads fired within 500ms (only one onChange)', () => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    const onChange = vi.fn();
    renderEditorContext({ value: '', currentWorkingDir: '/work' }, onChange);

    const payload = {
      absolutePath: '/work/src/file.ts',
      relativePath: 'src/file.ts',
      startLine: 10,
      endLine: 25,
      workingDir: '/work',
    };

    act(() => {
      emitEditorContext(payload);
      vi.setSystemTime(200);
      emitEditorContext(payload);
    });

    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it('allows the same payload again after 500ms', () => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
    const onChange = vi.fn();
    renderEditorContext({ value: '', currentWorkingDir: '/work' }, onChange);

    const payload = {
      absolutePath: '/work/src/file.ts',
      relativePath: 'src/file.ts',
      startLine: 10,
      endLine: 25,
      workingDir: '/work',
    };

    act(() => {
      emitEditorContext(payload);
      vi.setSystemTime(600);
      emitEditorContext(payload);
    });

    expect(onChange).toHaveBeenCalledTimes(2);
  });
});

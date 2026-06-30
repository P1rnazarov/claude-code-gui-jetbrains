import { describe, it, expect } from 'vitest';
import {
  conversationalEntries,
  isTurnWorking,
  accumulateTurnTokens,
  type ConvoEntry,
} from '../external-turn';

describe('conversationalEntries', () => {
  it('keeps user/assistant/result and drops trailing metadata', () => {
    const messages = [
      { type: 'user' },
      { type: 'assistant' },
      { type: 'result' },
      { type: 'last-prompt' },
      { type: 'mode' },
      { type: 'summary' },
      null,
      undefined,
      {},
    ] as any[];
    expect(conversationalEntries(messages).map((m) => m.type)).toEqual([
      'user',
      'assistant',
      'result',
    ]);
  });
});

describe('isTurnWorking', () => {
  it('is false for a metadata-only (empty convo) batch', () => {
    expect(isTurnWorking([])).toBe(false);
  });

  it('is false when the last entry is a result', () => {
    expect(isTurnWorking([{ type: 'assistant' }, { type: 'result' }])).toBe(false);
  });

  it('is false when the assistant turn ended (terminal stop_reason)', () => {
    for (const stop_reason of ['end_turn', 'stop_sequence', 'max_tokens']) {
      expect(isTurnWorking([{ type: 'assistant', message: { stop_reason } }])).toBe(false);
    }
  });

  it('is true when the assistant emitted a tool_use (more coming)', () => {
    expect(isTurnWorking([{ type: 'assistant', message: { stop_reason: 'tool_use' } }])).toBe(true);
  });

  it('is true when the assistant stop_reason is null/absent (still streaming)', () => {
    expect(isTurnWorking([{ type: 'assistant', message: { stop_reason: null } }])).toBe(true);
    expect(isTurnWorking([{ type: 'assistant', message: {} }])).toBe(true);
    expect(isTurnWorking([{ type: 'assistant' }])).toBe(true);
  });

  it('is true when the last entry is a user message', () => {
    expect(isTurnWorking([{ type: 'user' }])).toBe(true);
  });
});

describe('accumulateTurnTokens', () => {
  it('counts a single assistant message once', () => {
    const byId = new Map<string, number>();
    const total = accumulateTurnTokens(
      [{ type: 'assistant', message: { id: 'm1', usage: { output_tokens: 100 } } }],
      byId,
    );
    expect(total).toBe(100);
  });

  it('de-duplicates content-block repeats that share a message id and output_tokens', () => {
    const byId = new Map<string, number>();
    // One API response written as 4 JSONL lines, all repeating output_tokens=1081.
    const convo: ConvoEntry[] = Array.from({ length: 4 }, () => ({
      type: 'assistant',
      message: { id: 'msg_same', usage: { output_tokens: 1081 } },
    }));
    expect(accumulateTurnTokens(convo, byId)).toBe(1081);
  });

  it('is idempotent when the same batch is re-delivered (multiple subscribers)', () => {
    const byId = new Map<string, number>();
    const batch: ConvoEntry[] = [
      { type: 'assistant', message: { id: 'a', usage: { output_tokens: 500 } } },
    ];
    expect(accumulateTurnTokens(batch, byId)).toBe(500);
    // Same batch delivered again to a second subscriber must NOT double to 1000.
    expect(accumulateTurnTokens(batch, byId)).toBe(500);
  });

  it('accumulates distinct messages across mid-turn batches', () => {
    const byId = new Map<string, number>();
    accumulateTurnTokens(
      [{ type: 'user' }, { type: 'assistant', message: { id: 'a', usage: { output_tokens: 100 } } }],
      byId,
    );
    const total = accumulateTurnTokens(
      [{ type: 'assistant', message: { id: 'b', usage: { output_tokens: 250 } } }],
      byId,
    );
    expect(total).toBe(350);
  });

  it('resets the counter when a new user turn begins', () => {
    const byId = new Map<string, number>();
    accumulateTurnTokens(
      [{ type: 'assistant', message: { id: 'a', usage: { output_tokens: 900 } } }],
      byId,
    );
    const total = accumulateTurnTokens(
      [{ type: 'user' }, { type: 'assistant', message: { id: 'b', usage: { output_tokens: 40 } } }],
      byId,
    );
    expect(total).toBe(40);
  });

  it('ignores assistant entries missing an id or numeric token count', () => {
    const byId = new Map<string, number>();
    const total = accumulateTurnTokens(
      [
        { type: 'assistant', message: { usage: { output_tokens: 100 } } }, // no id
        { type: 'assistant', message: { id: 'x' } }, // no usage
        { type: 'assistant', message: { id: 'y', usage: { output_tokens: 7 } } },
      ],
      byId,
    );
    expect(total).toBe(7);
  });
});

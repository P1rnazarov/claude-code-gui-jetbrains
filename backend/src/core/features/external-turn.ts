/**
 * Pure helpers for classifying an externally-tailed (live-tailed terminal) session's
 * current turn from its raw JSONL entries. Extracted from server.ts so the edge-case
 * logic (stop_reason variants, metadata-only batches, per-message token de-dup) is
 * unit-testable in isolation.
 */

/** stop_reason values that mark an assistant turn as finished. */
export const TERMINAL_STOP_REASONS = ['end_turn', 'stop_sequence', 'max_tokens'];

/** The subset of a Claude Code JSONL entry this module reads. */
export interface ConvoEntry {
  type?: string;
  message?: {
    id?: string;
    stop_reason?: string | null;
    usage?: { output_tokens?: number };
  };
}

/** Conversational entry types. Everything else is trailing session metadata. */
const CONVO_TYPES = new Set(['user', 'assistant', 'result']);

/**
 * Keep only conversational entries; drop trailing session metadata lines
 * (last-prompt / mode / pr-link / summary …) which are written after a turn and
 * must not be treated as "still working".
 */
export function conversationalEntries<T extends ConvoEntry>(messages: T[]): T[] {
  return messages.filter((m) => !!m && typeof m.type === 'string' && CONVO_TYPES.has(m.type));
}

/**
 * Decide whether an externally-tailed session is still mid-turn, given the
 * conversational entries from the latest append batch.
 */
export function isTurnWorking(convo: ConvoEntry[]): boolean {
  const last = convo[convo.length - 1];
  // Batch carried only metadata → no active turn signalled.
  if (!last) return false;
  if (last.type === 'result') return false;
  if (last.type === 'assistant') {
    // stop_reason lives under `message`. `tool_use` (a tool call → more coming)
    // or an unstamped/null reason means the turn is still in progress.
    const stopReason = last.message?.stop_reason;
    return !stopReason || !TERMINAL_STOP_REASONS.includes(stopReason);
  }
  // Latest entry is a user message → assistant is about to respond.
  return true;
}

/**
 * Accumulate the active turn's output tokens into `tokensById`, keyed by the
 * assistant message id.
 *
 * Claude Code writes one assistant API response across MULTIPLE JSONL lines (one per
 * content block: thinking / text / tool_use …) that all repeat the SAME
 * usage.output_tokens. Keying by message id therefore (a) de-duplicates those
 * content-block repeats — fixing a 2x–5x overcount — and (b) makes re-delivery of the
 * identical batch to several subscribers idempotent — fixing the per-viewer
 * double-count. A user entry in the batch starts a fresh turn.
 *
 * Returns the active turn's running total.
 */
export function accumulateTurnTokens(convo: ConvoEntry[], tokensById: Map<string, number>): number {
  const hasUserMsg = convo.some((m) => m && m.type === 'user');
  if (hasUserMsg) tokensById.clear();

  for (const m of convo) {
    if (m && m.type === 'assistant') {
      const tokens = m.message?.usage?.output_tokens;
      const id = m.message?.id;
      if (typeof tokens === 'number' && typeof id === 'string') {
        tokensById.set(id, tokens);
      }
    }
  }

  let total = 0;
  for (const v of tokensById.values()) total += v;
  return total;
}

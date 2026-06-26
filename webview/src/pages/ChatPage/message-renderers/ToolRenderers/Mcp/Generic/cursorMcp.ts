/**
 * Cursor-compatible parsing helpers for the generic MCP fallback renderer.
 *
 * These deliberately mirror the rules used by Anthropic's official Claude Code
 * VSCode/Cursor extension so an unregistered MCP tool renders with the exact
 * same header label and input preview. They live apart from the project's own
 * `formatMcpToolName` (in `../_common`) — that one stays as-is for the dedicated
 * renderers; these are scoped to the fallback only.
 */

const MCP_PREFIX = 'mcp__';

/**
 * Server-name tokens that Cursor special-cases instead of plain title-casing.
 * Keyed by the already title-cased token (first letter upper, rest lower).
 */
const HUMANIZE_OVERRIDES: Record<string, string> = {
    Github: 'GitHub',
    Pubmed: 'PubMed',
    Ai: 'AI',
};

/**
 * Input keys, in priority order, that Cursor scans to build the dim header
 * preview shown next to `Server [tool]`. The first key holding a non-empty
 * string wins.
 */
const INPUT_PREVIEW_KEYS = [
    'query',
    'message',
    'channel',
    'repo',
    'url',
    'path',
    'title',
    'search',
    'text',
] as const;

export function isMcpToolName(name: string): boolean {
    return typeof name === 'string' && name.startsWith(MCP_PREFIX);
}

/** First `__`-separated segment after the `mcp__` prefix (the server). */
export function mcpServerName(name: string): string {
    if (!isMcpToolName(name)) return '';
    return name.slice(MCP_PREFIX.length).split('__')[0] ?? '';
}

/**
 * Everything after the server segment, re-joined by `__` so a tool name that
 * itself contains `__` is preserved (e.g. `mcp__s__foo__bar` → `foo__bar`).
 */
export function mcpToolName(name: string): string {
    if (!isMcpToolName(name)) return '';
    return name.slice(MCP_PREFIX.length).split('__').slice(1).join('__');
}

/**
 * Humanize a raw server segment: split on `_`, title-case each token (first
 * letter upper, rest lower), apply special-case overrides, join with spaces.
 * Hyphens are NOT split, matching Cursor (`workspace-mcp` → `Workspace-mcp`).
 */
export function humanizeMcpServer(server: string): string {
    return server
        .split('_')
        .map((token) => token.charAt(0).toUpperCase() + token.slice(1).toLowerCase())
        .map((token) => HUMANIZE_OVERRIDES[token] ?? token)
        .join(' ');
}

/**
 * Build the `Server [tool]` header label. Falls back to the raw name when the
 * input is not a well-formed mcp name (no prefix, or missing server/tool).
 */
export function mcpHeaderLabel(name: string): string {
    const server = mcpServerName(name);
    const tool = mcpToolName(name);
    if (!server || !tool) return name;
    return `${humanizeMcpServer(server)} [${tool}]`;
}

function truncate(value: string, max: number): string {
    return value.length > max ? value.slice(0, max) + '…' : value;
}

/**
 * Derive the dim header preview from a tool's input object, matching Cursor:
 *   - scan `INPUT_PREVIEW_KEYS` in order, take the first non-empty string
 *   - `channel` → `#<value>`
 *   - `url` → hostname (falls back to a 30-char truncation if unparseable)
 *   - otherwise → 40-char truncation
 * Returns null when no priority key holds a string.
 */
export function mcpInputPreview(input: Record<string, unknown> | undefined | null): string | null {
    if (!input || typeof input !== 'object') return null;
    for (const key of INPUT_PREVIEW_KEYS) {
        const value = input[key];
        if (typeof value !== 'string' || !value) continue;
        if (key === 'channel') return `#${value}`;
        if (key === 'url') {
            try {
                return new URL(value).hostname;
            } catch {
                return truncate(value, 30);
            }
        }
        return truncate(value, 40);
    }
    return null;
}

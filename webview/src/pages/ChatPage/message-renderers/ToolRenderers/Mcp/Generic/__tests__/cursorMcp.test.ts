import {describe, it, expect} from 'vitest';
import {
    isMcpToolName,
    mcpServerName,
    mcpToolName,
    humanizeMcpServer,
    mcpHeaderLabel,
    mcpInputPreview,
} from '../cursorMcp';

describe('isMcpToolName', () => {
    it('is true for an mcp__ prefixed name', () => {
        expect(isMcpToolName('mcp__workspace-mcp__search_gmail_messages')).toBe(true);
    });

    it('is false for a plain tool name', () => {
        expect(isMcpToolName('Bash')).toBe(false);
    });

    it('is false for an empty string', () => {
        expect(isMcpToolName('')).toBe(false);
    });
});

describe('mcpServerName / mcpToolName', () => {
    // Cursor parses the server as the FIRST segment after mcp__, and the tool as
    // everything after that (joined by __, so a __ inside the tool name is preserved).
    it('takes the server from the first segment', () => {
        expect(mcpServerName('mcp__workspace-mcp__search_gmail_messages')).toBe('workspace-mcp');
    });

    it('takes the tool from the remaining segments', () => {
        expect(mcpToolName('mcp__workspace-mcp__search_gmail_messages')).toBe('search_gmail_messages');
    });

    it('preserves __ inside the tool name (server = first segment only)', () => {
        expect(mcpServerName('mcp__server__foo__bar')).toBe('server');
        expect(mcpToolName('mcp__server__foo__bar')).toBe('foo__bar');
    });

    it('returns empty strings for a non-mcp name', () => {
        expect(mcpServerName('Bash')).toBe('');
        expect(mcpToolName('Bash')).toBe('');
    });
});

describe('humanizeMcpServer', () => {
    it('title-cases each underscore token and lowercases the rest', () => {
        expect(humanizeMcpServer('claude_ai_Gmail')).toBe('Claude AI Gmail');
    });

    it('does not split on hyphens', () => {
        expect(humanizeMcpServer('workspace-mcp')).toBe('Workspace-mcp');
    });

    it('applies special-case overrides (github -> GitHub, pubmed -> PubMed)', () => {
        expect(humanizeMcpServer('github')).toBe('GitHub');
        expect(humanizeMcpServer('pubmed')).toBe('PubMed');
    });
});

describe('mcpHeaderLabel', () => {
    it('formats as "Server [tool]" using Cursor rules', () => {
        expect(mcpHeaderLabel('mcp__workspace-mcp__search_gmail_messages')).toBe(
            'Workspace-mcp [search_gmail_messages]'
        );
    });

    it('humanizes multi-token servers', () => {
        expect(mcpHeaderLabel('mcp__claude_ai_Gmail__get_thread')).toBe(
            'Claude AI Gmail [get_thread]'
        );
    });

    it('falls back to the raw name when it is not a valid mcp name', () => {
        expect(mcpHeaderLabel('Bash')).toBe('Bash');
        expect(mcpHeaderLabel('mcp__only_one_segment')).toBe('mcp__only_one_segment');
    });
});

describe('mcpInputPreview', () => {
    it('returns the first priority-key string value (query)', () => {
        expect(mcpInputPreview({query: 'in:inbox newer_than:7d'})).toBe('in:inbox newer_than:7d');
    });

    it('prefixes channel with #', () => {
        expect(mcpInputPreview({channel: 'general'})).toBe('#general');
    });

    it('reduces a url to its hostname', () => {
        expect(mcpInputPreview({url: 'https://example.com/some/path?x=1'})).toBe('example.com');
    });

    it('truncates a long value to 40 chars with an ellipsis', () => {
        const long = 'a'.repeat(60);
        expect(mcpInputPreview({query: long})).toBe('a'.repeat(40) + '…');
    });

    it('respects priority order (query before text)', () => {
        expect(mcpInputPreview({text: 'second', query: 'first'})).toBe('first');
    });

    it('returns null when no priority key holds a string', () => {
        expect(mcpInputPreview({foo: 'bar', page_size: 3})).toBeNull();
        expect(mcpInputPreview({})).toBeNull();
        expect(mcpInputPreview(undefined)).toBeNull();
    });
});

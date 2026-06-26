import {describe, it, expect} from 'vitest';
import {render, screen} from '@testing-library/react';
import {ToolUseBlockDto, ContentBlockType} from '@/dto';
import type {LoadedMessageDto} from '@/types';
import {GenericMcpRenderer} from '../index';

function makeToolUse(input: Record<string, unknown>, name: string): ToolUseBlockDto {
    return Object.assign(new ToolUseBlockDto(), {
        type: ContentBlockType.ToolUse,
        id: 'tool_1',
        name,
        input,
    });
}

function makeToolResult(content: string): LoadedMessageDto {
    return {
        message: {
            content: [{type: ContentBlockType.ToolResult, content}],
        },
    } as unknown as LoadedMessageDto;
}

const TOOL = 'mcp__workspace-mcp__search_gmail_messages';

describe('GenericMcpRenderer', () => {
    it('renders the Cursor-style header label', () => {
        render(<GenericMcpRenderer toolUse={makeToolUse({}, TOOL)} />);
        expect(screen.getByText('Workspace-mcp [search_gmail_messages]')).toBeInTheDocument();
    });

    it('renders the input preview from the first priority key', () => {
        render(
            <GenericMcpRenderer
                toolUse={makeToolUse({query: 'in:inbox newer_than:7d', page_size: 3}, TOOL)}
            />
        );
        expect(screen.getByText('in:inbox newer_than:7d')).toBeInTheDocument();
    });

    it('renders the tool result in an OUT row (raw text)', () => {
        render(
            <GenericMcpRenderer
                toolUse={makeToolUse({query: 'x'}, TOOL)}
                toolResult={makeToolResult('Found 3 messages')}
            />
        );
        expect(screen.getByText('OUT')).toBeInTheDocument();
        expect(screen.getByText(/Found 3 messages/)).toBeInTheDocument();
    });

    it('renders an error result in the same OUT row (no special styling)', () => {
        render(
            <GenericMcpRenderer
                toolUse={makeToolUse({query: 'x'}, TOOL)}
                toolResult={makeToolResult("Error calling tool 'search_gmail_messages': ACTION REQUIRED")}
            />
        );
        expect(screen.getByText('OUT')).toBeInTheDocument();
        expect(screen.getByText(/ACTION REQUIRED/)).toBeInTheDocument();
    });

    it('does not render an OUT row when there is no result', () => {
        render(<GenericMcpRenderer toolUse={makeToolUse({query: 'x'}, TOOL)} />);
        expect(screen.queryByText('OUT')).not.toBeInTheDocument();
    });

    it('does not throw when input is missing entirely', () => {
        expect(() =>
            render(<GenericMcpRenderer toolUse={makeToolUse(undefined as never, TOOL)} />)
        ).not.toThrow();
    });
});

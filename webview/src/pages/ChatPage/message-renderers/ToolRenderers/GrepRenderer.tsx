import {useState} from "react";
import {ToolUseBlockDto} from "@/types";
import {RendererProps, ToolHeader, ToolWrapper} from "./common";

class GrepToolUseDto extends ToolUseBlockDto {
    caller: { type: 'direct' };
    declare input: {
        path: string;
        pattern: string;
    } | {
        pattern: string;
        glob: string;
        output_mode: string;
        head_limit: number;
    };
}

class GrepToolResultDto {
    type: string;
    tool_use_id: string;
    content: string;
}

export function GrepRenderer(props: RendererProps) {
    const [isExpanded, setIsExpanded] = useState(false);
    const toolUse = props.toolUse as unknown as GrepToolUseDto;
    const toolResult = props.toolResult?.message?.content?.[0] as GrepToolResultDto | undefined;

    const name = toolUse.name;
    const pattern = toolUse.input?.pattern ?? '';
    // const output = toolResult?.message?.content[0].content ?? '' as string;

    return (
        <ToolWrapper message={props.message}>
            <ToolHeader name={name} className="mb-2.5">
                <div className="text-white/80 text-[0.9230rem] line-clamp-2 break-all">
                    "{pattern}"{` `}
                    {toolUse.input && 'path' in toolUse.input && `(in ${toolUse.input.path})`}
                    {toolUse.input && 'glob' in toolUse.input && `(glob: ${toolUse.input.glob})`}
                </div>
            </ToolHeader>

            {toolResult?.content && (
                <div
                    onClick={() => setIsExpanded(!isExpanded)}
                    className={`text-white/50 text-[0.8461rem] -mt-1 cursor-pointer hover:underline whitespace-pre-wrap ${isExpanded ? '' : 'max-h-[20px] overflow-hidden'}`}>
                    {toolResult.content}
                </div>
            )}
        </ToolWrapper>
    )
}

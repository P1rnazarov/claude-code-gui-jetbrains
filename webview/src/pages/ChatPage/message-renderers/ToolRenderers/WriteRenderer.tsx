import {ToolUseBlockDto} from "@/dto";
import {getAdapter} from "@/adapters";
import {RendererProps, ToolHeader, ToolWrapper} from "./common";
import {cn} from "@/utils/cn";

class WriteToolUseDto extends ToolUseBlockDto {
    declare input: {
        file_path: string;
        content: string;
    };
}

export function WriteRenderer(props: RendererProps) {
    const toolUse = props.toolUse as unknown as WriteToolUseDto;
    const filePath = toolUse.input?.file_path ?? '';
    const fileName = filePath.split('/').pop() ?? filePath;
    const lineCount = (toolUse.input?.content ?? '').split('\n').length;

    return (
        <ToolWrapper message={props.message}>
            <ToolHeader name="Write" inProgress={!props.toolResult && lineCount <= 0} className="mb-1">
                <div className={cn("text-white/80 text-[0.8461rem] font-mono", filePath && "cursor-pointer hover:underline")} onClick={filePath ? () => getAdapter().openFile(filePath) : undefined}>{fileName}</div>
            </ToolHeader>
            <div className="text-white/50 text-[0.8461rem]">{lineCount} lines</div>
        </ToolWrapper>
    );
}

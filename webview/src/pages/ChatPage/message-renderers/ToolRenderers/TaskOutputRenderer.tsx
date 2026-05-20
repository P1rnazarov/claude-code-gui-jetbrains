import {ToolUseBlockDto} from "@/dto";
import {Container, LabelValue, RendererProps, ToolHeader, ToolWrapper} from "./common";

class TaskOutputToolUseDto extends ToolUseBlockDto {
    declare input: {
        task_id: string;
        block?: boolean;
        timeout?: number;
    };
}

enum RetrievalStatus {
    Success = 'success',
    Timeout = 'timeout',
    Error = 'error',
}

enum TaskStatus {
    Running = 'running',
    Completed = 'completed',
    Failed = 'failed',
    Stopped = 'stopped',
}

function parseXmlTag(text: string, tag: string): string | undefined {
    const match = text.match(new RegExp(`<${tag}>(.*?)</${tag}>`, 's'));
    return match?.[1]?.trim();
}

function retrievalStatusLabel(status: string): string {
    switch (status) {
        case RetrievalStatus.Success: return 'completed';
        case RetrievalStatus.Timeout: return 'timed out';
        case RetrievalStatus.Error: return 'error';
        default: return status;
    }
}

function taskStatusColor(status: string): string {
    switch (status) {
        case TaskStatus.Running: return 'text-blue-400';
        case TaskStatus.Completed: return 'text-green-400';
        case TaskStatus.Failed: return 'text-red-400';
        case TaskStatus.Stopped: return 'text-yellow-400';
        default: return 'text-white/60';
    }
}

export function TaskOutputRenderer(props: RendererProps) {
    const toolUse = props.toolUse as unknown as TaskOutputToolUseDto;
    const taskId = toolUse.input?.task_id ?? '';

    const toolResult = props.toolResult as {
        message?: { content?: Array<{ content?: string | Array<{ type?: string; content?: string }> }> }
    } | undefined;

    const rawContent = toolResult?.message?.content?.[0]?.content;
    const resultText = typeof rawContent === 'string'
        ? rawContent
        : (Array.isArray(rawContent) ? rawContent[0]?.content ?? '' : '');

    const retrievalStatus = parseXmlTag(resultText, 'retrieval_status');
    const taskType = parseXmlTag(resultText, 'task_type');
    const taskStatus = parseXmlTag(resultText, 'status');

    const xmlOutput = parseXmlTag(resultText, 'output');
    const stdout = parseXmlTag(resultText, 'stdout');
    const stderr = parseXmlTag(resultText, 'stderr');
    const output = xmlOutput || stdout || stderr || resultText;
    const hasMeta = !!(taskType || taskStatus || retrievalStatus);

    const description = taskStatus
        ? `${taskId} — ${taskStatus}`
        : taskId;

    return (
        <ToolWrapper message={props.message}>
            <ToolHeader name="TaskOutput" inProgress={!props.toolResult} className="mb-2.5">
                <div className="text-white/60 truncate text-[0.9230rem]">task: "{description}"</div>
            </ToolHeader>

            {props.toolResult && output && (
                <Container>
                    {hasMeta && (
                        <div className="flex items-start p-2 gap-4 text-[0.8461rem] font-mono">
                            {taskType && (
                                <div>
                                    <span className="text-white/40">type </span>
                                    <span className="text-white/80">{taskType}</span>
                                </div>
                            )}
                            {taskStatus && (
                                <div>
                                    <span className="text-white/40">status </span>
                                    <span className={taskStatusColor(taskStatus)}>{taskStatus}</span>
                                </div>
                            )}
                            {retrievalStatus && (
                                <div>
                                    <span className="text-white/40">retrieval </span>
                                    <span className="text-white/80">{retrievalStatusLabel(retrievalStatus)}</span>
                                </div>
                            )}
                        </div>
                    )}

                    <LabelValue
                        label="OUT"
                        className={hasMeta ? "border-t border-white/15" : undefined}
                        maxHeight="max-h-[105px]"
                    >
                        {output}
                    </LabelValue>
                </Container>
            )}
        </ToolWrapper>
    );
}

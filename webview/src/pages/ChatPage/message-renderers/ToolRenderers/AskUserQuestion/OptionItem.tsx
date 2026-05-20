export function OptionItem(props: {
    label: string;
    description: string;
    selected: boolean;
    multiSelect: boolean;
    disabled: boolean;
    onClick: () => void;
}) {
    const { label, description, selected, multiSelect, disabled, onClick } = props;

    const baseClass =
        "px-3 py-2 border rounded cursor-pointer transition-colors select-none";
    const selectedClass = "border-blue-500/50 bg-blue-900/20";
    const unselectedClass = "border-white/15 bg-zinc-800/40 hover:bg-zinc-700/50";
    const disabledClass = "opacity-50 cursor-not-allowed";

    return (
        <div
            className={`${baseClass} ${selected ? selectedClass : unselectedClass} ${disabled ? disabledClass : ""}`}
            onClick={disabled ? undefined : onClick}
        >
            <div className="flex items-center gap-2">
                {multiSelect ? (
                    <div
                        className={`w-3.5 h-3.5 rounded-sm border flex items-center justify-center flex-shrink-0 ${
                            selected ? "border-blue-500 bg-blue-600" : "border-white/30"
                        }`}
                    >
                        {selected && (
                            <svg width="9" height="7" viewBox="0 0 9 7" fill="none">
                                <path
                                    d="M1 3L3.5 5.5L8 1"
                                    stroke="white"
                                    strokeWidth="1.5"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                />
                            </svg>
                        )}
                    </div>
                ) : (
                    <div
                        className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center flex-shrink-0 ${
                            selected ? "border-blue-500" : "border-white/30"
                        }`}
                    >
                        {selected && (
                            <div className="w-2 h-2 rounded-full bg-blue-500" />
                        )}
                    </div>
                )}
                <span className="text-white/90 text-[1rem]">{label}</span>
            </div>
            {description && (
                <div className="text-white/50 text-[0.8461rem] mt-0.5 ml-5">{description}</div>
            )}
        </div>
    );
}

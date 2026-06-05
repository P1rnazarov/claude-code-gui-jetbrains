interface Props {
  visible: boolean;
}

export function DragOverlay(props: Props) {
  const { visible } = props;

  if (!visible) return null;

  return (
    <div className="absolute inset-0 z-10 flex items-center justify-center rounded-lg bg-accent-primary/10 border-2 border-dashed border-border-focus/50 pointer-events-none">
      <span className="text-text-link text-sm font-medium">Drop files or folders here</span>
    </div>
  );
}

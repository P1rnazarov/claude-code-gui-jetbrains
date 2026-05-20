interface InfoRowProps {
  label: string;
  value: string | null;
}

export function InfoRow({ label, value }: InfoRowProps) {
  return (
    <div className="flex items-center justify-between mb-3">
      <span className="text-[0.9230rem] text-zinc-400">{label}</span>
      <span className="text-[0.9230rem] text-zinc-200">{value ?? '—'}</span>
    </div>
  );
}

export function InfoRowSkeleton() {
  return (
    <div className="flex items-center justify-between mb-3">
      <div className="h-3 w-20 bg-zinc-700 rounded animate-pulse" />
      <div className="h-3 w-24 bg-zinc-700 rounded animate-pulse" />
    </div>
  );
}

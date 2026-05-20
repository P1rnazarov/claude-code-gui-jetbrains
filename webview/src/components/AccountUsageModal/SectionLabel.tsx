import { cn } from "@/utils/cn";
import { ReactNode } from 'react';

export function SectionLabel(props: {
  className?: string;
  children: ReactNode;
}) {
  const { className = '', children } = props;

  return (
    <div className={cn(`text-[0.9230rem] font-bold text-zinc-400 uppercase tracking-widest mb-3`, className)}>
      {children}
    </div>
  );
}

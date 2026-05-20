import {ReactNode} from "react";

interface SettingSectionProps {
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
}

export function SettingSection({ title, description, children }: SettingSectionProps) {
  return (
    <section className="mb-8">
      <h2 className="text-[0.9230rem] font-semibold text-zinc-500 uppercase tracking-wider mb-4">
        {title}
      </h2>
      {description && (typeof description === 'string' ? (
        <p className="text-[0.8461rem] font-normal text-zinc-500 -mt-2 mb-3">{description}</p>
      ) : description)}
      <div className="bg-zinc-900 rounded-lg border border-zinc-800 px-4">
        {children}
      </div>
    </section>
  );
}

import type { ReactNode } from "react";

type Props = {
  title: string;
  action?: ReactNode;
  className?: string;
};

export function DashboardSectionHeading({ title, action, className }: Props) {
  return (
    <div
      className={`flex flex-wrap items-center justify-between gap-3 ${className ?? ""}`}
    >
      <div className="flex min-w-0 items-center gap-2.5">
        <span
          className="h-5 w-0.5 shrink-0 rounded-full bg-emerald-600"
          aria-hidden
        />
        <h2 className="text-base font-semibold tracking-tight text-zinc-100">
          {title}
        </h2>
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

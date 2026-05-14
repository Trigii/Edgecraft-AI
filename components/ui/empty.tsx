import { ReactNode } from "react";

export function Empty({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <div className="card flex flex-col items-center text-center py-10 gap-2">
      <div className="text-base font-medium">{title}</div>
      {subtitle && <div className="text-sm text-ink-muted max-w-md">{subtitle}</div>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}

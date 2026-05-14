import { cn } from "@/lib/utils";

type Props = {
  label: string;
  value: string;
  sub?: string;
  trend?: "up" | "down" | "flat";
  tone?: "default" | "bull" | "bear" | "warn" | "info";
  className?: string;
};

const toneClass = {
  default: "text-ink",
  bull: "text-bull",
  bear: "text-bear",
  warn: "text-warn",
  info: "text-info",
};

export function Kpi({ label, value, sub, trend, tone = "default", className }: Props) {
  return (
    <div className={cn("card-tight", className)}>
      <div className="kpi-label">{label}</div>
      <div className={cn("kpi-value", toneClass[tone])}>
        {value}
        {trend === "up" && <span className="ml-2 text-sm text-bull">▲</span>}
        {trend === "down" && <span className="ml-2 text-sm text-bear">▼</span>}
      </div>
      {sub && <div className="kpi-sub">{sub}</div>}
    </div>
  );
}

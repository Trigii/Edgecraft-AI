"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  BookOpen,
  Calculator,
  Lightbulb,
  Layers,
  Settings as SettingsIcon,
  Bot,
  LineChart,
} from "lucide-react";

const items = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/markets", label: "Markets", icon: LineChart },
  { href: "/journal", label: "Journal", icon: BookOpen },
  { href: "/copilot", label: "Pre-Trade", icon: Bot },
  { href: "/calculator", label: "Calculator", icon: Calculator },
  { href: "/strategies", label: "Strategies", icon: Layers },
  { href: "/insights", label: "Insights", icon: Lightbulb },
  { href: "/settings", label: "Settings", icon: SettingsIcon },
];

export function SideNav() {
  const pathname = usePathname();
  return (
    <nav className="w-56 shrink-0 border-r border-bg-border bg-bg-surface p-3 flex flex-col gap-1 min-h-screen">
      <Link href="/dashboard" className="flex items-center gap-2 px-2 py-3">
        <div className="w-7 h-7 rounded bg-edge flex items-center justify-center text-bg font-bold">E</div>
        <div>
          <div className="text-sm font-semibold">Edgecraft</div>
          <div className="text-[10px] uppercase tracking-widest text-ink-subtle">Trading copilot</div>
        </div>
      </Link>
      <div className="h-px bg-bg-border my-2" />
      {items.map((item) => {
        const Icon = item.icon;
        const active = pathname === item.href || pathname.startsWith(item.href + "/");
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex items-center gap-2 px-2 py-1.5 rounded text-sm transition-colors",
              active
                ? "bg-bg-elevated text-ink"
                : "text-ink-muted hover:bg-bg-elevated hover:text-ink",
            )}
          >
            <Icon size={16} />
            {item.label}
          </Link>
        );
      })}
      <div className="mt-auto px-2 py-2 text-[10px] text-ink-subtle">
        v0.1 · Build your edge
      </div>
    </nav>
  );
}

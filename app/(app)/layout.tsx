import { SideNav } from "@/components/nav";
import { getDefaultUser, getActiveAccount } from "@/lib/queries";
import Link from "next/link";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getDefaultUser();
  const account = await getActiveAccount(user.id);

  return (
    <div className="flex">
      <SideNav />
      <main className="flex-1 min-h-screen">
        <header className="border-b border-bg-border bg-bg-surface/40 backdrop-blur px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-xs text-ink-subtle uppercase tracking-widest">Account</span>
            {account ? (
              <span className="text-sm">
                <span className="font-medium">{account.name}</span>{" "}
                <span className="text-ink-muted">· {account.broker ?? account.assetFocus}</span>{" "}
                <span className="badge-muted ml-1">{account.accountType}</span>
              </span>
            ) : (
              <Link href="/settings" className="text-sm link">
                Create an account →
              </Link>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Link href="/journal/new" className="btn-ghost text-xs">+ New trade</Link>
            <Link href="/copilot" className="btn-primary text-xs">Pre-trade copilot</Link>
          </div>
        </header>
        <div className="p-6 max-w-7xl">{children}</div>
      </main>
    </div>
  );
}

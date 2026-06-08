import { AuthGuard } from "@/components/AuthGuard";
import { Sidebar } from "./Sidebar";
import type { Role } from "@/lib/types";

export function AppShell({
  children,
  role,
  title,
  subtitle,
}: {
  children: React.ReactNode;
  role: Role;
  title?: string;
  subtitle?: string;
}) {
  return (
    <AuthGuard role={role}>
    <div className="min-h-screen bg-slate-50">
      <Sidebar role={role} />
      <main className="mr-64 min-h-screen">
        {(title || subtitle) && (
          <header className="border-b border-slate-200 bg-white px-8 py-6">
            {title && <h1 className="text-2xl font-bold text-slate-900">{title}</h1>}
            {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
          </header>
        )}
        <div className="p-8">{children}</div>
      </main>
    </div>
    </AuthGuard>
  );
}

"use client";

import { useState } from "react";
import { Menu } from "lucide-react";
import { KeepAlive } from "./KeepAlive";
import { Sidebar } from "./Sidebar";
import { SiteLogos } from "@/components/ui/SiteLogos";
import type { Role } from "@/lib/types";

export function ShellLayout({
  children,
  role,
}: {
  children: React.ReactNode;
  role: Role;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100/80">
      <Sidebar
        role={role}
        mobileOpen={mobileOpen}
        onMobileClose={() => setMobileOpen(false)}
      />

      {mobileOpen && (
        <button
          type="button"
          aria-label="סגור תפריט"
          className="fixed inset-0 z-40 bg-black/40 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <main className="mr-0 min-h-screen lg:mr-72">
        <div className="sticky top-0 z-20 flex items-center gap-3 border-b border-slate-200/80 bg-white/80 px-4 py-3 backdrop-blur-sm lg:hidden">
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            className="rounded-xl p-2 text-slate-600 transition hover:bg-slate-100"
            aria-label="פתח תפריט"
          >
            <Menu className="h-5 w-5" />
          </button>
          <SiteLogos size="header" />
        </div>

        <div className="p-4 lg:p-8">
          <KeepAlive>{children}</KeepAlive>
        </div>
      </main>
    </div>
  );
}

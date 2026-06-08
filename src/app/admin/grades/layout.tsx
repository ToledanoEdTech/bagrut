"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";

const TABS = [
  { href: "/admin/grades", label: "לפי תלמיד", exact: true },
  { href: "/admin/grades/matrix", label: "לפי מטלה" },
  { href: "/admin/grades/import", label: "ייבוא" },
];

export default function GradesLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <>
      <header className="-mx-8 -mt-8 border-b border-slate-200 bg-white px-8 py-6">
        <h1 className="text-2xl font-bold text-slate-900">הזנת ציונים</h1>
        <p className="mt-1 text-sm text-slate-500">
          הזנת ציונים וסטטוס הגשה לחובות בגרות
        </p>
        <nav className="mt-4 flex gap-1 rounded-xl bg-slate-100 p-1">
          {TABS.map((tab) => {
            const active = tab.exact
              ? pathname === tab.href
              : pathname.startsWith(tab.href);
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={clsx(
                  "rounded-lg px-4 py-2 text-sm font-medium transition",
                  active
                    ? "bg-white text-primary-700 shadow-sm"
                    : "text-slate-600 hover:text-slate-900"
                )}
              >
                {tab.label}
              </Link>
            );
          })}
        </nav>
      </header>
      {children}
    </>
  );
}

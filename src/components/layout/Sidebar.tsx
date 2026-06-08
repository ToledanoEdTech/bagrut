"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { prefetchAllRoutes, prefetchRoute } from "@/lib/api-cache";
import clsx from "clsx";
import {
  LayoutDashboard,
  Users,
  School,
  BookOpen,
  ClipboardList,
  Upload,
  LogOut,
  GraduationCap,
  Route,
  UserCog,
} from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import type { Role } from "@/lib/types";
import { canImportStudents, canManageStructure } from "@/lib/roles";

const allStaffLinks = [
  { href: "/admin", label: "דשבורד", icon: LayoutDashboard, adminOnly: false },
  { href: "/admin/students", label: "תלמידים", icon: Users, adminOnly: false },
  { href: "/admin/classes", label: "כיתות ותוכניות", icon: School, adminOnly: true },
  { href: "/admin/subjects", label: "מקצועות וחובות", icon: BookOpen, adminOnly: true },
  { href: "/admin/grades", label: "הזנת ציונים", icon: ClipboardList, adminOnly: false },
  { href: "/admin/import", label: "ייבוא תלמידים", icon: Upload, adminOnly: true },
  { href: "/admin/staff", label: "צוות מורים", icon: UserCog, adminOnly: true },
];

export function Sidebar({ role }: { role: Role }) {
  const pathname = usePathname();
  const { signOut, session } = useAuth();

  const links =
    role === "STUDENT"
      ? [{ href: "/student", label: "הדשבורד שלי", icon: GraduationCap }]
      : allStaffLinks.filter((l) => {
          if (l.adminOnly && role === "TEACHER") return false;
          if (l.href === "/admin/import" && !canImportStudents(role)) return false;
          if (
            (l.href === "/admin/classes" || l.href === "/admin/subjects") &&
            !canManageStructure(role)
          )
            return false;
          return true;
        });

  useEffect(() => {
    const timer = setTimeout(() => prefetchAllRoutes(links.map((l) => l.href)), 300);
    return () => clearTimeout(timer);
  }, [links]);

  return (
    <aside className="fixed inset-y-0 right-0 z-30 flex w-64 flex-col border-l border-slate-200 bg-white">
      <div className="flex items-center gap-3 border-b border-slate-100 px-6 py-5">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-600 text-white">
          <Route className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-sm font-bold text-slate-900">מעקב בגרות</h1>
          <p className="text-xs text-slate-500">ישיבה תיכונית צביה</p>
        </div>
      </div>

      {session && (
        <div className="border-b border-slate-100 px-6 py-3">
          <p className="truncate text-sm font-medium text-slate-800">{session.name}</p>
          <p className="truncate text-xs text-slate-400" dir="ltr">
            {session.email}
          </p>
          <span className="badge-info mt-1">
            {role === "ADMIN" ? "מנהל" : role === "TEACHER" ? "מורה" : "תלמיד"}
          </span>
        </div>
      )}

      <nav className="flex-1 space-y-1 p-4">
        {links.map((link) => {
          const active = pathname === link.href || pathname.startsWith(link.href + "/");
          const Icon = link.icon;
          return (
            <Link
              key={link.href}
              href={link.href}
              prefetch
              onMouseEnter={() => prefetchRoute(link.href)}
              onFocus={() => prefetchRoute(link.href)}
              className={clsx(
                "flex items-center gap-3 rounded-xl px-4 py-2.5 text-sm font-medium transition",
                active
                  ? "bg-primary-50 text-primary-700"
                  : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
              )}
            >
              <Icon className="h-4 w-4" />
              {link.label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-slate-100 p-4">
        <button
          onClick={() => signOut()}
          className="flex w-full items-center gap-3 rounded-xl px-4 py-2.5 text-sm font-medium text-slate-600 transition hover:bg-red-50 hover:text-red-600"
        >
          <LogOut className="h-4 w-4" />
          התנתקות
        </button>
      </div>
    </aside>
  );
}

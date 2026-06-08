"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { motion } from "framer-motion";
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
  UserCog,
  X,
} from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import { SiteLogos } from "@/components/ui/SiteLogos";
import type { Role } from "@/lib/types";
import { canImportStudents, canManageStructure } from "@/lib/roles";

const allStaffLinks = [
  { href: "/admin", label: "דשבורד", icon: LayoutDashboard, adminOnly: false, exact: true },
  { href: "/admin/students", label: "תלמידים", icon: Users, adminOnly: false },
  { href: "/admin/classes", label: "כיתות ותוכניות", icon: School, adminOnly: true },
  { href: "/admin/subjects", label: "מקצועות וחובות", icon: BookOpen, adminOnly: true },
  { href: "/admin/grades", label: "הזנת ציונים", icon: ClipboardList, adminOnly: false },
  { href: "/admin/import", label: "ייבוא תלמידים", icon: Upload, adminOnly: true },
  { href: "/admin/staff", label: "צוות מורים", icon: UserCog, adminOnly: true },
];

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0]![0]! + parts[1]![0]!).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

export function Sidebar({
  role,
  mobileOpen = false,
  onMobileClose,
}: {
  role: Role;
  mobileOpen?: boolean;
  onMobileClose?: () => void;
}) {
  const pathname = usePathname();
  const { signOut, session } = useAuth();

  const links =
    role === "STUDENT"
      ? [{ href: "/student", label: "הדשבורד שלי", icon: GraduationCap, exact: true }]
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
    const timer = setTimeout(() => prefetchAllRoutes(links.map((l) => l.href)), 0);
    return () => clearTimeout(timer);
  }, [links]);

  useEffect(() => {
    onMobileClose?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  const roleLabel =
    role === "ADMIN" ? "מנהל" : role === "TEACHER" ? "מורה" : "תלמיד";

  return (
    <aside
      className={clsx(
        "fixed inset-y-0 right-0 z-50 flex w-72 flex-col border-l border-slate-200 bg-white shadow-lg transition-transform duration-200 lg:shadow-none",
        mobileOpen ? "translate-x-0" : "translate-x-full lg:translate-x-0"
      )}
    >
      <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-4">
        <SiteLogos size="header" className="min-w-0 flex-1" />
        <button
          type="button"
          onClick={onMobileClose}
          className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 lg:hidden"
          aria-label="סגור תפריט"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {session && (
        <div className="border-b border-slate-100 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-100 text-sm font-bold text-primary-700">
              {getInitials(session.name)}
            </div>
            <div className="min-w-0">
              <p className="truncate text-base font-medium text-slate-800">{session.name}</p>
              <p className="truncate text-caption" dir="ltr">
                {session.email}
              </p>
              <span className="badge-info mt-1">{roleLabel}</span>
            </div>
          </div>
        </div>
      )}

      <nav className="flex-1 space-y-1 p-4">
        {links.map((link) => {
          const active =
            "exact" in link && link.exact
              ? pathname === link.href
              : pathname === link.href || pathname.startsWith(link.href + "/");
          const Icon = link.icon;
          return (
            <Link
              key={link.href}
              href={link.href}
              prefetch
              onMouseEnter={() => prefetchRoute(link.href)}
              onFocus={() => prefetchRoute(link.href)}
              className={clsx(
                "relative flex items-center gap-3 rounded-xl px-4 py-2.5 text-base font-medium transition",
                active
                  ? "border-l-2 border-primary-600 bg-primary-50 pl-[14px] font-semibold text-primary-700"
                  : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
              )}
            >
              {active && (
                <motion.div
                  layoutId="sidebarActive"
                  className="absolute inset-0 -z-10 rounded-xl bg-primary-50"
                  transition={{ type: "spring", stiffness: 400, damping: 30 }}
                />
              )}
              <Icon className="h-5 w-5" />
              {link.label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-slate-100 p-4">
        <button
          onClick={() => signOut()}
          className="flex w-full items-center gap-3 rounded-xl px-4 py-2.5 text-base font-medium text-slate-600 transition hover:bg-red-50 hover:text-red-600 active:scale-[0.98]"
        >
          <LogOut className="h-5 w-5" />
          התנתקות
        </button>
      </div>
    </aside>
  );
}

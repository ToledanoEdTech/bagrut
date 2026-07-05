"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { motion } from "framer-motion";
import { prefetchRoute } from "@/lib/api-cache";
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
  Bell,
  X,
  Award,
  CalendarDays,
} from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import { SiteLogos } from "@/components/ui/SiteLogos";
import type { Role } from "@/lib/types";
import { canImportStudents, canManageStructure } from "@/lib/roles";
import { hasAnyGradeWrite, hasAnyStudentView, canViewOutstandingBagrut } from "@/lib/permissions";

type NavLink = {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  exact?: boolean;
};

const dailyWorkLinks: NavLink[] = [
  { href: "/admin", label: "דשבורד", icon: LayoutDashboard, exact: true },
  { href: "/admin/students", label: "תלמידים", icon: Users },
  { href: "/admin/outstanding-bagrut", label: "בגרות מצטיינת", icon: Award },
  { href: "/admin/grades", label: "הזנת ציונים", icon: ClipboardList },
];

const managementLinks: NavLink[] = [
  { href: "/admin/classes", label: "כיתות ותוכניות", icon: School },
  { href: "/admin/subjects", label: "מקצועות וחובות", icon: BookOpen },
  { href: "/admin/obligations", label: "לוח מטלות וציונים", icon: CalendarDays },
  { href: "/admin/import", label: "ייבוא תלמידים", icon: Upload },
  { href: "/admin/staff", label: "צוות והרשאות", icon: UserCog },
  { href: "/admin/settings", label: "תזכורות ציונים", icon: Bell },
];

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0]![0]! + parts[1]![0]!).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

function NavSection({
  title,
  links,
  pathname,
}: {
  title: string;
  links: NavLink[];
  pathname: string;
}) {
  if (links.length === 0) return null;

  return (
    <div className="space-y-1">
      <p className="px-3 pb-1 pt-3 text-xs font-semibold text-slate-400">{title}</p>
      {links.map((link) => {
        const active =
          link.exact
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
              "group relative flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-base font-medium transition-all duration-200",
              active
                ? "text-primary-700"
                : "text-slate-600 hover:bg-slate-100/70 hover:text-slate-900"
            )}
          >
            {active && (
              <motion.div
                layoutId="sidebarActive"
                className="absolute inset-0 -z-10 rounded-xl bg-gradient-to-l from-primary-50 to-brand-50 ring-1 ring-inset ring-primary-100"
                transition={{ type: "spring", stiffness: 400, damping: 32 }}
              />
            )}
            {active && (
              <span className="absolute inset-y-2 right-0 w-1 rounded-full bg-gradient-to-b from-primary-500 to-brand-600" />
            )}
            <span
              className={clsx(
                "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg transition-all duration-200",
                active
                  ? "bg-white text-primary-600 shadow-soft"
                  : "text-slate-400 group-hover:text-slate-600"
              )}
            >
              <Icon className="h-5 w-5" />
            </span>
            <span className={clsx(active && "font-semibold")}>{link.label}</span>
          </Link>
        );
      })}
    </div>
  );
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

  const studentLinks: NavLink[] =
    role === "STUDENT"
      ? [{ href: "/student", label: "הדשבורד שלי", icon: GraduationCap, exact: true }]
      : [];

  const filteredDaily =
    role === "STUDENT"
      ? []
      : dailyWorkLinks.filter((l) => {
          if (l.href === "/admin/grades" && session && !hasAnyGradeWrite(session)) return false;
          if (
            (l.href === "/admin/students" || l.href === "/admin/outstanding-bagrut") &&
            session &&
            !hasAnyStudentView(session)
          )
            return false;
          if (
            l.href === "/admin/outstanding-bagrut" &&
            session &&
            !canViewOutstandingBagrut(session)
          )
            return false;
          return true;
        });

  const filteredManagement =
    role === "STUDENT" || role === "TEACHER"
      ? []
      : managementLinks.filter((l) => {
          if (l.href === "/admin/import" && session && !canImportStudents(role)) return false;
          if (
            (l.href === "/admin/classes" ||
              l.href === "/admin/subjects" ||
              l.href === "/admin/obligations") &&
            !canManageStructure(role)
          )
            return false;
          if (l.href === "/admin/settings" && role !== "ADMIN") return false;
          return true;
        });

  useEffect(() => {
    prefetchRoute(pathname);
  }, [pathname]);

  useEffect(() => {
    onMobileClose?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  const roleLabel =
    role === "ADMIN" ? "מנהל" : role === "TEACHER" ? "מורה" : "תלמיד";

  return (
    <aside
      className={clsx(
        "fixed inset-y-0 right-0 z-50 flex w-72 flex-col border-l border-slate-200/70 bg-white/85 shadow-xl backdrop-blur-xl transition-transform duration-300 ease-out lg:shadow-none",
        mobileOpen ? "translate-x-0" : "translate-x-full lg:translate-x-0"
      )}
    >
      <div className="relative flex items-center justify-between gap-3 overflow-hidden border-b border-slate-100 px-4 py-4">
        <div className="absolute inset-0 bg-gradient-to-l from-primary-50 via-white to-brand-50/60" />
        <SiteLogos size="header" className="relative min-w-0 flex-1" />
        <button
          type="button"
          onClick={onMobileClose}
          className="relative rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 lg:hidden"
          aria-label="סגור תפריט"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {session && (
        <div className="px-4 pt-4">
          <div className="flex items-center gap-3 rounded-2xl border border-slate-100 bg-gradient-to-bl from-slate-50 to-white p-3 shadow-soft">
            <div className="relative flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary-600 to-brand-600 text-sm font-bold text-white shadow-glow">
              {getInitials(session.name)}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold text-slate-800">{session.name}</p>
              <p className="truncate text-xs text-slate-400" dir="ltr">
                {session.email}
              </p>
            </div>
            <span className="badge-info shrink-0">{roleLabel}</span>
          </div>
        </div>
      )}

      <nav className="flex-1 overflow-y-auto p-4">
        {role === "STUDENT" ? (
          <NavSection title="תפריט" links={studentLinks} pathname={pathname} />
        ) : (
          <>
            <NavSection title="עבודה יומית" links={filteredDaily} pathname={pathname} />
            {filteredManagement.length > 0 && (
              <NavSection title="ניהול" links={filteredManagement} pathname={pathname} />
            )}
          </>
        )}
      </nav>

      <div className="border-t border-slate-100 p-4">
        <button
          onClick={() => signOut()}
          className="flex w-full items-center gap-3 rounded-xl px-3.5 py-2.5 text-base font-medium text-slate-600 transition-all duration-200 hover:bg-red-50 hover:text-red-600 active:scale-[0.98]"
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-400 transition group-hover:text-red-500">
            <LogOut className="h-5 w-5" />
          </span>
          התנתקות
        </button>
      </div>
    </aside>
  );
}

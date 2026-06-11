"use client";

import { StatCardGrid } from "@/components/ui/StatCardGrid";
import { PageHeader } from "@/components/ui/PageHeader";
import { PageLoader } from "@/components/ui/PageLoader";
import { Card } from "@/components/ui/Card";
import clsx from "clsx";
import {
  Users,
  BookOpen,
  Upload,
  ClipboardList,
  Target,
  Sparkles,
  AlertTriangle,
  ChevronLeft,
} from "lucide-react";
import Link from "next/link";
import { useAuth } from "@/components/AuthProvider";
import { useApi } from "@/hooks/useApi";
import { canImportStudents, canManageStructure } from "@/lib/roles";
import { hasAnyGradeWrite, hasAnyStudentEdit, hasAnyStudentView } from "@/lib/permissions";

type DashboardData = {
  counts: {
    students: number;
    classes: number;
    subjects: number;
    paths: number;
    obligations: number;
    gradedCount: number;
  };
  paths: Array<{ id: string; label: string; key: string }>;
};

export default function AdminDashboard() {
  const { session } = useAuth();
  const { data, loading } = useApi<DashboardData>("/api/admin/dashboard");

  if (loading && !data) {
    return <PageLoader />;
  }

  if (!data) {
    return <div className="text-center text-base text-slate-500">שגיאה בטעינת הנתונים</div>;
  }

  const { counts, paths } = data;
  const isAdmin = session?.role === "ADMIN";
  const canGrades = session ? hasAnyGradeWrite(session) : false;
  const canStudents = session ? hasAnyStudentView(session) : false;
  const canEditStudents = session ? hasAnyStudentEdit(session) : false;

  const ungradedEstimate = Math.max(
    0,
    counts.obligations * counts.students - counts.gradedCount
  );

  const quickActions = [
    isAdmin && session && canImportStudents(session.role)
      ? {
          href: "/admin/import",
          label: "ייבוא תלמידים מאקסל",
          icon: Upload,
          variant: "primary" as const,
          fullWidth: true,
        }
      : null,
    canGrades
      ? {
          href: "/admin/grades",
          label: "הזנת ציונים",
          icon: ClipboardList,
          variant: "secondary" as const,
        }
      : null,
    isAdmin && session && canManageStructure(session.role)
      ? {
          href: "/admin/subjects",
          label: "מקצועות וחובות",
          icon: BookOpen,
          variant: "secondary" as const,
        }
      : null,
    canStudents
      ? {
          href: "/admin/students",
          label: canEditStudents ? "עריכת תלמידים" : "תלמידים",
          icon: Users,
          variant: "secondary" as const,
        }
      : null,
  ].filter(Boolean) as Array<{
    href: string;
    label: string;
    icon: typeof Users;
    variant: "primary" | "secondary";
    fullWidth?: boolean;
  }>;

  return (
    <>
      <PageHeader
        variant="gradient"
        title={session?.role === "TEACHER" ? "דשבורד מורה" : "דשבורד מנהל"}
        subtitle="סקירה כללית של מערכת מעקב הבגרות"
      />

      <div className="mt-8">
        <StatCardGrid
          items={[
            { title: "תלמידים", value: counts.students, icon: "users", color: "primary" },
            { title: "כיתות", value: counts.classes, icon: "school", color: "info" },
            {
              title: "מקצועות",
              value: counts.subjects,
              subtitle: `${counts.obligations} חובות`,
              icon: "book-open",
              color: "success",
            },
            {
              title: "ציונים שהוזנו",
              value: counts.gradedCount,
              icon: "clipboard-check",
              color: "warning",
            },
          ]}
        />
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-3">
        <Card className="p-6 lg:col-span-1">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 text-amber-600 ring-1 ring-inset ring-amber-100">
              <AlertTriangle className="h-5 w-5" />
            </span>
            <div>
              <h2 className="text-h2 text-slate-900">דורש טיפול</h2>
              <p className="text-sm text-slate-500">פריטים שדורשים תשומת לב</p>
            </div>
          </div>
          <ul className="mt-5 space-y-2 text-sm">
            <li className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3">
              <span className="text-slate-600">חובות ללא ציון (משוער)</span>
              <span className="font-bold text-amber-700">{ungradedEstimate}</span>
            </li>
            <li className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3">
              <span className="text-slate-600">תוכניות חובה</span>
              <span className="font-bold text-slate-800">{counts.paths}</span>
            </li>
          </ul>
        </Card>

        <Card className="p-6 lg:col-span-1">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-50 text-primary-600 ring-1 ring-inset ring-primary-100">
              <Target className="h-5 w-5" />
            </span>
            <div>
              <h2 className="text-h2 text-slate-900">תוכניות חובה</h2>
              <p className="text-sm text-slate-500">{counts.paths} תוכניות מוגדרות</p>
            </div>
          </div>
          <div className="mt-5 space-y-2">
            {paths.map((p) => (
              <Link
                key={p.id}
                href="/admin/subjects"
                className="group flex items-center gap-3 rounded-xl border border-transparent bg-slate-50 px-4 py-3 transition hover:border-primary-100 hover:bg-white hover:shadow-soft"
              >
                <span className="h-2 w-2 shrink-0 rounded-full bg-gradient-to-l from-primary-500 to-brand-500" />
                <span className="min-w-0 flex-1 text-base font-medium text-slate-700 group-hover:text-slate-900">
                  {p.label}
                </span>
                <ChevronLeft className="h-4 w-4 shrink-0 text-slate-300 group-hover:text-primary-500" />
              </Link>
            ))}
          </div>
        </Card>

        <Card className="p-6 lg:col-span-1">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-600 ring-1 ring-inset ring-brand-100">
              <Sparkles className="h-5 w-5" />
            </span>
            <h2 className="text-h2 text-slate-900">פעולות מהירות</h2>
          </div>
          <div className="mt-5 grid grid-cols-2 gap-3">
            {quickActions.map((action) => {
              const Icon = action.icon;
              return (
                <Link
                  key={action.href}
                  href={action.href}
                  className={clsx(
                    "w-full",
                    action.fullWidth && "col-span-2",
                    action.variant === "primary" ? "btn-primary" : "btn-secondary"
                  )}
                >
                  <Icon className="h-5 w-5" />
                  {action.label}
                </Link>
              );
            })}
          </div>
        </Card>
      </div>
    </>
  );
}

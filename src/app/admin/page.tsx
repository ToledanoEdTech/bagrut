"use client";

import { StatCardGrid } from "@/components/ui/StatCardGrid";
import { PageHeader } from "@/components/ui/PageHeader";
import { PageLoader } from "@/components/ui/PageLoader";
import { Users, BookOpen, Upload, ClipboardList, Target, Sparkles } from "lucide-react";
import Link from "next/link";
import clsx from "clsx";
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

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <div className="card p-6">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-50 text-primary-600 ring-1 ring-inset ring-primary-100">
              <Target className="h-5 w-5" />
            </span>
            <div>
              <h2 className="text-h2 text-slate-900">תוכניות חובה</h2>
              <p className="text-sm text-slate-500">
                {counts.paths} תוכניות מוגדרות
              </p>
            </div>
          </div>
          <div className="mt-5 space-y-2">
            {paths.map((p) => (
              <div
                key={p.id}
                className="group flex items-center gap-3 rounded-xl border border-transparent bg-slate-50 px-4 py-3 transition hover:border-primary-100 hover:bg-white hover:shadow-soft"
              >
                <span className="h-2 w-2 shrink-0 rounded-full bg-gradient-to-l from-primary-500 to-brand-500" />
                <span className="text-base font-medium text-slate-700 group-hover:text-slate-900">
                  {p.label}
                </span>
              </div>
            ))}
          </div>
        </div>

        <div className="card p-6">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-50 text-brand-600 ring-1 ring-inset ring-brand-100">
              <Sparkles className="h-5 w-5" />
            </span>
            <h2 className="text-h2 text-slate-900">פעולות מהירות</h2>
          </div>
          <div className="mt-5 grid grid-cols-2 gap-3">
            {isAdmin && session && canImportStudents(session.role) && (
              <Link
                href="/admin/import"
                className={clsx("btn-primary col-span-2 px-5 py-3 text-base")}
              >
                <Upload className="h-5 w-5" />
                ייבוא תלמידים מאקסל
              </Link>
            )}
            {canGrades && (
              <Link href="/admin/grades" className="btn-secondary px-5 py-3 text-base">
                <ClipboardList className="h-5 w-5" />
                הזנת ציונים
              </Link>
            )}
            {isAdmin && session && canManageStructure(session.role) ? (
              <>
                <Link href="/admin/subjects" className="btn-secondary px-5 py-3 text-base">
                  <BookOpen className="h-5 w-5" />
                  מקצועות וחובות
                </Link>
                {canStudents && (
                  <Link href="/admin/students" className="btn-secondary px-5 py-3 text-base">
                    <Users className="h-5 w-5" />
                    {canEditStudents ? "עריכת תלמידים" : "תלמידים"}
                  </Link>
                )}
              </>
            ) : (
              canStudents && (
                <Link href="/admin/students" className="btn-secondary px-5 py-3 text-base">
                  <Users className="h-5 w-5" />
                  צפייה בתלמידים
                </Link>
              )
            )}
          </div>
        </div>
      </div>
    </>
  );
}

"use client";

import { StatCardGrid } from "@/components/ui/StatCardGrid";
import { PageHeader } from "@/components/ui/PageHeader";
import { PageLoader } from "@/components/ui/PageLoader";
import { Users, BookOpen, Upload, ClipboardList } from "lucide-react";
import Link from "next/link";
import clsx from "clsx";
import { useAuth } from "@/components/AuthProvider";
import { useApi } from "@/hooks/useApi";
import { canImportStudents, canManageStructure } from "@/lib/roles";

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
          <h2 className="text-h2 text-slate-900">תוכניות חובה</h2>
          <p className="mt-1 text-base text-slate-500">
            {counts.paths} תוכניות חובה מוגדרות (מתמטיקה, אנגלית ומגמות נקבעים לפי תלמיד)
          </p>
          <div className="mt-4 space-y-2">
            {paths.map((p) => (
              <div
                key={p.id}
                className="rounded-xl bg-slate-50 px-4 py-3 transition hover:bg-white hover:shadow-sm"
              >
                <span className="text-base font-medium">{p.label}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="card p-6">
          <h2 className="text-h2 text-slate-900">פעולות מהירות</h2>
          <div className="mt-4 grid grid-cols-2 gap-3">
            {isAdmin && session && canImportStudents(session.role) && (
              <Link
                href="/admin/import"
                className={clsx("btn-primary col-span-2 px-5 py-3 text-base")}
              >
                <Upload className="h-5 w-5" />
                ייבוא תלמידים מאקסל
              </Link>
            )}
            <Link href="/admin/grades" className="btn-secondary px-5 py-3 text-base">
              <ClipboardList className="h-5 w-5" />
              הזנת ציונים
            </Link>
            {isAdmin && session && canManageStructure(session.role) ? (
              <>
                <Link href="/admin/subjects" className="btn-secondary px-5 py-3 text-base">
                  <BookOpen className="h-5 w-5" />
                  מקצועות וחובות
                </Link>
                <Link href="/admin/students" className="btn-secondary px-5 py-3 text-base">
                  <Users className="h-5 w-5" />
                  עריכת תלמידים
                </Link>
              </>
            ) : (
              <Link href="/admin/students" className="btn-secondary px-5 py-3 text-base">
                <Users className="h-5 w-5" />
                צפייה בתלמידים
              </Link>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

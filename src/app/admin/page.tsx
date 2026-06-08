import { StatCard } from "@/components/ui/StatCard";
import { Users, School, BookOpen, ClipboardCheck } from "lucide-react";
import Link from "next/link";
import { getAdminDashboardData } from "@/lib/firestore";
import { getAuthSession } from "@/lib/auth-server";
import { canImportStudents, canManageStructure } from "@/lib/roles";

export default async function AdminDashboard() {
  const [session, { counts, paths }] = await Promise.all([
    getAuthSession(),
    getAdminDashboardData(),
  ]);
  const isAdmin = session?.role === "ADMIN";

  return (
    <>
      <header className="-mx-8 -mt-8 border-b border-slate-200 bg-white px-8 py-6">
        <h1 className="text-2xl font-bold text-slate-900">
          {session?.role === "TEACHER" ? "דשבורד מורה" : "דשבורד מנהל"}
        </h1>
        <p className="mt-1 text-sm text-slate-500">סקירה כללית של מערכת מעקב הבגרות</p>
      </header>

      <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard title="תלמידים" value={counts.students} icon={Users} color="primary" />
        <StatCard title="כיתות" value={counts.classes} icon={School} color="info" />
        <StatCard
          title="מקצועות"
          value={counts.subjects}
          subtitle={`${counts.obligations} חובות`}
          icon={BookOpen}
          color="success"
        />
        <StatCard
          title="ציונים שהוזנו"
          value={counts.gradedCount}
          icon={ClipboardCheck}
          color="warning"
        />
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <div className="card p-6">
          <h2 className="text-lg font-semibold text-slate-900">תוכניות חובה</h2>
          <p className="mt-1 text-sm text-slate-500">
            {counts.paths} תוכניות חובה מוגדרות (מתמטיקה, אנגלית ומגמות נקבעים לפי תלמיד)
          </p>
          <div className="mt-4 space-y-2">
            {paths.map((p) => (
              <div
                key={p.id}
                className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3"
              >
                <span className="text-sm font-medium">{p.label}</span>
                <span className="badge-info">{p.key}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="card p-6">
          <h2 className="text-lg font-semibold text-slate-900">פעולות מהירות</h2>
          <div className="mt-4 grid gap-3">
            {isAdmin && canImportStudents(session!.role) && (
              <Link href="/admin/import" className="btn-primary">
                ייבוא תלמידים מאקסל
              </Link>
            )}
            <Link href="/admin/grades" className="btn-secondary">
              הזנת ציונים
            </Link>
            {isAdmin && canManageStructure(session!.role) && (
              <>
                <Link href="/admin/subjects" className="btn-secondary">
                  ניהול מקצועות וחובות
                </Link>
                <Link href="/admin/students" className="btn-secondary">
                  עריכת שיוכי תלמידים
                </Link>
              </>
            )}
            {!isAdmin && (
              <Link href="/admin/students" className="btn-secondary">
                צפייה בתלמידים
              </Link>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

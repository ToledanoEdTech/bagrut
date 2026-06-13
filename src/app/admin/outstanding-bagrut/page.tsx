"use client";

import { Award } from "lucide-react";
import { useApi } from "@/hooks/useApi";
import { useAuth } from "@/components/AuthProvider";
import { PageHeader } from "@/components/ui/PageHeader";
import { PageLoader } from "@/components/ui/PageLoader";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Alert } from "@/components/ui/Alert";
import { OutstandingBagrutBadge } from "@/components/students/OutstandingBagrutBadge";
import { canViewOutstandingBagrut } from "@/lib/permissions";
import type { OutstandingBagrutStudent } from "@/lib/outstanding-bagrut";

type OutstandingBagrutApiData = {
  candidates: OutstandingBagrutStudent[];
  candidateCount: number;
  total: number;
};

export default function OutstandingBagrutPage() {
  const { session } = useAuth();
  const canAccess = session ? canViewOutstandingBagrut(session) : false;
  const { data, loading } = useApi<OutstandingBagrutApiData>(
    canAccess ? "/api/students/outstanding-bagrut" : null
  );

  if (!canAccess) {
    return (
      <>
        <PageHeader title="מועמדים לבגרות מצטיינת" />
        <Alert variant="error" className="mt-6">
          אין הרשאה לצפייה בדף זה
        </Alert>
      </>
    );
  }

  if (loading && !data) {
    return (
      <>
        <PageHeader
          title="מועמדים לבגרות מצטיינת"
          subtitle="תלמידים העומדים בקריטריונים: 5 יח״ל אנגלית, לפחות 4 יח״ל מתמטיקה, ממוצע 90+"
        />
        <div className="mt-8">
          <PageLoader variant="table" />
        </div>
      </>
    );
  }

  const candidates = data?.candidates ?? [];

  return (
    <>
      <PageHeader
        title="מועמדים לבגרות מצטיינת"
        subtitle="תלמידים העומדים בקריטריונים: 5 יח״ל אנגלית, לפחות 4 יח״ל מתמטיקה, ממוצע 90+ בכל המקצועות"
      />

      <div className="mt-6 rounded-2xl border border-amber-100 bg-gradient-to-l from-amber-50/80 to-yellow-50/50 px-5 py-4 text-sm text-amber-900">
        <p className="font-semibold">קריטריונים</p>
        <ul className="mt-2 list-inside list-disc space-y-1 text-amber-800/90">
          <li>5 יחידות לימוד באנגלית</li>
          <li>לפחות 4 יחידות לימוד במתמטיקה</li>
          <li>ממוצע 90 ומעלה בכל המקצועות (מחושב לפי ציונים שהוזנו עד כה)</li>
        </ul>
      </div>

      <div className="mt-6 flex items-center gap-3 text-sm text-slate-600">
        <Award className="h-5 w-5 text-amber-600" />
        <span>
          <strong className="text-slate-900">{candidates.length}</strong> מועמדים מתוך{" "}
          {data?.total ?? 0} תלמידים
        </span>
      </div>

      <div className="mt-6">
        {candidates.length === 0 ? (
          <EmptyState
            icon={Award}
            title="אין מועמדים כרגע"
            description="לא נמצאו תלמידים העומדים בכל הקריטריונים לפי הציונים שהוזנו"
          />
        ) : (
          <Card variant="flat" className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-base">
                <thead className="bg-slate-50/80">
                  <tr className="border-b border-slate-200 text-slate-500">
                    <th className="px-4 py-3 text-right text-xs font-semibold">שם</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold">כיתה</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold">מתמטיקה</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold">אנגלית</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold">ממוצע</th>
                    <th className="px-4 py-3 text-center text-xs font-semibold">מקצועות עם ציון</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {candidates.map((item) => (
                    <tr
                      key={item.studentId}
                      className="transition-colors even:bg-slate-50/40 hover:bg-amber-50/30"
                    >
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-semibold text-slate-800">{item.name}</span>
                          <OutstandingBagrutBadge size="sm" />
                        </div>
                        <p className="mt-0.5 text-xs text-slate-400" dir="ltr">
                          {item.email}
                        </p>
                      </td>
                      <td className="px-4 py-3 text-slate-600">
                        {item.className}
                        {item.gradeYear ? ` · ${item.gradeYear}` : ""}
                      </td>
                      <td className="px-4 py-3 text-center tabular-nums">{item.mathUnits}</td>
                      <td className="px-4 py-3 text-center tabular-nums">{item.englishUnits}</td>
                      <td className="px-4 py-3 text-center font-bold tabular-nums text-emerald-700">
                        {item.outstandingBagrut.average?.toFixed(1) ?? "—"}
                      </td>
                      <td className="px-4 py-3 text-center tabular-nums text-slate-600">
                        {item.outstandingBagrut.gradedSubjectsCount}/
                        {item.outstandingBagrut.totalSubjectsCount}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </div>
    </>
  );
}

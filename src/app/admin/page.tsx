"use client";



import { useState } from "react";

import { StatCardGrid } from "@/components/ui/StatCardGrid";

import { PageHeader } from "@/components/ui/PageHeader";

import { PageLoader } from "@/components/ui/PageLoader";

import { Card } from "@/components/ui/Card";

import { ProgressBar } from "@/components/ui/ProgressBar";

import { EmptyState } from "@/components/ui/EmptyState";

import { Alert } from "@/components/ui/Alert";

import { OutstandingBagrutBadge } from "@/components/students/OutstandingBagrutBadge";

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

  Award,

  TrendingUp,

  School,

  Bell,

  ChevronDown,

  UserCog,

  Grid3X3,

  Settings,

} from "lucide-react";

import Link from "next/link";

import { useAuth } from "@/components/AuthProvider";

import { useApi } from "@/hooks/useApi";

import { canImportStudents, canManageStructure } from "@/lib/roles";

import {

  hasAnyGradeWrite,

  hasAnyStudentEdit,

  hasAnyStudentView,

  canViewOutstandingBagrut,

  isFullAdmin,

} from "@/lib/permissions";

import type {

  AdminDashboardResponse,

  DataQualityAlerts,

  GradeGaps,

  GradeRemindersSummary,

  OutstandingBagrutPreview,

  SchoolProgress,

} from "@/lib/admin-dashboard";



function GapLinkRow({

  href,

  label,

  value,

  variant = "default",

}: {

  href: string;

  label: string;

  value: number;

  variant?: "default" | "danger" | "warning";

}) {

  const bg =

    variant === "danger"

      ? "bg-red-50 hover:bg-red-100/80"

      : variant === "warning"

        ? "bg-amber-50 hover:bg-amber-100/80"

        : "bg-slate-50 hover:bg-slate-100/80";

  const text =

    variant === "danger"

      ? "text-red-700"

      : variant === "warning"

        ? "text-amber-700"

        : "text-slate-800";



  return (

    <li>

      <Link

        href={href}

        className={clsx(

          "flex items-center justify-between rounded-xl px-4 py-3 transition",

          bg

        )}

      >

        <span className="text-slate-600">{label}</span>

        <span className={clsx("font-bold", text)}>{value}</span>

      </Link>

    </li>

  );

}



function SchoolProgressCard({ progress }: { progress: SchoolProgress }) {

  return (

    <Card className="p-6">

      <div className="flex items-center gap-3">

        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600 ring-1 ring-inset ring-emerald-100">

          <TrendingUp className="h-5 w-5" />

        </span>

        <div>

          <h2 className="text-h2 text-slate-900">התקדמות כללית</h2>

          <p className="text-sm text-slate-500">

            {progress.gradedObligationsCount} מתוך {progress.totalRelevantObligationsCount} חובות

            הושלמו

          </p>

        </div>

      </div>

      <div className="mt-5">

        <div className="flex justify-between text-sm">

          <span className="text-slate-600">אחוז השלמה</span>

          <span className="font-bold text-slate-900">

            {progress.overallCompletionPercent}%

          </span>

        </div>

        <ProgressBar

          value={progress.overallCompletionPercent}

          className="mt-2 h-3"

          color="success"

        />

      </div>

      {progress.estimatedAverage != null && (

        <p className="mt-4 text-sm text-slate-600">

          ממוצע משוער:{" "}

          <span className="font-bold text-slate-900">

            {progress.estimatedAverage.toFixed(1)}

          </span>

        </p>

      )}

    </Card>

  );

}



function ClassSummaryCard({ byClass }: { byClass: GradeGaps["byClass"] }) {

  return (

    <Card className="p-6">

      <div className="flex items-center gap-3">

        <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-50 text-sky-600 ring-1 ring-inset ring-sky-100">

          <School className="h-5 w-5" />

        </span>

        <div>

          <h2 className="text-h2 text-slate-900">סיכום לפי כיתה</h2>

          <p className="text-sm text-slate-500">כיתות עם הכי הרבה חובות חסרות</p>

        </div>

      </div>

      {byClass.length === 0 ? (

        <EmptyState

          title="אין נתונים"

          description="לא נמצאו כיתות בטווח ההרשאות"

          className="mt-5 py-8"

        />

      ) : (

        <div className="mt-5 overflow-x-auto">

          <table className="w-full text-sm">

            <thead>

              <tr className="border-b border-slate-100 text-slate-500">

                <th className="pb-2 text-start font-medium">כיתה</th>

                <th className="pb-2 text-center font-medium">תלמידים</th>

                <th className="pb-2 text-center font-medium">השלמה</th>

                <th className="pb-2 text-center font-medium">חסרים</th>

              </tr>

            </thead>

            <tbody>

              {byClass.map((row) => (

                <tr

                  key={row.classId}

                  className="border-b border-slate-50 last:border-0"

                >

                  <td className="py-2.5">

                    <Link

                      href="/admin/classes"

                      className="font-medium text-slate-800 hover:text-primary-600"

                    >

                      {row.className}

                    </Link>

                  </td>

                  <td className="py-2.5 text-center text-slate-600">{row.studentCount}</td>

                  <td className="py-2.5 text-center">

                    <span

                      className={clsx(

                        "font-medium",

                        row.completionPercent >= 80

                          ? "text-emerald-700"

                          : row.completionPercent >= 50

                            ? "text-amber-700"

                            : "text-red-700"

                      )}

                    >

                      {row.completionPercent}%

                    </span>

                  </td>

                  <td className="py-2.5 text-center font-bold text-amber-700">

                    {row.missingCount}

                  </td>

                </tr>

              ))}

            </tbody>

          </table>

        </div>

      )}

    </Card>

  );

}



function OutstandingPreviewCard({ preview }: { preview: OutstandingBagrutPreview }) {

  return (

    <Card className="p-6">

      <div className="flex items-center justify-between gap-3">

        <div className="flex items-center gap-3">

          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 text-amber-600 ring-1 ring-inset ring-amber-100">

            <Award className="h-5 w-5" />

          </span>

          <div>

            <h2 className="text-h2 text-slate-900">בגרות מצטיינת</h2>

            <p className="text-sm text-slate-500">

              {preview.candidateCount} מועמדים
              {preview.greenCount > 0 && ` · ${preview.greenCount} ירוק`}
              {preview.yellowCount > 0 && ` · ${preview.yellowCount} צהוב`}
              {preview.redCount > 0 && ` · ${preview.redCount} אדום`}

            </p>

          </div>

        </div>

        <Link

          href="/admin/outstanding-bagrut"

          className="text-sm font-medium text-primary-600 hover:text-primary-700"

        >

          הכל

        </Link>

      </div>

      {preview.topCandidates.length === 0 ? (

        <p className="mt-5 text-sm text-slate-500">אין מועמדים כרגע</p>

      ) : (

        <ul className="mt-5 space-y-2">

          {preview.topCandidates.map((c) => (

            <li

              key={c.studentId}

              className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3"

            >

              <div className="min-w-0">

                <p className="truncate font-medium text-slate-800">{c.name}</p>

                <p className="text-xs text-slate-500">{c.className}</p>

              </div>

              <div className="flex shrink-0 items-center gap-2">

                <span
                  className={
                    c.tier === "green"
                      ? "font-bold text-emerald-700"
                      : c.tier === "yellow"
                        ? "font-bold text-amber-700"
                        : "font-bold text-red-700"
                  }
                >
                  {c.average.toFixed(1)}
                </span>

                <OutstandingBagrutBadge size="sm" tier={c.tier} />

              </div>

            </li>

          ))}

        </ul>

      )}

    </Card>

  );

}



function GradeRemindersCard({ summary }: { summary: GradeRemindersSummary }) {

  return (

    <Card className="p-6">

      <div className="flex items-center justify-between gap-3">

        <div className="flex items-center gap-3">

          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-50 text-primary-600 ring-1 ring-inset ring-primary-100">

            <Bell className="h-5 w-5" />

          </span>

          <div>

            <h2 className="text-h2 text-slate-900">תזכורות ציונים</h2>

            <p className="text-sm text-slate-500">

              {summary.enabled ? "פעיל" : "כבוי"}

              {summary.lastRunAt && (

                <span className="text-slate-400">

                  {" "}

                  · ריצה אחרונה:{" "}

                  {new Date(summary.lastRunAt).toLocaleDateString("he-IL")}

                </span>

              )}

            </p>

          </div>

        </div>

        <Link href="/admin/settings" className="btn-secondary px-3 py-1.5 text-sm">

          <Settings className="h-4 w-4" />

          הגדרות

        </Link>

      </div>

      <ul className="mt-5 space-y-2 text-sm">

        <li className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3">

          <span className="text-slate-600">פריטים באיחור</span>

          <span className="font-bold text-red-700">{summary.overdueCount}</span>

        </li>

        <li className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3">

          <span className="text-slate-600">יישלחו תזכורות היום</span>

          <span className="font-bold text-slate-800">{summary.wouldNotifyCount}</span>

        </li>

      </ul>

    </Card>

  );

}



function DataQualitySection({ alerts }: { alerts: DataQualityAlerts }) {

  const [open, setOpen] = useState(true);

  const total =

    alerts.studentsWithoutClass +

    alerts.classesWithoutStudents +

    alerts.subjectsWithoutObligations +

    alerts.obligationsWithoutDueDate;



  if (total === 0) return null;



  const items = [

    alerts.studentsWithoutClass > 0 && {

      label: "תלמידים ללא כיתה",

      count: alerts.studentsWithoutClass,

      href: "/admin/students",

    },

    alerts.classesWithoutStudents > 0 && {

      label: "כיתות ללא תלמידים",

      count: alerts.classesWithoutStudents,

      href: "/admin/classes",

    },

    alerts.subjectsWithoutObligations > 0 && {

      label: "מקצועות ללא חובות",

      count: alerts.subjectsWithoutObligations,

      href: "/admin/subjects",

    },

    alerts.obligationsWithoutDueDate > 0 && {

      label: "חובות ללא תאריך יעד",

      count: alerts.obligationsWithoutDueDate,

      href: "/admin/subjects",

    },

  ].filter(Boolean) as Array<{ label: string; count: number; href: string }>;



  return (

    <Card className="p-6 lg:col-span-3">

      <button

        type="button"

        onClick={() => setOpen((v) => !v)}

        className="flex w-full items-center justify-between gap-3 text-start"

      >

        <Alert variant="warning" className="flex-1 border-0 p-0">

          <span>

            {total} בעיות איכות נתונים זוהו — לחץ לפרטים

          </span>

        </Alert>

        <ChevronDown

          className={clsx(

            "h-5 w-5 shrink-0 text-slate-400 transition",

            open && "rotate-180"

          )}

        />

      </button>

      {open && (

        <ul className="mt-4 space-y-2 text-sm">

          {items.map((item) => (

            <li key={item.label}>

              <Link

                href={item.href}

                className="flex items-center justify-between rounded-xl bg-amber-50 px-4 py-3 hover:bg-amber-100/80"

              >

                <span className="text-amber-900">{item.label}</span>

                <span className="font-bold text-amber-700">{item.count}</span>

              </Link>

            </li>

          ))}

        </ul>

      )}

    </Card>

  );

}



export default function AdminDashboard() {

  const { session } = useAuth();

  const canStudents = session ? hasAnyStudentView(session) : false;

  const canOutstandingBagrut = session ? canViewOutstandingBagrut(session) : false;

  const { data, loading } = useApi<AdminDashboardResponse>("/api/admin/dashboard");



  if (loading && !data) {

    return <PageLoader />;

  }



  if (!data) {

    return <div className="text-center text-base text-slate-500">שגיאה בטעינת הנתונים</div>;

  }



  const {

    counts,

    paths,

    gradeGaps,

    schoolProgress,

    outstandingBagrutPreview,

    gradeRemindersSummary,

    teacherAlerts,

    dataQualityAlerts,

  } = data;



  const isAdmin = session ? isFullAdmin(session) : false;

  const canGrades = session ? hasAnyGradeWrite(session) : false;

  const canEditStudents = session ? hasAnyStudentEdit(session) : false;



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

    canGrades

      ? {

          href: "/admin/grades/matrix",

          label: "מטריצת ציונים",

          icon: Grid3X3,

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

    {

      href: "/admin/classes",

      label: "כיתות ותוכניות",

      icon: School,

      variant: "secondary" as const,

    },

    isAdmin && session && canManageStructure(session.role)

      ? {

          href: "/admin/subjects",

          label: "מקצועות וחובות",

          icon: BookOpen,

          variant: "secondary" as const,

        }

      : null,

    canOutstandingBagrut

      ? {

          href: "/admin/outstanding-bagrut",

          label: "בגרות מצטיינת",

          icon: Award,

          variant: "secondary" as const,

        }

      : null,

    isAdmin

      ? {

          href: "/admin/staff",

          label: "צוות והרשאות",

          icon: UserCog,

          variant: "secondary" as const,

        }

      : null,

    isAdmin

      ? {

          href: "/admin/settings",

          label: "תזכורות ציונים",

          icon: Bell,

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



      {(schoolProgress || gradeGaps) && (

        <div className="mt-8 grid gap-6 lg:grid-cols-2">

          {schoolProgress && <SchoolProgressCard progress={schoolProgress} />}

          {gradeGaps && <ClassSummaryCard byClass={gradeGaps.byClass} />}

        </div>

      )}



      <div className="mt-8 grid gap-6 lg:grid-cols-3">

        {gradeGaps && (

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

              <GapLinkRow

                href="/admin/grades"

                label="חובות חסרות"

                value={gradeGaps.totalMissing}

                variant="warning"

              />

              <GapLinkRow

                href="/admin/grades"

                label="באיחור"

                value={gradeGaps.overdueCount}

                variant={gradeGaps.overdueCount > 0 ? "danger" : "default"}

              />

              <GapLinkRow

                href="/admin/grades"

                label="תאריכי יעד קרובים (14 יום)"

                value={gradeGaps.upcomingCount}

              />

              {gradeGaps.topMissingSubjects.length > 0 && (

                <li className="rounded-xl border border-slate-100 px-4 py-3">

                  <p className="mb-2 text-xs font-medium text-slate-500">מקצועות עם הכי הרבה חסרים</p>

                  <ul className="space-y-1">

                    {gradeGaps.topMissingSubjects.map((s) => (

                      <li

                        key={s.subjectId}

                        className="flex justify-between text-slate-700"

                      >

                        <span className="truncate">{s.subjectName}</span>

                        <span className="shrink-0 font-bold text-amber-700">

                          {s.missingCount}

                        </span>

                      </li>

                    ))}

                  </ul>

                </li>

              )}

              <li className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3">

                <span className="text-slate-600">תוכניות חובה</span>

                <span className="font-bold text-slate-800">{counts.paths}</span>

              </li>

            </ul>

          </Card>

        )}



        {outstandingBagrutPreview && (

          <OutstandingPreviewCard preview={outstandingBagrutPreview} />

        )}



        {!outstandingBagrutPreview && (

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

        )}



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



      {teacherAlerts &&
        (teacherAlerts.upcoming.length > 0 || teacherAlerts.overdue.length > 0) && (
          <div className="mt-8 grid gap-6 lg:grid-cols-2">
            <Card className="p-6">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 text-amber-600 ring-1 ring-inset ring-amber-100">
                  <Bell className="h-5 w-5" />
                </span>
                <div>
                  <h3 className="text-h3 text-slate-900">מורים שמועד ההזנה שלהם מתקרב</h3>
                  <p className="text-sm text-slate-500">בשבוע הקרוב, ועדיין לא הוזנו ציונים</p>
                </div>
              </div>
              <div className="mt-4 space-y-2">
                {teacherAlerts.upcoming.length === 0 ? (
                  <p className="rounded-lg bg-slate-50 px-4 py-3 text-sm text-slate-500">
                    אין מורים עם מועד מתקרב
                  </p>
                ) : (
                  teacherAlerts.upcoming.map((t) => (
                    <div
                      key={t.teacherId}
                      className="flex items-center justify-between gap-3 rounded-lg border border-amber-100 bg-amber-50/50 px-4 py-3"
                    >
                      <div className="min-w-0">
                        <p className="truncate font-medium text-slate-800">{t.name || t.email}</p>
                        <p className="text-xs text-slate-500">
                          {t.upcomingCount} מטלות · {t.upcomingMissingStudents} ציונים חסרים
                          {t.nearestDueDate ? ` · הקרוב ביותר: ${t.nearestDueDate}` : ""}
                        </p>
                      </div>
                      <span className="badge-warning shrink-0">{t.upcomingCount}</span>
                    </div>
                  ))
                )}
              </div>
            </Card>

            <Card className="p-6">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-50 text-red-600 ring-1 ring-inset ring-red-100">
                  <AlertTriangle className="h-5 w-5" />
                </span>
                <div>
                  <h3 className="text-h3 text-slate-900">ציונים באיחור — טרם הוזנו</h3>
                  <p className="text-sm text-slate-500">מועד ההזנה חלף וחסרים ציונים</p>
                </div>
              </div>
              <div className="mt-4 space-y-2">
                {teacherAlerts.overdue.length === 0 ? (
                  <p className="rounded-lg bg-slate-50 px-4 py-3 text-sm text-slate-500">
                    אין ציונים באיחור
                  </p>
                ) : (
                  teacherAlerts.overdue.map((t) => (
                    <div
                      key={t.teacherId}
                      className="flex items-center justify-between gap-3 rounded-lg border border-red-100 bg-red-50/50 px-4 py-3"
                    >
                      <div className="min-w-0">
                        <p className="truncate font-medium text-slate-800">{t.name || t.email}</p>
                        <p className="text-xs text-slate-500">
                          {t.overdueCount} מטלות · {t.overdueMissingStudents} ציונים חסרים
                        </p>
                      </div>
                      <span className="badge-danger shrink-0">{t.overdueCount}</span>
                    </div>
                  ))
                )}
              </div>
            </Card>
          </div>
        )}

      {gradeRemindersSummary && (

        <div className="mt-8 grid gap-6 lg:grid-cols-3">

          <GradeRemindersCard summary={gradeRemindersSummary} />

          <Card className="p-6 lg:col-span-2">

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

        </div>

      )}



      {!gradeRemindersSummary && outstandingBagrutPreview && (

        <div className="mt-8 grid gap-6 lg:grid-cols-3">

          <Card className="p-6 lg:col-span-2">

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

        </div>

      )}



      {dataQualityAlerts && (

        <div className="mt-8 grid gap-6 lg:grid-cols-3">

          <DataQualitySection alerts={dataQualityAlerts} />

        </div>

      )}

    </>

  );

}



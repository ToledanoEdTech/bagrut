"use client";

import { SubjectCard } from "@/components/subjects/SubjectCard";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { StatCardGrid } from "@/components/ui/StatCardGrid";
import { PageLoader } from "@/components/ui/PageLoader";
import { StaggerChildren, StaggerItem } from "@/components/motion/StaggerChildren";
import { useAuth } from "@/components/AuthProvider";
import { useApi } from "@/hooks/useApi";
import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/Button";

type DashboardData = {
  student: {
    user: { name: string };
    class: { name: string; gradeYear: string | null };
    tracks: { name: string }[];
    track: { name: string } | null;
    mathUnits: number;
    englishUnits: number;
  };
  subjects: Array<{
    id: string;
    name: string;
    pathLabels?: string[];
    units: number | null;
    obligations: Array<{
      id: string;
      questionnaireNumber: string | null;
      name: string | null;
      weightPercent: number;
      examType: string;
      studyMaterial: string | null;
      examEvent: string | null;
      gradeYear: string | null;
      components: Array<{ name: string; weightPercent: number }>;
      subItems: Array<{ name: string; weightPercent: number }>;
    }>;
    progress: { progressPercent: number; estimatedGrade: number | null };
    grades: Array<{ obligationId: string; score: number | null; status: string }>;
  }>;
  overallProgress: number;
};

export default function StudentDashboard() {
  const { signOut } = useAuth();
  const { data, loading } = useApi<DashboardData>("/api/student/dashboard");

  if (loading && !data) {
    return <PageLoader variant="dashboard" />;
  }

  if (!data) {
    return <div className="text-center text-base text-slate-500">שגיאה בטעינת הנתונים</div>;
  }

  const completedObligations = data.subjects.reduce((sum, s) => {
    const graded = s.grades.filter(
      (g) => g.status === "GRADED" || g.status === "SUBMITTED"
    ).length;
    return sum + graded;
  }, 0);

  const totalObligations = data.subjects.reduce(
    (sum, s) => sum + s.obligations.length,
    0
  );

  const gradedSubjects = data.subjects.filter((s) =>
    s.grades.some((g) => g.status === "GRADED" && g.score != null)
  );
  const avgGrade =
    gradedSubjects.length > 0
      ? gradedSubjects.reduce((sum, s) => {
          const g = s.progress.estimatedGrade ?? 0;
          return sum + g;
        }, 0) / gradedSubjects.length
      : null;

  return (
    <>
      <header className="relative -mx-4 -mt-4 overflow-hidden bg-primary-700 px-6 py-9 text-white shadow-glow lg:-mx-8 lg:-mt-8 lg:rounded-b-[2rem] lg:px-9">
        <div className="absolute inset-0 bg-gradient-to-l from-primary-700 via-brand-700 to-primary-800" />
        <div className="absolute inset-0 bg-mesh-hero opacity-60" />
        <div className="absolute -left-16 -top-20 h-64 w-64 rounded-full bg-white/10 blur-3xl" />
        <div className="absolute -right-10 bottom-0 h-48 w-48 rounded-full bg-brand-400/20 blur-3xl" />

        <div className="relative">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-base text-primary-100/90">שלום,</p>
              <h1 className="mt-0.5 text-4xl font-extrabold tracking-tight text-white drop-shadow-sm">
                {data.student.user.name}
              </h1>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => signOut()}
              className="shrink-0 border border-white/20 bg-white/15 text-white shadow-none hover:bg-white/25 hover:text-white"
            >
              <LogOut className="h-4 w-4" />
              התנתק
            </Button>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {[
              `כיתה ${data.student.class.name}`,
              data.student.class.gradeYear,
              (data.student.tracks?.length
                ? data.student.tracks.map((t) => t.name).join(", ")
                : data.student.track?.name)
                ? `מגמות: ${
                    data.student.tracks?.length
                      ? data.student.tracks.map((t) => t.name).join(", ")
                      : data.student.track!.name
                  }`
                : null,
              `מתמטיקה ${data.student.mathUnits} יח"ל`,
              `אנגלית ${data.student.englishUnits} יח"ל`,
            ]
              .filter(Boolean)
              .map((chip) => (
                <span
                  key={chip as string}
                  className="rounded-full border border-white/15 bg-white/10 px-3 py-1 text-sm font-medium text-primary-50 backdrop-blur-sm"
                >
                  {chip}
                </span>
              ))}
          </div>

          <div className="mt-7 max-w-lg rounded-2xl border border-white/15 bg-white/10 p-4 backdrop-blur-md">
            <div className="flex items-center justify-between text-base">
              <span className="font-medium text-primary-50">התקדמות כללית</span>
              <span className="text-2xl font-extrabold text-white">
                {data.overallProgress.toFixed(0)}%
              </span>
            </div>
            <ProgressBar
              value={data.overallProgress}
              className="mt-2.5 h-3 bg-white/20"
              color="success"
            />
          </div>
        </div>
      </header>

      <div className="mt-8">
        <StatCardGrid
          columns="sm:grid-cols-3"
          items={[
            { title: "מקצועות", value: data.subjects.length, icon: "book-open", color: "primary" },
            {
              title: "חובות שהושלמו",
              value: `${completedObligations}/${totalObligations}`,
              icon: "target",
              color: "info",
            },
            {
              title: "ממוצע משוער",
              value: avgGrade != null ? avgGrade.toFixed(0) : "—",
              subtitle: "ממקצועות עם ציונים",
              icon: "award",
              color: "success",
            },
          ]}
        />
      </div>

      <div className="mt-10">
        <div className="mb-4 flex items-center gap-3">
          <h2 className="text-h2 text-slate-900">המקצועות שלי</h2>
          <span className="h-px flex-1 bg-gradient-to-l from-slate-200 to-transparent" />
          <span className="badge-info">{data.subjects.length} מקצועות</span>
        </div>
        <StaggerChildren className="space-y-4">
          {data.subjects.map((subject) => (
            <StaggerItem key={subject.id}>
              <SubjectCard
                name={subject.name}
                pathLabels={subject.pathLabels}
                units={subject.units}
                obligations={subject.obligations}
                grades={subject.grades}
                progress={subject.progress}
                readOnly
              />
            </StaggerItem>
          ))}
        </StaggerChildren>
      </div>
    </>
  );
}

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
      <header className="-mx-4 -mt-4 border-b border-primary-700/20 bg-gradient-to-l from-primary-600 to-primary-700 px-4 py-8 text-white lg:-mx-8 lg:-mt-8 lg:px-8">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-base text-primary-100">שלום,</p>
            <h1 className="text-display text-white">{data.student.user.name}</h1>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => signOut()}
            className="shrink-0 bg-white/15 text-white hover:bg-white/25 hover:text-white"
          >
            <LogOut className="h-4 w-4" />
            התנתק
          </Button>
        </div>
        <div className="mt-3 flex flex-wrap gap-4 text-base text-primary-100">
          <span>כיתה {data.student.class.name}</span>
          {data.student.class.gradeYear && <span>{data.student.class.gradeYear}</span>}
          {(data.student.tracks?.length
            ? data.student.tracks.map((t) => t.name).join(", ")
            : data.student.track?.name) && (
            <span>
              מגמות:{" "}
              {data.student.tracks?.length
                ? data.student.tracks.map((t) => t.name).join(", ")
                : data.student.track!.name}
            </span>
          )}
          <span>מתמטיקה {data.student.mathUnits} יח&quot;ל</span>
          <span>אנגלית {data.student.englishUnits} יח&quot;ל</span>
        </div>

        <div className="mt-6 max-w-lg">
          <div className="flex justify-between text-base">
            <span>התקדמות כללית</span>
            <span className="font-bold">{data.overallProgress.toFixed(0)}%</span>
          </div>
          <ProgressBar
            value={data.overallProgress}
            className="mt-2 h-3"
            color="success"
          />
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

      <div className="mt-8">
        <h2 className="text-h2 mb-4 text-slate-900">המקצועות שלי</h2>
        <StaggerChildren className="space-y-4">
          {data.subjects.map((subject) => (
            <StaggerItem key={subject.id}>
              <SubjectCard
                name={subject.name}
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

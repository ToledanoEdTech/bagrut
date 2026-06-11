"use client";

import { SubjectCard } from "@/components/subjects/SubjectCard";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { StatCardGrid } from "@/components/ui/StatCardGrid";
import { PageLoader } from "@/components/ui/PageLoader";
import { StaggerChildren, StaggerItem } from "@/components/motion/StaggerChildren";
import { useApi } from "@/hooks/useApi";

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

type Props = {
  studentId: string;
  apiPath?: string;
};

export function StudentCardView({ studentId, apiPath }: Props) {
  const endpoint = apiPath ?? `/api/students/dashboard?studentId=${studentId}`;
  const { data, loading } = useApi<DashboardData>(endpoint);

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

  const trackLabel =
    data.student.tracks?.length > 0
      ? data.student.tracks.map((t) => t.name).join(", ")
      : data.student.track?.name;

  return (
    <>
      <div className="card overflow-hidden">
        <div className="bg-gradient-to-l from-primary-600 to-primary-700 px-6 py-6 text-white">
          <h2 className="text-display text-white">{data.student.user.name}</h2>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-base text-primary-100">
            <span>כיתה {data.student.class.name}</span>
            {data.student.class.gradeYear && <span>{data.student.class.gradeYear}</span>}
            {trackLabel && <span>מגמות: {trackLabel}</span>}
            <span>מתמטיקה {data.student.mathUnits} יח&quot;ל</span>
            <span>אנגלית {data.student.englishUnits} יח&quot;ל</span>
          </div>
          <div className="mt-5 max-w-lg">
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
        </div>
      </div>

      <div className="mt-6">
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
        <h3 className="text-h2 mb-4 text-slate-900">מקצועות</h3>
        <StaggerChildren className="space-y-4">
          {data.subjects.length === 0 ? (
            <p className="text-base text-slate-500">אין מקצועות רלוונטיים לתלמיד זה</p>
          ) : (
            data.subjects.map((subject) => (
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
            ))
          )}
        </StaggerChildren>
      </div>
    </>
  );
}

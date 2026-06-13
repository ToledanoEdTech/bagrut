"use client";

import { SubjectCard } from "@/components/subjects/SubjectCard";
import { OutstandingBagrutBadge } from "@/components/students/OutstandingBagrutBadge";
import { EmptyState } from "@/components/ui/EmptyState";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { StatCardGrid } from "@/components/ui/StatCardGrid";
import { StaggerChildren, StaggerItem } from "@/components/motion/StaggerChildren";
import type { OutstandingBagrutResult } from "@/lib/outstanding-bagrut";
import { BookOpen } from "lucide-react";

export type StudentDashboardData = {
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
    category?: string | null;
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
  outstandingBagrut?: OutstandingBagrutResult;
};

type StudentDashboardContentProps = {
  data: StudentDashboardData;
  hero?: React.ReactNode;
  subjectsTitle?: string;
};

export function StudentDashboardContent({
  data,
  hero,
  subjectsTitle = "המקצועות שלי",
}: StudentDashboardContentProps) {
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

  const defaultHero = (
    <div className="card overflow-hidden">
      <div className="bg-gradient-to-l from-primary-600 to-primary-700 px-6 py-6 text-white">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <h2 className="text-display text-white">{data.student.user.name}</h2>
          {data.outstandingBagrut?.isCandidate && (
            <OutstandingBagrutBadge className="border-white/20 bg-white/15 text-white ring-white/20" />
          )}
        </div>
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
          <ProgressBar value={data.overallProgress} className="mt-2 h-3" color="success" />
        </div>
      </div>
    </div>
  );

  return (
    <>
      {hero ?? defaultHero}

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
            ...(data.outstandingBagrut?.isCandidate
              ? [
                  {
                    title: "בגרות מצטיינת",
                    value: "מועמד",
                    subtitle:
                      data.outstandingBagrut.average != null
                        ? `ממוצע ${data.outstandingBagrut.average.toFixed(1)}`
                        : undefined,
                    icon: "award" as const,
                    color: "warning" as const,
                  },
                ]
              : []),
          ]}
        />
      </div>

      <div className="mt-8">
        <div className="mb-4 flex items-center gap-3">
          <h2 className="text-h2 text-slate-900">{subjectsTitle}</h2>
          <span className="h-px flex-1 bg-gradient-to-l from-slate-200 to-transparent" />
          <span className="badge-info">{data.subjects.length} מקצועות</span>
        </div>
        {data.subjects.length === 0 ? (
          <EmptyState
            icon={BookOpen}
            title="אין מקצועות"
            description="לא נמצאו מקצועות רלוונטיים לתלמיד זה"
          />
        ) : (
          <StaggerChildren className="space-y-4">
            {data.subjects.map((subject) => (
              <StaggerItem key={subject.id}>
                <SubjectCard
                  name={subject.name}
                  pathLabels={subject.pathLabels}
                  category={subject.category}
                  units={subject.units}
                  obligations={subject.obligations}
                  grades={subject.grades}
                  progress={subject.progress}
                  readOnly
                />
              </StaggerItem>
            ))}
          </StaggerChildren>
        )}
      </div>
    </>
  );
}

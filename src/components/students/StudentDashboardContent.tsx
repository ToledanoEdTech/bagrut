"use client";

import { SubjectCard } from "@/components/subjects/SubjectCard";
import { OutstandingBagrutBadge } from "@/components/students/OutstandingBagrutBadge";
import { EmptyState } from "@/components/ui/EmptyState";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { StatCardGrid } from "@/components/ui/StatCardGrid";
import { StaggerChildren, StaggerItem } from "@/components/motion/StaggerChildren";
import { OUTSTANDING_BAGRUT_TIER_LABELS, type OutstandingBagrutResult } from "@/lib/outstanding-bagrut-core";
import { calcWeightedBagrutAverage } from "@/lib/bagrut-average";
import { BookOpen, AlertCircle } from "lucide-react";

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
    progress: { progressPercent: number; estimatedGrade: number | null; isFinal?: boolean };
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

  const weightedAverage = calcWeightedBagrutAverage(
    data.subjects.map((s) => ({
      units: s.units,
      category: s.category,
      progress: s.progress,
    }))
  );
  const avgGrade = weightedAverage.average;

  const missingCount = data.subjects.reduce(
    (sum, s) => sum + s.grades.filter((g) => g.status === "MISSING").length,
    0
  );

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
            <OutstandingBagrutBadge
              variant="onDark"
              tier={data.outstandingBagrut.tier ?? undefined}
            />
          )}
        </div>
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-base text-primary-100">
          <span>כיתה {data.student.class.name}</span>
          {data.student.class.gradeYear && <span>{data.student.class.gradeYear}</span>}
          {trackLabel && <span>מגמות: {trackLabel}</span>}
          <span>מתמטיקה {data.student.mathUnits} יח&quot;ל</span>
          <span>אנגלית {data.student.englishUnits} יח&quot;ל</span>
        </div>
        <div className="mt-5 flex flex-wrap items-end justify-between gap-4">
          <div className="flex-1 min-w-[16rem] max-w-lg">
            <div className="flex justify-between text-base">
              <span>התקדמות כללית</span>
              <span className="font-bold">{data.overallProgress.toFixed(0)}%</span>
            </div>
            <ProgressBar value={data.overallProgress} className="mt-2 h-3" color="success" />
          </div>
          <div className="shrink-0 rounded-2xl bg-white/15 px-5 py-3 text-center ring-1 ring-white/25 backdrop-blur-sm">
            <p className="text-4xl font-extrabold tabular-nums text-white">
              {avgGrade != null ? avgGrade.toFixed(1) : "—"}
            </p>
            <p className="mt-0.5 text-sm text-primary-100">ממוצע בגרות משוקלל</p>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {hero ?? defaultHero}

      {missingCount > 0 && (
        <div className="mt-4 flex items-center gap-3 rounded-xl border border-red-300 bg-red-50 px-4 py-3 text-red-700">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <span className="text-base font-semibold">
            {missingCount === 1
              ? "חסר לך ציון אחד — פנה למורה הרלוונטי"
              : `חסרים לך ${missingCount} ציונים — פנה למורים הרלוונטיים`}
          </span>
        </div>
      )}

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
              title: "ממוצע בגרות משוקלל",
              value: avgGrade != null ? avgGrade.toFixed(1) : "—",
              subtitle: "משוקלל לפי יחידות לימוד",
              icon: "award",
              color: "success",
            },
            ...(data.outstandingBagrut?.isCandidate
              ? [
                  {
                    title: "בגרות מצטיינת",
                    value: "מועמד",
                    subtitle:
                      data.outstandingBagrut.tier != null
                        ? OUTSTANDING_BAGRUT_TIER_LABELS[data.outstandingBagrut.tier]
                        : undefined,
                    icon: "award" as const,
                    color:
                      data.outstandingBagrut.tier === "green"
                        ? ("success" as const)
                        : data.outstandingBagrut.tier === "yellow"
                          ? ("warning" as const)
                          : ("danger" as const),
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

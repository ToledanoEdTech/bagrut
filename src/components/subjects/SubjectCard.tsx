"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, FileText, Calendar, BookOpen } from "lucide-react";
import { ProgressBar } from "@/components/ui/ProgressBar";
import clsx from "clsx";

type Obligation = {
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
};

type Grade = {
  obligationId: string;
  score: number | null;
  status: string;
  notes?: string | null;
};

const STATUS_LABELS: Record<string, { label: string; className: string }> = {
  NOT_STARTED: { label: "לא התחיל", className: "badge-muted" },
  IN_PROGRESS: { label: "בתהליך", className: "badge-warning" },
  SUBMITTED: { label: "הוגש", className: "badge-info" },
  GRADED: { label: "נבדק", className: "badge-success" },
  EXEMPT: { label: "פטור", className: "badge-muted" },
};

export function SubjectCard({
  name,
  units,
  obligations,
  grades,
  progress,
  readOnly = true,
  onGradeChange,
}: {
  name: string;
  units?: number | null;
  obligations: Obligation[];
  grades: Grade[];
  progress: { progressPercent: number; estimatedGrade: number | null };
  readOnly?: boolean;
  onGradeChange?: (obligationId: string, field: string, value: string | number | null) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const gradeMap = new Map(grades.map((g) => [g.obligationId, g]));

  return (
    <div className="card overflow-hidden transition hover:shadow-md">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center gap-3 p-5 text-right"
      >
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <h3 className="text-lg font-semibold text-slate-900">
                {name}
                {units && (
                  <span className="me-2 text-sm font-normal text-slate-500">
                    ({units} יח&quot;ל)
                  </span>
                )}
              </h3>
              <p className="mt-1 text-sm text-slate-500">
                {obligations.length} חובות • {progress.progressPercent.toFixed(0)}% הושלם
              </p>
            </div>
            {progress.estimatedGrade != null && (
              <div className="shrink-0 text-end">
                <p className="text-2xl font-bold text-primary-600">
                  {progress.estimatedGrade.toFixed(0)}
                </p>
                <p className="text-xs text-slate-400">ציון משוער</p>
              </div>
            )}
          </div>
          <ProgressBar
            value={progress.progressPercent}
            className="mt-3"
            color={progress.progressPercent >= 70 ? "success" : "primary"}
          />
        </div>
        <div className="shrink-0">
          {expanded ? (
            <ChevronUp className="h-5 w-5 text-slate-400" />
          ) : (
            <ChevronDown className="h-5 w-5 text-slate-400" />
          )}
        </div>
      </button>

      {expanded && (
        <div className="border-t border-slate-100 bg-slate-50/50 p-5">
          <div className="space-y-3">
            {obligations.map((o) => {
              const grade = gradeMap.get(o.id);
              const status = STATUS_LABELS[grade?.status ?? "NOT_STARTED"];

              return (
                <div
                  key={o.id}
                  className="rounded-xl border border-slate-200 bg-white p-4"
                >
                  <div className="flex flex-wrap items-start gap-3">
                    <div className="min-w-0 flex-1 text-right">
                      <div className="flex flex-wrap items-center justify-start gap-2">
                        <span className="font-medium text-slate-900">
                          {o.name || o.examEvent || "חובה"}
                        </span>
                        {o.questionnaireNumber && (
                          <span className="badge-muted" dir="ltr">
                            שאלון {o.questionnaireNumber}
                          </span>
                        )}
                        <span className={status.className}>{status.label}</span>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-4 text-xs text-slate-500">
                        <span className="flex items-center gap-1">
                          <FileText className="h-3 w-3" />
                          משקל: {o.weightPercent}%
                        </span>
                        <span className="flex items-center gap-1">
                          <BookOpen className="h-3 w-3" />
                          {o.examType}
                        </span>
                        {o.gradeYear && (
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {o.gradeYear}
                          </span>
                        )}
                      </div>
                      {o.studyMaterial && (
                        <p className="mt-1 text-xs text-slate-400">
                          חומר: {o.studyMaterial}
                        </p>
                      )}
                    </div>

                    <div className="flex shrink-0 items-center gap-3">
                      {!readOnly && onGradeChange ? (
                        <>
                          <select
                            className="input w-32 py-1.5 text-xs"
                            value={grade?.status ?? "NOT_STARTED"}
                            onChange={(e) =>
                              onGradeChange(o.id, "status", e.target.value)
                            }
                          >
                            {Object.entries(STATUS_LABELS).map(([k, v]) => (
                              <option key={k} value={k}>
                                {v.label}
                              </option>
                            ))}
                          </select>
                          <input
                            type="number"
                            min={0}
                            max={100}
                            className="input w-20 py-1.5 text-xs"
                            placeholder="ציון"
                            value={grade?.score ?? ""}
                            onChange={(e) =>
                              onGradeChange(
                                o.id,
                                "score",
                                e.target.value ? parseFloat(e.target.value) : null
                              )
                            }
                          />
                        </>
                      ) : (
                        grade?.score != null && (
                          <div
                            className={clsx(
                              "flex h-12 w-12 items-center justify-center rounded-xl text-lg font-bold",
                              grade.score >= 70
                                ? "bg-emerald-50 text-emerald-600"
                                : grade.score >= 55
                                  ? "bg-amber-50 text-amber-600"
                                  : "bg-red-50 text-red-600"
                            )}
                          >
                            {grade.score}
                          </div>
                        )
                      )}
                    </div>
                  </div>

                  {o.components.length > 0 && (
                    <div className="mt-3 border-t border-slate-100 pt-3 text-right">
                      <p className="mb-2 text-xs font-medium text-slate-500">
                        שקלול ציון:
                      </p>
                      <div className="flex flex-wrap justify-start gap-2">
                        {o.components.map((c, i) => (
                          <span key={i} className="badge-muted text-xs">
                            {c.name}: {c.weightPercent}%
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {o.subItems.length > 0 && (
                    <div className="mt-3 border-t border-slate-100 pt-3 text-right">
                      <p className="mb-2 text-xs font-medium text-slate-500">
                        פריטי משנה:
                      </p>
                      <div className="grid gap-1 sm:grid-cols-2">
                        {o.subItems.map((si, i) => (
                          <div
                            key={i}
                            className="flex justify-between rounded-lg bg-slate-50 px-3 py-1.5 text-xs"
                          >
                            <span className="text-slate-400">{si.weightPercent}%</span>
                            <span>{si.name}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

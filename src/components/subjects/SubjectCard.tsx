"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, ChevronUp } from "lucide-react";
import { ProgressBar } from "@/components/ui/ProgressBar";
import clsx from "clsx";
import { STATUS_LABELS, isValidSubmissionStatus } from "@/lib/grade-status";

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
    <div className="card overflow-hidden hover:shadow-md">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center gap-3 p-5 text-right"
      >
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <h3 className="text-xl font-bold text-slate-900">
                {name}
                {units && (
                  <span className="me-2 text-base font-normal text-slate-500">
                    ({units} יח&quot;ל)
                  </span>
                )}
              </h3>
              <p className="mt-1 text-base text-slate-500">
                {obligations.length} חובות • {progress.progressPercent.toFixed(0)}% הושלם
              </p>
            </div>
            {progress.estimatedGrade != null && (
              <div className="shrink-0 text-end">
                <p className="text-4xl font-extrabold text-primary-600">
                  {progress.estimatedGrade.toFixed(0)}
                </p>
                <p className="text-caption">ציון משוער</p>
              </div>
            )}
          </div>
          <ProgressBar
            value={progress.progressPercent}
            className="mt-3 h-3"
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

      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <div className="border-t border-slate-100 bg-slate-50/50 p-5">
              <div className="space-y-3">
                {obligations.map((o) => {
                  const grade = gradeMap.get(o.id);
                  const statusKey =
                    grade?.status && isValidSubmissionStatus(grade.status)
                      ? grade.status
                      : "NOT_STARTED";
                  const status = STATUS_LABELS[statusKey];

                  return (
                    <div
                      key={o.id}
                      className="rounded-xl border border-slate-200 bg-white p-5 transition hover:bg-slate-50"
                    >
                      <div className="flex flex-wrap items-start justify-between gap-4">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-lg font-bold text-slate-900">
                              {o.name || o.examEvent || "חובה"}
                            </span>
                            {o.questionnaireNumber && (
                              <span className="badge-muted text-sm font-semibold" dir="ltr">
                                שאלון {o.questionnaireNumber}
                              </span>
                            )}
                            <span className={status.className}>{status.label}</span>
                          </div>

                          <div className="mt-3 grid w-full grid-cols-2 gap-x-6 gap-y-2 text-base sm:grid-cols-4">
                            <div>
                              <span className="font-semibold text-slate-700">משקל: </span>
                              <span className="text-slate-900">{o.weightPercent}%</span>
                            </div>
                            <div>
                              <span className="font-semibold text-slate-700">סוג: </span>
                              <span className="text-slate-900">{o.examType}</span>
                            </div>
                            {o.gradeYear && (
                              <div>
                                <span className="font-semibold text-slate-700">שכבה: </span>
                                <span className="text-slate-900">{o.gradeYear}</span>
                              </div>
                            )}
                            {o.examEvent && o.name && (
                              <div>
                                <span className="font-semibold text-slate-700">אירוע: </span>
                                <span className="text-slate-900">{o.examEvent}</span>
                              </div>
                            )}
                          </div>

                          {o.studyMaterial && (
                            <p className="mt-3 text-base text-slate-700">
                              <span className="font-semibold text-slate-900">חומר: </span>
                              {o.studyMaterial}
                            </p>
                          )}
                        </div>

                        {!readOnly && onGradeChange ? (
                          <div className="flex shrink-0 flex-wrap items-center gap-3">
                            <select
                              className="input w-36 py-2 text-base"
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
                              className="input w-24 py-2 text-base"
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
                          </div>
                        ) : (
                          grade?.score != null && (
                            <div
                              className={clsx(
                                "flex h-16 w-16 shrink-0 items-center justify-center rounded-xl text-2xl font-bold",
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

                      {o.components.length > 0 && (
                        <div className="mt-4 border-t border-slate-100 pt-4">
                          <p className="mb-2 text-base font-semibold text-slate-800">שקלול ציון:</p>
                          <div className="flex flex-wrap gap-2">
                            {o.components.map((c, i) => (
                              <span key={i} className="badge-muted text-sm font-medium">
                                {c.name}: <strong>{c.weightPercent}%</strong>
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {o.subItems.length > 0 && (
                        <div className="mt-4 border-t border-slate-100 pt-4">
                          <p className="mb-2 text-base font-semibold text-slate-800">פריטי משנה:</p>
                          <div className="grid w-full gap-2 sm:grid-cols-2 lg:grid-cols-3">
                            {o.subItems.map((si, i) => (
                              <div
                                key={i}
                                className="flex items-center justify-between rounded-lg bg-slate-50 px-4 py-2.5 text-base"
                              >
                                <span className="font-medium text-slate-800">{si.name}</span>
                                <span className="font-semibold text-primary-600">
                                  {si.weightPercent}%
                                </span>
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
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

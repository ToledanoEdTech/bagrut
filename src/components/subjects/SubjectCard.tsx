"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, ChevronUp, AlertCircle } from "lucide-react";
import { ProgressBar } from "@/components/ui/ProgressBar";
import clsx from "clsx";
import {
  hasSeparateComponentGrades,
  hasSubItemGrades,
  normalizeComponents,
  normalizeSubItems,
  resolveObligationGradeScore,
} from "@/lib/grade-components";
import { STATUS_LABELS, isValidSubmissionStatus } from "@/lib/grade-status";
import { formatSubjectDisplayName } from "@/lib/subject-display";
import { formatObligationLabel, getNegativeGradeScore } from "@/lib/missing-grades";
import { isObligationDueForStudent } from "@/lib/grade-year";

type Obligation = {
  id: string;
  questionnaireNumber: string | null;
  name: string | null;
  weightPercent: number;
  examType: string;
  studyMaterial: string | null;
  examEvent: string | null;
  gradeYear: string | null;
  components: Array<{ name: string; weightPercent: number; sortOrder?: number }>;
  subItems: Array<{ name: string; weightPercent: number; sortOrder?: number }>;
};

type Grade = {
  obligationId: string;
  score: number | null;
  componentScores?: Record<number, number | null> | null;
  subItemScores?: Record<number, number | null> | null;
  status: string;
  notes?: string | null;
};

export function SubjectCard({
  name,
  pathLabels,
  category,
  units,
  obligations,
  grades,
  progress,
  readOnly = true,
  onGradeChange,
  studentGradeYear,
}: {
  name: string;
  pathLabels?: string[];
  category?: string | null;
  units?: number | null;
  obligations: Obligation[];
  grades: Grade[];
  progress: { progressPercent: number; estimatedGrade: number | null; isFinal?: boolean };
  readOnly?: boolean;
  onGradeChange?: (obligationId: string, field: string, value: string | number | null) => void;
  /** שכבת התלמיד — לסימון מטלות עתידיות */
  studentGradeYear?: string | null;
}) {
  const [expanded, setExpanded] = useState(false);
  const gradeMap = new Map(grades.map((g) => [g.obligationId, g]));
  const missingObligations = obligations.filter(
    (o) =>
      isObligationDueForStudent(o.gradeYear, studentGradeYear) &&
      gradeMap.get(o.id)?.status === "MISSING"
  );
  const negativeObligations = obligations
    .filter((o) => isObligationDueForStudent(o.gradeYear, studentGradeYear))
    .map((o) => ({
      obligation: o,
      score: getNegativeGradeScore(o, gradeMap.get(o.id)),
    }))
    .filter((entry): entry is { obligation: Obligation; score: number } => entry.score != null);
  const hasMissingGrades = missingObligations.length > 0;
  const hasNegativeGrades = negativeObligations.length > 0;
  const displayName = formatSubjectDisplayName(name, { pathLabels, units, category });
  const showUnitsSeparately =
    units != null && category !== "MATH" && category !== "ENGLISH";

  const estGrade = progress.estimatedGrade;
  const gradeTone =
    estGrade == null
      ? "text-slate-400"
      : estGrade >= 70
        ? "text-emerald-600"
        : estGrade >= 55
          ? "text-amber-600"
          : "text-red-600";

  return (
    <div
      className={clsx(
        "card group overflow-hidden",
        hasMissingGrades && "border-red-300 ring-2 ring-red-200",
        !hasMissingGrades && hasNegativeGrades && "border-amber-400 ring-2 ring-amber-200"
      )}
    >
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center gap-3 p-5 text-right"
      >
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-4">
            <div className="flex min-w-0 items-center gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary-50 to-brand-50 text-base font-extrabold text-primary-600 ring-1 ring-inset ring-primary-100">
                {name.slice(0, 2)}
              </span>
              <div className="min-w-0">
                <h3 className="text-xl font-bold text-slate-900">
                  {displayName}
                  {showUnitsSeparately && (
                    <span className="me-2 text-base font-normal text-slate-500">
                      ({units} יח&quot;ל)
                    </span>
                  )}
                </h3>
                <p className="mt-0.5 text-sm text-slate-500">
                  {obligations.length} חובות • {progress.progressPercent.toFixed(0)}% הושלם
                </p>
                {hasMissingGrades && (
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-sm font-semibold text-red-600">
                    <AlertCircle className="h-4 w-4 shrink-0" aria-hidden />
                    <span>
                      {missingObligations.length === 1
                        ? `חסר ציון: ${formatObligationLabel(missingObligations[0])}`
                        : `חסרים ${missingObligations.length} ציונים: ${missingObligations
                            .map(formatObligationLabel)
                            .join(" · ")}`}
                    </span>
                  </div>
                )}
                {!hasMissingGrades && hasNegativeGrades && (
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-sm font-semibold text-amber-700">
                    <AlertCircle className="h-4 w-4 shrink-0" aria-hidden />
                    <span>
                      {negativeObligations.length === 1
                        ? `ציון שלילי: ${formatObligationLabel(negativeObligations[0].obligation)} (${negativeObligations[0].score})`
                        : `ציונים שליליים: ${negativeObligations
                            .map(
                              ({ obligation, score }) =>
                                `${formatObligationLabel(obligation)} (${score})`
                            )
                            .join(" · ")}`}
                    </span>
                  </div>
                )}
              </div>
            </div>
            {estGrade != null && (
              <div className="shrink-0 text-end">
                <p className={clsx("text-4xl font-extrabold tabular-nums", gradeTone)}>
                  {estGrade.toFixed(0)}
                </p>
                <p className={clsx("text-caption", progress.isFinal && "font-semibold text-emerald-600")}>
                  {progress.isFinal ? "ציון סופי" : "ציון משוער"}
                </p>
              </div>
            )}
          </div>
          <ProgressBar
            value={progress.progressPercent}
            className="mt-3 h-2.5"
            color={progress.progressPercent >= 70 ? "success" : "primary"}
          />
        </div>
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-50 text-slate-400 transition group-hover:bg-primary-50 group-hover:text-primary-600">
          {expanded ? (
            <ChevronUp className="h-5 w-5" />
          ) : (
            <ChevronDown className="h-5 w-5" />
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
                  const normalizedSubItems = normalizeSubItems(o.subItems);
                  const normalizedComponents = normalizeComponents(o.components);
                  const usesSubItems = hasSubItemGrades(normalizedSubItems);
                  const multiComponent =
                    !usesSubItems && hasSeparateComponentGrades(normalizedComponents);
                  const displayScore = resolveObligationGradeScore(o, grade ?? {});

                  const isMissing = statusKey === "MISSING";
                  const negativeScore = getNegativeGradeScore(o, grade);
                  const isNegative = negativeScore != null;
                  const isFuture =
                    studentGradeYear !== undefined &&
                    !isObligationDueForStudent(o.gradeYear, studentGradeYear);

                  return (
                    <div
                      key={o.id}
                      className={clsx(
                        "rounded-xl border p-5 transition",
                        isFuture
                          ? "border-slate-200 bg-slate-50/80 opacity-75"
                          : "bg-white hover:bg-slate-50",
                        !isFuture &&
                          (isMissing
                            ? "border-red-300 bg-red-50/40 ring-1 ring-red-200"
                            : isNegative
                              ? "border-amber-400 bg-amber-50/40 ring-1 ring-amber-200"
                              : "border-slate-200")
                      )}
                    >
                      <div className="flex flex-wrap items-start justify-between gap-4">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            {isMissing && (
                              <AlertCircle className="h-5 w-5 shrink-0 text-red-600" aria-label="חסר ציון" />
                            )}
                            {!isMissing && isNegative && (
                              <AlertCircle
                                className="h-5 w-5 shrink-0 text-amber-600"
                                aria-label="ציון שלילי"
                              />
                            )}
                            <span className="text-lg font-bold text-slate-900">
                              {o.name || o.examEvent || "חובה"}
                            </span>
                            {o.questionnaireNumber && (
                              <span className="badge-muted text-sm font-semibold" dir="ltr">
                                שאלון {o.questionnaireNumber}
                              </span>
                            )}
                            <span className={status.className}>{status.label}</span>
                            {isFuture && (
                              <span className="rounded-full bg-slate-200 px-2 py-0.5 text-xs font-medium text-slate-600">
                                בעתיד
                              </span>
                            )}
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
                            {!usesSubItems && multiComponent ? (
                              <div className="flex flex-wrap items-center gap-2">
                                {o.components.map((c, i) => {
                                  const sortOrder = c.sortOrder ?? i;
                                  return (
                                    <label
                                      key={sortOrder}
                                      className="flex flex-col items-end gap-1"
                                    >
                                      <span className="text-xs font-medium text-slate-600">
                                        {c.name} ({c.weightPercent}%)
                                      </span>
                                      <input
                                        type="number"
                                        min={0}
                                        max={100}
                                        className="input w-24 py-2 text-base"
                                        placeholder="ציון"
                                        value={grade?.componentScores?.[sortOrder] ?? ""}
                                        onChange={(e) =>
                                          onGradeChange(
                                            o.id,
                                            `componentScore:${sortOrder}`,
                                            e.target.value ? parseFloat(e.target.value) : null
                                          )
                                        }
                                      />
                                    </label>
                                  );
                                })}
                                {displayScore != null && (
                                  <div className="flex flex-col items-end gap-1">
                                    <span className="text-xs font-medium text-slate-600">
                                      ציון משוקלל
                                    </span>
                                    <span className="flex h-10 w-16 items-center justify-center rounded-lg bg-primary-50 text-lg font-bold text-primary-600">
                                      {displayScore}
                                    </span>
                                  </div>
                                )}
                              </div>
                            ) : !usesSubItems ? (
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
                            ) : displayScore != null ? (
                              <div className="flex flex-col items-end gap-1">
                                <span className="text-xs font-medium text-slate-600">ציון משוקלל</span>
                                <span className="flex h-10 w-16 items-center justify-center rounded-lg bg-primary-50 text-lg font-bold text-primary-600">
                                  {displayScore}
                                </span>
                              </div>
                            ) : null}
                          </div>
                        ) : (
                          displayScore != null && (
                            <div
                              className={clsx(
                                "flex h-16 w-16 shrink-0 items-center justify-center rounded-xl text-2xl font-bold",
                                displayScore <= 55
                                  ? "bg-amber-100 text-amber-800 ring-2 ring-amber-300"
                                  : displayScore >= 70
                                    ? "bg-emerald-50 text-emerald-600"
                                    : displayScore >= 55
                                      ? "bg-amber-50 text-amber-600"
                                      : "bg-red-50 text-red-600"
                              )}
                            >
                              {displayScore}
                            </div>
                          )
                        )}
                      </div>

                      {multiComponent && readOnly && grade?.componentScores && (
                        <div className="mt-4 border-t border-slate-100 pt-4">
                          <p className="mb-2 text-base font-semibold text-slate-800">ציוני רכיבים:</p>
                          <div className="flex flex-wrap gap-2">
                            {o.components.map((c, i) => {
                              const sortOrder = c.sortOrder ?? i;
                              const componentScore = grade.componentScores?.[sortOrder];
                              if (componentScore == null) return null;
                              return (
                                <span key={sortOrder} className="badge-muted text-sm font-medium">
                                  {c.name}: <strong>{componentScore}</strong>
                                </span>
                              );
                            })}
                          </div>
                        </div>
                      )}

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

                      {usesSubItems && (
                        <div className="mt-4 border-t border-slate-100 pt-4">
                          <p className="mb-2 text-base font-semibold text-slate-800">תתי מטלות:</p>
                          <div className="grid w-full gap-2 sm:grid-cols-2 lg:grid-cols-3">
                            {o.subItems.map((si, i) => {
                              const sortOrder = si.sortOrder ?? i;
                              const subItemScore = grade?.subItemScores?.[sortOrder];
                              return (
                                <div
                                  key={sortOrder}
                                  className="flex items-center justify-between gap-3 rounded-lg bg-slate-50 px-4 py-2.5 text-base"
                                >
                                  <div className="min-w-0">
                                    <span className="font-medium text-slate-800">{si.name}</span>
                                    <span className="me-2 text-sm text-primary-600">
                                      ({si.weightPercent}%)
                                    </span>
                                  </div>
                                  {!readOnly && onGradeChange ? (
                                    <input
                                      type="number"
                                      min={0}
                                      max={100}
                                      className="input w-20 py-1.5 text-sm"
                                      placeholder="ציון"
                                      value={subItemScore ?? ""}
                                      onChange={(e) =>
                                        onGradeChange(
                                          o.id,
                                          `subItemScore:${sortOrder}`,
                                          e.target.value ? parseFloat(e.target.value) : null
                                        )
                                      }
                                    />
                                  ) : subItemScore != null ? (
                                    <span className="shrink-0 font-bold text-primary-600">
                                      {subItemScore}
                                    </span>
                                  ) : null}
                                </div>
                              );
                            })}
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

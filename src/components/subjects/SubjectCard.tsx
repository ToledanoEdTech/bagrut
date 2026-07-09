"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronDown, ChevronUp, AlertCircle, CheckCircle2, Circle } from "lucide-react";
import { ProgressBar } from "@/components/ui/ProgressBar";
import clsx from "clsx";
import {
  calcObligationEarnedSubjectPoints,
  calcObligationProgressContribution,
  formatObligationEarnedScoreLabel,
  formatSubItemProgressLabel,
  getObligationSubItemProgress,
  hasSeparateComponentGrades,
  hasSubItemGrades,
  isObligationSubItemsComplete,
  normalizeComponents,
  normalizeSubItems,
  resolveObligationGradeScore,
} from "@/lib/grade-components";
import {
  STATUS_LABELS,
  isMissingGradeStatus,
  normalizeSubmissionStatus,
} from "@/lib/grade-status";
import { formatSubjectDisplayName } from "@/lib/subject-display";
import { formatObligationLabel, getNegativeGradeScore } from "@/lib/missing-grades";
import {
  getObligationTiming,
  getSubItemTiming,
  isObligationRelevantForStudent,
  resolveSubItemGradeYear,
  type ObligationTiming,
} from "@/lib/grade-year";

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
  subItems: Array<{
    name: string;
    weightPercent: number;
    sortOrder?: number;
    gradeYear?: string | null;
  }>;
};

type Grade = {
  obligationId: string;
  score: number | null;
  componentScores?: Record<number, number | null> | null;
  subItemScores?: Record<number, number | null> | null;
  status: string;
  notes?: string | null;
};

function isObligationOpenForStudent(
  obligation: Obligation,
  grade: Grade | undefined,
  studentGradeYear?: string | null
): boolean {
  if (!grade) return true;
  if (grade.status === "EXEMPT" || grade.status === "GRADED" || grade.status === "SUBMITTED") {
    return false;
  }
  if (isMissingGradeStatus(grade.status)) return true;
  const usesSubItems = hasSubItemGrades(normalizeSubItems(obligation.subItems));
  if (usesSubItems) {
    return !isObligationSubItemsComplete(obligation, grade, studentGradeYear);
  }
  return grade.score == null;
}

/** האם יש תת-מטלה פתוחה עם תזמון נתון (או המטלה עצמה כשאין תתי-מטלות). */
function hasOpenTiming(
  obligation: Obligation,
  grade: Grade | undefined,
  studentGradeYear: string | null | undefined,
  timing: "past" | "current"
): boolean {
  if (studentGradeYear === undefined) return false;
  if (!isObligationOpenForStudent(obligation, grade, studentGradeYear)) return false;

  const subItems = obligation.subItems ?? [];
  if (subItems.length === 0) {
    return getObligationTiming(obligation.gradeYear, studentGradeYear) === timing;
  }

  return subItems.some((si, i) => {
    if (getSubItemTiming(si.gradeYear, obligation.gradeYear, studentGradeYear) !== timing) {
      return false;
    }
    const sortOrder = si.sortOrder ?? i;
    if (!grade) return true;
    if (grade.status === "EXEMPT") return false;
    return grade.subItemScores?.[sortOrder] == null;
  });
}

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
  const missingObligations = obligations.filter((o) =>
    isMissingGradeStatus(gradeMap.get(o.id)?.status)
  );
  const negativeObligations = obligations
    .filter((o) => isObligationRelevantForStudent(o, studentGradeYear))
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
  const openCurrentYear = obligations.filter((o) =>
    hasOpenTiming(o, gradeMap.get(o.id), studentGradeYear, "current")
  );
  const openPastYear = obligations.filter((o) =>
    hasOpenTiming(o, gradeMap.get(o.id), studentGradeYear, "past")
  );
  const futureCount = obligations.filter((o) => {
    if (studentGradeYear === undefined) return false;
    const subItems = o.subItems ?? [];
    if (subItems.length === 0) {
      return getObligationTiming(o.gradeYear, studentGradeYear) === "future";
    }
    return subItems.some(
      (si) => getSubItemTiming(si.gradeYear, o.gradeYear, studentGradeYear) === "future"
    );
  }).length;
  const hasOpenCurrent = openCurrentYear.length > 0;
  const hasOpenPast = openPastYear.length > 0;

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
        !hasMissingGrades && hasNegativeGrades && "border-amber-400 ring-2 ring-amber-200",
        !hasMissingGrades &&
          !hasNegativeGrades &&
          hasOpenCurrent &&
          "border-primary-300 ring-2 ring-primary-200",
        !hasMissingGrades &&
          !hasNegativeGrades &&
          !hasOpenCurrent &&
          hasOpenPast &&
          "border-sky-300 ring-2 ring-sky-200"
      )}
    >
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center gap-3 p-5 text-right sm:gap-5"
      >
        <div className="min-w-0 flex-1">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:gap-6">
            <div className="flex min-w-0 flex-1 items-start gap-3 sm:items-center">
              <span
                className={clsx(
                  "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-base font-extrabold ring-1 ring-inset",
                  hasOpenCurrent
                    ? "bg-gradient-to-br from-primary-100 to-primary-50 text-primary-700 ring-primary-200"
                    : hasOpenPast
                      ? "bg-gradient-to-br from-sky-100 to-sky-50 text-sky-700 ring-sky-200"
                      : "bg-gradient-to-br from-primary-50 to-brand-50 text-primary-600 ring-primary-100"
                )}
              >
                {name.slice(0, 2)}
              </span>
              <div className="min-w-0 flex-1">
                <h3 className="text-xl font-bold text-slate-900">
                  {displayName}
                  {showUnitsSeparately && (
                    <span className="me-2 text-base font-normal text-slate-500">
                      ({units} יח&quot;ל)
                    </span>
                  )}
                </h3>
                {(hasOpenCurrent || hasOpenPast || futureCount > 0) && (
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    {hasOpenCurrent && (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-primary-600 px-3 py-1 text-sm font-bold text-white shadow-sm">
                        להגיש השנה
                        <span className="rounded-full bg-white/25 px-1.5 py-0.5 text-xs tabular-nums">
                          {openCurrentYear.length}
                        </span>
                      </span>
                    )}
                    {hasOpenPast && (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-sky-600 px-3 py-1 text-sm font-bold text-white shadow-sm">
                        היה עליך לעשות
                        <span className="rounded-full bg-white/25 px-1.5 py-0.5 text-xs tabular-nums">
                          {openPastYear.length}
                        </span>
                      </span>
                    )}
                    {futureCount > 0 && (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-600">
                        לשנים הבאות · {futureCount}
                      </span>
                    )}
                  </div>
                )}
                {hasOpenCurrent && openCurrentYear.length <= 3 && (
                  <p className="mt-1.5 text-sm font-semibold text-primary-700">
                    {openCurrentYear.map(formatObligationLabel).join(" · ")}
                  </p>
                )}
                {!hasOpenCurrent && hasOpenPast && openPastYear.length <= 3 && (
                  <p className="mt-1.5 text-sm font-semibold text-sky-700">
                    {openPastYear.map(formatObligationLabel).join(" · ")}
                  </p>
                )}
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

            <div
              className={clsx(
                "grid w-full shrink-0 grid-cols-2 gap-px overflow-hidden rounded-xl bg-slate-200/70 ring-1 ring-slate-200/80",
                estGrade != null ? "sm:grid-cols-3 lg:w-auto lg:min-w-[22rem]" : "lg:w-auto lg:min-w-[14rem]"
              )}
            >
              <div className="flex flex-col items-center justify-center bg-white px-4 py-3 text-center">
                <span className="text-xs font-medium tracking-wide text-slate-500">חובות</span>
                <span className="mt-0.5 text-2xl font-extrabold tabular-nums text-slate-900">
                  {obligations.length}
                </span>
              </div>
              <div className="flex flex-col items-center justify-center bg-white px-4 py-3 text-center">
                <span className="text-xs font-medium tracking-wide text-slate-500">הושלם</span>
                <span className="mt-0.5 text-2xl font-extrabold tabular-nums text-slate-900">
                  {progress.progressPercent.toFixed(0)}
                  <span className="text-base font-bold text-slate-400">%</span>
                </span>
              </div>
              {estGrade != null && (
                <div className="col-span-2 flex flex-col items-center justify-center bg-white px-4 py-3 text-center sm:col-span-1">
                  <span
                    className={clsx(
                      "text-xs font-medium tracking-wide",
                      progress.isFinal ? "font-semibold text-emerald-600" : "text-slate-500"
                    )}
                  >
                    {progress.isFinal ? "ציון סופי" : "ציון ביניים"}
                  </span>
                  <span className={clsx("mt-0.5 text-2xl font-extrabold tabular-nums", gradeTone)}>
                    {estGrade.toFixed(0)}
                  </span>
                </div>
              )}
            </div>
          </div>

          <ProgressBar
            value={progress.progressPercent}
            className="mt-4 h-2.5"
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
                  const statusKey = normalizeSubmissionStatus(grade?.status);
                  const status = STATUS_LABELS[statusKey];
                  const normalizedSubItems = normalizeSubItems(o.subItems);
                  const normalizedComponents = normalizeComponents(o.components);
                  const usesSubItems = hasSubItemGrades(normalizedSubItems);
                  const multiComponent =
                    !usesSubItems && hasSeparateComponentGrades(normalizedComponents);
                  const displayScore = resolveObligationGradeScore(o, grade ?? {}, {
                    studentGradeYear,
                  });
                  const subItemProgress = getObligationSubItemProgress(
                    o,
                    grade,
                    studentGradeYear
                  );
                  const subItemsComplete =
                    !usesSubItems ||
                    isObligationSubItemsComplete(o, grade ?? {}, studentGradeYear);
                  const showPartialSubItemProgress =
                    usesSubItems &&
                    subItemProgress != null &&
                    subItemProgress.enteredCount > 0 &&
                    !subItemsComplete;
                  const partialProgressLabel = showPartialSubItemProgress
                    ? formatSubItemProgressLabel(
                        subItemProgress.enteredCount,
                        subItemProgress.totalCount
                      )
                    : null;
                  const earnedSubjectPoints = usesSubItems
                    ? calcObligationEarnedSubjectPoints(o, grade, studentGradeYear)
                    : null;
                  const earnedScoreLabel =
                    earnedSubjectPoints != null
                      ? formatObligationEarnedScoreLabel(
                          earnedSubjectPoints.earned,
                          earnedSubjectPoints.total
                        )
                      : null;

                  const isMissing = statusKey === "MISSING";
                  const negativeScore = subItemsComplete
                    ? getNegativeGradeScore(o, grade)
                    : null;
                  const isNegative = negativeScore != null;
                  const timing: ObligationTiming =
                    studentGradeYear !== undefined
                      ? getObligationTiming(o.gradeYear, studentGradeYear)
                      : "unknown";
                  const isFuture =
                    studentGradeYear !== undefined &&
                    !isObligationRelevantForStudent(o, studentGradeYear);
                  // השלמת מטלה לפי כל תתי-המטלות של הבגרות (לא רק השנה)
                  const obligationDone =
                    grade?.status === "EXEMPT" ||
                    calcObligationProgressContribution(o, grade, undefined).isComplete;

                  return (
                    <div
                      key={o.id}
                      className={clsx(
                        "rounded-xl border p-5 transition",
                        isFuture
                          ? "border-slate-200 bg-slate-50/80 opacity-75"
                          : timing === "past"
                            ? "border-sky-300 bg-sky-50/50 ring-1 ring-sky-200"
                            : timing === "current"
                              ? "border-primary-300 bg-primary-50/40 ring-1 ring-primary-200"
                              : "bg-white hover:bg-slate-50",
                        !isFuture &&
                          (isMissing
                            ? "border-red-300 bg-red-50/40 ring-1 ring-red-200"
                            : isNegative
                              ? "border-amber-400 bg-amber-50/40 ring-1 ring-amber-200"
                              : timing === "past" || timing === "current"
                                ? null
                                : "border-slate-200")
                      )}
                    >
                      <div className="flex flex-wrap items-start justify-between gap-4">
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            {obligationDone ? (
                              <CheckCircle2
                                className="h-5 w-5 shrink-0 text-emerald-600"
                                aria-label="הושלם"
                              />
                            ) : (
                              <Circle
                                className="h-5 w-5 shrink-0 text-slate-400"
                                aria-label="נשאר לעשות"
                              />
                            )}
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
                            {obligationDone ? (
                              <span className="rounded-full bg-emerald-600 px-2.5 py-0.5 text-xs font-bold text-white">
                                הושלם
                              </span>
                            ) : (
                              <span className="rounded-full bg-amber-500 px-2.5 py-0.5 text-xs font-bold text-white">
                                נשאר לעשות
                              </span>
                            )}
                            <span className={status.className}>{status.label}</span>
                            {timing === "past" && (
                              <span className="rounded-full bg-sky-600 px-2.5 py-0.5 text-xs font-bold text-white">
                                היה עליך לעשות
                              </span>
                            )}
                            {timing === "current" && (
                              <span className="rounded-full bg-primary-600 px-2.5 py-0.5 text-xs font-bold text-white">
                                להגיש השנה
                              </span>
                            )}
                            {isFuture && (
                              <span className="rounded-full bg-slate-400 px-2.5 py-0.5 text-xs font-bold text-white">
                                לשנים הבאות
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
                                      {showPartialSubItemProgress ? "התקדמות" : "ציון משוקלל"}
                                    </span>
                                    <span className="flex min-h-10 min-w-16 items-center justify-center rounded-lg bg-primary-50 px-2 text-lg font-bold text-primary-600">
                                      {partialProgressLabel ?? displayScore}
                                    </span>
                                    {showPartialSubItemProgress && (
                                      <span className="text-xs text-slate-500">
                                        ממוצע חלקי: {displayScore}
                                      </span>
                                    )}
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
                                <span className="text-xs font-medium text-slate-600">
                                  {showPartialSubItemProgress ? "התקדמות" : "ציון משוקלל"}
                                </span>
                                <span className="flex min-h-10 min-w-16 items-center justify-center rounded-lg bg-primary-50 px-2 text-lg font-bold text-primary-600">
                                  {partialProgressLabel ?? displayScore}
                                </span>
                                {showPartialSubItemProgress && (
                                  <span className="text-xs text-slate-500">
                                    {earnedScoreLabel
                                      ? `ציון: ${earnedScoreLabel}`
                                      : displayScore != null
                                        ? `ממוצע חלקי: ${displayScore}`
                                        : null}
                                  </span>
                                )}
                                {!showPartialSubItemProgress && earnedScoreLabel && (
                                  <span className="text-xs text-slate-500">
                                    ציון: {earnedScoreLabel}
                                  </span>
                                )}
                              </div>
                            ) : null}
                          </div>
                        ) : (
                          (displayScore != null || partialProgressLabel) && (
                            <div
                              className={clsx(
                                "flex min-h-16 min-w-16 shrink-0 flex-col items-center justify-center rounded-xl px-3 py-2 text-center font-bold",
                                showPartialSubItemProgress
                                  ? "bg-sky-50 text-sky-700 ring-2 ring-sky-200"
                                  : displayScore != null && displayScore <= 55
                                    ? "bg-amber-100 text-amber-800 ring-2 ring-amber-300"
                                    : displayScore != null && displayScore >= 70
                                      ? "bg-emerald-50 text-emerald-600"
                                      : displayScore != null && displayScore >= 55
                                        ? "bg-amber-50 text-amber-600"
                                        : "bg-red-50 text-red-600"
                              )}
                            >
                              <span className={showPartialSubItemProgress ? "text-lg" : "text-2xl"}>
                                {partialProgressLabel ?? displayScore}
                              </span>
                              {earnedScoreLabel && (
                                <span className="mt-0.5 text-xs font-medium opacity-80">
                                  {showPartialSubItemProgress ? "ציון: " : ""}
                                  {earnedScoreLabel}
                                </span>
                              )}
                              {showPartialSubItemProgress && !earnedScoreLabel && displayScore != null && (
                                <span className="mt-0.5 text-xs font-medium opacity-80">
                                  ממוצע: {displayScore}
                                </span>
                              )}
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
                          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                            <p className="text-base font-semibold text-slate-800">תתי מטלות:</p>
                            {earnedScoreLabel && (
                              <span className="text-sm font-semibold text-primary-700">
                                ציון נוכחי: {earnedScoreLabel}
                              </span>
                            )}
                          </div>
                          <div className="grid w-full gap-2 sm:grid-cols-2 lg:grid-cols-3">
                            {o.subItems.map((si, i) => {
                              const sortOrder = si.sortOrder ?? i;
                              const subItemScore = grade?.subItemScores?.[sortOrder];
                              const subItemDone =
                                grade?.status === "EXEMPT" || subItemScore != null;
                              const subTiming =
                                studentGradeYear !== undefined
                                  ? getSubItemTiming(
                                      si.gradeYear,
                                      o.gradeYear,
                                      studentGradeYear
                                    )
                                  : "unknown";
                              const effectiveGy = resolveSubItemGradeYear(
                                si.gradeYear,
                                o.gradeYear
                              );
                              return (
                                <div
                                  key={sortOrder}
                                  className={clsx(
                                    "flex items-center justify-between gap-3 rounded-lg px-4 py-2.5 text-base",
                                    subTiming === "future"
                                      ? "bg-slate-100/80 opacity-70"
                                      : subTiming === "past"
                                        ? "bg-sky-50 ring-1 ring-sky-100"
                                        : subTiming === "current"
                                          ? "bg-primary-50 ring-1 ring-primary-100"
                                          : "bg-slate-50"
                                  )}
                                >
                                  <div className="min-w-0">
                                    <div className="flex flex-wrap items-center gap-1.5">
                                      {subItemDone ? (
                                        <CheckCircle2
                                          className="h-4 w-4 shrink-0 text-emerald-600"
                                          aria-label="הושלם"
                                        />
                                      ) : (
                                        <Circle
                                          className="h-4 w-4 shrink-0 text-slate-400"
                                          aria-label="נשאר לעשות"
                                        />
                                      )}
                                      <span className="font-medium text-slate-800">{si.name}</span>
                                      <span className="text-sm text-primary-600">
                                        ({si.weightPercent}%)
                                      </span>
                                      {subItemDone ? (
                                        <span className="rounded bg-emerald-600 px-1.5 py-0.5 text-[10px] font-bold text-white">
                                          הושלם
                                        </span>
                                      ) : (
                                        <span className="rounded bg-amber-500 px-1.5 py-0.5 text-[10px] font-bold text-white">
                                          נשאר
                                        </span>
                                      )}
                                      {subTiming === "past" && (
                                        <span className="rounded bg-sky-600 px-1.5 py-0.5 text-[10px] font-bold text-white">
                                          היה עליך
                                        </span>
                                      )}
                                      {subTiming === "current" && (
                                        <span className="rounded bg-primary-600 px-1.5 py-0.5 text-[10px] font-bold text-white">
                                          השנה
                                        </span>
                                      )}
                                      {subTiming === "future" && (
                                        <span className="rounded bg-slate-400 px-1.5 py-0.5 text-[10px] font-bold text-white">
                                          בעתיד
                                        </span>
                                      )}
                                    </div>
                                    {effectiveGy && (
                                      <p className="mt-0.5 text-xs text-slate-500">{effectiveGy}</p>
                                    )}
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

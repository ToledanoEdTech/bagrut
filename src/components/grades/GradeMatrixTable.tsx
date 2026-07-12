"use client";

import { useRef, useCallback } from "react";
import { RotateCcw } from "lucide-react";
import { STATUS_LABELS, SUBMISSION_STATUSES, hasClearableGradeEntry } from "@/lib/grade-status";
import { calcWeightedComponentScore, hasSeparateComponentGrades } from "@/lib/grade-components";
import {
  SOCIAL_INVOLVEMENT_LABELS,
  SOCIAL_INVOLVEMENT_LEVELS,
} from "@/lib/social-involvement";
import type { QualitativeLevel, SubmissionStatus } from "@/lib/types";

export type MatrixComponent = {
  name: string;
  weightPercent: number;
  sortOrder: number;
};

export type MatrixRow = {
  studentId: string;
  studentName: string;
  className?: string | null;
  score: number | null;
  qualitativeLevel?: QualitativeLevel | null;
  componentScores?: Record<number, number | null> | null;
  status: SubmissionStatus;
};

type Props = {
  rows: MatrixRow[];
  components?: MatrixComponent[];
  /** מעורבות חברתית — בחירת הערכה איכותית במקום ציון מספרי */
  qualitative?: boolean;
  /** הצגת עמודת כיתה (הזנה לפי שכבה) */
  showClass?: boolean;
  onChange: (
    studentId: string,
    field: "score" | "status" | "qualitativeLevel" | `componentScore:${number}`,
    value: number | null | SubmissionStatus | QualitativeLevel | ""
  ) => void;
  onClear?: (studentId: string) => void;
};

export function GradeMatrixTable({
  rows,
  components = [],
  qualitative = false,
  showClass = false,
  onChange,
  onClear,
}: Props) {
  const multiComponent = !qualitative && hasSeparateComponentGrades(components);
  const scoreRefs = useRef<(HTMLInputElement | null)[]>([]);
  const levelRefs = useRef<(HTMLSelectElement | null)[]>([]);

  const handleScoreKeyDown = useCallback(
    (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") {
        e.preventDefault();
        const next = scoreRefs.current[index + 1];
        if (next) {
          next.focus();
          next.select();
        }
      }
    },
    []
  );

  const handleLevelKeyDown = useCallback(
    (index: number, e: React.KeyboardEvent<HTMLSelectElement>) => {
      if (e.key === "Enter") {
        e.preventDefault();
        const next = levelRefs.current[index + 1];
        if (next) next.focus();
      }
    },
    []
  );

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200">
      <table className="w-full text-base">
        <thead className="sticky top-0 z-10">
          <tr className="border-b border-slate-200 bg-slate-50 text-right">
            <th className="px-4 py-3 text-sm font-semibold text-slate-600">#</th>
            <th className="px-4 py-3 text-sm font-semibold text-slate-600">שם תלמיד</th>
            {showClass && (
              <th className="px-4 py-3 text-sm font-semibold text-slate-600">כיתה</th>
            )}
            <th className="px-4 py-3 text-sm font-semibold text-slate-600">סטטוס</th>
            {qualitative ? (
              <th className="px-4 py-3 text-sm font-semibold text-slate-600">הערכה</th>
            ) : multiComponent ? (
              <>
                {components.map((c) => (
                  <th
                    key={c.sortOrder}
                    className="px-4 py-3 text-sm font-semibold text-slate-600"
                  >
                    {c.name}
                    <span className="block text-xs font-normal normal-case text-slate-400">
                      ({c.weightPercent}%)
                    </span>
                  </th>
                ))}
                <th className="px-4 py-3 text-sm font-semibold text-slate-600">
                  ציון משוקלל
                </th>
              </>
            ) : (
              <th className="px-4 py-3 text-sm font-semibold text-slate-600">
                {components[0]?.name ?? "ציון"}
              </th>
            )}
            {onClear && (
              <th className="px-4 py-3 text-sm font-semibold text-slate-600">פעולות</th>
            )}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => {
            const weightedScore = multiComponent
              ? calcWeightedComponentScore(components, row.componentScores)
              : row.score;
            const canClear = hasClearableGradeEntry(row);

            return (
              <tr
                key={row.studentId}
                className="border-b border-slate-100 transition hover:bg-primary-50/30"
              >
                <td className="px-4 py-2.5 text-slate-400">{index + 1}</td>
                <td className="px-4 py-2.5 font-medium text-slate-900">{row.studentName}</td>
                {showClass && (
                  <td className="px-4 py-2.5 text-slate-600">{row.className ?? "—"}</td>
                )}
                <td className="px-4 py-2.5">
                  <select
                    className="input w-36 py-1.5 text-sm"
                    value={row.status}
                    onChange={(e) =>
                      onChange(row.studentId, "status", e.target.value as SubmissionStatus)
                    }
                  >
                    {SUBMISSION_STATUSES.map((s) => (
                      <option key={s} value={s}>
                        {STATUS_LABELS[s].label}
                      </option>
                    ))}
                  </select>
                </td>
                {qualitative ? (
                  <td className="px-4 py-2.5">
                    <select
                      ref={(el) => {
                        levelRefs.current[index] = el;
                      }}
                      className="input w-44 py-1.5 text-sm"
                      value={row.qualitativeLevel ?? ""}
                      onChange={(e) =>
                        onChange(
                          row.studentId,
                          "qualitativeLevel",
                          (e.target.value || "") as QualitativeLevel | ""
                        )
                      }
                      onKeyDown={(e) => handleLevelKeyDown(index, e)}
                    >
                      <option value="">בחר הערכה</option>
                      {SOCIAL_INVOLVEMENT_LEVELS.map((level) => (
                        <option key={level} value={level}>
                          {SOCIAL_INVOLVEMENT_LABELS[level]}
                        </option>
                      ))}
                    </select>
                  </td>
                ) : multiComponent ? (
                  <>
                    {components.map((c) => (
                      <td key={c.sortOrder} className="px-4 py-2.5">
                        <input
                          type="number"
                          min={0}
                          max={100}
                          className="input w-24 py-1.5 text-sm"
                          placeholder="—"
                          value={row.componentScores?.[c.sortOrder] ?? ""}
                          onChange={(e) => {
                            const raw = e.target.value;
                            const score = raw ? parseFloat(raw) : null;
                            onChange(row.studentId, `componentScore:${c.sortOrder}`, score);
                          }}
                        />
                      </td>
                    ))}
                    <td className="px-4 py-2.5 text-center font-semibold text-primary-600">
                      {weightedScore ?? "—"}
                    </td>
                  </>
                ) : (
                  <td className="px-4 py-2.5">
                    <input
                      ref={(el) => {
                        scoreRefs.current[index] = el;
                      }}
                      type="number"
                      min={0}
                      max={100}
                      className="input w-24 py-1.5 text-sm"
                      placeholder="—"
                      value={row.score ?? ""}
                      onChange={(e) => {
                        const raw = e.target.value;
                        const score = raw ? parseFloat(raw) : null;
                        onChange(row.studentId, "score", score);
                      }}
                      onKeyDown={(e) => handleScoreKeyDown(index, e)}
                    />
                  </td>
                )}
                {onClear && (
                  <td className="px-4 py-2.5">
                    {canClear ? (
                      <button
                        type="button"
                        className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs font-medium text-slate-600 transition hover:border-red-200 hover:bg-red-50 hover:text-red-700"
                        title="מחיקת הציון והחזרה למצב שלא הוזן"
                        onClick={() => onClear(row.studentId)}
                      >
                        <RotateCcw className="h-3.5 w-3.5" aria-hidden />
                        נקה
                      </button>
                    ) : (
                      <span className="text-slate-300">—</span>
                    )}
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

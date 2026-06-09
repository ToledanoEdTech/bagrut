"use client";

import { useRef, useCallback } from "react";
import { STATUS_LABELS, SUBMISSION_STATUSES } from "@/lib/grade-status";
import { calcWeightedComponentScore, hasSeparateComponentGrades } from "@/lib/grade-components";
import type { SubmissionStatus } from "@/lib/types";

export type MatrixComponent = {
  name: string;
  weightPercent: number;
  sortOrder: number;
};

export type MatrixRow = {
  studentId: string;
  studentName: string;
  score: number | null;
  componentScores?: Record<number, number | null> | null;
  status: SubmissionStatus;
};

type Props = {
  rows: MatrixRow[];
  components?: MatrixComponent[];
  onChange: (
    studentId: string,
    field: "score" | "status" | `componentScore:${number}`,
    value: number | null | SubmissionStatus
  ) => void;
};

export function GradeMatrixTable({ rows, components = [], onChange }: Props) {
  const multiComponent = hasSeparateComponentGrades(components);
  const scoreRefs = useRef<(HTMLInputElement | null)[]>([]);

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

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200">
      <table className="w-full text-base">
        <thead className="sticky top-0 z-10">
          <tr className="border-b border-slate-200 bg-slate-50 text-right">
            <th className="px-4 py-3 text-sm font-semibold uppercase tracking-wide text-slate-600">
              #
            </th>
            <th className="px-4 py-3 text-sm font-semibold uppercase tracking-wide text-slate-600">
              שם תלמיד
            </th>
            <th className="px-4 py-3 text-sm font-semibold uppercase tracking-wide text-slate-600">
              סטטוס
            </th>
            {multiComponent ? (
              <>
                {components.map((c) => (
                  <th
                    key={c.sortOrder}
                    className="px-4 py-3 text-sm font-semibold uppercase tracking-wide text-slate-600"
                  >
                    {c.name}
                    <span className="block text-xs font-normal normal-case text-slate-400">
                      ({c.weightPercent}%)
                    </span>
                  </th>
                ))}
                <th className="px-4 py-3 text-sm font-semibold uppercase tracking-wide text-slate-600">
                  ציון משוקלל
                </th>
              </>
            ) : (
              <th className="px-4 py-3 text-sm font-semibold uppercase tracking-wide text-slate-600">
                {components[0]?.name ?? "ציון"}
              </th>
            )}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => {
            const weightedScore = multiComponent
              ? calcWeightedComponentScore(components, row.componentScores)
              : row.score;

            return (
              <tr
                key={row.studentId}
                className="border-b border-slate-100 transition hover:bg-primary-50/30"
              >
                <td className="px-4 py-2.5 text-slate-400">{index + 1}</td>
                <td className="px-4 py-2.5 font-medium text-slate-900">{row.studentName}</td>
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
                {multiComponent ? (
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
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

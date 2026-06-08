"use client";

import { useRef, useCallback } from "react";
import { STATUS_LABELS, SUBMISSION_STATUSES } from "@/lib/grade-status";
import type { SubmissionStatus } from "@/lib/types";

export type MatrixRow = {
  studentId: string;
  studentName: string;
  score: number | null;
  status: SubmissionStatus;
};

type Props = {
  rows: MatrixRow[];
  onChange: (studentId: string, field: "score" | "status", value: number | null | SubmissionStatus) => void;
};

export function GradeMatrixTable({ rows, onChange }: Props) {
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
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50 text-right">
            <th className="px-4 py-3 font-medium text-slate-600">#</th>
            <th className="px-4 py-3 font-medium text-slate-600">שם תלמיד</th>
            <th className="px-4 py-3 font-medium text-slate-600">סטטוס</th>
            <th className="px-4 py-3 font-medium text-slate-600">ציון</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={row.studentId} className="border-b border-slate-100 hover:bg-slate-50/50">
              <td className="px-4 py-2 text-slate-400">{index + 1}</td>
              <td className="px-4 py-2 font-medium text-slate-900">{row.studentName}</td>
              <td className="px-4 py-2">
                <select
                  className="input w-32 py-1.5 text-xs"
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
              <td className="px-4 py-2">
                <input
                  ref={(el) => {
                    scoreRefs.current[index] = el;
                  }}
                  type="number"
                  min={0}
                  max={100}
                  className="input w-20 py-1.5 text-xs"
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
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

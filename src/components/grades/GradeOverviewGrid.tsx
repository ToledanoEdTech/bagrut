"use client";

import clsx from "clsx";
import type { OverviewCell, OverviewColumn, OverviewRow } from "@/lib/grade-overview-grid";

function cellTone(cell: OverviewCell): string {
  if (!cell.relevant) return "bg-slate-50 text-slate-300";
  if (!cell.filled) return "bg-amber-50/80 text-amber-800";
  if (cell.status === "EXEMPT") return "bg-slate-100 text-slate-600";
  if (cell.status === "MISSING") return "bg-red-50 text-red-700";
  if (cell.score != null) {
    if (cell.score >= 80) return "bg-emerald-50 text-emerald-800";
    if (cell.score >= 55) return "bg-sky-50 text-sky-800";
    return "bg-red-50 text-red-700";
  }
  return "bg-emerald-50/70 text-emerald-800";
}

export function GradeOverviewGrid({
  columns,
  rows,
  showClassColumn,
  onCellClick,
  onStudentClick,
}: {
  columns: OverviewColumn[];
  rows: OverviewRow[];
  showClassColumn: boolean;
  onCellClick?: (row: OverviewRow, column: OverviewColumn) => void;
  onStudentClick?: (studentId: string) => void;
}) {
  if (columns.length === 0) {
    return (
      <p className="rounded-xl bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
        אין עמודות להצגה בטווח שנבחר. נסו לבחור מקצוע אחר או להרחיב את הסינון.
      </p>
    );
  }

  if (rows.length === 0) {
    return (
      <p className="rounded-xl bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
        לא נמצאו תלמידים התואמים לסינון.
      </p>
    );
  }

  return (
    <div className="max-h-[min(70vh,42rem)] overflow-auto rounded-2xl border border-slate-200/70 bg-white shadow-soft">
      <table className="min-w-full border-separate border-spacing-0 text-sm">
        <caption className="sr-only">מטריצת ציונים</caption>
        <thead>
          <tr>
            <th
              scope="col"
              className="sticky top-0 right-0 z-40 border-b border-slate-200 bg-slate-50 px-3 py-3 text-right text-xs font-semibold text-slate-500 shadow-[0_1px_0_0_rgb(226_232_240)]"
            >
              #
            </th>
            <th
              scope="col"
              className="sticky top-0 right-10 z-40 min-w-[9rem] border-b border-slate-200 bg-slate-50 px-3 py-3 text-right text-xs font-semibold text-slate-500 shadow-[0_1px_0_0_rgb(226_232_240)]"
            >
              תלמיד
            </th>
            {showClassColumn && (
              <th
                scope="col"
                className="sticky top-0 z-30 min-w-[5rem] border-b border-slate-200 bg-slate-50 px-3 py-3 text-right text-xs font-semibold text-slate-500 shadow-[0_1px_0_0_rgb(226_232_240)]"
              >
                כיתה
              </th>
            )}
            {columns.map((col) => (
              <th
                key={col.key}
                scope="col"
                title={
                  col.kind === "obligation"
                    ? `${col.subjectName} — ${col.label}`
                    : `${col.subjectName} (וריאנט לפי מסלול/יחידות של כל תלמיד)`
                }
                className="sticky top-0 z-30 min-w-[4.5rem] max-w-[7rem] border-b border-slate-200 bg-slate-50 px-2 py-3 text-center text-xs font-semibold text-slate-600 shadow-[0_1px_0_0_rgb(226_232_240)]"
              >
                <span className="line-clamp-2">
                  {col.kind === "obligation" ? col.shortLabel : col.subjectName}
                </span>
                {col.kind === "subject" && (
                  <span className="mt-0.5 block text-[10px] font-normal text-slate-400">
                    {col.obligationCount} מטלות
                  </span>
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, idx) => {
            const even = idx % 2 === 1;
            const stickyBg = even ? "bg-slate-50" : "bg-white";
            return (
              <tr key={row.studentId} className={even ? "bg-slate-50/40" : "bg-white"}>
                <td
                  className={clsx(
                    "sticky right-0 z-10 border-b border-slate-100 px-3 py-2 text-slate-400",
                    stickyBg
                  )}
                >
                  {idx + 1}
                </td>
                <td
                  className={clsx(
                    "sticky right-10 z-10 border-b border-slate-100 px-3 py-2",
                    stickyBg
                  )}
                >
                  {onStudentClick ? (
                    <button
                      type="button"
                      onClick={() => onStudentClick(row.studentId)}
                      className="font-semibold text-slate-800 hover:text-primary-700"
                    >
                      {row.studentName}
                    </button>
                  ) : (
                    <span className="font-semibold text-slate-800">{row.studentName}</span>
                  )}
                  {row.trackNames.length > 0 && (
                    <p className="truncate text-[11px] text-slate-400">
                      {row.trackNames.join(", ")}
                    </p>
                  )}
                </td>
                {showClassColumn && (
                  <td className="border-b border-slate-100 px-3 py-2 text-slate-600">
                    {row.className}
                  </td>
                )}
                {columns.map((col) => {
                  const cell = row.cells[col.key] ?? {
                    display: null,
                    score: null,
                    status: null,
                    relevant: false,
                    filled: false,
                  };
                  const clickable = cell.relevant && !!onCellClick;
                  return (
                    <td key={col.key} className="border-b border-slate-100 p-1 text-center">
                      {clickable ? (
                        <button
                          type="button"
                          onClick={() => onCellClick(row, col)}
                          className={clsx(
                            "mx-auto flex h-9 min-w-[3.25rem] items-center justify-center rounded-lg px-1.5 text-xs font-semibold tabular-nums transition hover:ring-2 hover:ring-primary-300",
                            cellTone(cell)
                          )}
                          title={
                            col.kind === "obligation"
                              ? `${row.studentName} — ${col.label}`
                              : `${row.studentName} — ${col.label}`
                          }
                        >
                          {cell.display ?? "—"}
                        </button>
                      ) : (
                        <span
                          className={clsx(
                            "mx-auto flex h-9 min-w-[3.25rem] items-center justify-center rounded-lg px-1.5 text-xs font-semibold tabular-nums",
                            cellTone(cell)
                          )}
                        >
                          {cell.relevant ? cell.display ?? "—" : "·"}
                        </span>
                      )}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

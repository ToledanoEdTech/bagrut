"use client";

import { useMemo, useSyncExternalStore } from "react";
import clsx from "clsx";
import type { OverviewCell, OverviewColumn, OverviewRow } from "@/lib/grade-overview-grid";

const DESKTOP_MQ = "(min-width: 768px)";

function subscribeDesktop(onChange: () => void) {
  const mq = window.matchMedia(DESKTOP_MQ);
  mq.addEventListener("change", onChange);
  return () => mq.removeEventListener("change", onChange);
}

function getDesktopSnapshot() {
  return window.matchMedia(DESKTOP_MQ).matches;
}

/** SSR / hydration: מעדיפים פריסת מובייל כדי למנוע גלילה אופקית */
function useIsDesktop() {
  return useSyncExternalStore(subscribeDesktop, getDesktopSnapshot, () => false);
}

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

function emptyCell(): OverviewCell {
  return {
    display: null,
    score: null,
    status: null,
    relevant: false,
    filled: false,
  };
}

function columnChipLabel(col: OverviewColumn): string {
  return col.kind === "obligation" ? col.shortLabel : col.subjectName;
}

function columnTitle(col: OverviewColumn): string {
  return col.kind === "obligation"
    ? `${col.subjectName} — ${col.label}`
    : `${col.subjectName} (וריאנט לפי מסלול/יחידות של כל תלמיד)`;
}

type SubjectGroup = {
  key: string;
  name: string;
  columns: OverviewColumn[];
};

function groupColumnsBySubject(columns: OverviewColumn[]): SubjectGroup[] {
  const groups: SubjectGroup[] = [];
  const byKey = new Map<string, SubjectGroup>();

  for (const col of columns) {
    let group = byKey.get(col.subjectGroup);
    if (!group) {
      group = {
        key: col.subjectGroup,
        name: col.subjectName,
        columns: [],
      };
      byKey.set(col.subjectGroup, group);
      groups.push(group);
    }
    group.columns.push(col);
  }

  return groups;
}

function GradeCellButton({
  cell,
  label,
  title,
  clickable,
  onClick,
  compact = false,
}: {
  cell: OverviewCell;
  label?: string;
  title: string;
  clickable: boolean;
  onClick?: () => void;
  compact?: boolean;
}) {
  const content = (
    <>
      {label && (
        <span className="min-w-0 flex-1 truncate text-start text-[11px] font-medium leading-tight text-slate-600">
          {label}
        </span>
      )}
      <span
        className={clsx(
          "flex shrink-0 items-center justify-center rounded-lg font-semibold tabular-nums",
          compact ? "h-8 min-w-[2.75rem] px-1.5 text-xs" : "h-9 min-w-[3.25rem] px-1.5 text-xs",
          cellTone(cell)
        )}
      >
        {cell.relevant ? cell.display ?? "—" : "·"}
      </span>
    </>
  );

  if (clickable && onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        title={title}
        className={clsx(
          "flex w-full items-center gap-2 rounded-xl border border-slate-100 bg-white/80 p-1.5 transition hover:border-primary-200 hover:ring-2 hover:ring-primary-200",
          label ? "justify-between" : "justify-center"
        )}
      >
        {content}
      </button>
    );
  }

  return (
    <div
      title={title}
      className={clsx(
        "flex w-full items-center gap-2 rounded-xl border border-slate-100 bg-white/60 p-1.5",
        label ? "justify-between" : "justify-center"
      )}
    >
      {content}
    </div>
  );
}

function MobileOverviewCards({
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
  const groups = useMemo(() => groupColumnsBySubject(columns), [columns]);

  return (
    <div className="space-y-3">
      {rows.map((row, idx) => {
        const meta = [
          showClassColumn ? row.className : null,
          row.trackNames.length > 0 ? row.trackNames.join(", ") : null,
        ]
          .filter(Boolean)
          .join(" · ");

        return (
          <article
            key={row.studentId}
            className="rounded-2xl border border-slate-200 bg-white p-3.5 shadow-sm"
          >
            <div className="mb-3 border-b border-slate-100 pb-3">
              {onStudentClick ? (
                <button
                  type="button"
                  onClick={() => onStudentClick(row.studentId)}
                  className="block w-full text-start"
                >
                  <p className="text-base font-semibold text-slate-900">
                    <span className="me-1.5 text-sm font-medium text-slate-400">
                      {idx + 1}.
                    </span>
                    {row.studentName}
                  </p>
                  {meta && <p className="mt-0.5 text-sm text-slate-500">{meta}</p>}
                </button>
              ) : (
                <div>
                  <p className="text-base font-semibold text-slate-900">
                    <span className="me-1.5 text-sm font-medium text-slate-400">
                      {idx + 1}.
                    </span>
                    {row.studentName}
                  </p>
                  {meta && <p className="mt-0.5 text-sm text-slate-500">{meta}</p>}
                </div>
              )}
            </div>

            <div className="space-y-3">
              {groups.map((group) => {
                const relevantCols = group.columns.filter((col) => {
                  const cell = row.cells[col.key] ?? emptyCell();
                  return cell.relevant;
                });
                const colsToShow =
                  relevantCols.length > 0 ? relevantCols : group.columns.slice(0, 1);
                const singleSubjectSummary =
                  colsToShow.length === 1 && colsToShow[0]!.kind === "subject";

                return (
                  <div key={group.key}>
                    {!singleSubjectSummary && (
                      <p className="mb-1.5 text-xs font-semibold text-slate-500">
                        {group.name}
                      </p>
                    )}
                    <div
                      className={clsx(
                        "grid gap-1.5",
                        colsToShow.length > 1 ? "grid-cols-2" : "grid-cols-1"
                      )}
                    >
                      {colsToShow.map((col) => {
                        const cell = row.cells[col.key] ?? emptyCell();
                        const clickable = cell.relevant && !!onCellClick;
                        const label = singleSubjectSummary
                          ? col.subjectName
                          : col.kind === "obligation"
                            ? col.shortLabel
                            : col.subjectName;

                        return (
                          <GradeCellButton
                            key={col.key}
                            cell={cell}
                            label={label}
                            title={`${row.studentName} — ${columnTitle(col)}`}
                            clickable={clickable}
                            onClick={
                              clickable ? () => onCellClick?.(row, col) : undefined
                            }
                            compact
                          />
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </article>
        );
      })}
    </div>
  );
}

function DesktopOverviewTable({
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
                title={columnTitle(col)}
                className="sticky top-0 z-30 min-w-[4.5rem] max-w-[7rem] border-b border-slate-200 bg-slate-50 px-2 py-3 text-center text-xs font-semibold text-slate-600 shadow-[0_1px_0_0_rgb(226_232_240)]"
              >
                <span className="line-clamp-2">{columnChipLabel(col)}</span>
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
                  const cell = row.cells[col.key] ?? emptyCell();
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
                          title={`${row.studentName} — ${col.label}`}
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
  const isDesktop = useIsDesktop();

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

  if (!isDesktop) {
    return (
      <MobileOverviewCards
        columns={columns}
        rows={rows}
        showClassColumn={showClassColumn}
        onCellClick={onCellClick}
        onStudentClick={onStudentClick}
      />
    );
  }

  return (
    <DesktopOverviewTable
      columns={columns}
      rows={rows}
      showClassColumn={showClassColumn}
      onCellClick={onCellClick}
      onStudentClick={onStudentClick}
    />
  );
}

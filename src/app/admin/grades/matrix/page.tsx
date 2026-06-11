"use client";

import { useEffect, useMemo, useState } from "react";
import { Save, Loader2 } from "lucide-react";
import { useApi } from "@/hooks/useApi";
import { PageLoader } from "@/components/ui/PageLoader";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Select } from "@/components/ui/Select";
import { Input } from "@/components/ui/Input";
import { Alert } from "@/components/ui/Alert";
import { ExportButton } from "@/components/ui/ExportButton";
import { useToast } from "@/components/ui/Toast";
import { GradeMatrixTable, type MatrixRow } from "@/components/grades/GradeMatrixTable";
import { invalidateCache } from "@/lib/api-cache";
import {
  buildMatrixSheet,
  downloadExcel,
  exportTimestamp,
} from "@/lib/excel-export";
import {
  makeMatrixTaskKey,
  matrixTaskLabel,
  parseMatrixTaskKey,
} from "@/lib/grade-components";
import { autoStatusOnScore } from "@/lib/grade-status";
import type { SubmissionStatus } from "@/lib/types";

type ClassItem = { id: string; name: string; gradeYear: string | null };

type MatrixTask = {
  id: string;
  taskKind: "subItem" | "component" | "single";
  sortOrder: number;
  taskName: string;
  questionnaireNumber: string | null;
  name: string | null;
  relevantStudentCount: number;
  label: string;
};

type MatrixOptions = {
  subjects: Array<{
    id: string;
    name: string;
    displayName?: string;
    pathLabels?: string[];
    units: number | null;
    tasks: MatrixTask[];
  }>;
};

type MatrixData = {
  class: { id: string; name: string; gradeYear: string | null };
  subject: {
    id: string;
    name: string;
    displayName?: string;
    pathLabels?: string[];
    units: number | null;
  };
  obligation: {
    id: string;
    name: string | null;
    questionnaireNumber: string | null;
    weightPercent: number;
    examType: string;
    taskKind: "subItem" | "component" | "single" | null;
    taskSortOrder: number | null;
    components: Array<{ name: string; weightPercent: number; sortOrder: number }>;
  };
  rows: Array<{
    studentId: string;
    studentName: string;
    grade: {
      score: number | null;
      componentScores?: Record<number, number | null> | null;
      subItemScores?: Record<number, number | null> | null;
      status: SubmissionStatus;
      notes: string | null;
    } | null;
  }>;
  notRelevantCount: number;
};

type RowState = Record<string, { score: number | null; status: SubmissionStatus }>;

export default function GradesMatrixPage() {
  const toast = useToast();
  const { data: classes = [], loading: classesLoading } = useApi<ClassItem[]>("/api/classes/list");
  const [classId, setClassId] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [taskKey, setTaskKey] = useState("");
  const [rowState, setRowState] = useState<RowState>({});
  const [savedSnapshot, setSavedSnapshot] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [bulkScore, setBulkScore] = useState("");

  const parsedTask = parseMatrixTaskKey(taskKey);

  const optionsKey = classId ? `/api/grades/matrix/options?classId=${classId}` : null;
  const { data: options, loading: optionsLoading } = useApi<MatrixOptions>(optionsKey);

  const matrixKey =
    classId && parsedTask
      ? `/api/grades/matrix?classId=${classId}&obligationId=${parsedTask.obligationId}&taskKind=${parsedTask.taskKind}&taskSortOrder=${parsedTask.sortOrder}`
      : null;
  const { data: matrixData, loading: matrixLoading, mutate: refreshMatrix } =
    useApi<MatrixData>(matrixKey);

  const components = matrixData?.obligation.components ?? [];

  useEffect(() => {
    setSubjectId("");
    setTaskKey("");
    setRowState({});
    setSavedSnapshot("");
  }, [classId]);

  useEffect(() => {
    setTaskKey("");
    setRowState({});
    setSavedSnapshot("");
  }, [subjectId]);

  useEffect(() => {
    if (!matrixData) {
      setRowState({});
      setSavedSnapshot("");
      return;
    }
    const initial: RowState = {};
    for (const row of matrixData.rows) {
      initial[row.studentId] = {
        score: row.grade?.score ?? null,
        status: row.grade?.status ?? "NOT_STARTED",
      };
    }
    setRowState(initial);
    setSavedSnapshot(JSON.stringify(initial));
    setSaveError(null);
  }, [matrixData]);

  const selectedSubject = options?.subjects.find((s) => s.id === subjectId);
  const tasks = selectedSubject?.tasks ?? [];
  const selectedTask = tasks.find(
    (t) =>
      parsedTask &&
      t.id === parsedTask.obligationId &&
      t.taskKind === parsedTask.taskKind &&
      t.sortOrder === parsedTask.sortOrder
  );

  const tableRows: MatrixRow[] = useMemo(() => {
    if (!matrixData) return [];
    return matrixData.rows.map((r) => ({
      studentId: r.studentId,
      studentName: r.studentName,
      score: rowState[r.studentId]?.score ?? null,
      status: rowState[r.studentId]?.status ?? "NOT_STARTED",
    }));
  }, [matrixData, rowState]);

  const isDirty = savedSnapshot !== "" && JSON.stringify(rowState) !== savedSnapshot;

  function handleChange(
    studentId: string,
    field: "score" | "status" | `componentScore:${number}`,
    value: number | null | SubmissionStatus
  ) {
    setRowState((prev) => {
      const current = prev[studentId] ?? {
        score: null,
        status: "NOT_STARTED" as SubmissionStatus,
      };

      if (field === "score" || field.startsWith("componentScore:")) {
        const score = value as number | null;
        return {
          ...prev,
          [studentId]: {
            score,
            status: autoStatusOnScore(score, current.status),
          },
        };
      }

      return {
        ...prev,
        [studentId]: { ...current, status: value as SubmissionStatus },
      };
    });
    setSaveError(null);
  }

  function applyBulkScore() {
    const score = parseFloat(bulkScore);
    if (isNaN(score) || score < 0 || score > 100) return;

    setRowState((prev) => {
      const next = { ...prev };
      for (const row of tableRows) {
        if (next[row.studentId]?.score == null) {
          next[row.studentId] = { score, status: "GRADED" };
        }
      }
      return next;
    });
  }

  async function saveGrades() {
    if (!parsedTask || !matrixData) return;
    setSaving(true);
    setSaveError(null);
    try {
      const res = await fetch("/api/grades/matrix", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          obligationId: parsedTask.obligationId,
          taskKind: parsedTask.taskKind,
          taskSortOrder: parsedTask.sortOrder,
          entries: matrixData.rows.map((r) => ({
            studentId: r.studentId,
            score: rowState[r.studentId]?.score ?? null,
            status: rowState[r.studentId]?.status ?? "NOT_STARTED",
          })),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setSaveError(data.error ?? "שגיאה בשמירה");
        return;
      }
      setSavedSnapshot(JSON.stringify(rowState));
      toast.success("נשמר בהצלחה");
      invalidateCache("/api/grades");
      await refreshMatrix();
    } catch {
      setSaveError("שגיאת רשת בשמירה");
    } finally {
      setSaving(false);
    }
  }

  const taskHeaderLabel =
    selectedTask?.label ??
    (matrixData
      ? matrixTaskLabel({
          name: matrixData.obligation.name,
          questionnaireNumber: matrixData.obligation.questionnaireNumber,
          taskName: matrixData.obligation.components[0]?.name ?? "ציון",
        })
      : "");

  async function handleExport() {
    if (!matrixData) return;
    const safeName = matrixData.class.name.replace(/[/\\?*[\]]/g, "-");
    await downloadExcel(`ציונים_${safeName}_${exportTimestamp()}.xlsx`, [
      buildMatrixSheet({
        className: matrixData.class.name,
        subjectName: matrixData.subject.displayName ?? matrixData.subject.name,
        taskLabel: taskHeaderLabel,
        rows: tableRows.map((r) => ({
          studentName: r.studentName,
          score: r.score,
          status: r.status,
        })),
      }),
    ]);
  }

  if (classesLoading && classes.length === 0) {
    return <PageLoader variant="table" />;
  }

  return (
    <>
      <Card className="p-6">
        <div className="grid gap-4 sm:grid-cols-3">
          <Select
            label="כיתה"
            value={classId}
            onChange={(e) => setClassId(e.target.value)}
          >
            <option value="">— בחר כיתה —</option>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
                {c.gradeYear ? ` (${c.gradeYear})` : ""}
              </option>
            ))}
          </Select>

          <Select
            label="מקצוע"
            value={subjectId}
            onChange={(e) => setSubjectId(e.target.value)}
            disabled={!classId || optionsLoading}
          >
            <option value="">— בחר מקצוע —</option>
            {(options?.subjects ?? []).map((s) => (
              <option key={s.id} value={s.id}>
                {s.displayName ?? s.name}
                {s.units ? ` (${s.units} יח"ל)` : ""}
              </option>
            ))}
          </Select>

          <Select
            label="מטלה"
            value={taskKey}
            onChange={(e) => setTaskKey(e.target.value)}
            disabled={!subjectId}
          >
            <option value="">— בחר מטלה —</option>
            {tasks.map((t) => (
              <option
                key={makeMatrixTaskKey(t.id, t.taskKind, t.sortOrder)}
                value={makeMatrixTaskKey(t.id, t.taskKind, t.sortOrder)}
              >
                {t.label} ({t.relevantStudentCount} תלמידים)
              </option>
            ))}
          </Select>
        </div>
      </Card>

      {matrixLoading && taskKey && (
        <div className="mt-8">
          <PageLoader variant="table" />
        </div>
      )}

      {!matrixLoading && matrixData && taskKey && (
        <>
          <div className="mt-6 flex flex-wrap items-end justify-between gap-3">
            <div className="text-sm text-slate-600">
              <span className="font-medium">{matrixData.rows.length} תלמידים</span>
              {matrixData.notRelevantCount > 0 && (
                <span className="me-2 text-slate-400">
                  • {matrixData.notRelevantCount} לא רלוונטיים לכיתה זו
                </span>
              )}
              <span className="block text-slate-500">
                {matrixData.subject.displayName ?? matrixData.subject.name}
                {matrixData.subject.units ? ` (${matrixData.subject.units} יח"ל)` : ""}
                {" — "}
                {taskHeaderLabel}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {isDirty && <span className="badge-warning">שינויים לא שמורים</span>}
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min={0}
                  max={100}
                  inputMode="decimal"
                  className="w-20 py-1.5 text-xs"
                  placeholder="ציון"
                  value={bulkScore}
                  onChange={(e) => setBulkScore(e.target.value)}
                />
                <Button type="button" variant="secondary" size="sm" onClick={applyBulkScore}>
                  החל לכל הריקים
                </Button>
              </div>
              <Button onClick={saveGrades} disabled={saving || !isDirty} size="sm">
                {saving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                שמירה
              </Button>
              <ExportButton
                onExport={handleExport}
                disabled={tableRows.length === 0}
                label="ייצוא"
                size="sm"
              />
            </div>
          </div>

          {saveError && (
            <Alert variant="error" className="mt-4" onClose={() => setSaveError(null)}>
              {saveError}
            </Alert>
          )}

          <div className="mt-4">
            <GradeMatrixTable rows={tableRows} components={components} onChange={handleChange} />
          </div>
        </>
      )}
    </>
  );
}

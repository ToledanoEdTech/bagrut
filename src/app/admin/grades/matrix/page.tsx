"use client";

import { useEffect, useMemo, useState } from "react";
import { Save, Loader2, AlertCircle } from "lucide-react";
import { useApi } from "@/hooks/useApi";
import { PageLoader } from "@/components/ui/PageLoader";
import { GradeMatrixTable, type MatrixRow } from "@/components/grades/GradeMatrixTable";
import { invalidateCache } from "@/lib/api-cache";
import { autoStatusOnScore } from "@/lib/grade-status";
import type { SubmissionStatus } from "@/lib/types";

type ClassItem = { id: string; name: string; gradeYear: string | null };

type MatrixOptions = {
  subjects: Array<{
    id: string;
    name: string;
    units: number | null;
    obligations: Array<{
      id: string;
      name: string | null;
      questionnaireNumber: string | null;
      relevantStudentCount: number;
    }>;
  }>;
};

type MatrixData = {
  class: { id: string; name: string; gradeYear: string | null };
  subject: { id: string; name: string; units: number | null };
  obligation: {
    id: string;
    name: string | null;
    questionnaireNumber: string | null;
    weightPercent: number;
    examType: string;
  };
  rows: Array<{
    studentId: string;
    studentName: string;
    grade: { score: number | null; status: SubmissionStatus; notes: string | null } | null;
  }>;
  notRelevantCount: number;
};

type RowState = Record<string, { score: number | null; status: SubmissionStatus }>;

function obligationLabel(ob: {
  name: string | null;
  questionnaireNumber: string | null;
}): string {
  if (ob.name) return ob.name;
  if (ob.questionnaireNumber) return `שאלון ${ob.questionnaireNumber}`;
  return "חובה";
}

export default function GradesMatrixPage() {
  const { data: classes = [], loading: classesLoading } = useApi<ClassItem[]>("/api/classes/list");
  const [classId, setClassId] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [obligationId, setObligationId] = useState("");
  const [rowState, setRowState] = useState<RowState>({});
  const [savedSnapshot, setSavedSnapshot] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [bulkScore, setBulkScore] = useState("");

  const optionsKey = classId ? `/api/grades/matrix/options?classId=${classId}` : null;
  const { data: options, loading: optionsLoading } = useApi<MatrixOptions>(optionsKey);

  const matrixKey =
    classId && obligationId
      ? `/api/grades/matrix?classId=${classId}&obligationId=${obligationId}`
      : null;
  const { data: matrixData, loading: matrixLoading, mutate: refreshMatrix } =
    useApi<MatrixData>(matrixKey);

  useEffect(() => {
    setSubjectId("");
    setObligationId("");
    setRowState({});
    setSavedSnapshot("");
  }, [classId]);

  useEffect(() => {
    setObligationId("");
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
  const obligations = selectedSubject?.obligations ?? [];

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
    field: "score" | "status",
    value: number | null | SubmissionStatus
  ) {
    setRowState((prev) => {
      const current = prev[studentId] ?? { score: null, status: "NOT_STARTED" as SubmissionStatus };
      if (field === "score") {
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
        if (row.score == null) {
          next[row.studentId] = {
            score,
            status: "GRADED",
          };
        }
      }
      return next;
    });
  }

  async function saveGrades() {
    if (!obligationId || !matrixData) return;
    setSaving(true);
    setSaveError(null);
    try {
      const res = await fetch("/api/grades/matrix", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          obligationId,
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
      invalidateCache("/api/grades");
      await refreshMatrix();
    } catch {
      setSaveError("שגיאת רשת בשמירה");
    } finally {
      setSaving(false);
    }
  }

  if (classesLoading && classes.length === 0) {
    return <PageLoader />;
  }

  return (
    <>
      <div className="mt-6 card p-6">
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label className="label">כיתה</label>
            <select
              className="input"
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
            </select>
          </div>

          <div>
            <label className="label">מקצוע</label>
            <select
              className="input"
              value={subjectId}
              onChange={(e) => setSubjectId(e.target.value)}
              disabled={!classId || optionsLoading}
            >
              <option value="">— בחר מקצוע —</option>
              {(options?.subjects ?? []).map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                  {s.units ? ` (${s.units} יח"ל)` : ""}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="label">מטלה</label>
            <select
              className="input"
              value={obligationId}
              onChange={(e) => setObligationId(e.target.value)}
              disabled={!subjectId}
            >
              <option value="">— בחר מטלה —</option>
              {obligations.map((o) => (
                <option key={o.id} value={o.id}>
                  {obligationLabel(o)} ({o.relevantStudentCount} תלמידים)
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {matrixLoading && obligationId && (
        <div className="mt-8 flex justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
        </div>
      )}

      {!matrixLoading && matrixData && obligationId && (
        <>
          <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
            <div className="text-sm text-slate-600">
              <span className="font-medium">{matrixData.rows.length} תלמידים</span>
              {matrixData.notRelevantCount > 0 && (
                <span className="me-2 text-slate-400">
                  • {matrixData.notRelevantCount} לא רלוונטיים לכיתה זו
                </span>
              )}
              <span className="block text-slate-500">
                {matrixData.subject.name}
                {matrixData.subject.units ? ` (${matrixData.subject.units} יח"ל)` : ""}
                {" — "}
                {obligationLabel(matrixData.obligation)}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {isDirty && <span className="badge-warning">שינויים לא שמורים</span>}
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={0}
                  max={100}
                  className="input w-20 py-1.5 text-xs"
                  placeholder="ציון"
                  value={bulkScore}
                  onChange={(e) => setBulkScore(e.target.value)}
                />
                <button type="button" onClick={applyBulkScore} className="btn-secondary text-xs">
                  החל לכל הריקים
                </button>
              </div>
              <button onClick={saveGrades} className="btn-primary" disabled={saving || !isDirty}>
                {saving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                שמירת ציונים
              </button>
            </div>
          </div>

          {saveError && (
            <div className="mt-4 flex items-center gap-2 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {saveError}
            </div>
          )}

          <div className="mt-4">
            <GradeMatrixTable rows={tableRows} onChange={handleChange} />
          </div>
        </>
      )}
    </>
  );
}

"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { SubjectCard } from "@/components/subjects/SubjectCard";
import { calcWeightedComponentScore, calcWeightedSubItemScore, normalizeComponents, normalizeSubItems, resolveObligationGradeScore } from "@/lib/grade-components";
import { calcSubjectProgress } from "@/lib/progress";
import { autoStatusOnScore } from "@/lib/grade-status";
import type { SubmissionStatus } from "@/lib/types";
import { Save, Loader2, ChevronRight, ChevronLeft, ArrowLeft, AlertCircle, Check } from "lucide-react";
import { useApi } from "@/hooks/useApi";
import { PageLoader } from "@/components/ui/PageLoader";
import { ExportButton } from "@/components/ui/ExportButton";
import {
  buildStudentGradesSheet,
  downloadExcel,
  exportTimestamp,
} from "@/lib/excel-export";
import { prefetch, invalidateCache } from "@/lib/api-cache";

type Student = {
  id: string;
  mathUnits: number;
  englishUnits: number;
  user: { name: string };
  class: { id: string; examPathId: string; name: string };
  track: { id: string; name: string } | null;
};

type Subject = {
  id: string;
  name: string;
  units: number | null;
  obligations: Array<{
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
  }>;
};

type Grade = {
  obligationId: string;
  score: number | null;
  componentScores?: Record<number, number | null> | null;
  subItemScores?: Record<number, number | null> | null;
  status: string;
};

type GradeRow = {
  obligationId: string;
  score: number | null;
  componentScores?: Record<number, number | null> | null;
  subItemScores?: Record<number, number | null> | null;
  status: string;
};

type SaveState = "idle" | "saving" | "saved" | "error";

export default function GradesPage() {
  const { data: students = [], loading: studentsLoading } = useApi<Student[]>("/api/students");
  const [classFilter, setClassFilter] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [grades, setGrades] = useState<Grade[]>([]);
  const [savedSnapshot, setSavedSnapshot] = useState("");
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [saveError, setSaveError] = useState<string | null>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const filteredStudents = useMemo(() => {
    if (!classFilter) return students;
    return students.filter((s) => s.class?.id === classFilter);
  }, [students, classFilter]);

  const classOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const s of students) {
      if (s.class?.id) map.set(s.class.id, s.class.name);
    }
    return Array.from(map.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name, "he"));
  }, [students]);

  const currentIndex = filteredStudents.findIndex((s) => s.id === selectedId);

  const gradesKey = selectedId ? `/api/grades?studentId=${selectedId}` : null;
  const subjectsKey = selectedId ? `/api/students/subjects?studentId=${selectedId}` : null;

  const { data: gradesData, loading: gradesLoading, mutate: refreshGrades } = useApi<GradeRow[]>(gradesKey);
  const { data: subjects = [], loading: subjectsLoading, mutate: refreshSubjects } = useApi<Subject[]>(subjectsKey);

  const loading = !!selectedId && (gradesLoading || subjectsLoading) && grades.length === 0 && subjects.length === 0;
  const isDirty = savedSnapshot !== "" && JSON.stringify(grades) !== savedSnapshot;

  useEffect(() => {
    if (!selectedId) return;
    prefetch(`/api/grades?studentId=${selectedId}`);
    prefetch(`/api/students/subjects?studentId=${selectedId}`);
  }, [selectedId]);

  useEffect(() => {
    if (!gradesData) {
      setGrades([]);
      setSavedSnapshot("");
      return;
    }
    const initial = gradesData.map((g) => ({
      obligationId: g.obligationId,
      score: g.score,
      componentScores: g.componentScores ?? null,
      subItemScores: g.subItemScores ?? null,
      status: g.status,
    }));
    setGrades(initial);
    setSavedSnapshot(JSON.stringify(initial));
    setSaveState("idle");
    setSaveError(null);
  }, [gradesData]);

  const saveGrades = useCallback(async () => {
    if (!selectedId) return false;
    setSaveState("saving");
    setSaveError(null);
    try {
      const res = await fetch("/api/grades", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ studentId: selectedId, grades }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setSaveState("error");
        setSaveError((data as { error?: string }).error ?? "שגיאה בשמירה");
        return false;
      }
      setSavedSnapshot(JSON.stringify(grades));
      setSaveState("saved");
      invalidateCache(`/api/grades?studentId=${selectedId}`);
      await Promise.all([refreshGrades(), refreshSubjects()]);
      return true;
    } catch {
      setSaveState("error");
      setSaveError("שגיאת רשת בשמירה");
      return false;
    }
  }, [selectedId, grades, refreshGrades, refreshSubjects]);

  useEffect(() => {
    if (!selectedId || !isDirty) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      void saveGrades();
    }, 800);
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [grades, selectedId, isDirty, saveGrades]);

  function handleGradeChange(obligationId: string, field: string, value: string | number | null) {
    setGrades((prev) => {
      const obligation = subjects
        .flatMap((s) => s.obligations)
        .find((o) => o.id === obligationId);
      const existing = prev.find((g) => g.obligationId === obligationId);

      if (field.startsWith("componentScore:")) {
        const sortOrder = Number(field.split(":")[1]);
        const componentScores = {
          ...(existing?.componentScores ?? {}),
          [sortOrder]: value as number | null,
        };
        const score = obligation
          ? calcWeightedComponentScore(normalizeComponents(obligation.components), componentScores)
          : null;
        const hasAnyScore = Object.values(componentScores).some((s) => s != null);
        const status = (existing?.status ?? "NOT_STARTED") as SubmissionStatus;
        const nextStatus = hasAnyScore ? autoStatusOnScore(score ?? 0, status) : status;

        if (existing) {
          return prev.map((g) =>
            g.obligationId === obligationId
              ? { ...g, componentScores, score, status: nextStatus }
              : g
          );
        }
        return [
          ...prev,
          {
            obligationId,
            score,
            componentScores,
            subItemScores: null,
            status: nextStatus,
          },
        ];
      }

      if (field.startsWith("subItemScore:")) {
        const sortOrder = Number(field.split(":")[1]);
        const subItemScores = {
          ...(existing?.subItemScores ?? {}),
          [sortOrder]: value as number | null,
        };
        const score = obligation
          ? calcWeightedSubItemScore(normalizeSubItems(obligation.subItems), subItemScores)
          : null;
        const hasAnyScore = Object.values(subItemScores).some((s) => s != null);
        const status = (existing?.status ?? "NOT_STARTED") as SubmissionStatus;
        const nextStatus = hasAnyScore ? autoStatusOnScore(score ?? 0, status) : status;

        if (existing) {
          return prev.map((g) =>
            g.obligationId === obligationId
              ? { ...g, subItemScores, score, status: nextStatus }
              : g
          );
        }
        return [
          ...prev,
          {
            obligationId,
            score,
            componentScores: null,
            subItemScores,
            status: nextStatus,
          },
        ];
      }

      if (existing) {
        const next = { ...existing, [field]: value };
        if (field === "score") {
          next.status = autoStatusOnScore(
            value as number | null,
            existing.status as SubmissionStatus
          );
        }
        return prev.map((g) => (g.obligationId === obligationId ? next : g));
      }
      return [
        ...prev,
        {
          obligationId,
          score: field === "score" ? (value as number | null) : null,
          componentScores: null,
          subItemScores: null,
          status: field === "status" ? (value as string) : "NOT_STARTED",
        },
      ];
    });
    setSaveState("idle");
  }

  async function navigateStudent(direction: -1 | 1) {
    const nextIndex = currentIndex + direction;
    if (nextIndex < 0 || nextIndex >= filteredStudents.length) return;

    if (isDirty) {
      const ok = window.confirm("יש שינויים לא שמורים. לעבור לתלמיד הבא בכל זאת?");
      if (!ok) return;
    }

    setSelectedId(filteredStudents[nextIndex]!.id);
  }

  const selectedStudent = students.find((s) => s.id === selectedId);

  async function handleExport() {
    if (!selectedStudent) return;
    await downloadExcel(
      `ציונים_${selectedStudent.user.name}_${exportTimestamp()}.xlsx`,
      [
        buildStudentGradesSheet(
          selectedStudent.user.name,
          selectedStudent.class.name,
          subjects,
          grades
        ),
      ]
    );
  }

  if (studentsLoading && students.length === 0) {
    return <PageLoader variant="skeleton" />;
  }

  return (
    <>
      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <Link href="/admin/grades/matrix" className="btn-primary">
          <ArrowLeft className="h-4 w-4" />
          הזנה מהירה לפי מטלה
        </Link>
        <div className="flex flex-wrap items-center gap-2">
          <ExportButton
            onExport={handleExport}
            disabled={!selectedId || subjects.length === 0}
            label="ייצוא ציונים"
          />
          <div className="flex items-center gap-2 text-sm">
          {saveState === "saving" && (
            <span className="flex items-center gap-1 text-slate-500">
              <Loader2 className="h-3 w-3 animate-spin" />
              שומר...
            </span>
          )}
          {saveState === "saved" && !isDirty && (
            <span className="flex items-center gap-1 text-emerald-600">
              <Check className="h-3 w-3" />
              נשמר
            </span>
          )}
          {saveState === "error" && (
            <span className="flex items-center gap-1 text-red-600">
              <AlertCircle className="h-3 w-3" />
              שגיאה
            </span>
          )}
          {isDirty && saveState !== "saving" && (
            <span className="badge-warning">שינויים לא שמורים</span>
          )}
          </div>
        </div>
      </div>

      {saveError && (
        <div className="mt-4 flex items-center gap-2 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {saveError}
        </div>
      )}

      <div className="mt-4 card p-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label">סנן לפי כיתה</label>
            <select
              className="input"
              value={classFilter}
              onChange={(e) => {
                setClassFilter(e.target.value);
                setSelectedId("");
              }}
            >
              <option value="">כל הכיתות</option>
              {classOptions.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label">בחר תלמיד</label>
            <div className="flex gap-2">
              <button
                type="button"
                className="btn-secondary shrink-0 px-3"
                disabled={currentIndex <= 0}
                onClick={() => navigateStudent(-1)}
                title="תלמיד קודם"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
              <select
                className="input min-w-0 flex-1"
                value={selectedId}
                onChange={(e) => {
                  if (isDirty) {
                    const ok = window.confirm("יש שינויים לא שמורים. לעבור לתלמיד אחר בכל זאת?");
                    if (!ok) return;
                  }
                  setSelectedId(e.target.value);
                }}
              >
                <option value="">— בחר תלמיד —</option>
                {filteredStudents.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.user.name} ({s.class.name})
                  </option>
                ))}
              </select>
              <button
                type="button"
                className="btn-secondary shrink-0 px-3"
                disabled={currentIndex < 0 || currentIndex >= filteredStudents.length - 1}
                onClick={() => navigateStudent(1)}
                title="תלמיד הבא"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>

        {selectedStudent && (
          <div className="mt-4 flex flex-wrap gap-3 text-sm text-slate-500">
            <span>מתמטיקה: {selectedStudent.mathUnits} יח&quot;ל</span>
            <span>אנגלית: {selectedStudent.englishUnits} יח&quot;ל</span>
            {selectedStudent.track && <span>מגמה: {selectedStudent.track.name}</span>}
          </div>
        )}
      </div>

      {loading && (
        <div className="mt-8 flex justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
        </div>
      )}

      {!loading && selectedId && subjects.length > 0 && (
        <>
          <div className="mt-6 flex justify-start">
            <button
              onClick={() => void saveGrades()}
              className="btn-primary"
              disabled={saveState === "saving" || !isDirty}
            >
              {saveState === "saving" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              שמירת ציונים
            </button>
          </div>

          <div className="mt-4 space-y-4">
            {subjects.map((subject) => {
              const subjectGrades = grades
                .filter((g) => subject.obligations.some((o) => o.id === g.obligationId))
                .map((g) => {
                  const obligation = subject.obligations.find((o) => o.id === g.obligationId);
                  if (!obligation) return g;
                  return {
                    ...g,
                    score: resolveObligationGradeScore(obligation, g),
                  };
                });
              const progress = calcSubjectProgress(subject.obligations, subjectGrades);

              return (
                <SubjectCard
                  key={subject.id}
                  name={subject.name}
                  units={subject.units}
                  obligations={subject.obligations}
                  grades={subjectGrades}
                  progress={progress}
                  readOnly={false}
                  onGradeChange={handleGradeChange}
                />
              );
            })}
          </div>
        </>
      )}
    </>
  );
}

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
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Select } from "@/components/ui/Select";
import { Alert } from "@/components/ui/Alert";
import { ExportButton } from "@/components/ui/ExportButton";
import { UnsavedChangesBanner } from "@/components/ui/UnsavedChangesBanner";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { useToast } from "@/components/ui/Toast";
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
  pathLabels?: string[];
  displayName?: string;
  category?: string | null;
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
  const confirm = useConfirm();
  const toast = useToast();
  const { data: students = [], loading: studentsLoading } = useApi<Student[]>("/api/students");
  const [classFilter, setClassFilter] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [jumpSubjectId, setJumpSubjectId] = useState("");
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
      toast.success("נשמר בהצלחה");
      invalidateCache(`/api/grades?studentId=${selectedId}`);
      await Promise.all([refreshGrades(), refreshSubjects()]);
      return true;
    } catch {
      setSaveState("error");
      setSaveError("שגיאת רשת בשמירה");
      return false;
    }
  }, [selectedId, grades, refreshGrades, refreshSubjects, toast]);

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
      const ok = await confirm({
        title: "שינויים לא שמורים",
        description: "לעבור לתלמיד אחר בכל זאת? השינויים שלא נשמרו עלולים להיאבד.",
        confirmLabel: "עבור בכל זאת",
        variant: "danger",
      });
      if (!ok) return;
    }

    setSelectedId(filteredStudents[nextIndex]!.id);
  }

  async function selectStudent(id: string) {
    if (id === selectedId) return;
    if (isDirty) {
      const ok = await confirm({
        title: "שינויים לא שמורים",
        description: "לעבור לתלמיד אחר בכל זאת? השינויים שלא נשמרו עלולים להיאבד.",
        confirmLabel: "עבור בכל זאת",
        variant: "danger",
      });
      if (!ok) return;
    }
    setSelectedId(id);
  }

  function jumpToSubject(subjectId: string) {
    if (!subjectId) return;
    document.getElementById(`subject-${subjectId}`)?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
    setJumpSubjectId(subjectId);
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
      <div className="flex flex-wrap items-center justify-end gap-2">
        <ExportButton
          onExport={handleExport}
          disabled={!selectedId || subjects.length === 0}
          label="ייצוא ציונים"
        />
        <Link href="/admin/grades/matrix" className="btn-secondary">
          <ArrowLeft className="h-4 w-4" />
          הזנה מהירה לפי מטלה
        </Link>
      </div>

      <UnsavedChangesBanner visible={isDirty && saveState !== "saving"}>
        <Button
          size="sm"
          variant="secondary"
          onClick={() => void saveGrades()}
          disabled={saveState === "saving"}
        >
          <Save className="h-3.5 w-3.5" />
          שמור עכשיו
        </Button>
      </UnsavedChangesBanner>

      {saveError && (
        <Alert variant="error" className="mt-4" onClose={() => setSaveError(null)}>
          {saveError}
        </Alert>
      )}

      {selectedStudent && (
        <div className="sticky top-0 z-20 -mx-4 mb-4 border-b border-slate-200/70 bg-white/95 px-4 py-3 backdrop-blur-md lg:-mx-8 lg:px-8">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-lg font-bold text-slate-900">
                {selectedStudent.user.name}
              </p>
              <p className="text-sm text-slate-500">
                {selectedStudent.class.name}
                {" · "}מתמטיקה {selectedStudent.mathUnits}
                {" · "}אנגלית {selectedStudent.englishUnits}
                {selectedStudent.track && ` · ${selectedStudent.track.name}`}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1 text-sm">
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={currentIndex <= 0}
                  onClick={() => navigateStudent(-1)}
                  aria-label="תלמיד קודם"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={currentIndex < 0 || currentIndex >= filteredStudents.length - 1}
                  onClick={() => navigateStudent(1)}
                  aria-label="תלמיד הבא"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
              </div>
              {saveState === "saving" && (
                <span className="flex items-center gap-1 text-sm text-slate-500">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  שומר...
                </span>
              )}
              {saveState === "saved" && !isDirty && (
                <span className="badge-success flex items-center gap-1">
                  <Check className="h-3 w-3" />
                  נשמר
                </span>
              )}
              {saveState === "error" && (
                <span className="badge-danger flex items-center gap-1">
                  <AlertCircle className="h-3 w-3" />
                  שגיאה
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      <Card className="mt-4 p-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <Select
            label="סנן לפי כיתה"
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
          </Select>
          <div>
            <label className="label">בחר תלמיד</label>
            <div className="flex gap-2">
              <select
                className="input min-w-0 flex-1"
                value={selectedId}
                onChange={(e) => void selectStudent(e.target.value)}
              >
                <option value="">— בחר תלמיד —</option>
                {filteredStudents.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.user.name} ({s.class.name})
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {subjects.length > 0 && (
          <div className="mt-4 max-w-md">
            <Select
              label="קפיצה למקצוע"
              value={jumpSubjectId}
              onChange={(e) => jumpToSubject(e.target.value)}
            >
              <option value="">— בחר מקצוע —</option>
              {subjects.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.displayName ?? s.name}
                </option>
              ))}
            </Select>
          </div>
        )}
      </Card>

      {loading && (
        <div className="mt-8 flex justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
        </div>
      )}

      {!loading && selectedId && subjects.length > 0 && (
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
                <div key={subject.id} id={`subject-${subject.id}`} className="scroll-mt-28">
                  <SubjectCard
                    name={subject.name}
                    pathLabels={subject.pathLabels}
                    category={subject.category}
                    units={subject.units}
                    obligations={subject.obligations}
                    grades={subjectGrades}
                    progress={progress}
                    readOnly={false}
                    onGradeChange={handleGradeChange}
                  />
                </div>
              );
            })}
        </div>
      )}
    </>
  );
}

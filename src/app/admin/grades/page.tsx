"use client";

import { useEffect, useState } from "react";
import { SubjectCard } from "@/components/subjects/SubjectCard";
import { calcSubjectProgress } from "@/lib/progress";
import { Save, Loader2 } from "lucide-react";
import { useApi } from "@/hooks/useApi";
import { PageLoader } from "@/components/ui/PageLoader";
import { prefetch } from "@/lib/api-cache";

type Student = {
  id: string;
  mathUnits: number;
  englishUnits: number;
  user: { name: string };
  class: { examPathId: string; name: string };
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
    components: Array<{ name: string; weightPercent: number }>;
    subItems: Array<{ name: string; weightPercent: number }>;
  }>;
};

type Grade = {
  obligationId: string;
  score: number | null;
  status: string;
};

type GradeRow = {
  obligationId: string;
  score: number | null;
  status: string;
};

export default function GradesPage() {
  const { data: students = [], loading: studentsLoading } = useApi<Student[]>("/api/students");
  const [selectedId, setSelectedId] = useState("");
  const [grades, setGrades] = useState<Grade[]>([]);
  const [saving, setSaving] = useState(false);

  const gradesKey = selectedId ? `/api/grades?studentId=${selectedId}` : null;
  const subjectsKey = selectedId ? `/api/students/subjects?studentId=${selectedId}` : null;

  const { data: gradesData, loading: gradesLoading, mutate: refreshGrades } = useApi<GradeRow[]>(gradesKey);
  const { data: subjects = [], loading: subjectsLoading, mutate: refreshSubjects } = useApi<Subject[]>(subjectsKey);

  const loading = !!selectedId && (gradesLoading || subjectsLoading) && grades.length === 0 && subjects.length === 0;

  useEffect(() => {
    if (!selectedId) return;
    prefetch(`/api/grades?studentId=${selectedId}`);
    prefetch(`/api/students/subjects?studentId=${selectedId}`);
  }, [selectedId]);

  useEffect(() => {
    if (!gradesData) {
      setGrades([]);
      return;
    }
    setGrades(
      gradesData.map((g) => ({
        obligationId: g.obligationId,
        score: g.score,
        status: g.status,
      }))
    );
  }, [gradesData]);

  function handleGradeChange(obligationId: string, field: string, value: string | number | null) {
    setGrades((prev) => {
      const existing = prev.find((g) => g.obligationId === obligationId);
      if (existing) {
        return prev.map((g) =>
          g.obligationId === obligationId ? { ...g, [field]: value } : g
        );
      }
      return [
        ...prev,
        {
          obligationId,
          score: field === "score" ? (value as number | null) : null,
          status: field === "status" ? (value as string) : "NOT_STARTED",
        },
      ];
    });
  }

  async function saveGrades() {
    if (!selectedId) return;
    setSaving(true);
    await fetch("/api/grades", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ studentId: selectedId, grades }),
    });
    setSaving(false);
    await Promise.all([refreshGrades(), refreshSubjects()]);
    alert("הציונים נשמרו בהצלחה");
  }

  const selectedStudent = students.find((s) => s.id === selectedId);

  if (studentsLoading && students.length === 0) {
    return <PageLoader />;
  }

  return (
    <>
      <header className="-mx-8 -mt-8 border-b border-slate-200 bg-white px-8 py-6">
        <h1 className="text-2xl font-bold text-slate-900">הזנת ציונים</h1>
        <p className="mt-1 text-sm text-slate-500">
          בחר תלמיד והזן ציונים וסטטוס הגשה לכל חובה
        </p>
      </header>

      <div className="mt-6 card p-6">
        <label className="label">בחר תלמיד</label>
        <select
          className="input max-w-md"
          value={selectedId}
          onChange={(e) => setSelectedId(e.target.value)}
        >
          <option value="">— בחר תלמיד —</option>
          {students.map((s) => (
            <option key={s.id} value={s.id}>
              {s.user.name} ({s.class.name})
            </option>
          ))}
        </select>

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
            <button onClick={saveGrades} className="btn-primary" disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              שמירת ציונים
            </button>
          </div>

          <div className="mt-4 space-y-4">
            {subjects.map((subject) => {
              const subjectGrades = grades.filter((g) =>
                subject.obligations.some((o) => o.id === g.obligationId)
              );
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

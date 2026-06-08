"use client";

import { useMemo, useState } from "react";
import { Plus, Pencil, Trash2, Save, X, ChevronLeft, Users } from "lucide-react";
import { useApi } from "@/hooks/useApi";
import { PageLoader } from "@/components/ui/PageLoader";
import { StudentCardView } from "@/components/students/StudentCardView";

type ExamPath = { id: string; label: string; key: string };
type ClassItem = {
  id: string;
  name: string;
  gradeYear: string | null;
  examPath: ExamPath;
  _count: { students: number };
};

type Student = {
  id: string;
  mathUnits: number;
  englishUnits: number;
  user: { name: string };
  class: { id: string; name: string } | null;
  track: { name: string } | null;
  tracks: { name: string }[];
};

type View = "classes" | "students" | "detail";

export default function ClassesPage() {
  const { data: classes = [], loading, mutate: refreshClasses } = useApi<ClassItem[]>("/api/classes");
  const { data: paths = [], mutate: refreshPaths } = useApi<ExamPath[]>("/api/paths");
  const { data: students = [], loading: studentsLoading } = useApi<Student[]>("/api/students");

  const [view, setView] = useState<View>("classes");
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [form, setForm] = useState({ name: "", gradeYear: "", examPathId: "" });

  const selectedClass = classes.find((c) => c.id === selectedClassId);
  const selectedStudent = students.find((s) => s.id === selectedStudentId);

  const classStudents = useMemo(() => {
    if (!selectedClassId) return [];
    return students
      .filter((s) => s.class?.id === selectedClassId)
      .sort((a, b) => a.user.name.localeCompare(b.user.name, "he"));
  }, [students, selectedClassId]);

  async function load() {
    await Promise.all([refreshClasses(), refreshPaths()]);
    if (paths.length && !form.examPathId) {
      setForm((f) => ({ ...f, examPathId: paths[0].id }));
    }
  }

  async function saveNew() {
    await fetch("/api/classes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setShowNew(false);
    setForm({ name: "", gradeYear: "", examPathId: paths[0]?.id ?? "" });
    load();
  }

  async function saveEdit(id: string) {
    await fetch("/api/classes", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, ...form }),
    });
    setEditing(null);
    load();
  }

  async function remove(id: string) {
    const res = await fetch(`/api/classes?id=${id}`, { method: "DELETE" });
    const data = await res.json();
    if (!res.ok) alert(data.error);
    else load();
  }

  function openClass(classId: string) {
    setSelectedClassId(classId);
    setSelectedStudentId(null);
    setView("students");
  }

  function openStudent(studentId: string) {
    setSelectedStudentId(studentId);
    setView("detail");
  }

  function backToClasses() {
    setView("classes");
    setSelectedClassId(null);
    setSelectedStudentId(null);
  }

  function backToStudents() {
    setView("students");
    setSelectedStudentId(null);
  }

  if (loading && classes.length === 0) {
    return <PageLoader />;
  }

  if (view === "detail" && selectedStudentId) {
    return (
      <>
        <header className="-mx-8 -mt-8 border-b border-slate-200 bg-white px-8 py-6">
          <button onClick={backToStudents} className="btn-secondary mb-4">
            <ChevronLeft className="h-4 w-4" />
            חזרה לרשימת התלמידים
          </button>
          <h1 className="text-2xl font-bold text-slate-900">
            {selectedStudent?.user.name ?? "כרטיס תלמיד"}
          </h1>
          {selectedClass && (
            <p className="mt-1 text-sm text-slate-500">
              {selectedClass.name}
              {selectedClass.gradeYear ? ` · ${selectedClass.gradeYear}` : ""}
            </p>
          )}
        </header>
        <div className="mt-8">
          <StudentCardView studentId={selectedStudentId} />
        </div>
      </>
    );
  }

  if (view === "students" && selectedClass) {
    return (
      <>
        <header className="-mx-8 -mt-8 border-b border-slate-200 bg-white px-8 py-6">
          <button onClick={backToClasses} className="btn-secondary mb-4">
            <ChevronLeft className="h-4 w-4" />
            חזרה לכיתות
          </button>
          <h1 className="text-2xl font-bold text-slate-900">{selectedClass.name}</h1>
          <p className="mt-1 text-sm text-slate-500">
            {selectedClass.gradeYear && <span>{selectedClass.gradeYear} · </span>}
            {selectedClass.examPath.label} · {classStudents.length} תלמידים
          </p>
        </header>

        <div className="mt-8">
          {studentsLoading && classStudents.length === 0 ? (
            <PageLoader />
          ) : classStudents.length === 0 ? (
            <div className="card p-8 text-center text-slate-500">
              <Users className="mx-auto h-10 w-10 text-slate-300" />
              <p className="mt-3">אין תלמידים בכיתה זו</p>
            </div>
          ) : (
            <div className="card divide-y divide-slate-100 overflow-hidden">
              {classStudents.map((student) => {
                const trackLabel =
                  student.tracks?.length > 0
                    ? student.tracks.map((t) => t.name).join(", ")
                    : student.track?.name;

                return (
                  <button
                    key={student.id}
                    type="button"
                    onClick={() => openStudent(student.id)}
                    className="flex w-full items-center justify-between gap-4 px-5 py-4 text-right transition hover:bg-slate-50"
                  >
                    <ChevronLeft className="h-4 w-4 shrink-0 text-slate-400" />
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-slate-900">{student.user.name}</p>
                      <p className="mt-0.5 text-sm text-slate-500">
                        מתמטיקה {student.mathUnits} יח&quot;ל · אנגלית {student.englishUnits}{" "}
                        יח&quot;ל
                        {trackLabel ? ` · ${trackLabel}` : ""}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </>
    );
  }

  return (
    <>
      <header className="-mx-8 -mt-8 border-b border-slate-200 bg-white px-8 py-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">כיתות ותוכניות חובה</h1>
            <p className="mt-1 text-sm text-slate-500">
              הגדרת כיתות ושיוך לתוכנית חובה (רגילה, בית מדרש, מב&quot;ר/חנ&quot;מ)
            </p>
          </div>
          <button onClick={() => setShowNew(true)} className="btn-primary">
            <Plus className="h-4 w-4" />
            כיתה חדשה
          </button>
        </div>
      </header>

      {showNew && (
        <div className="mt-6 card p-6">
          <h3 className="font-semibold">כיתה חדשה</h3>
          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            <div>
              <label className="label">שם כיתה</label>
              <input
                className="input"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder={'י"א3'}
              />
            </div>
            <div>
              <label className="label">שכבה</label>
              <select
                className="input"
                value={form.gradeYear}
                onChange={(e) => setForm({ ...form, gradeYear: e.target.value })}
              >
                <option value="">בחר שכבה</option>
                <option value="שכבת ט">שכבת ט</option>
                <option value="שכבת י">שכבת י</option>
                <option value="שכבת יא">שכבת יא</option>
                <option value="שכבת יב">שכבת יב</option>
              </select>
            </div>
            <div>
              <label className="label">תוכנית חובה</label>
              <select
                className="input"
                value={form.examPathId}
                onChange={(e) => setForm({ ...form, examPathId: e.target.value })}
              >
                {paths.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="mt-4 flex gap-3">
            <button onClick={saveNew} className="btn-primary">
              שמירה
            </button>
            <button onClick={() => setShowNew(false)} className="btn-secondary">
              ביטול
            </button>
          </div>
        </div>
      )}

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {classes.map((c) => (
          <div key={c.id} className="card p-5">
            {editing === c.id ? (
              <div className="space-y-3">
                <input
                  className="input"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
                <select
                  className="input"
                  value={form.gradeYear}
                  onChange={(e) => setForm({ ...form, gradeYear: e.target.value })}
                >
                  <option value="שכבת ט">שכבת ט</option>
                  <option value="שכבת י">שכבת י</option>
                  <option value="שכבת יא">שכבת יא</option>
                  <option value="שכבת יב">שכבת יב</option>
                </select>
                <select
                  className="input"
                  value={form.examPathId}
                  onChange={(e) => setForm({ ...form, examPathId: e.target.value })}
                >
                  {paths.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.label}
                    </option>
                  ))}
                </select>
                <div className="flex gap-2">
                  <button onClick={() => saveEdit(c.id)} className="btn-primary flex-1">
                    <Save className="h-4 w-4" />
                  </button>
                  <button onClick={() => setEditing(null)} className="btn-secondary">
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ) : (
              <>
                <div className="flex items-start justify-between">
                  <button
                    type="button"
                    onClick={() => openClass(c.id)}
                    className="min-w-0 flex-1 text-right transition hover:opacity-80"
                  >
                    <h3 className="text-lg font-semibold text-slate-900">{c.name}</h3>
                    <p className="mt-1 text-sm text-slate-500">{c.gradeYear}</p>
                  </button>
                  <div className="flex gap-1">
                    <button
                      onClick={() => {
                        setEditing(c.id);
                        setForm({
                          name: c.name,
                          gradeYear: c.gradeYear ?? "",
                          examPathId: c.examPath.id,
                        });
                      }}
                      className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-primary-600"
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => remove(c.id)}
                      className="rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-500"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => openClass(c.id)}
                  className="mt-4 w-full rounded-xl bg-primary-50 px-3 py-2 text-right transition hover:bg-primary-100"
                >
                  <p className="text-xs text-primary-600">תוכנית חובה</p>
                  <p className="text-sm font-medium text-primary-800">{c.examPath.label}</p>
                </button>
                <button
                  type="button"
                  onClick={() => openClass(c.id)}
                  className="mt-3 flex w-full items-center gap-2 text-sm text-slate-500 transition hover:text-primary-600"
                >
                  <Users className="h-4 w-4" />
                  {c._count.students} תלמידים
                </button>
              </>
            )}
          </div>
        ))}
      </div>
    </>
  );
}

"use client";

import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Plus, Pencil, Trash2, Save, X, ChevronLeft, Users } from "lucide-react";
import { useApi } from "@/hooks/useApi";
import { PageLoader } from "@/components/ui/PageLoader";
import { PageHeader } from "@/components/ui/PageHeader";
import { Breadcrumb } from "@/components/ui/Breadcrumb";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { ExportButton } from "@/components/ui/ExportButton";
import { StudentCardView } from "@/components/students/StudentCardView";
import {
  buildClassStudentsSheet,
  buildClassesSheet,
  downloadExcel,
  exportTimestamp,
} from "@/lib/excel-export";

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
  const [view, setView] = useState<View>("classes");
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [form, setForm] = useState({ name: "", gradeYear: "", examPathId: "" });

  const { data: classes = [], loading, mutate: refreshClasses } = useApi<ClassItem[]>("/api/classes");
  const { data: paths = [], mutate: refreshPaths } = useApi<ExamPath[]>("/api/paths");
  const { data: students = [], loading: studentsLoading } = useApi<Student[]>(
    view !== "classes" ? "/api/students" : null
  );

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

  async function handleExport() {
    if (view === "students" && selectedClass) {
      await downloadExcel(
        `תלמידים_${selectedClass.name}_${exportTimestamp()}.xlsx`,
        [buildClassStudentsSheet(selectedClass.name, classStudents)]
      );
      return;
    }

    await downloadExcel(`כיתות_${exportTimestamp()}.xlsx`, [buildClassesSheet(classes)]);
  }

  if (loading && classes.length === 0) {
    return <PageLoader />;
  }

  return (
    <>
      <PageHeader
        title={
          view === "detail"
            ? (selectedStudent?.user.name ?? "כרטיס תלמיד")
            : view === "students" && selectedClass
              ? selectedClass.name
              : "כיתות ותוכניות חובה"
        }
        subtitle={
          view === "detail" && selectedClass
            ? `${selectedClass.name}${selectedClass.gradeYear ? ` · ${selectedClass.gradeYear}` : ""}`
            : view === "students" && selectedClass
              ? `${selectedClass.gradeYear ? `${selectedClass.gradeYear} · ` : ""}${selectedClass.examPath.label} · ${classStudents.length} תלמידים`
              : 'הגדרת כיתות ושיוך לתוכנית חובה (רגילה, בית מדרש, מב"ר/חנ"מ)'
        }
      >
        <div className="flex flex-wrap items-center gap-2">
          {view !== "detail" && (
            <ExportButton
              onExport={handleExport}
              disabled={view === "students" ? classStudents.length === 0 : classes.length === 0}
              label={view === "students" ? "ייצוא תלמידי כיתה" : "ייצוא כיתות"}
            />
          )}
          {view === "classes" && (
            <Button onClick={() => setShowNew(true)}>
              <Plus className="h-4 w-4" />
              כיתה חדשה
            </Button>
          )}
        </div>
      </PageHeader>

      <Breadcrumb
        items={[
          {
            label: "כיתות",
            active: view === "classes",
            onClick: view !== "classes" ? backToClasses : undefined,
          },
          ...(view !== "classes" && selectedClass
            ? [
                {
                  label: selectedClass.name,
                  active: view === "students",
                  onClick: view === "detail" ? backToStudents : undefined,
                },
              ]
            : []),
          ...(view === "detail" && selectedStudent
            ? [{ label: selectedStudent.user.name, active: true }]
            : []),
        ]}
      />

      <AnimatePresence mode="wait">
        {view === "detail" && selectedStudentId ? (
          <motion.div
            key="detail"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2 }}
            className="mt-4"
          >
            <Button variant="secondary" onClick={backToStudents} className="mb-4">
              <ChevronLeft className="h-4 w-4" />
              חזרה לרשימת התלמידים
            </Button>
            <StudentCardView studentId={selectedStudentId} />
          </motion.div>
        ) : view === "students" && selectedClass ? (
          <motion.div
            key="students"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2 }}
            className="mt-4"
          >
            <Button variant="secondary" onClick={backToClasses} className="mb-4">
              <ChevronLeft className="h-4 w-4" />
              חזרה לכיתות
            </Button>
            {studentsLoading && classStudents.length === 0 ? (
              <PageLoader variant="table" />
            ) : classStudents.length === 0 ? (
              <Card className="p-8 text-center text-base text-slate-500">
                <Users className="mx-auto h-10 w-10 text-slate-300" />
                <p className="mt-3">אין תלמידים בכיתה זו</p>
              </Card>
            ) : (
              <Card variant="flat" className="divide-y divide-slate-100 overflow-hidden">
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
                        <p className="text-base font-medium text-slate-900">
                          {student.user.name}
                        </p>
                        <p className="mt-0.5 text-base text-slate-500">
                          מתמטיקה {student.mathUnits} יח&quot;ל · אנגלית {student.englishUnits}{" "}
                          יח&quot;ל
                          {trackLabel ? ` · ${trackLabel}` : ""}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </Card>
            )}
          </motion.div>
        ) : (
          <motion.div
            key="classes"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            transition={{ duration: 0.2 }}
          >

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
          <Card key={c.id} variant="interactive" className="p-5">
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
                    <h3 className="text-h3 text-slate-900">{c.name}</h3>
                    <p className="mt-1 text-base text-slate-500">{c.gradeYear}</p>
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
                  <p className="text-base font-medium text-primary-800">{c.examPath.label}</p>
                </button>
                <button
                  type="button"
                  onClick={() => openClass(c.id)}
                  className="mt-3 flex w-full items-center gap-2 text-base text-slate-500 transition hover:text-primary-600"
                >
                  <Users className="h-4 w-4" />
                  {c._count.students} תלמידים
                </button>
              </>
            )}
          </Card>
        ))}
      </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

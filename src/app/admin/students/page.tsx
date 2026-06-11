"use client";

import { useMemo, useState } from "react";
import { Plus, Pencil, Trash2, Users, Info } from "lucide-react";
import { useApi } from "@/hooks/useApi";
import { PageLoader } from "@/components/ui/PageLoader";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { ExportButton } from "@/components/ui/ExportButton";
import { SearchInput } from "@/components/ui/SearchInput";
import { Alert } from "@/components/ui/Alert";
import { EmptyState } from "@/components/ui/EmptyState";
import { Sheet } from "@/components/ui/Sheet";
import { useConfirm } from "@/components/ui/ConfirmDialog";
import { useToast } from "@/components/ui/Toast";
import {
  StudentForm,
  type StudentFormData,
} from "@/components/students/StudentForm";
import {
  buildStudentsSheet,
  downloadExcel,
  exportTimestamp,
} from "@/lib/excel-export";
import { useAuth } from "@/components/AuthProvider";
import { hasAnyStudentEdit } from "@/lib/permissions";

type Student = {
  id: string;
  mathUnits: number;
  englishUnits: number;
  mandatorySubjectIds: string[] | null;
  user: { name: string; email: string };
  class: { id: string; name: string; examPath: { id: string; label: string } } | null;
  tracks: { id: string; name: string }[];
  track: { id: string; name: string } | null;
};

type ClassOption = { id: string; name: string };
type ClassItem = { id: string; name: string; gradeYear: string | null; examPathId: string };
type TrackOption = { id: string; name: string };
type SubjectOption = {
  id: string;
  name: string;
  category: string;
  pathLinks?: { path: { id: string; label: string; key: string } }[];
};

const emptyForm = (classes: ClassOption[]): StudentFormData => ({
  name: "",
  email: "",
  class: classes[0] ? { id: classes[0].id, name: classes[0].name } : { id: "", name: "" },
  trackIds: [],
  mathUnits: 3,
  englishUnits: 3,
  mandatorySubjectIds: null,
});

type ClassGroup = {
  id: string;
  name: string;
  gradeYear: string | null;
  examPathLabel: string | null;
  students: Student[];
};

export default function StudentsPage() {
  const { session } = useAuth();
  const canEdit = session ? hasAnyStudentEdit(session) : false;
  const confirm = useConfirm();
  const toast = useToast();

  const { data: students = [], loading: studentsLoading, mutate: refreshStudents } =
    useApi<Student[]>("/api/students");
  const { data: classesRaw = [], mutate: refreshClasses } = useApi<ClassItem[]>("/api/classes");
  const { data: tracks = [], mutate: refreshTracks } = useApi<TrackOption[]>("/api/tracks");
  const { data: allSubjects = [] } = useApi<SubjectOption[]>("/api/subjects");
  const classes: ClassOption[] = classesRaw.map((c) => ({ id: c.id, name: c.name }));

  const [editingId, setEditingId] = useState<string | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [form, setForm] = useState<StudentFormData | null>(null);
  const [newForm, setNewForm] = useState<StudentFormData>(() => emptyForm([]));
  const [saveError, setSaveError] = useState("");
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editExamPathId, setEditExamPathId] = useState<string | null>(null);
  const [newExamPathId, setNewExamPathId] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  function examPathIdForClass(classId: string) {
    return classesRaw.find((c) => c.id === classId)?.examPathId ?? null;
  }

  const classGroups = useMemo(() => {
    const classMeta = new Map(classesRaw.map((c) => [c.id, c]));
    const groups = new Map<string, ClassGroup>();

    for (const student of students) {
      const classId = student.class?.id ?? "__none__";
      const meta = student.class ? classMeta.get(student.class.id) : null;

      if (!groups.has(classId)) {
        groups.set(classId, {
          id: classId,
          name: student.class?.name ?? "ללא כיתה",
          gradeYear: meta?.gradeYear ?? null,
          examPathLabel: student.class?.examPath.label ?? null,
          students: [],
        });
      }
      groups.get(classId)!.students.push(student);
    }

    return Array.from(groups.values())
      .map((group) => ({
        ...group,
        students: group.students.sort((a, b) =>
          a.user.name.localeCompare(b.user.name, "he")
        ),
      }))
      .sort((a, b) => {
        if (a.id === "__none__") return 1;
        if (b.id === "__none__") return -1;
        return a.name.localeCompare(b.name, "he");
      });
  }, [students, classesRaw]);

  const filteredClassGroups = useMemo(() => {
    const q = search.trim();
    if (!q) return classGroups;

    const qLower = q.toLowerCase();
    return classGroups
      .map((group) => ({
        ...group,
        students: group.students.filter((s) => {
          const trackNames =
            s.tracks?.map((t) => t.name).join(" ") ?? s.track?.name ?? "";
          return (
            s.user.name.includes(q) ||
            s.user.email.toLowerCase().includes(qLower) ||
            group.name.includes(q) ||
            trackNames.includes(q)
          );
        }),
      }))
      .filter((group) => group.students.length > 0);
  }, [classGroups, search]);

  const exportStudents = useMemo(() => {
    if (search.trim()) return filteredClassGroups.flatMap((g) => g.students);
    return students;
  }, [students, filteredClassGroups, search]);

  async function load() {
    await Promise.all([refreshStudents(), refreshClasses(), refreshTracks()]);
  }

  function startEdit(s: Student) {
    if (!s.class) return;
    setShowNew(false);
    setEditingId(s.id);
    setSaveError("");
    setEditExamPathId(examPathIdForClass(s.class.id));
    setForm({
      name: s.user.name,
      email: s.user.email,
      class: { id: s.class.id, name: s.class.name },
      trackIds: s.tracks?.map((t) => t.id) ?? (s.track ? [s.track.id] : []),
      mathUnits: s.mathUnits,
      englishUnits: s.englishUnits,
      mandatorySubjectIds: s.mandatorySubjectIds,
    });
  }

  function openNewForm() {
    setEditingId(null);
    setForm(null);
    setSaveError("");
    const initialClass = classes[0];
    setNewExamPathId(initialClass ? examPathIdForClass(initialClass.id) : null);
    setNewForm(emptyForm(classes));
    setShowNew(true);
  }

  async function createNew() {
    if (!newForm.name.trim() || !newForm.email.trim() || !newForm.class.id) {
      setSaveError("יש למלא שם, אימייל וכיתה");
      return;
    }
    setCreating(true);
    setSaveError("");
    try {
      const res = await fetch("/api/students", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newForm.name,
          email: newForm.email,
          classId: newForm.class.id,
          trackIds: newForm.trackIds,
          mathUnits: newForm.mathUnits,
          englishUnits: newForm.englishUnits,
          mandatorySubjectIds: newForm.mandatorySubjectIds,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setSaveError(data.error ?? "שגיאה ביצירת תלמיד");
        return;
      }
      setShowNew(false);
      setNewForm(emptyForm(classes));
      toast.success("התלמיד נוצר בהצלחה");
      load();
    } catch {
      setSaveError("שגיאת רשת — לא ניתן ליצור תלמיד");
    } finally {
      setCreating(false);
    }
  }

  async function save() {
    if (!editingId || !form) return;
    setSaving(true);
    setSaveError("");
    try {
      const res = await fetch("/api/students", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editingId,
          name: form.name,
          email: form.email,
          classId: form.class.id,
          trackIds: form.trackIds,
          mathUnits: form.mathUnits,
          englishUnits: form.englishUnits,
          mandatorySubjectIds: form.mandatorySubjectIds,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setSaveError(data.error ?? "שגיאה בשמירה");
        return;
      }
      setEditingId(null);
      setForm(null);
      toast.success("נשמר בהצלחה");
      load();
    } catch {
      setSaveError("שגיאת רשת — לא ניתן לשמור");
    } finally {
      setSaving(false);
    }
  }

  async function remove(id: string) {
    const ok = await confirm({
      title: "מחיקת תלמיד",
      description: "למחוק תלמיד זה? פעולה זו אינה ניתנת לביטול.",
      confirmLabel: "מחק",
      variant: "danger",
    });
    if (!ok) return;
    await fetch(`/api/students?id=${id}`, { method: "DELETE" });
    toast.success("התלמיד נמחק");
    load();
  }

  async function handleExport() {
    await downloadExcel(`תלמידים_${exportTimestamp()}.xlsx`, [
      buildStudentsSheet(exportStudents),
    ]);
  }

  function trackText(s: Student) {
    return s.tracks?.length
      ? s.tracks.map((t) => t.name).join(", ")
      : s.track?.name ?? "—";
  }

  const pageTitle = canEdit ? "ניהול תלמידים" : "תלמידים";
  const pageSubtitle = canEdit
    ? "הוספה ידנית, עריכת שיוכים, מגמות, מקצועות חובה, רמות יחידות (מתמטיקה/אנגלית) וכיתות"
    : "צפייה בתלמידים לפי ההרשאות שהוגדרו";

  if (studentsLoading && students.length === 0) {
    return (
      <>
        <PageHeader title={pageTitle} subtitle={pageSubtitle} />
        <div className="mt-8">
          <PageLoader variant="table" />
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader title={pageTitle} subtitle={pageSubtitle}>
        <div className="flex flex-wrap items-center gap-2">
          <ExportButton onExport={handleExport} disabled={exportStudents.length === 0} />
          {canEdit && (
            <Button
              onClick={openNewForm}
              disabled={classes.length === 0}
              className="shrink-0"
              title={classes.length === 0 ? "יש ליצור כיתה לפני הוספת תלמיד" : undefined}
            >
              <Plus className="h-4 w-4" />
              תלמיד חדש
            </Button>
          )}
        </div>
      </PageHeader>

      <div className="mt-6">
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="חיפוש לפי שם, אימייל, כיתה או מגמה..."
          className="max-w-md"
        />
      </div>

      {saveError && !showNew && !editingId && (
        <Alert variant="error" className="mt-4" onClose={() => setSaveError("")}>
          {saveError}
        </Alert>
      )}

      {showNew && (
        <Card className="mt-6 p-6">
          <h3 className="font-semibold">תלמיד חדש</h3>
          {saveError && (
            <Alert variant="error" className="mt-4" onClose={() => setSaveError("")}>
              {saveError}
            </Alert>
          )}
          <div className="mt-4">
            <StudentForm
              form={newForm}
              onChange={setNewForm}
              classes={classes}
              tracks={tracks}
              allSubjects={allSubjects}
              examPathId={newExamPathId}
              onClassChange={(classId) =>
                setNewExamPathId(examPathIdForClass(classId))
              }
              onSubmit={createNew}
              onCancel={() => {
                setShowNew(false);
                setNewExamPathId(null);
                setSaveError("");
              }}
              submitting={creating}
              submitLabel="יצירה"
            />
          </div>
        </Card>
      )}

      <div className="mt-8 space-y-6">
        {classGroups.length === 0 ? (
          <EmptyState
            icon={Users}
            title="אין תלמידים במערכת"
            description="הוסיפו תלמידים ידנית או ייבאו מקובץ אקסל"
            actionLabel={canEdit ? "תלמיד חדש" : undefined}
            onAction={canEdit ? openNewForm : undefined}
          />
        ) : filteredClassGroups.length === 0 ? (
          <EmptyState
            icon={Users}
            title="לא נמצאו תוצאות"
            description={`לא נמצאו תלמידים התואמים לחיפוש "${search}"`}
          />
        ) : (
          filteredClassGroups.map((group) => (
            <section key={group.id}>
              <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2 px-1">
                <h2 className="text-h2 text-slate-900">{group.name}</h2>
                <span className="text-base text-slate-500">
                  {group.students.length} תלמידים
                  {(group.gradeYear || group.examPathLabel) &&
                    ` · ${[group.gradeYear, group.examPathLabel].filter(Boolean).join(" · ")}`}
                </span>
              </div>

              {/* Mobile cards */}
              <div className="space-y-3 lg:hidden">
                {group.students.map((s) => (
                  <Card key={s.id} className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-semibold text-slate-900">{s.user.name}</p>
                        <p className="mt-0.5 truncate text-sm text-slate-500" dir="ltr">
                          {s.user.email}
                        </p>
                        <p className="mt-2 text-sm text-slate-600">{trackText(s)}</p>
                        <p className="mt-1 text-xs text-slate-400">
                          מתמטיקה {s.mathUnits} · אנגלית {s.englishUnits}
                        </p>
                      </div>
                      {canEdit && (
                        <div className="flex shrink-0 gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => startEdit(s)}
                            disabled={!s.class}
                            title={!s.class ? "לא ניתן לערוך תלמיד ללא כיתה" : "עריכה"}
                            aria-label="עריכה"
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => remove(s.id)}
                            className="text-red-500 hover:bg-red-50 hover:text-red-600"
                            aria-label="מחיקה"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      )}
                    </div>
                    {canEdit && !s.class && (
                      <p className="mt-2 flex items-center gap-1 text-xs text-amber-600">
                        <Info className="h-3 w-3" />
                        יש לשייך כיתה לפני עריכה
                      </p>
                    )}
                  </Card>
                ))}
              </div>

              {/* Desktop table */}
              <Card variant="flat" className="hidden overflow-hidden lg:block">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[880px] table-fixed text-base">
                    <colgroup>
                      <col className="w-[22%]" />
                      <col className="w-[28%]" />
                      <col className="w-[24%]" />
                      <col className="w-[9%]" />
                      <col className="w-[9%]" />
                      <col className="w-[8%]" />
                    </colgroup>
                    <thead className="bg-slate-50/80">
                      <tr className="border-b border-slate-200 text-slate-500">
                        <th className="px-4 py-3 text-right text-xs font-semibold">שם</th>
                        <th className="px-4 py-3 text-right text-xs font-semibold">אימייל</th>
                        <th className="px-4 py-3 text-right text-xs font-semibold">מגמות</th>
                        <th className="px-4 py-3 text-center text-xs font-semibold">מתמטיקה</th>
                        <th className="px-4 py-3 text-center text-xs font-semibold">אנגלית</th>
                        <th className="px-4 py-3 text-right text-xs font-semibold">פעולות</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {group.students.map((s) => (
                        <tr
                          key={s.id}
                          className="transition-colors even:bg-slate-50/40 hover:bg-primary-50/30"
                        >
                          <td className="truncate px-4 py-3 font-semibold text-slate-800">
                            {s.user.name}
                          </td>
                          <td className="truncate px-4 py-3 text-slate-500" dir="ltr">
                            {s.user.email}
                          </td>
                          <td className="truncate px-4 py-3 text-slate-600">{trackText(s)}</td>
                          <td className="px-4 py-3 text-center tabular-nums text-slate-700">
                            {s.mathUnits}
                          </td>
                          <td className="px-4 py-3 text-center tabular-nums text-slate-700">
                            {s.englishUnits}
                          </td>
                          <td className="px-4 py-3">
                            {canEdit && (
                              <div className="flex items-center gap-1">
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => startEdit(s)}
                                  disabled={!s.class}
                                  title={
                                    !s.class ? "לא ניתן לערוך תלמיד ללא כיתה" : "עריכה"
                                  }
                                  aria-label="עריכה"
                                >
                                  <Pencil className="h-4 w-4" />
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => remove(s.id)}
                                  className="text-red-500 hover:bg-red-50 hover:text-red-600"
                                  aria-label="מחיקה"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            </section>
          ))
        )}
      </div>

      <Sheet
        open={!!editingId && !!form}
        onClose={() => {
          setEditingId(null);
          setForm(null);
          setEditExamPathId(null);
          setSaveError("");
        }}
        title="עריכת תלמיד"
      >
        {form && (
          <>
            {saveError && (
              <Alert variant="error" className="mb-4" onClose={() => setSaveError("")}>
                {saveError}
              </Alert>
            )}
            <StudentForm
              form={form}
              onChange={setForm}
              classes={classes}
              tracks={tracks}
              allSubjects={allSubjects}
              examPathId={editExamPathId}
              onClassChange={(classId) =>
                setEditExamPathId(examPathIdForClass(classId))
              }
              onSubmit={save}
              onCancel={() => {
                setEditingId(null);
                setForm(null);
                setEditExamPathId(null);
                setSaveError("");
              }}
              submitting={saving}
            />
          </>
        )}
      </Sheet>
    </>
  );
}

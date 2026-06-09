"use client";

import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Plus, Pencil, Trash2, Save, X } from "lucide-react";
import { useApi } from "@/hooks/useApi";
import { PageLoader } from "@/components/ui/PageLoader";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";
import { ExportButton } from "@/components/ui/ExportButton";
import { SearchInput } from "@/components/ui/SearchInput";
import {
  buildStudentsSheet,
  downloadExcel,
  exportTimestamp,
} from "@/lib/excel-export";

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

type EditForm = {
  name: string;
  email: string;
  class: { id: string; name: string };
  trackIds: string[];
  mathUnits: number;
  englishUnits: number;
  /** null = all mandatory subjects from path */
  mandatorySubjectIds: string[] | null;
};

const emptyForm = (classes: ClassOption[]): EditForm => ({
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
  const { data: students = [], loading: studentsLoading, mutate: refreshStudents } =
    useApi<Student[]>("/api/students");
  const { data: classesRaw = [], mutate: refreshClasses } = useApi<ClassItem[]>("/api/classes");
  const { data: tracks = [], mutate: refreshTracks } = useApi<TrackOption[]>("/api/tracks");
  const { data: allSubjects = [] } = useApi<SubjectOption[]>("/api/subjects");
  const classes: ClassOption[] = classesRaw.map((c) => ({ id: c.id, name: c.name }));
  const [editing, setEditing] = useState<string | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [form, setForm] = useState<EditForm | null>(null);
  const [newForm, setNewForm] = useState<EditForm>(() => emptyForm([]));
  const [saveError, setSaveError] = useState("");
  const [creating, setCreating] = useState(false);
  const [editExamPathId, setEditExamPathId] = useState<string | null>(null);
  const [newExamPathId, setNewExamPathId] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const mandatoryForPath = (pathId: string | null) =>
    allSubjects.filter(
      (s) =>
        s.category === "MANDATORY" &&
        (pathId ? s.pathLinks?.some((l) => l.path.id === pathId) : false)
    );

  const otherMandatoryForPath = (pathId: string | null) => {
    const pathIds = new Set(mandatoryForPath(pathId).map((s) => s.id));
    return allSubjects.filter((s) => s.category === "MANDATORY" && !pathIds.has(s.id));
  };

  const editPathMandatory = useMemo(
    () => mandatoryForPath(editExamPathId),
    [allSubjects, editExamPathId]
  );
  const editOtherMandatory = useMemo(
    () => otherMandatoryForPath(editExamPathId),
    [allSubjects, editExamPathId]
  );
  const newPathMandatory = useMemo(
    () => mandatoryForPath(newExamPathId),
    [allSubjects, newExamPathId]
  );
  const newOtherMandatory = useMemo(
    () => otherMandatoryForPath(newExamPathId),
    [allSubjects, newExamPathId]
  );

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
    if (search.trim()) {
      return filteredClassGroups.flatMap((g) => g.students);
    }
    return students;
  }, [students, filteredClassGroups, search]);

  async function handleExport() {
    await downloadExcel(`תלמידים_${exportTimestamp()}.xlsx`, [
      buildStudentsSheet(exportStudents),
    ]);
  }

  async function load() {
    await Promise.all([refreshStudents(), refreshClasses(), refreshTracks()]);
  }

  function examPathIdForClass(classId: string) {
    return classesRaw.find((c) => c.id === classId)?.examPathId ?? null;
  }

  function startEdit(s: Student) {
    if (!s.class) return;
    setShowNew(false);
    setEditing(s.id);
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

  function effectiveMandatoryIds(
    mandatorySubjectIds: string[] | null,
    pathMandatory: SubjectOption[]
  ) {
    if (mandatorySubjectIds === null) {
      return pathMandatory.map((s) => s.id);
    }
    return mandatorySubjectIds;
  }

  function toggleMandatorySubject(
    subjectId: string,
    target: "edit" | "new",
    pathMandatory: SubjectOption[]
  ) {
    const current = target === "edit" ? form : newForm;
    if (!current) return;

    const pathIds = pathMandatory.map((s) => s.id);
    const selected = effectiveMandatoryIds(current.mandatorySubjectIds, pathMandatory);

    const next = selected.includes(subjectId)
      ? selected.filter((id) => id !== subjectId)
      : [...selected, subjectId];

    const isDefault =
      next.length === pathIds.length && pathIds.every((id) => next.includes(id));

    const mandatorySubjectIds = isDefault ? null : next;

    if (target === "edit" && form) {
      setForm({ ...form, mandatorySubjectIds });
    } else {
      setNewForm({ ...newForm, mandatorySubjectIds });
    }
  }

  function isMandatorySelected(
    subjectId: string,
    mandatorySubjectIds: string[] | null,
    pathMandatory: SubjectOption[]
  ) {
    return effectiveMandatoryIds(mandatorySubjectIds, pathMandatory).includes(subjectId);
  }

  function toggleTrack(trackId: string, target: "edit" | "new") {
    const current = target === "edit" ? form : newForm;
    if (!current) return;
    const trackIds = current.trackIds.includes(trackId)
      ? current.trackIds.filter((id) => id !== trackId)
      : [...current.trackIds, trackId];
    if (target === "edit" && form) {
      setForm({ ...form, trackIds });
    } else {
      setNewForm({ ...newForm, trackIds });
    }
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
      load();
    } catch {
      setSaveError("שגיאת רשת — לא ניתן ליצור תלמיד");
    } finally {
      setCreating(false);
    }
  }

  function openNewForm() {
    setEditing(null);
    setForm(null);
    setEditExamPathId(null);
    setSaveError("");
    const initialClass = classes[0];
    setNewExamPathId(initialClass ? examPathIdForClass(initialClass.id) : null);
    setNewForm(emptyForm(classes));
    setShowNew(true);
  }

  async function save() {
    if (!editing || !form) return;
    setSaveError("");
    try {
      const res = await fetch("/api/students", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editing,
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
      setEditing(null);
      setForm(null);
      load();
    } catch {
      setSaveError("שגיאת רשת — לא ניתן לשמור");
    }
  }

  async function remove(id: string) {
    if (!confirm("למחוק תלמיד זה?")) return;
    await fetch(`/api/students?id=${id}`, { method: "DELETE" });
    load();
  }

  function cancelEdit() {
    setEditing(null);
    setForm(null);
    setEditExamPathId(null);
    setSaveError("");
  }

  function renderMandatorySubjects(
    pathMandatory: SubjectOption[],
    otherMandatory: SubjectOption[],
    mandatorySubjectIds: string[] | null,
    target: "edit" | "new"
  ) {
    if (pathMandatory.length === 0 && otherMandatory.length === 0) return null;

    return (
      <div className="mt-4 space-y-4">
        <div>
          <label className="label">מקצועות חובה</label>
          <p className="mb-2 text-xs text-slate-500">
            ניתן להסיר מקצועות ממסלול הכיתה, או להוסיף מקצועות חובה ממסלולים אחרים
          </p>
        </div>

        {pathMandatory.length > 0 && (
          <div>
            <p className="mb-2 text-xs font-medium text-slate-600">מסלול הכיתה</p>
            <div className="flex flex-wrap gap-2">
              {pathMandatory.map((s) => (
                <label
                  key={s.id}
                  className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-slate-200 px-2 py-1 text-xs hover:bg-slate-50"
                >
                  <input
                    type="checkbox"
                    checked={isMandatorySelected(s.id, mandatorySubjectIds, pathMandatory)}
                    onChange={() => toggleMandatorySubject(s.id, target, pathMandatory)}
                    className="rounded"
                  />
                  {s.name}
                </label>
              ))}
            </div>
          </div>
        )}

        {otherMandatory.length > 0 && (
          <div>
            <p className="mb-2 text-xs font-medium text-slate-600">ממסלולים אחרים</p>
            <div className="flex flex-wrap gap-2">
              {otherMandatory.map((s) => (
                <label
                  key={s.id}
                  className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-dashed border-slate-300 px-2 py-1 text-xs hover:bg-slate-50"
                >
                  <input
                    type="checkbox"
                    checked={isMandatorySelected(s.id, mandatorySubjectIds, pathMandatory)}
                    onChange={() => toggleMandatorySubject(s.id, target, pathMandatory)}
                    className="rounded"
                  />
                  <span>{s.name}</span>
                  {s.pathLinks && s.pathLinks.length > 0 && (
                    <span className="text-slate-400">
                      ({s.pathLinks.map((l) => l.path.label).join(", ")})
                    </span>
                  )}
                </label>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  function renderStudentRow(s: Student) {
    if (editing === s.id && form) {
      return (
        <motion.tr
          key={s.id}
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          exit={{ opacity: 0, height: 0 }}
          transition={{ duration: 0.25, ease: "easeInOut" }}
          className="bg-primary-50/40"
        >
          <td colSpan={6} className="px-4 py-4">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <div>
                <label className="label">שם</label>
                <input
                  className="input py-1.5"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </div>
              <div>
                <label className="label">אימייל</label>
                <input
                  className="input py-1.5"
                  dir="ltr"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                />
              </div>
              <div>
                <label className="label">כיתה</label>
                <select
                  className="input py-1.5"
                  value={form.class.id}
                  onChange={(e) => {
                    const classId = e.target.value;
                    setEditExamPathId(examPathIdForClass(classId));
                    setForm({
                      ...form,
                      class: {
                        id: classId,
                        name: classes.find((c) => c.id === classId)?.name ?? "",
                      },
                      mandatorySubjectIds: null,
                    });
                  }}
                >
                  {classes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">מתמטיקה</label>
                <select
                  className="input py-1.5"
                  value={form.mathUnits}
                  onChange={(e) => setForm({ ...form, mathUnits: parseInt(e.target.value) })}
                >
                  {[3, 4, 5].map((u) => (
                    <option key={u} value={u}>
                      {u}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">אנגלית</label>
                <select
                  className="input py-1.5"
                  value={form.englishUnits}
                  onChange={(e) => setForm({ ...form, englishUnits: parseInt(e.target.value) })}
                >
                  {[3, 4, 5].map((u) => (
                    <option key={u} value={u}>
                      {u}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="mt-4">
              <label className="label">מגמות</label>
              <div className="flex flex-wrap gap-2">
                {tracks.map((t) => (
                  <label
                    key={t.id}
                    className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-slate-200 px-2 py-1 text-xs hover:bg-slate-50"
                  >
                    <input
                      type="checkbox"
                      checked={form.trackIds.includes(t.id)}
                      onChange={() => toggleTrack(t.id, "edit")}
                      className="rounded"
                    />
                    {t.name}
                  </label>
                ))}
              </div>
            </div>
            {renderMandatorySubjects(
              editPathMandatory,
              editOtherMandatory,
              form.mandatorySubjectIds,
              "edit"
            )}
            <div className="mt-4 flex gap-2">
              <Button onClick={save} size="sm">
                <Save className="h-4 w-4" />
                שמירה
              </Button>
              <Button onClick={cancelEdit} variant="secondary" size="sm">
                <X className="h-4 w-4" />
                ביטול
              </Button>
            </div>
          </td>
        </motion.tr>
      );
    }

    const trackText = s.tracks?.length
      ? s.tracks.map((t) => t.name).join(", ")
      : s.track?.name ?? "—";

    return (
      <tr key={s.id} className="transition-colors even:bg-slate-50/40 hover:bg-primary-50/30">
        <td className="truncate px-4 py-3 font-semibold text-slate-800" title={s.user.name}>
          {s.user.name}
        </td>
        <td className="truncate px-4 py-3 text-slate-500" dir="ltr" title={s.user.email}>
          {s.user.email}
        </td>
        <td className="truncate px-4 py-3 text-slate-600" title={trackText}>
          {trackText}
        </td>
        <td className="px-4 py-3 text-center tabular-nums text-slate-700">{s.mathUnits}</td>
        <td className="px-4 py-3 text-center tabular-nums text-slate-700">{s.englishUnits}</td>
        <td className="px-4 py-3">
          <div className="flex items-center gap-1">
            <button
              onClick={() => startEdit(s)}
              disabled={!s.class}
              aria-label="עריכה"
              className="rounded-lg p-1.5 text-primary-600 transition hover:bg-primary-50 hover:text-primary-700 disabled:opacity-40 disabled:hover:bg-transparent"
            >
              <Pencil className="h-4 w-4" />
            </button>
            <button
              onClick={() => remove(s.id)}
              aria-label="מחיקה"
              className="rounded-lg p-1.5 text-red-500 transition hover:bg-red-50 hover:text-red-600"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </td>
      </tr>
    );
  }

  if (studentsLoading && students.length === 0) {
    return (
      <>
        <PageHeader
          title="ניהול תלמידים"
          subtitle="הוספה ידנית, עריכת שיוכים, מגמות, מקצועות חובה, רמות יחידות (מתמטיקה/אנגלית) וכיתות"
        />
        <div className="mt-8">
          <PageLoader variant="table" />
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="ניהול תלמידים"
        subtitle="הוספה ידנית, עריכת שיוכים, מגמות, מקצועות חובה, רמות יחידות (מתמטיקה/אנגלית) וכיתות"
      >
        <div className="flex flex-wrap items-center gap-2">
          <ExportButton
            onExport={handleExport}
            disabled={exportStudents.length === 0}
          />
          <Button
            onClick={openNewForm}
            disabled={classes.length === 0}
            className="shrink-0"
            title={classes.length === 0 ? "יש ליצור כיתה לפני הוספת תלמיד" : undefined}
          >
            <Plus className="h-4 w-4" />
            תלמיד חדש
          </Button>
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

      {saveError && (
        <div className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">
          {saveError}
        </div>
      )}

      {showNew && (
        <div className="mt-6 card p-6">
          <h3 className="font-semibold">תלמיד חדש</h3>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <label className="label">שם</label>
              <input
                className="input"
                value={newForm.name}
                onChange={(e) => setNewForm({ ...newForm, name: e.target.value })}
                placeholder="ישראל ישראלי"
              />
            </div>
            <div>
              <label className="label">אימייל</label>
              <input
                className="input"
                dir="ltr"
                type="email"
                value={newForm.email}
                onChange={(e) => setNewForm({ ...newForm, email: e.target.value })}
                placeholder="student@example.com"
              />
            </div>
            <div>
              <label className="label">כיתה</label>
              <select
                className="input"
                value={newForm.class.id}
                onChange={(e) => {
                  const classId = e.target.value;
                  setNewExamPathId(examPathIdForClass(classId));
                  setNewForm({
                    ...newForm,
                    class: {
                      id: classId,
                      name: classes.find((c) => c.id === classId)?.name ?? "",
                    },
                    mandatorySubjectIds: null,
                  });
                }}
              >
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">מתמטיקה</label>
              <select
                className="input"
                value={newForm.mathUnits}
                onChange={(e) =>
                  setNewForm({ ...newForm, mathUnits: parseInt(e.target.value) })
                }
              >
                {[3, 4, 5].map((u) => (
                  <option key={u} value={u}>
                    {u} יח&quot;ל
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">אנגלית</label>
              <select
                className="input"
                value={newForm.englishUnits}
                onChange={(e) =>
                  setNewForm({ ...newForm, englishUnits: parseInt(e.target.value) })
                }
              >
                {[3, 4, 5].map((u) => (
                  <option key={u} value={u}>
                    {u} יח&quot;ל
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="mt-4">
            <label className="label">מגמות</label>
            <div className="flex flex-wrap gap-2">
              {tracks.map((t) => (
                <label
                  key={t.id}
                  className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-slate-200 px-2 py-1 text-xs hover:bg-slate-50"
                >
                  <input
                    type="checkbox"
                    checked={newForm.trackIds.includes(t.id)}
                    onChange={() => toggleTrack(t.id, "new")}
                    className="rounded"
                  />
                  {t.name}
                </label>
              ))}
            </div>
          </div>
          {renderMandatorySubjects(
            newPathMandatory,
            newOtherMandatory,
            newForm.mandatorySubjectIds,
            "new"
          )}
          <div className="mt-4 flex gap-3">
            <button onClick={createNew} disabled={creating} className="btn-primary">
              <Save className="h-4 w-4" />
              {creating ? "שומר..." : "שמירה"}
            </button>
            <button
              onClick={() => {
                setShowNew(false);
                setNewExamPathId(null);
                setSaveError("");
              }}
              className="btn-secondary"
            >
              ביטול
            </button>
          </div>
        </div>
      )}

      <div className="mt-8 space-y-6">
        {classGroups.length === 0 ? (
          <div className="card p-8 text-center text-slate-500">אין תלמידים במערכת</div>
        ) : filteredClassGroups.length === 0 ? (
          <div className="card p-8 text-center text-slate-500">
            לא נמצאו תלמידים התואמים לחיפוש &quot;{search}&quot;
          </div>
        ) : (
          filteredClassGroups.map((group) => (
            <section key={group.id} className="card overflow-hidden">
              <div className="border-b border-slate-100 bg-slate-50 px-5 py-4">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h2 className="text-h2 text-slate-900">{group.name}</h2>
                  <span className="text-base text-slate-500">
                    {group.students.length} תלמידים
                  </span>
                </div>
                {(group.gradeYear || group.examPathLabel) && (
                  <p className="mt-1 text-base text-slate-500">
                    {[group.gradeYear, group.examPathLabel].filter(Boolean).join(" · ")}
                  </p>
                )}
              </div>
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
                      <th className="px-4 py-3 text-right text-xs font-bold uppercase tracking-wide">
                        שם
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-bold uppercase tracking-wide">
                        אימייל
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-bold uppercase tracking-wide">
                        מגמות
                      </th>
                      <th className="px-4 py-3 text-center text-xs font-bold uppercase tracking-wide">
                        מתמטיקה
                      </th>
                      <th className="px-4 py-3 text-center text-xs font-bold uppercase tracking-wide">
                        אנגלית
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-bold uppercase tracking-wide">
                        פעולות
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    <AnimatePresence initial={false}>
                      {group.students.map((s) => renderStudentRow(s))}
                    </AnimatePresence>
                  </tbody>
                </table>
              </div>
            </section>
          ))
        )}
      </div>
    </>
  );
}

"use client";

import { useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Plus, Pencil, Trash2, Save, X } from "lucide-react";
import { useApi } from "@/hooks/useApi";
import { PageLoader } from "@/components/ui/PageLoader";
import { PageHeader } from "@/components/ui/PageHeader";
import { Button } from "@/components/ui/Button";

type Student = {
  id: string;
  mathUnits: number;
  englishUnits: number;
  user: { name: string; email: string };
  class: { id: string; name: string; examPath: { label: string } } | null;
  tracks: { id: string; name: string }[];
  track: { id: string; name: string } | null;
};

type ClassOption = { id: string; name: string };
type ClassItem = { id: string; name: string; gradeYear: string | null };
type TrackOption = { id: string; name: string };

type EditForm = {
  name: string;
  email: string;
  class: { id: string; name: string };
  trackIds: string[];
  mathUnits: number;
  englishUnits: number;
};

const emptyForm = (classes: ClassOption[]): EditForm => ({
  name: "",
  email: "",
  class: classes[0] ? { id: classes[0].id, name: classes[0].name } : { id: "", name: "" },
  trackIds: [],
  mathUnits: 3,
  englishUnits: 3,
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
  const classes: ClassOption[] = classesRaw.map((c) => ({ id: c.id, name: c.name }));
  const [editing, setEditing] = useState<string | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [form, setForm] = useState<EditForm | null>(null);
  const [newForm, setNewForm] = useState<EditForm>(() => emptyForm([]));
  const [saveError, setSaveError] = useState("");
  const [creating, setCreating] = useState(false);

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

  async function load() {
    await Promise.all([refreshStudents(), refreshClasses(), refreshTracks()]);
  }

  function startEdit(s: Student) {
    if (!s.class) return;
    setShowNew(false);
    setEditing(s.id);
    setSaveError("");
    setForm({
      name: s.user.name,
      email: s.user.email,
      class: { id: s.class.id, name: s.class.name },
      trackIds: s.tracks?.map((t) => t.id) ?? (s.track ? [s.track.id] : []),
      mathUnits: s.mathUnits,
      englishUnits: s.englishUnits,
    });
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
    setSaveError("");
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
    setSaveError("");
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
                  onChange={(e) =>
                    setForm({
                      ...form,
                      class: {
                        id: e.target.value,
                        name: classes.find((c) => c.id === e.target.value)?.name ?? "",
                      },
                    })
                  }
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

    return (
      <tr key={s.id} className="even:bg-slate-50/30 hover:bg-primary-50/20">
        <td className="px-4 py-3 font-medium">{s.user.name}</td>
        <td className="px-4 py-3 text-slate-500" dir="ltr">
          {s.user.email}
        </td>
        <td className="px-4 py-3">
          {s.tracks?.length
            ? s.tracks.map((t) => t.name).join(", ")
            : s.track?.name ?? "—"}
        </td>
        <td className="px-4 py-3">{s.mathUnits}</td>
        <td className="px-4 py-3">{s.englishUnits}</td>
        <td className="px-4 py-3">
          <div className="flex gap-2">
            <button
              onClick={() => startEdit(s)}
              disabled={!s.class}
              className="text-primary-600 hover:text-primary-700 disabled:opacity-40"
            >
              <Pencil className="h-4 w-4" />
            </button>
            <button onClick={() => remove(s.id)} className="text-red-500 hover:text-red-600">
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
          subtitle="הוספה ידנית, עריכת שיוכים, מגמות, רמות יחידות (מתמטיקה/אנגלית) וכיתות"
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
        subtitle="הוספה ידנית, עריכת שיוכים, מגמות, רמות יחידות (מתמטיקה/אנגלית) וכיתות"
      >
        <Button
          onClick={openNewForm}
          disabled={classes.length === 0}
          className="shrink-0"
          title={classes.length === 0 ? "יש ליצור כיתה לפני הוספת תלמיד" : undefined}
        >
          <Plus className="h-4 w-4" />
          תלמיד חדש
        </Button>
      </PageHeader>

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
                onChange={(e) =>
                  setNewForm({
                    ...newForm,
                    class: {
                      id: e.target.value,
                      name: classes.find((c) => c.id === e.target.value)?.name ?? "",
                    },
                  })
                }
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
          <div className="mt-4 flex gap-3">
            <button onClick={createNew} disabled={creating} className="btn-primary">
              <Save className="h-4 w-4" />
              {creating ? "שומר..." : "שמירה"}
            </button>
            <button
              onClick={() => {
                setShowNew(false);
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
        ) : (
          classGroups.map((group) => (
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
                <table className="w-full text-base">
                  <thead className="sticky top-0 z-10 bg-white">
                    <tr className="border-b border-slate-200 text-slate-600">
                      <th className="px-4 py-3 text-right text-sm font-semibold uppercase tracking-wide">
                        שם
                      </th>
                      <th className="px-4 py-3 text-right text-sm font-semibold uppercase tracking-wide">
                        אימייל
                      </th>
                      <th className="px-4 py-3 text-right text-sm font-semibold uppercase tracking-wide">
                        מגמות
                      </th>
                      <th className="px-4 py-3 text-right text-sm font-semibold uppercase tracking-wide">
                        מתמטיקה
                      </th>
                      <th className="px-4 py-3 text-right text-sm font-semibold uppercase tracking-wide">
                        אנגלית
                      </th>
                      <th className="px-4 py-3 text-right text-sm font-semibold uppercase tracking-wide">
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

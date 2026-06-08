"use client";

import { useEffect, useState } from "react";
import { Pencil, Trash2, Save, X } from "lucide-react";

type Student = {
  id: string;
  mathUnits: number;
  englishUnits: number;
  user: { name: string; email: string };
  class: { id: string; name: string; examPath: { label: string } };
  track: { id: string; name: string } | null;
};

type ClassOption = { id: string; name: string };
type TrackOption = { id: string; name: string };

export default function StudentsPage() {
  const [students, setStudents] = useState<Student[]>([]);
  const [classes, setClasses] = useState<ClassOption[]>([]);
  const [tracks, setTracks] = useState<TrackOption[]>([]);
  const [editing, setEditing] = useState<string | null>(null);
  const [form, setForm] = useState<Partial<Student & { name: string; email: string }>>({});
  const [loading, setLoading] = useState(true);

  async function load() {
    const [sRes, cRes, tRes] = await Promise.all([
      fetch("/api/students"),
      fetch("/api/classes"),
      fetch("/api/tracks"),
    ]);
    setStudents(await sRes.json());
    const cls = await cRes.json();
    setClasses(cls.map((c: { id: string; name: string }) => ({ id: c.id, name: c.name })));
    setTracks(await tRes.json());
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  function startEdit(s: Student) {
    setEditing(s.id);
    setForm({
      ...s,
      name: s.user.name,
      email: s.user.email,
    });
  }

  async function save() {
    if (!editing) return;
    await fetch("/api/students", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: editing,
        name: form.name,
        email: form.email,
        classId: form.class?.id,
        trackId: form.track?.id,
        mathUnits: form.mathUnits,
        englishUnits: form.englishUnits,
      }),
    });
    setEditing(null);
    load();
  }

  async function remove(id: string) {
    if (!confirm("למחוק תלמיד זה?")) return;
    await fetch(`/api/students?id=${id}`, { method: "DELETE" });
    load();
  }

  if (loading) {
    return <div className="text-center text-slate-500">טוען...</div>;
  }

  return (
    <>
      <header className="-mx-8 -mt-8 border-b border-slate-200 bg-white px-8 py-6">
        <h1 className="text-2xl font-bold text-slate-900">ניהול תלמידים</h1>
        <p className="mt-1 text-sm text-slate-500">
          עריכת שיוכים, מגמות, רמות יחידות (מתמטיקה/אנגלית) וכיתות
        </p>
      </header>

      <div className="mt-8 card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-600">
            <tr>
              <th className="px-4 py-3 text-right font-medium">שם</th>
              <th className="px-4 py-3 text-right font-medium">אימייל</th>
              <th className="px-4 py-3 text-right font-medium">כיתה</th>
              <th className="px-4 py-3 text-right font-medium">תוכנית חובה</th>
              <th className="px-4 py-3 text-right font-medium">מגמה</th>
              <th className="px-4 py-3 text-right font-medium">מתמטיקה</th>
              <th className="px-4 py-3 text-right font-medium">אנגלית</th>
              <th className="px-4 py-3 text-right font-medium">פעולות</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {students.map((s) => (
              <tr key={s.id} className="hover:bg-slate-50/50">
                {editing === s.id ? (
                  <>
                    <td className="px-4 py-3">
                      <input
                        className="input py-1.5"
                        value={form.name ?? ""}
                        onChange={(e) => setForm({ ...form, name: e.target.value })}
                      />
                    </td>
                    <td className="px-4 py-3">
                      <input
                        className="input py-1.5"
                        dir="ltr"
                        value={form.email ?? ""}
                        onChange={(e) => setForm({ ...form, email: e.target.value })}
                      />
                    </td>
                    <td className="px-4 py-3">
                      <select
                        className="input py-1.5"
                        value={form.class?.id}
                        onChange={(e) =>
                          setForm({
                            ...form,
                            class: {
                              ...form.class!,
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
                    </td>
                    <td className="px-4 py-3 text-slate-500">
                      {s.class.examPath.label}
                    </td>
                    <td className="px-4 py-3">
                      <select
                        className="input py-1.5"
                        value={form.track?.id ?? ""}
                        onChange={(e) =>
                          setForm({
                            ...form,
                            track: e.target.value
                              ? {
                                  id: e.target.value,
                                  name:
                                    tracks.find((t) => t.id === e.target.value)?.name ?? "",
                                }
                              : null,
                          })
                        }
                      >
                        <option value="">ללא מגמה</option>
                        {tracks.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.name}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-3">
                      <select
                        className="input w-20 py-1.5"
                        value={form.mathUnits}
                        onChange={(e) =>
                          setForm({ ...form, mathUnits: parseInt(e.target.value) })
                        }
                      >
                        {[3, 4, 5].map((u) => (
                          <option key={u} value={u}>
                            {u}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-3">
                      <select
                        className="input w-20 py-1.5"
                        value={form.englishUnits}
                        onChange={(e) =>
                          setForm({ ...form, englishUnits: parseInt(e.target.value) })
                        }
                      >
                        {[3, 4, 5].map((u) => (
                          <option key={u} value={u}>
                            {u}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <button onClick={save} className="text-emerald-600 hover:text-emerald-700">
                          <Save className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => setEditing(null)}
                          className="text-slate-400 hover:text-slate-600"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </>
                ) : (
                  <>
                    <td className="px-4 py-3 font-medium">{s.user.name}</td>
                    <td className="px-4 py-3 text-slate-500" dir="ltr">
                      {s.user.email}
                    </td>
                    <td className="px-4 py-3">{s.class.name}</td>
                    <td className="px-4 py-3 text-slate-500">{s.class.examPath.label}</td>
                    <td className="px-4 py-3">{s.track?.name ?? "—"}</td>
                    <td className="px-4 py-3">{s.mathUnits}</td>
                    <td className="px-4 py-3">{s.englishUnits}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <button
                          onClick={() => startEdit(s)}
                          className="text-primary-600 hover:text-primary-700"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => remove(s.id)}
                          className="text-red-500 hover:text-red-600"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

"use client";

import { useState } from "react";
import { Plus, Pencil, Trash2, Save, X } from "lucide-react";
import { useApi } from "@/hooks/useApi";
import { PageLoader } from "@/components/ui/PageLoader";

type ExamPath = { id: string; label: string; key: string };
type ClassItem = {
  id: string;
  name: string;
  gradeYear: string | null;
  examPath: ExamPath;
  _count: { students: number };
};

export default function ClassesPage() {
  const { data: classes = [], loading, mutate: refreshClasses } = useApi<ClassItem[]>("/api/classes");
  const { data: paths = [], mutate: refreshPaths } = useApi<ExamPath[]>("/api/paths");
  const [editing, setEditing] = useState<string | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [form, setForm] = useState({ name: "", gradeYear: "", examPathId: "" });

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

  if (loading && classes.length === 0) {
    return <PageLoader />;
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
                  <div>
                    <h3 className="text-lg font-semibold">{c.name}</h3>
                    <p className="mt-1 text-sm text-slate-500">{c.gradeYear}</p>
                  </div>
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
                <div className="mt-4 rounded-xl bg-primary-50 px-3 py-2">
                  <p className="text-xs text-primary-600">תוכנית חובה</p>
                  <p className="text-sm font-medium text-primary-800">
                    {c.examPath.label}
                  </p>
                </div>
                <p className="mt-3 text-sm text-slate-500">
                  {c._count.students} תלמידים
                </p>
              </>
            )}
          </div>
        ))}
      </div>
    </>
  );
}

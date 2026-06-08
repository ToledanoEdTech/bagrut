"use client";

import { useEffect, useState } from "react";
import { Plus, Trash2, ChevronDown, ChevronUp } from "lucide-react";

type Obligation = {
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
};

type Subject = {
  id: string;
  name: string;
  units: number | null;
  category: string;
  obligations: Obligation[];
  pathLinks: Array<{ path: { label: string } }>;
};

export default function SubjectsPage() {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [filter, setFilter] = useState("all");
  const [showNew, setShowNew] = useState(false);
  const [newSubject, setNewSubject] = useState({
    name: "",
    units: 5,
    category: "MANDATORY",
    obligation: {
      name: "",
      weightPercent: 100,
      examType: "פנימי",
      questionnaireNumber: "",
    },
  });

  async function load() {
    const res = await fetch("/api/subjects");
    setSubjects(await res.json());
  }

  useEffect(() => {
    load();
  }, []);

  const filtered = subjects.filter((s) => {
    if (filter === "all") return true;
    return s.category === filter;
  });

  const categories: Record<string, string> = {
    MANDATORY: "חובה",
    MATH: "מתמטיקה",
    ENGLISH: "אנגלית",
    TRACK: "מגמה",
    EXTENSION: "הרחבה",
  };

  async function addSubject() {
    await fetch("/api/subjects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: newSubject.name,
        units: newSubject.units,
        category: newSubject.category,
        obligations: [
          {
            name: newSubject.obligation.name,
            weightPercent: newSubject.obligation.weightPercent,
            examType: newSubject.obligation.examType,
            questionnaireNumber: newSubject.obligation.questionnaireNumber || null,
            components: [{ name: "ציון פנימי", weightPercent: 100 }],
          },
        ],
      }),
    });
    setShowNew(false);
    load();
  }

  async function deleteObligation(subjectId: string, id: string) {
    if (!confirm("למחוק חובה זו?")) return;
    await fetch(`/api/obligations?id=${id}&subjectId=${subjectId}`, { method: "DELETE" });
    load();
  }

  async function deleteSubject(id: string) {
    if (!confirm("למחוק מקצוע זה וכל החובות שלו?")) return;
    await fetch(`/api/subjects?id=${id}`, { method: "DELETE" });
    load();
  }

  return (
    <>
      <header className="-mx-8 -mt-8 border-b border-slate-200 bg-white px-8 py-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">מקצועות וחובות</h1>
            <p className="mt-1 text-sm text-slate-500">
              ניהול מקצועות, חובות ומשקלי ציונים
            </p>
          </div>
          <button onClick={() => setShowNew(true)} className="btn-primary">
            <Plus className="h-4 w-4" />
            מקצוע חדש
          </button>
        </div>
      </header>

      <div className="mt-6 flex flex-wrap gap-2">
        {[
          { key: "all", label: "הכל" },
          ...Object.entries(categories).map(([k, v]) => ({ key: k, label: v })),
        ].map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`rounded-xl px-4 py-2 text-sm font-medium transition ${
              filter === f.key
                ? "bg-primary-600 text-white"
                : "bg-white text-slate-600 hover:bg-slate-100"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {showNew && (
        <div className="mt-6 card p-6">
          <h3 className="font-semibold">מקצוע חדש</h3>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <label className="label">שם מקצוע</label>
              <input
                className="input"
                value={newSubject.name}
                onChange={(e) => setNewSubject({ ...newSubject, name: e.target.value })}
              />
            </div>
            <div>
              <label className="label">יחידות</label>
              <input
                type="number"
                className="input"
                value={newSubject.units}
                onChange={(e) =>
                  setNewSubject({ ...newSubject, units: parseInt(e.target.value) })
                }
              />
            </div>
            <div>
              <label className="label">קטגוריה</label>
              <select
                className="input"
                value={newSubject.category}
                onChange={(e) =>
                  setNewSubject({ ...newSubject, category: e.target.value })
                }
              >
                {Object.entries(categories).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="label">שם חובה ראשונה</label>
              <input
                className="input"
                value={newSubject.obligation.name}
                onChange={(e) =>
                  setNewSubject({
                    ...newSubject,
                    obligation: { ...newSubject.obligation, name: e.target.value },
                  })
                }
              />
            </div>
          </div>
          <div className="mt-4 flex gap-3">
            <button onClick={addSubject} className="btn-primary">
              שמירה
            </button>
            <button onClick={() => setShowNew(false)} className="btn-secondary">
              ביטול
            </button>
          </div>
        </div>
      )}

      <div className="mt-6 space-y-3">
        {filtered.map((subject) => {
          const totalWeight = subject.obligations.reduce(
            (s, o) => s + o.weightPercent,
            0
          );
          const isOpen = expanded === subject.id;

          return (
            <div key={subject.id} className="card overflow-hidden">
              <button
                type="button"
                onClick={() => setExpanded(isOpen ? null : subject.id)}
                className="flex w-full items-center gap-3 p-5"
              >
                <div className="min-w-0 flex-1 text-right">
                  <div className="flex flex-wrap items-center justify-start gap-2">
                    <span className="badge-info">{categories[subject.category]}</span>
                    {subject.units && (
                      <span className="badge-muted">{subject.units} יח&quot;ל</span>
                    )}
                    <h3 className="text-lg font-semibold">{subject.name}</h3>
                  </div>
                  <p className="mt-1 text-sm text-slate-500">
                    {subject.obligations.length} חובות • סה&quot;כ משקל: {totalWeight}%
                    {subject.pathLinks.length > 0 && (
                      <> • {subject.pathLinks.map((pl) => pl.path.label).join(", ")}</>
                    )}
                  </p>
                </div>
                <div className="shrink-0">
                  {isOpen ? (
                    <ChevronUp className="h-5 w-5 text-slate-400" />
                  ) : (
                    <ChevronDown className="h-5 w-5 text-slate-400" />
                  )}
                </div>
              </button>

              {isOpen && (
                <div className="border-t border-slate-100 bg-slate-50/50 p-5">
                  <div className="mb-4 flex justify-end">
                    <button
                      onClick={() => deleteSubject(subject.id)}
                      className="flex items-center gap-1 text-sm text-red-500 hover:text-red-600"
                    >
                      <Trash2 className="h-4 w-4" />
                      מחק מקצוע
                    </button>
                  </div>
                  <div className="space-y-2">
                    {subject.obligations.map((o) => (
                      <div
                        key={o.id}
                        className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3"
                      >
                        <div className="min-w-0 flex-1 text-right">
                          <div className="flex flex-wrap items-center justify-start gap-2">
                            <span className="font-medium">
                              {o.name || o.examEvent || "חובה"}
                            </span>
                            {o.questionnaireNumber && (
                              <span className="badge-muted" dir="ltr">
                                {o.questionnaireNumber}
                              </span>
                            )}
                            <span className="badge-warning">{o.weightPercent}%</span>
                            <span className="badge-muted">{o.examType}</span>
                            {o.gradeYear && (
                              <span className="text-xs text-slate-400">{o.gradeYear}</span>
                            )}
                          </div>
                          {o.studyMaterial && (
                            <p className="mt-1 text-xs text-slate-400">
                              {o.studyMaterial}
                            </p>
                          )}
                          {o.components.length > 0 && (
                            <div className="mt-1 flex flex-wrap justify-start gap-1">
                              {o.components.map((c, i) => (
                                <span key={i} className="text-xs text-slate-400">
                                  {c.name}: {c.weightPercent}%
                                </span>
                              ))}
                            </div>
                          )}
                          {o.subItems.length > 0 && (
                            <div className="mt-2 grid gap-1 sm:grid-cols-2">
                              {o.subItems.map((si, i) => (
                                <div
                                  key={i}
                                  className="flex justify-between rounded bg-slate-50 px-2 py-1 text-xs"
                                >
                                  <span className="text-slate-400">{si.weightPercent}%</span>
                                  <span>{si.name}</span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                        <button
                          onClick={() => deleteObligation(subject.id, o.id)}
                          className="shrink-0 text-red-400 hover:text-red-600"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </>
  );
}

"use client";

import { useEffect, useState } from "react";
import { Plus, Trash2, ChevronDown, ChevronUp, Pencil, X, Check } from "lucide-react";

type WeightedItem = { name: string; weightPercent: number };

type Obligation = {
  id: string;
  questionnaireNumber: string | null;
  name: string | null;
  weightPercent: number;
  examType: string;
  studyMaterial: string | null;
  examEvent: string | null;
  gradeYear: string | null;
  sortOrder: number;
  components: WeightedItem[];
  subItems: WeightedItem[];
};

type Subject = {
  id: string;
  name: string;
  units: number | null;
  category: string;
  obligations: Obligation[];
  pathLinks: Array<{ path: { label: string } }>;
};

type ObligationDraft = Omit<Obligation, "id" | "sortOrder"> & { id?: string };

const EMPTY_OBLIGATION: ObligationDraft = {
  questionnaireNumber: "",
  name: "",
  weightPercent: 0,
  examType: "פנימי",
  studyMaterial: "",
  examEvent: "",
  gradeYear: "",
  components: [{ name: "ציון פנימי", weightPercent: 100 }],
  subItems: [],
};

const categories: Record<string, string> = {
  MANDATORY: "חובה",
  MATH: "מתמטיקה",
  ENGLISH: "אנגלית",
  TRACK: "מגמה",
  EXTENSION: "הרחבה",
};

function WeightedListEditor({
  label,
  items,
  onChange,
}: {
  label: string;
  items: WeightedItem[];
  onChange: (items: WeightedItem[]) => void;
}) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-medium text-slate-600">{label}</span>
        <button
          type="button"
          onClick={() => onChange([...items, { name: "", weightPercent: 0 }])}
          className="text-xs text-primary-600 hover:text-primary-700"
        >
          + הוסף
        </button>
      </div>
      {items.length === 0 ? (
        <p className="text-xs text-slate-400">אין פריטים</p>
      ) : (
        <div className="space-y-1">
          {items.map((item, i) => (
            <div key={i} className="flex gap-2">
              <input
                className="input flex-1 py-1 text-sm"
                placeholder="שם"
                value={item.name}
                onChange={(e) => {
                  const next = [...items];
                  next[i] = { ...next[i], name: e.target.value };
                  onChange(next);
                }}
              />
              <input
                type="number"
                className="input w-20 py-1 text-sm"
                placeholder="%"
                value={item.weightPercent || ""}
                onChange={(e) => {
                  const next = [...items];
                  next[i] = { ...next[i], weightPercent: parseFloat(e.target.value) || 0 };
                  onChange(next);
                }}
              />
              <button
                type="button"
                onClick={() => onChange(items.filter((_, j) => j !== i))}
                className="text-red-400 hover:text-red-600"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ObligationForm({
  draft,
  onChange,
  onSave,
  onCancel,
  saving,
}: {
  draft: ObligationDraft;
  onChange: (d: ObligationDraft) => void;
  onSave: () => void;
  onCancel: () => void;
  saving: boolean;
}) {
  return (
    <div className="space-y-3 rounded-xl border border-primary-200 bg-primary-50/30 p-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <div>
          <label className="label">שם מטלה</label>
          <input
            className="input"
            value={draft.name ?? ""}
            onChange={(e) => onChange({ ...draft, name: e.target.value })}
          />
        </div>
        <div>
          <label className="label">מספר שאלון</label>
          <input
            className="input"
            dir="ltr"
            value={draft.questionnaireNumber ?? ""}
            onChange={(e) => onChange({ ...draft, questionnaireNumber: e.target.value })}
          />
        </div>
        <div>
          <label className="label">משקל בציון סופי (%)</label>
          <input
            type="number"
            className="input"
            value={draft.weightPercent || ""}
            onChange={(e) =>
              onChange({ ...draft, weightPercent: parseFloat(e.target.value) || 0 })
            }
          />
        </div>
        <div>
          <label className="label">סוג היבחנות</label>
          <select
            className="input"
            value={draft.examType}
            onChange={(e) => onChange({ ...draft, examType: e.target.value })}
          >
            <option value="פנימי">פנימי</option>
            <option value="חיצוני">חיצוני</option>
          </select>
        </div>
        <div>
          <label className="label">שכבה</label>
          <input
            className="input"
            value={draft.gradeYear ?? ""}
            onChange={(e) => onChange({ ...draft, gradeYear: e.target.value })}
          />
        </div>
        <div>
          <label className="label">אירוע בחינה</label>
          <input
            className="input"
            value={draft.examEvent ?? ""}
            onChange={(e) => onChange({ ...draft, examEvent: e.target.value })}
          />
        </div>
        <div className="sm:col-span-2 lg:col-span-3">
          <label className="label">חומר לימוד</label>
          <input
            className="input"
            value={draft.studyMaterial ?? ""}
            onChange={(e) => onChange({ ...draft, studyMaterial: e.target.value })}
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <WeightedListEditor
          label="שקלול במטלה (ציון בחינה / הגשה / פנימי)"
          items={draft.components}
          onChange={(components) => onChange({ ...draft, components })}
        />
        <WeightedListEditor
          label="תת-מטלות (סיפורים, יחידות וכו')"
          items={draft.subItems}
          onChange={(subItems) => onChange({ ...draft, subItems })}
        />
      </div>

      <div className="flex gap-2">
        <button onClick={onSave} disabled={saving} className="btn-primary text-sm">
          <Check className="h-4 w-4" />
          {saving ? "שומר..." : "שמירה"}
        </button>
        <button onClick={onCancel} className="btn-secondary text-sm">
          ביטול
        </button>
      </div>
    </div>
  );
}

export default function SubjectsPage() {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [filter, setFilter] = useState("all");
  const [showNew, setShowNew] = useState(false);
  const [editingSubject, setEditingSubject] = useState<string | null>(null);
  const [subjectDraft, setSubjectDraft] = useState({ name: "", units: 5, category: "MANDATORY" });
  const [editingObligation, setEditingObligation] = useState<string | null>(null);
  const [addingObligation, setAddingObligation] = useState<string | null>(null);
  const [obligationDraft, setObligationDraft] = useState<ObligationDraft>(EMPTY_OBLIGATION);
  const [saving, setSaving] = useState(false);
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

  function startEditSubject(subject: Subject) {
    setEditingSubject(subject.id);
    setSubjectDraft({
      name: subject.name,
      units: subject.units ?? 0,
      category: subject.category,
    });
  }

  async function saveSubject(id: string) {
    setSaving(true);
    await fetch("/api/subjects", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, ...subjectDraft }),
    });
    setSaving(false);
    setEditingSubject(null);
    load();
  }

  function startEditObligation(o: Obligation) {
    setEditingObligation(o.id);
    setAddingObligation(null);
    setObligationDraft({
      id: o.id,
      questionnaireNumber: o.questionnaireNumber ?? "",
      name: o.name ?? "",
      weightPercent: o.weightPercent,
      examType: o.examType,
      studyMaterial: o.studyMaterial ?? "",
      examEvent: o.examEvent ?? "",
      gradeYear: o.gradeYear ?? "",
      components: o.components.map(({ name, weightPercent }) => ({ name, weightPercent })),
      subItems: o.subItems.map(({ name, weightPercent }) => ({ name, weightPercent })),
    });
  }

  function startAddObligation(subjectId: string) {
    setAddingObligation(subjectId);
    setEditingObligation(null);
    setObligationDraft({ ...EMPTY_OBLIGATION });
  }

  async function saveObligation(subjectId: string, existingId?: string) {
    setSaving(true);
    const payload = {
      subjectId,
      questionnaireNumber: obligationDraft.questionnaireNumber || null,
      name: obligationDraft.name || null,
      weightPercent: obligationDraft.weightPercent,
      examType: obligationDraft.examType,
      studyMaterial: obligationDraft.studyMaterial || null,
      examEvent: obligationDraft.examEvent || null,
      gradeYear: obligationDraft.gradeYear || null,
      components: obligationDraft.components,
      subItems: obligationDraft.subItems,
    };

    if (existingId) {
      await fetch("/api/obligations", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...payload, id: existingId, sortOrder: 0 }),
      });
    } else {
      await fetch("/api/obligations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    }

    setSaving(false);
    setEditingObligation(null);
    setAddingObligation(null);
    load();
  }

  async function deleteObligation(subjectId: string, id: string) {
    if (!confirm("למחוק מטלה זו?")) return;
    await fetch(`/api/obligations?id=${id}&subjectId=${subjectId}`, { method: "DELETE" });
    load();
  }

  async function deleteSubject(id: string) {
    if (!confirm("למחוק מקצוע זה וכל המטלות שלו?")) return;
    await fetch(`/api/subjects?id=${id}`, { method: "DELETE" });
    load();
  }

  return (
    <>
      <header className="-mx-8 -mt-8 border-b border-slate-200 bg-white px-8 py-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">מקצועות ומטלות</h1>
            <p className="mt-1 text-sm text-slate-500">
              ניהול מקצועות, מטלות, משקלים ושקלול ציונים
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
              <label className="label">שם מטלה ראשונה</label>
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
                    {subject.units != null && (
                      <span className="badge-muted">{subject.units} יח&quot;ל</span>
                    )}
                    <h3 className="text-lg font-semibold">{subject.name}</h3>
                  </div>
                  <p className="mt-1 text-sm text-slate-500">
                    {subject.obligations.length} מטלות • סה&quot;כ משקל: {totalWeight}%
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
                  {editingSubject === subject.id ? (
                    <div className="mb-4 space-y-3 rounded-xl border border-slate-200 bg-white p-4">
                      <div className="grid gap-3 sm:grid-cols-3">
                        <div>
                          <label className="label">שם מקצוע</label>
                          <input
                            className="input"
                            value={subjectDraft.name}
                            onChange={(e) =>
                              setSubjectDraft({ ...subjectDraft, name: e.target.value })
                            }
                          />
                        </div>
                        <div>
                          <label className="label">יחידות</label>
                          <input
                            type="number"
                            className="input"
                            value={subjectDraft.units}
                            onChange={(e) =>
                              setSubjectDraft({
                                ...subjectDraft,
                                units: parseInt(e.target.value),
                              })
                            }
                          />
                        </div>
                        <div>
                          <label className="label">קטגוריה</label>
                          <select
                            className="input"
                            value={subjectDraft.category}
                            onChange={(e) =>
                              setSubjectDraft({ ...subjectDraft, category: e.target.value })
                            }
                          >
                            {Object.entries(categories).map(([k, v]) => (
                              <option key={k} value={k}>
                                {v}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => saveSubject(subject.id)}
                          disabled={saving}
                          className="btn-primary text-sm"
                        >
                          שמירה
                        </button>
                        <button
                          onClick={() => setEditingSubject(null)}
                          className="btn-secondary text-sm"
                        >
                          ביטול
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="mb-4 flex justify-between">
                      <button
                        onClick={() => startAddObligation(subject.id)}
                        className="flex items-center gap-1 text-sm text-primary-600 hover:text-primary-700"
                      >
                        <Plus className="h-4 w-4" />
                        הוסף מטלה
                      </button>
                      <div className="flex gap-3">
                        <button
                          onClick={() => startEditSubject(subject)}
                          className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700"
                        >
                          <Pencil className="h-4 w-4" />
                          ערוך מקצוע
                        </button>
                        <button
                          onClick={() => deleteSubject(subject.id)}
                          className="flex items-center gap-1 text-sm text-red-500 hover:text-red-600"
                        >
                          <Trash2 className="h-4 w-4" />
                          מחק מקצוע
                        </button>
                      </div>
                    </div>
                  )}

                  {addingObligation === subject.id && (
                    <div className="mb-4">
                      <h4 className="mb-2 text-sm font-medium text-slate-700">מטלה חדשה</h4>
                      <ObligationForm
                        draft={obligationDraft}
                        onChange={setObligationDraft}
                        onSave={() => saveObligation(subject.id)}
                        onCancel={() => setAddingObligation(null)}
                        saving={saving}
                      />
                    </div>
                  )}

                  <div className="space-y-2">
                    {subject.obligations.map((o) => (
                      <div key={o.id}>
                        {editingObligation === o.id ? (
                          <ObligationForm
                            draft={obligationDraft}
                            onChange={setObligationDraft}
                            onSave={() => saveObligation(subject.id, o.id)}
                            onCancel={() => setEditingObligation(null)}
                            saving={saving}
                          />
                        ) : (
                          <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3">
                            <div className="min-w-0 flex-1 text-right">
                              <div className="flex flex-wrap items-center justify-start gap-2">
                                <span className="font-medium">
                                  {o.name || o.examEvent || "מטלה"}
                                </span>
                                {o.questionnaireNumber && (
                                  <span className="badge-muted" dir="ltr">
                                    {o.questionnaireNumber}
                                  </span>
                                )}
                                <span className="badge-warning">{o.weightPercent}%</span>
                                <span
                                  className={`badge-muted ${o.examType === "חיצוני" ? "bg-orange-50 text-orange-700" : ""}`}
                                >
                                  {o.examType}
                                </span>
                                {o.gradeYear && (
                                  <span className="text-xs text-slate-400">{o.gradeYear}</span>
                                )}
                              </div>
                              {o.studyMaterial && (
                                <p className="mt-1 text-xs text-slate-400">{o.studyMaterial}</p>
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
                            <div className="flex shrink-0 gap-1">
                              <button
                                onClick={() => startEditObligation(o)}
                                className="text-slate-400 hover:text-slate-600"
                              >
                                <Pencil className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => deleteObligation(subject.id, o.id)}
                                className="text-red-400 hover:text-red-600"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          </div>
                        )}
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

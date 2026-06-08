"use client";

import { useState } from "react";
import { Plus, Trash2, ChevronDown, ChevronUp, Pencil } from "lucide-react";
import { useApi } from "@/hooks/useApi";
import { PageLoader } from "@/components/ui/PageLoader";
import {
  ObligationEditor,
  EMPTY_OBLIGATION,
  type ObligationDraft,
} from "@/components/subjects/ObligationEditor";

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

const categories: Record<string, string> = {
  MANDATORY: "חובה",
  MATH: "מתמטיקה",
  ENGLISH: "אנגלית",
  TRACK: "מגמה",
  EXTENSION: "הרחבה",
};

async function apiJson<T>(url: string, init?: RequestInit): Promise<{ data?: T; error?: string }> {
  const res = await fetch(url, init);
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    return { error: body.error || `שגיאה ${res.status}` };
  }
  return { data: body as T };
}

function obligationToDraft(o?: Obligation): ObligationDraft {
  if (!o) return { ...EMPTY_OBLIGATION };
  return {
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
  };
}

function draftToPayload(draft: ObligationDraft, subjectId: string, sortOrder: number) {
  return {
    subjectId,
    questionnaireNumber: draft.questionnaireNumber || null,
    name: draft.name || null,
    weightPercent: draft.weightPercent,
    examType: draft.examType,
    studyMaterial: draft.studyMaterial || null,
    examEvent: draft.examEvent || null,
    gradeYear: draft.gradeYear || null,
    sortOrder,
    components: draft.components,
    subItems: draft.subItems,
  };
}

export default function SubjectsPage() {
  const { data: subjects = [], loading, mutate: refreshSubjects } = useApi<Subject[]>("/api/subjects");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [filter, setFilter] = useState("all");
  const [showNew, setShowNew] = useState(false);
  const [editingSubject, setEditingSubject] = useState<string | null>(null);
  const [subjectDraft, setSubjectDraft] = useState({ name: "", units: 5, category: "MANDATORY" });
  const [editingObligation, setEditingObligation] = useState<string | null>(null);
  const [addingObligation, setAddingObligation] = useState<string | null>(null);
  const [obligationDraft, setObligationDraft] = useState<ObligationDraft>({ ...EMPTY_OBLIGATION });
  const [newSubjectObligations, setNewSubjectObligations] = useState<ObligationDraft[]>([
    { ...EMPTY_OBLIGATION, weightPercent: 100 },
  ]);
  const [newSubjectMeta, setNewSubjectMeta] = useState({
    name: "",
    units: 5,
    category: "MANDATORY",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    try {
      await refreshSubjects();
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "שגיאה בטעינה");
    }
  }

  const filtered = subjects.filter((s) => filter === "all" || s.category === filter);

  if (loading && subjects.length === 0) {
    return <PageLoader />;
  }

  async function addSubject() {
    if (!newSubjectMeta.name.trim()) {
      setError("יש להזין שם מקצוע");
      return;
    }
    setSaving(true);
    setError(null);
    const { error: err } = await apiJson("/api/subjects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...newSubjectMeta,
        obligations: newSubjectObligations.map((o) => ({
          name: o.name || null,
          weightPercent: o.weightPercent,
          examType: o.examType,
          questionnaireNumber: o.questionnaireNumber || null,
          studyMaterial: o.studyMaterial || null,
          examEvent: o.examEvent || null,
          gradeYear: o.gradeYear || null,
          components: o.components,
          subItems: o.subItems,
        })),
      }),
    });
    setSaving(false);
    if (err) {
      setError(err);
      return;
    }
    setShowNew(false);
    setNewSubjectMeta({ name: "", units: 5, category: "MANDATORY" });
    setNewSubjectObligations([{ ...EMPTY_OBLIGATION, weightPercent: 100 }]);
    load();
  }

  async function saveSubject(id: string) {
    setSaving(true);
    const { error: err } = await apiJson("/api/subjects", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, ...subjectDraft }),
    });
    setSaving(false);
    if (err) setError(err);
    else {
      setEditingSubject(null);
      load();
    }
  }

  async function saveObligation(subjectId: string, existingId?: string, addAnother = false) {
    if (!obligationDraft.name?.trim() && !obligationDraft.questionnaireNumber?.trim()) {
      setError("יש להזין שם מטלה או מספר שאלון");
      return;
    }
    setSaving(true);
    setError(null);

    const subject = subjects.find((s) => s.id === subjectId);
    const sortOrder = existingId
      ? (subject?.obligations.find((o) => o.id === existingId)?.sortOrder ?? 0)
      : (subject?.obligations.length ?? 0);

    const payload = draftToPayload(obligationDraft, subjectId, sortOrder);
    const { error: err } = await apiJson(
      "/api/obligations",
      existingId
        ? {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ...payload, id: existingId }),
          }
        : {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          }
    );

    setSaving(false);
    if (err) {
      setError(err);
      return;
    }

    if (addAnother) {
      setObligationDraft({ ...EMPTY_OBLIGATION });
      setAddingObligation(subjectId);
      setEditingObligation(null);
    } else {
      setEditingObligation(null);
      setAddingObligation(null);
    }
    load();
  }

  async function deleteObligation(subjectId: string, id: string) {
    if (!confirm("למחוק מטלה זו?")) return;
    const { error: err } = await apiJson(
      `/api/obligations?id=${id}&subjectId=${subjectId}`,
      { method: "DELETE" }
    );
    if (err) setError(err);
    else load();
  }

  async function deleteSubject(id: string) {
    if (!confirm("למחוק מקצוע זה וכל המטלות שלו?")) return;
    const { error: err } = await apiJson(`/api/subjects?id=${id}`, { method: "DELETE" });
    if (err) setError(err);
    else load();
  }

  return (
    <>
      <header className="-mx-8 -mt-8 border-b border-slate-200 bg-white px-8 py-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">מקצועות ומטלות</h1>
            <p className="mt-1 text-sm text-slate-500">
              לכל מטלה: אחוז מהציון הסופי, סוג היבחנות, ושקלול פנימי / עבודות
            </p>
          </div>
          <button type="button" onClick={() => setShowNew(true)} className="btn-primary">
            <Plus className="h-4 w-4" />
            מקצוע חדש
          </button>
        </div>
      </header>

      {error && (
        <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
          <button
            type="button"
            className="mr-3 underline"
            onClick={() => setError(null)}
          >
            סגור
          </button>
        </div>
      )}

      <div className="mt-6 flex flex-wrap gap-2">
        {[
          { key: "all", label: "הכל" },
          ...Object.entries(categories).map(([k, v]) => ({ key: k, label: v })),
        ].map((f) => (
          <button
            key={f.key}
            type="button"
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
          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            <div>
              <label className="label">שם מקצוע</label>
              <input
                className="input"
                value={newSubjectMeta.name}
                onChange={(e) => setNewSubjectMeta({ ...newSubjectMeta, name: e.target.value })}
              />
            </div>
            <div>
              <label className="label">יחידות</label>
              <input
                type="number"
                className="input"
                value={newSubjectMeta.units}
                onChange={(e) =>
                  setNewSubjectMeta({ ...newSubjectMeta, units: parseInt(e.target.value) || 0 })
                }
              />
            </div>
            <div>
              <label className="label">קטגוריה</label>
              <select
                className="input"
                value={newSubjectMeta.category}
                onChange={(e) =>
                  setNewSubjectMeta({ ...newSubjectMeta, category: e.target.value })
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

          <div className="mt-6 space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-medium text-slate-700">מטלות</h4>
              <button
                type="button"
                onClick={() =>
                  setNewSubjectObligations([...newSubjectObligations, { ...EMPTY_OBLIGATION }])
                }
                className="flex items-center gap-1 text-sm text-primary-600"
              >
                <Plus className="h-4 w-4" />
                הוסף מטלה
              </button>
            </div>
            {newSubjectObligations.map((ob, idx) => (
              <div key={idx} className="relative">
                {newSubjectObligations.length > 1 && (
                  <button
                    type="button"
                    onClick={() =>
                      setNewSubjectObligations(newSubjectObligations.filter((_, i) => i !== idx))
                    }
                    className="absolute left-2 top-2 z-10 text-xs text-red-500"
                  >
                    הסר מטלה
                  </button>
                )}
                <ObligationEditor
                  draft={ob}
                  compact
                  onChange={(d) => {
                    const next = [...newSubjectObligations];
                    next[idx] = d;
                    setNewSubjectObligations(next);
                  }}
                />
              </div>
            ))}
          </div>

          <div className="mt-4 flex gap-3">
            <button type="button" onClick={addSubject} disabled={saving} className="btn-primary">
              שמור מקצוע
            </button>
            <button type="button" onClick={() => setShowNew(false)} className="btn-secondary">
              ביטול
            </button>
          </div>
        </div>
      )}

      <div className="mt-6 space-y-3">
        {filtered.map((subject) => {
          const totalWeight = subject.obligations.reduce((s, o) => s + o.weightPercent, 0);
          const isOpen = expanded === subject.id;

          return (
            <div key={subject.id} className="card overflow-hidden">
              <div className="flex items-center gap-3 p-5">
                <button
                  type="button"
                  onClick={() => setExpanded(isOpen ? null : subject.id)}
                  className="shrink-0 rounded-lg p-1 hover:bg-slate-100"
                  aria-label={isOpen ? "סגור" : "פתח"}
                >
                  {isOpen ? (
                    <ChevronUp className="h-5 w-5 text-slate-400" />
                  ) : (
                    <ChevronDown className="h-5 w-5 text-slate-400" />
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setExpanded(isOpen ? null : subject.id)}
                  className="min-w-0 flex-1 text-right"
                >
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
                </button>
              </div>

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
                                units: parseInt(e.target.value) || 0,
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
                          type="button"
                          onClick={() => saveSubject(subject.id)}
                          disabled={saving}
                          className="btn-primary text-sm"
                        >
                          שמירה
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingSubject(null)}
                          className="btn-secondary text-sm"
                        >
                          ביטול
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setAddingObligation(subject.id);
                          setEditingObligation(null);
                          setObligationDraft({ ...EMPTY_OBLIGATION });
                          setError(null);
                        }}
                        className="btn-primary text-sm"
                      >
                        <Plus className="h-4 w-4" />
                        הוסף מטלה
                      </button>
                      <div className="flex gap-3">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingSubject(subject.id);
                            setSubjectDraft({
                              name: subject.name,
                              units: subject.units ?? 0,
                              category: subject.category,
                            });
                          }}
                          className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700"
                        >
                          <Pencil className="h-4 w-4" />
                          ערוך מקצוע
                        </button>
                        <button
                          type="button"
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
                      <ObligationEditor
                        draft={obligationDraft}
                        onChange={setObligationDraft}
                        onSave={() => saveObligation(subject.id)}
                        onCancel={() => setAddingObligation(null)}
                        saving={saving}
                        showAddAnother
                        onSaveAndAddAnother={() => saveObligation(subject.id, undefined, true)}
                      />
                    </div>
                  )}

                  <div className="space-y-2">
                    {subject.obligations.length === 0 && addingObligation !== subject.id && (
                      <p className="rounded-xl border border-dashed border-slate-300 bg-white p-4 text-center text-sm text-slate-500">
                        אין מטלות למקצוע זה. לחץ &quot;הוסף מטלה&quot; למעלה.
                      </p>
                    )}
                    {subject.obligations.map((o) => (
                      <div key={o.id}>
                        {editingObligation === o.id ? (
                          <ObligationEditor
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
                                <span className="badge-warning">{o.weightPercent}% מהסופי</span>
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
                                  <span className="text-xs text-slate-500">שקלול במטלה:</span>
                                  {o.components.map((c, i) => (
                                    <span key={i} className="text-xs text-slate-400">
                                      {c.name} {c.weightPercent}%
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
                                type="button"
                                onClick={() => {
                                  setEditingObligation(o.id);
                                  setAddingObligation(null);
                                  setObligationDraft(obligationToDraft(o));
                                  setError(null);
                                }}
                                className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                              >
                                <Pencil className="h-4 w-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => deleteObligation(subject.id, o.id)}
                                className="rounded p-1 text-red-400 hover:bg-red-50 hover:text-red-600"
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

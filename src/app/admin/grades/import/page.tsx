"use client";

import { useEffect, useMemo, useState } from "react";
import { Upload, FileSpreadsheet, CheckCircle, AlertCircle, Download, Loader2 } from "lucide-react";
import { useApi } from "@/hooks/useApi";
import {
  downloadGradesImportTemplate,
  exportTimestamp,
} from "@/lib/excel-export";

type ClassItem = { id: string; name: string; gradeYear: string | null };

type TemplateData = {
  classes: string[];
  subjects: string[];
  obligations: string[];
  statuses: string[];
  subjectOptions: Array<{
    id: string;
    name: string;
    obligations: Array<{ id: string; label: string }>;
  }>;
  classStudents?: string[];
};

export default function GradesImportPage() {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{
    updated: number;
    skipped: number;
    errors: string[];
  } | null>(null);

  const [classId, setClassId] = useState("");
  const [subjectId, setSubjectId] = useState("");
  const [obligationLabel, setObligationLabel] = useState("");
  const [downloading, setDownloading] = useState<"empty" | "filled" | null>(null);

  const { data: classes = [] } = useApi<ClassItem[]>("/api/classes/list");
  const templateKey = classId
    ? `/api/grades/import/template?classId=${classId}`
    : "/api/grades/import/template";
  const { data: templateData, loading: templateLoading } =
    useApi<TemplateData>(templateKey);

  const selectedClass = classes.find((c) => c.id === classId);

  const selectedSubject = useMemo(
    () => templateData?.subjectOptions.find((s) => s.id === subjectId),
    [templateData, subjectId]
  );

  const obligationOptions = useMemo(() => {
    return selectedSubject?.obligations ?? [];
  }, [selectedSubject]);

  useEffect(() => {
    setSubjectId("");
    setObligationLabel("");
  }, [classId]);

  useEffect(() => {
    setObligationLabel("");
  }, [subjectId]);

  async function handleImport() {
    if (!file) return;
    setLoading(true);
    setResult(null);
    setError(null);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("/api/grades/import", { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "שגיאה בייבוא");
        return;
      }
      setResult(data);
    } catch {
      setError("שגיאת רשת בייבוא");
    } finally {
      setLoading(false);
    }
  }

  async function downloadEmptyTemplate() {
    if (!templateData) return;
    setDownloading("empty");
    try {
      await downloadGradesImportTemplate(`תבנית_ציונים_${exportTimestamp()}.xlsx`, {
        classes: templateData.classes,
        subjects: templateData.subjects,
        obligations: templateData.obligations,
        statuses: templateData.statuses,
      });
    } finally {
      setDownloading(null);
    }
  }

  async function downloadFilledTemplate() {
    if (!templateData || !selectedClass) return;
    const students = templateData.classStudents ?? [];
    if (students.length === 0) return;

    setDownloading("filled");
    try {
      const safeName = selectedClass.name.replace(/[/\\?*[\]]/g, "-");
      await downloadGradesImportTemplate(
        `ציונים_${safeName}_${exportTimestamp()}.xlsx`,
        {
          classes: templateData.classes,
          subjects: templateData.subjects,
          obligations: templateData.obligations,
          statuses: templateData.statuses,
          students,
          prefilledClass: selectedClass.name,
          prefilledSubject: selectedSubject?.name || undefined,
          prefilledObligation: obligationLabel || undefined,
        }
      );
    } finally {
      setDownloading(null);
    }
  }

  const studentCount = templateData?.classStudents?.length ?? 0;

  return (
    <div className="mt-6 grid gap-6 lg:grid-cols-2">
      <div className="card p-6">
        <h2 className="text-lg font-semibold">העלאת קובץ ציונים</h2>
        <p className="mt-2 text-sm text-slate-500">
          הקובץ צריך לכלול: כיתה, מקצוע, מטלה, שם תלמיד, ציון, סטטוס
        </p>

        <div className="mt-6">
          <label className="flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50 p-10 transition hover:border-primary-400 hover:bg-primary-50/30">
            <Upload className="h-10 w-10 text-slate-400" />
            <span className="mt-3 text-sm font-medium text-slate-600">
              {file ? file.name : "לחץ לבחירת קובץ או גרור לכאן"}
            </span>
            <input
              type="file"
              accept=".xlsx,.xls,.csv"
              className="hidden"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          </label>
        </div>

        <div className="mt-6 flex gap-3">
          <button onClick={handleImport} disabled={!file || loading} className="btn-primary">
            <FileSpreadsheet className="h-4 w-4" />
            {loading ? "מייבא..." : "ייבוא"}
          </button>
        </div>

        {error && (
          <div className="mt-4 flex items-center gap-2 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">
            <AlertCircle className="h-4 w-4" />
            {error}
          </div>
        )}
      </div>

      <div className="space-y-6">
        <div className="card p-6">
          <h2 className="text-lg font-semibold">הורדת תבנית</h2>
          <p className="mt-2 text-sm text-slate-500">
            תבנית אקסל עם רשימות בחירה לכיתה, מקצוע, מטלה וסטטוס
          </p>

          <div className="mt-4">
            <button
              onClick={() => void downloadEmptyTemplate()}
              disabled={!templateData || downloading !== null}
              className="btn-secondary w-full sm:w-auto"
            >
              {downloading === "empty" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Download className="h-4 w-4" />
              )}
              תבנית ריקה
            </button>
          </div>

          <div className="mt-6 border-t border-slate-100 pt-6">
            <h3 className="text-sm font-semibold text-slate-700">
              תבנית מוכנה עם תלמידי כיתה
            </h3>
            <p className="mt-1 text-sm text-slate-500">
              הורידו קובץ עם שמות התלמידים כבר מולאו — נשאר רק להזין ציונים
            </p>

            <div className="mt-4 grid gap-3">
              <div>
                <label className="label">כיתה</label>
                <select
                  className="input"
                  value={classId}
                  onChange={(e) => setClassId(e.target.value)}
                >
                  <option value="">— בחר כיתה —</option>
                  {classes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                      {c.gradeYear ? ` (${c.gradeYear})` : ""}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="label">מקצוע (אופציונלי)</label>
                <select
                  className="input"
                  value={subjectId}
                  onChange={(e) => setSubjectId(e.target.value)}
                  disabled={!classId || templateLoading}
                >
                  <option value="">— בחר מקצוע —</option>
                  {(templateData?.subjectOptions ?? []).map((subject) => (
                    <option key={subject.id} value={subject.id}>
                      {subject.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="label">מטלה (אופציונלי)</label>
                <select
                  className="input"
                  value={obligationLabel}
                  onChange={(e) => setObligationLabel(e.target.value)}
                  disabled={!subjectId}
                >
                  <option value="">— בחר מטלה —</option>
                  {obligationOptions.map((o) => (
                    <option key={o.id} value={o.label}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <button
              onClick={() => void downloadFilledTemplate()}
              disabled={
                !classId ||
                !templateData ||
                studentCount === 0 ||
                downloading !== null
              }
              className="btn-primary mt-4 w-full sm:w-auto"
            >
              {downloading === "filled" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Download className="h-4 w-4" />
              )}
              {studentCount > 0
                ? `הורדת תבנית (${studentCount} תלמידים)`
                : "הורדת תבנית עם תלמידים"}
            </button>

            {classId && !templateLoading && studentCount === 0 && (
              <p className="mt-2 text-sm text-amber-600">אין תלמידים בכיתה זו</p>
            )}

            {subjectId && obligationLabel && (
              <p className="mt-2 text-xs text-slate-500">
                המקצוע והמטלה ימולאו אוטומטית בכל השורות
              </p>
            )}
          </div>
        </div>

        <div className="card p-6">
          <h2 className="text-lg font-semibold">הוראות</h2>
          <ul className="mt-4 space-y-3 text-sm text-slate-600">
            <li className="flex gap-2">
              <span className="font-bold text-primary-600">1.</span>
              הורידו תבנית ריקה או תבנית עם תלמידי כיתה
            </li>
            <li className="flex gap-2">
              <span className="font-bold text-primary-600">2.</span>
              בחרו ערכים מרשימות הנפתחות בכיתה, מקצוע, מטלה וסטטוס
            </li>
            <li className="flex gap-2">
              <span className="font-bold text-primary-600">3.</span>
              ניתן להשתמש בעמודות בעברית או באנגלית
            </li>
            <li className="flex gap-2">
              <span className="font-bold text-primary-600">4.</span>
              סטטוסים: לא התחיל, בתהליך, הוגש, נבדק, פטור
            </li>
            <li className="flex gap-2">
              <span className="font-bold text-primary-600">5.</span>
              שורות עם שגיאות ידווחו — שאר השורות ייובאו
            </li>
          </ul>

          {result && (
            <div className="mt-6 rounded-xl bg-slate-50 p-4">
              <div className="flex items-center gap-2 text-emerald-600">
                <CheckCircle className="h-5 w-5" />
                <span className="font-medium">
                  {result.updated} ציונים עודכנו, {result.skipped} דולגו
                </span>
              </div>
              {result.errors.length > 0 && (
                <div className="mt-3">
                  <div className="flex items-center gap-2 text-red-500">
                    <AlertCircle className="h-4 w-4" />
                    <span className="text-sm font-medium">שגיאות:</span>
                  </div>
                  <ul className="mt-2 max-h-48 space-y-1 overflow-y-auto text-xs text-red-500">
                    {result.errors.map((e, i) => (
                      <li key={i}>{e}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

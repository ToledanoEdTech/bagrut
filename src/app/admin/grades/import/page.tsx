"use client";

import { useState } from "react";
import { Upload, FileSpreadsheet, CheckCircle, AlertCircle } from "lucide-react";

export default function GradesImportPage() {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{
    updated: number;
    skipped: number;
    errors: string[];
  } | null>(null);

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

  function downloadTemplate() {
    const headers = "כיתה,מקצוע,מטלה,שם תלמיד,ציון,סטטוס\n";
    const sample =
      'י"א1,ביולוגיה,שאלון 1,ישראל ישראלי,85,נבדק\n' +
      'י"א1,ביולוגיה,שאלון 1,דוד כהן,72,נבדק\n';
    const blob = new Blob(["\ufeff" + headers + sample], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "template_grades.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

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
          <button onClick={downloadTemplate} className="btn-secondary">
            הורדת תבנית
          </button>
        </div>

        {error && (
          <div className="mt-4 flex items-center gap-2 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">
            <AlertCircle className="h-4 w-4" />
            {error}
          </div>
        )}
      </div>

      <div className="card p-6">
        <h2 className="text-lg font-semibold">הוראות</h2>
        <ul className="mt-4 space-y-3 text-sm text-slate-600">
          <li className="flex gap-2">
            <span className="font-bold text-primary-600">1.</span>
            הורידו את תבנית הקובץ או הכינו קובץ עם העמודות הנדרשות
          </li>
          <li className="flex gap-2">
            <span className="font-bold text-primary-600">2.</span>
            ניתן להשתמש בעמודות בעברית או באנגלית
          </li>
          <li className="flex gap-2">
            <span className="font-bold text-primary-600">3.</span>
            סטטוסים: לא התחיל, בתהליך, הוגש, נבדק, פטור
          </li>
          <li className="flex gap-2">
            <span className="font-bold text-primary-600">4.</span>
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
  );
}

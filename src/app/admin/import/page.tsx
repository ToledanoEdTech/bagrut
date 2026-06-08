"use client";

import { useState } from "react";
import { Upload, FileSpreadsheet, CheckCircle, AlertCircle } from "lucide-react";

export default function ImportPage() {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{
    created: number;
    skipped: number;
    errors: string[];
  } | null>(null);

  async function handleImport() {
    if (!file) return;
    setLoading(true);
    setResult(null);

    const formData = new FormData();
    formData.append("file", file);

    const res = await fetch("/api/students/import", {
      method: "POST",
      body: formData,
    });
    const data = await res.json();
    setResult(data);
    setLoading(false);
  }

  function downloadTemplate() {
    const headers = "שם,אימייל,כיתה,מגמה,מתמטיקה,אנגלית\n";
    const sample =
      'ישראל ישראלי,israel@student.local,י"א1,ביולוגיה,4,4\n';
    const blob = new Blob(["\ufeff" + headers + sample], {
      type: "text/csv;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "template_students.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <>
      <header className="-mx-8 -mt-8 border-b border-slate-200 bg-white px-8 py-6">
        <h1 className="text-2xl font-bold text-slate-900">ייבוא תלמידים</h1>
        <p className="mt-1 text-sm text-slate-500">
          העלאת קובץ אקסל/CSV עם רשימת תלמידים
        </p>
      </header>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <div className="card p-6">
          <h2 className="text-lg font-semibold">העלאת קובץ</h2>
          <p className="mt-2 text-sm text-slate-500">
            הקובץ צריך לכלול: שם, אימייל, כיתה, מגמה (אופציונלי), מתמטיקה, אנגלית
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
            <button
              onClick={handleImport}
              disabled={!file || loading}
              className="btn-primary"
            >
              <FileSpreadsheet className="h-4 w-4" />
              {loading ? "מייבא..." : "ייבוא"}
            </button>
            <button onClick={downloadTemplate} className="btn-secondary">
              הורדת תבנית
            </button>
          </div>
        </div>

        <div className="card p-6">
          <h2 className="text-lg font-semibold">הוראות</h2>
          <ul className="mt-4 space-y-3 text-sm text-slate-600">
            <li className="flex gap-2">
              <span className="font-bold text-primary-600">1.</span>
              הורידו את תבנית הקובץ או הכינו קובץ אקסל עם העמודות הנדרשות
            </li>
            <li className="flex gap-2">
              <span className="font-bold text-primary-600">2.</span>
              עמודת האימייל תשמש ליצירת חשבון התחברות לתלמיד
            </li>
            <li className="flex gap-2">
              <span className="font-bold text-primary-600">3.</span>
              סיסמת ברירת מחדל לתלמידים חדשים: student123
            </li>
            <li className="flex gap-2">
              <span className="font-bold text-primary-600">4.</span>
              כיתות שלא קיימות ייווצרו אוטומטית
            </li>
          </ul>

          {result && (
            <div className="mt-6 rounded-xl bg-slate-50 p-4">
              <div className="flex items-center gap-2 text-emerald-600">
                <CheckCircle className="h-5 w-5" />
                <span className="font-medium">
                  {result.created} תלמידים נוצרו, {result.skipped} דולגו
                </span>
              </div>
              {result.errors.length > 0 && (
                <div className="mt-3">
                  <div className="flex items-center gap-2 text-red-500">
                    <AlertCircle className="h-4 w-4" />
                    <span className="text-sm font-medium">שגיאות:</span>
                  </div>
                  <ul className="mt-2 space-y-1 text-xs text-red-500">
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
    </>
  );
}

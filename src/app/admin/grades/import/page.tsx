"use client";

import { useEffect, useMemo, useState } from "react";
import { FileSpreadsheet, Download, Loader2, CheckCircle2 } from "lucide-react";
import { useApi } from "@/hooks/useApi";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";
import { Alert } from "@/components/ui/Alert";
import { FileUpload } from "@/components/ui/FileUpload";
import { useToast } from "@/components/ui/Toast";
import {
  downloadGradesImportTemplate,
  downloadFullGradesTemplate,
  exportTimestamp,
  type FullGradesTemplateRow,
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
  const toast = useToast();
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
  const [downloading, setDownloading] = useState<"empty" | "filled" | "full" | null>(null);

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
      if (data.updated > 0) {
        toast.success(`${data.updated} ציונים עודכנו בהצלחה`);
      }
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

  async function downloadFullClassFile() {
    if (!classId || !selectedClass) return;
    setDownloading("full");
    try {
      const res = await fetch(
        `/api/grades/import/full-template?classId=${classId}`
      );
      const data = (await res.json()) as {
        className: string;
        statuses: string[];
        rows: FullGradesTemplateRow[];
        error?: string;
      };
      if (!res.ok) {
        setError(data.error ?? "שגיאה בהורדת הקובץ");
        return;
      }
      const safeName = selectedClass.name.replace(/[/\\?*[\]]/g, "-");
      await downloadFullGradesTemplate(
        `ציונים_מלא_${safeName}_${exportTimestamp()}.xlsx`,
        { className: data.className, statuses: data.statuses, rows: data.rows }
      );
    } catch {
      setError("שגיאת רשת בהורדת הקובץ");
    } finally {
      setDownloading(null);
    }
  }

  const studentCount = templateData?.classStudents?.length ?? 0;

  return (
    <>
      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="p-6">
          <h2 className="text-lg font-semibold">העלאת קובץ ציונים</h2>
          <p className="mt-2 text-sm text-slate-500">
            הקובץ צריך לכלול: כיתה, מקצוע, מטלה, שם תלמיד, ציון, סטטוס
          </p>

          <div className="mt-6">
            <FileUpload file={file} onFileChange={setFile} />
          </div>

          <div className="mt-6">
            <Button onClick={handleImport} disabled={!file || loading}>
              <FileSpreadsheet className="h-4 w-4" />
              {loading ? "מייבא..." : "ייבוא"}
            </Button>
          </div>

          {error && (
            <Alert variant="error" className="mt-4" onClose={() => setError(null)}>
              {error}
            </Alert>
          )}
        </Card>

        <div className="space-y-6">
          <Card className="p-6">
            <h2 className="text-lg font-semibold">הורדת תבנית</h2>
            <p className="mt-2 text-sm text-slate-500">
              תבנית אקסל עם רשימות בחירה לכיתה, מקצוע, מטלה וסטטוס
            </p>

            <div className="mt-4">
              <Button
                variant="secondary"
                onClick={() => void downloadEmptyTemplate()}
                disabled={!templateData || downloading !== null}
              >
                {downloading === "empty" ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Download className="h-4 w-4" />
                )}
                תבנית ריקה
              </Button>
            </div>

            <div className="mt-6 border-t border-slate-100 pt-6">
              <h3 className="text-sm font-semibold text-slate-700">
                תבנית מוכנה עם תלמידי כיתה
              </h3>
              <p className="mt-1 text-sm text-slate-500">
                הורידו קובץ עם שמות התלמידים כבר מולאו — נשאר רק להזין ציונים
              </p>

              <div className="mt-4 grid gap-3">
                <Select
                  label="כיתה"
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
                </Select>

                <Select
                  label="מקצוע (אופציונלי)"
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
                </Select>

                <Select
                  label="מטלה (אופציונלי)"
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
                </Select>
              </div>

              <div className="mt-4 flex flex-wrap gap-3">
                <Button
                  onClick={() => void downloadFilledTemplate()}
                  disabled={!classId || !templateData || studentCount === 0 || downloading !== null}
                >
                  {downloading === "filled" ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Download className="h-4 w-4" />
                  )}
                  {studentCount > 0
                    ? `תבנית לפי בחירה (${studentCount})`
                    : "תבנית לפי בחירה"}
                </Button>

                <Button
                  variant="secondary"
                  onClick={() => void downloadFullClassFile()}
                  disabled={!classId || studentCount === 0 || downloading !== null}
                >
                  {downloading === "full" ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Download className="h-4 w-4" />
                  )}
                  קובץ מלא — כל המטלות והרכיבים
                </Button>
              </div>

              {classId && !templateLoading && studentCount === 0 && (
                <p className="mt-2 text-sm text-amber-600">אין תלמידים בכיתה זו</p>
              )}
            </div>
          </Card>

          <Card className="p-6">
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
                שורות עם שגיאות ידווחו — שאר השורות ייובאו
              </li>
            </ul>

            {result && (
              <div className="mt-6 space-y-3">
                <Alert variant="success" title="הייבוא הושלם">
                  <span className="flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4" />
                    {result.updated} ציונים עודכנו, {result.skipped} דולגו
                  </span>
                </Alert>
                {result.errors.length > 0 && (
                  <Alert variant="error" title="שגיאות בייבוא">
                    <ul className="mt-2 max-h-48 space-y-1 overflow-y-auto text-xs">
                      {result.errors.map((e, i) => (
                        <li key={i}>{e}</li>
                      ))}
                    </ul>
                  </Alert>
                )}
              </div>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}

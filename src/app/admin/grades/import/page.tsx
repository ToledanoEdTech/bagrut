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
    obligations: Array<{
      id: string;
      label: string;
      tasks: Array<{
        sortOrder: number;
        taskName: string;
        taskKind: "single" | "component" | "subItem";
      }>;
    }>;
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
  const [taskSortOrder, setTaskSortOrder] = useState("");
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

  const selectedObligation = useMemo(
    () => obligationOptions.find((o) => o.label === obligationLabel),
    [obligationOptions, obligationLabel]
  );

  const taskOptions = useMemo(() => {
    const tasks = selectedObligation?.tasks ?? [];
    if (tasks.length <= 1) return [];
    return tasks;
  }, [selectedObligation]);

  const selectedTask = useMemo(
    () => taskOptions.find((t) => String(t.sortOrder) === taskSortOrder),
    [taskOptions, taskSortOrder]
  );

  useEffect(() => {
    setSubjectId("");
    setObligationLabel("");
    setTaskSortOrder("");
  }, [classId]);

  useEffect(() => {
    setObligationLabel("");
    setTaskSortOrder("");
  }, [subjectId]);

  useEffect(() => {
    setTaskSortOrder("");
  }, [obligationLabel]);

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

  function buildFilledTemplateQuery(): string {
    const params = new URLSearchParams({ classId });
    if (subjectId) params.set("subjectId", subjectId);
    if (selectedObligation?.id) params.set("obligationId", selectedObligation.id);
    if (taskSortOrder) params.set("taskSortOrder", taskSortOrder);
    return params.toString();
  }

  function buildFilledFilename(): string {
    const safeClass = selectedClass?.name.replace(/[/\\?*[\]]/g, "-") ?? "כיתה";
    const parts = [safeClass];
    if (selectedSubject?.name) {
      parts.push(selectedSubject.name.replace(/[/\\?*[\]]/g, "-"));
    }
    if (obligationLabel) {
      parts.push(obligationLabel.slice(0, 30).replace(/[/\\?*[\]]/g, "-"));
    }
    if (selectedTask?.taskName) {
      parts.push(selectedTask.taskName.slice(0, 20).replace(/[/\\?*[\]]/g, "-"));
    }
    return `ציונים_${parts.join("_")}_${exportTimestamp()}.xlsx`;
  }

  function buildFilledTitle(rowCount: number): string {
    const parts = [selectedClass?.name ?? "כיתה"];
    if (selectedSubject?.name) parts.push(selectedSubject.name);
    if (obligationLabel) parts.push(obligationLabel);
    if (selectedTask?.taskName) parts.push(selectedTask.taskName);
    return `קובץ הזנת ציונים — ${parts.join(" · ")} (${rowCount} שורות)`;
  }

  async function downloadFilledTemplate() {
    if (!templateData || !selectedClass || !classId) return;
    const students = templateData.classStudents ?? [];
    if (students.length === 0) return;

    setDownloading("filled");
    try {
      const res = await fetch(
        `/api/grades/import/filled-template?${buildFilledTemplateQuery()}`
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
      if (data.rows.length === 0) {
        setError("לא נמצאו שורות לפי הבחירה — בדקו שהמקצוע/מטלה רלוונטיים לכיתה");
        return;
      }
      await downloadFullGradesTemplate(buildFilledFilename(), {
        className: data.className,
        statuses: data.statuses,
        rows: data.rows,
        title: buildFilledTitle(data.rows.length),
      });
    } catch {
      setError("שגיאת רשת בהורדת הקובץ");
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
            (ובמידת הצורך גם רכיב/תת-מטלה)
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
                הורידו קובץ עם שמות התלמידים וציונים קיימים — נשאר רק למלא את
                התאים הריקים. ניתן לסנן לפי מקצוע, מטלה או תת-מטלה.
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
                  <option value="">— כל המקצועות —</option>
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
                  <option value="">— כל המטלות —</option>
                  {obligationOptions.map((o) => (
                    <option key={o.id} value={o.label}>
                      {o.label}
                    </option>
                  ))}
                </Select>

                {taskOptions.length > 0 && (
                  <Select
                    label="תת-מטלה (אופציונלי)"
                    value={taskSortOrder}
                    onChange={(e) => setTaskSortOrder(e.target.value)}
                  >
                    <option value="">— כל תתי המטלות —</option>
                    {taskOptions.map((task) => (
                      <option key={task.sortOrder} value={String(task.sortOrder)}>
                        {task.taskName}
                      </option>
                    ))}
                  </Select>
                )}
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
                    ? `תבנית לפי בחירה (${studentCount} תלמידים)`
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
                בחרו כיתה, ואופציונלית מקצוע / מטלה / תת-מטלה לסינון הקובץ
              </li>
              <li className="flex gap-2">
                <span className="font-bold text-primary-600">3.</span>
                ציונים שכבר הוזנו יופיעו בקובץ — מלאו רק תאים ריקים
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

"use client";

import { useCallback, useState } from "react";
import { Bell, Mail, Play, RefreshCw, Settings2 } from "lucide-react";
import { useApi } from "@/hooks/useApi";
import { PageHeader } from "@/components/ui/PageHeader";
import { PageLoader } from "@/components/ui/PageLoader";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Alert } from "@/components/ui/Alert";
import { useToast } from "@/components/ui/Toast";
import { invalidateCache } from "@/lib/api-cache";
import type { GradeReminderSettings } from "@/lib/grade-reminders";

type SettingsResponse = {
  settings: GradeReminderSettings;
  periodKey: string;
  today: string;
  overdueCount: number;
  wouldNotifyCount: number;
  overdueItems: Array<{
    subjectName: string;
    obligationLabel: string;
    examEvent: string | null;
    gradeEntryDueDate: string;
    missingStudentCount: number;
    classNames: string[];
  }>;
  plans: Array<{
    recipient: { id: string; name: string; email: string };
    itemCount: number;
  }>;
  smtpConfigured: boolean;
  cronConfigured: boolean;
  appUrl: string | null;
};

function formatDateTime(iso?: string): string {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("he-IL", {
    timeZone: "Asia/Jerusalem",
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(iso));
}

export default function SettingsPage() {
  const { data, loading, mutate } = useApi<SettingsResponse>("/api/settings/grade-reminders");
  const toast = useToast();
  const [saving, setSaving] = useState(false);
  const [running, setRunning] = useState<"dry" | "force" | null>(null);
  const [testEmail, setTestEmail] = useState("");
  const [sendingTest, setSendingTest] = useState(false);

  const enabled = data?.settings.enabled ?? false;
  const minThreshold = data?.settings.minThreshold ?? 1;

  const saveSettings = useCallback(
    async (patch: Partial<GradeReminderSettings>) => {
      setSaving(true);
      try {
        const res = await fetch("/api/settings/grade-reminders", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(patch),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? "שגיאה בשמירה");
        invalidateCache("/api/settings/grade-reminders");
        await mutate();
        toast.success("ההגדרות נשמרו");
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "שגיאה בשמירה");
      } finally {
        setSaving(false);
      }
    },
    [mutate, toast]
  );

  const runReminders = useCallback(
    async (mode: "dry" | "force") => {
      setRunning(mode);
      try {
        const res = await fetch("/api/settings/grade-reminders", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            dryRun: mode === "dry",
            force: mode === "force",
          }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error ?? "שגיאה בהרצה");
        invalidateCache("/api/settings/grade-reminders");
        await mutate();
        const { summary } = json;
        if (mode === "dry") {
          toast.success(`סימולציה: ${summary.sent} נמענים היו מקבלים מייל`);
        } else {
          toast.success(`נשלחו ${summary.sent} מיילים (${summary.skipped} דולגו, ${summary.errors} שגיאות)`);
        }
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "שגיאה בהרצה");
      } finally {
        setRunning(null);
      }
    },
    [mutate, toast]
  );

  const sendTestEmail = useCallback(async () => {
    if (!testEmail.trim()) {
      toast.error("הזן כתובת מייל לבדיקה");
      return;
    }
    setSendingTest(true);
    try {
      const res = await fetch(
        `/api/test-email?to=${encodeURIComponent(testEmail.trim())}`
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "שגיאה בשליחה");
      toast.success(`מייל בדיקה נשלח ל-${testEmail.trim()}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "שגיאה בשליחה");
    } finally {
      setSendingTest(false);
    }
  }, [testEmail, toast]);

  if (loading && !data) return <PageLoader />;

  return (
    <div className="space-y-6">
      <PageHeader
        title="תזכורות הזנת ציונים"
        subtitle="הפעלה, בדיקות ידניות ומעקב אחרי ריצות אוטומטיות"
      />

      {data && !data.smtpConfigured && (
        <Alert variant="warning">
          SMTP לא מוגדר. הגדר SMTP_USER ו-SMTP_APP_PASSWORD ב-Vercel לפני שליחה אמיתית.
        </Alert>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="space-y-5 p-6">
          <div className="flex items-center gap-2 text-slate-800">
            <Settings2 className="h-5 w-5 text-primary-600" />
            <h2 className="text-lg font-bold">הגדרות כלליות</h2>
          </div>

          <label className="flex cursor-pointer items-center justify-between gap-4 rounded-xl border border-slate-200 bg-slate-50/50 p-4">
            <div>
              <p className="font-medium text-slate-800">תזכורות אוטומטיות</p>
              <p className="text-sm text-slate-500">
                שליחה ביום למחרת תאריך היעד, בשעה 08:00 (שעון ישראל)
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={enabled}
              disabled={saving}
              onClick={() => saveSettings({ enabled: !enabled })}
              className={`relative h-7 w-12 shrink-0 rounded-full transition ${
                enabled ? "bg-primary-600" : "bg-slate-300"
              }`}
            >
              <span
                className={`absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition ${
                  enabled ? "right-0.5" : "right-5"
                }`}
              />
            </button>
          </label>

          <div>
            <label className="label">סף מינימלי למטלות חסרות</label>
            <div className="flex gap-2">
              <Input
                type="number"
                min={1}
                value={minThreshold}
                onChange={(e) => {
                  const val = parseInt(e.target.value, 10);
                  if (!isNaN(val) && val >= 1) {
                    saveSettings({ minThreshold: val });
                  }
                }}
                className="max-w-[120px]"
              />
            </div>
            <p className="mt-1 text-xs text-slate-400">
              נמען יקבל מייל רק אם יש לפחות מספר מטלות כזה שמצדיקות תזכורת
            </p>
          </div>
        </Card>

        <Card className="space-y-4 p-6">
          <div className="flex items-center gap-2 text-slate-800">
            <Bell className="h-5 w-5 text-primary-600" />
            <h2 className="text-lg font-bold">סטטוס ריצה</h2>
          </div>
          <dl className="grid gap-3 text-sm">
            <div className="flex justify-between gap-4 border-b border-slate-100 pb-2">
              <dt className="text-slate-500">תאריך היום (ישראל)</dt>
              <dd className="font-medium">{data?.today ?? "—"}</dd>
            </div>
            <div className="flex justify-between gap-4 border-b border-slate-100 pb-2">
              <dt className="text-slate-500">תאריך ריצה (ישראל)</dt>
              <dd className="font-medium" dir="ltr">
                {data?.periodKey ?? "—"}
              </dd>
            </div>
            <div className="flex justify-between gap-4 border-b border-slate-100 pb-2">
              <dt className="text-slate-500">מטלות לתזכורת היום</dt>
              <dd className="font-medium">{data?.overdueCount ?? 0}</dd>
            </div>
            <div className="flex justify-between gap-4 border-b border-slate-100 pb-2">
              <dt className="text-slate-500">נמענים שיקבלו תזכורת</dt>
              <dd className="font-medium">{data?.wouldNotifyCount ?? 0}</dd>
            </div>
            <div className="flex justify-between gap-4 border-b border-slate-100 pb-2">
              <dt className="text-slate-500">ריצה אחרונה</dt>
              <dd className="font-medium">
                {formatDateTime(data?.settings.lastRunAt)}
              </dd>
            </div>
            {data?.settings.lastRunSummary && (
              <div className="flex justify-between gap-4">
                <dt className="text-slate-500">סיכום אחרון</dt>
                <dd className="font-medium">
                  {data.settings.lastRunSummary.sent} נשלחו ·{" "}
                  {data.settings.lastRunSummary.skipped} דולגו ·{" "}
                  {data.settings.lastRunSummary.errors} שגיאות
                </dd>
              </div>
            )}
          </dl>
          <Button variant="secondary" onClick={() => mutate()} className="w-full">
            <RefreshCw className="h-4 w-4" />
            רענון סטטוס
          </Button>
        </Card>
      </div>

      <Card className="space-y-4 p-6">
        <div className="flex items-center gap-2 text-slate-800">
          <Play className="h-5 w-5 text-primary-600" />
          <h2 className="text-lg font-bold">בדיקות ידניות</h2>
        </div>
        <div className="flex flex-wrap gap-3">
          <Button
            variant="secondary"
            disabled={!!running}
            onClick={() => runReminders("dry")}
          >
            {running === "dry" ? "מריץ..." : "סימולציה (dry run)"}
          </Button>
          <Button
            variant="primary"
            disabled={!!running || !data?.smtpConfigured}
            onClick={() => runReminders("force")}
          >
            {running === "force" ? "שולח..." : "שליחה אמיתית (force)"}
          </Button>
        </div>
        <p className="text-sm text-slate-500">
          dry run מדווח מי היה מקבל מייל בלי לשלוח. force שולח בפועל ומתעלם מ-dedup.
        </p>
      </Card>

      <Card className="space-y-4 p-6">
        <div className="flex items-center gap-2 text-slate-800">
          <Mail className="h-5 w-5 text-primary-600" />
          <h2 className="text-lg font-bold">בדיקת SMTP</h2>
        </div>
        <div className="flex flex-wrap gap-2">
          <Input
            type="email"
            dir="ltr"
            placeholder="email@example.com"
            value={testEmail}
            onChange={(e) => setTestEmail(e.target.value)}
            className="max-w-sm"
          />
          <Button
            variant="secondary"
            disabled={sendingTest || !data?.smtpConfigured}
            onClick={sendTestEmail}
          >
            {sendingTest ? "שולח..." : "שלח מייל בדיקה"}
          </Button>
        </div>
        <p className="text-sm text-slate-500">
          בפרודקשן ניתן גם:{" "}
          <code dir="ltr" className="rounded bg-slate-100 px-1.5 py-0.5 text-xs">
            curl -H &quot;Authorization: Bearer $CRON_SECRET&quot; &quot;$APP_URL/api/test-email?to=...&quot;
          </code>
        </p>
      </Card>

      {data && data.overdueItems.length > 0 && (
        <Card className="space-y-4 p-6">
          <h2 className="text-lg font-bold text-slate-800">מטלות לתזכורת היום (תצוגה חיה)</h2>
          <ul className="space-y-2 text-sm">
            {data.overdueItems.map((item, i) => (
              <li
                key={i}
                className="rounded-lg border border-slate-100 bg-slate-50/50 px-4 py-3"
              >
                <p className="font-medium text-slate-800">
                  {item.subjectName} — {item.obligationLabel}
                  {item.examEvent ? ` (${item.examEvent})` : ""}
                </p>
                <p className="text-slate-500">
                  יעד: {item.gradeEntryDueDate} · {item.missingStudentCount} תלמידים ·{" "}
                  {item.classNames.join(", ")}
                </p>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}

import { adminDb } from "@/lib/firebase/admin";
import type { GradeReminderSettings } from "@/lib/grade-reminders";

const SETTINGS_DOC = "settings/general";

export interface GeneralSettings {
  gradeReminders?: GradeReminderSettings;
}

export async function getGeneralSettings(): Promise<GeneralSettings> {
  const snap = await adminDb.doc(SETTINGS_DOC).get();
  if (!snap.exists) return {};
  return snap.data() as GeneralSettings;
}

export async function getGradeReminderSettings(): Promise<GradeReminderSettings> {
  const settings = await getGeneralSettings();
  return settings.gradeReminders ?? {};
}

export async function updateGradeReminderSettings(
  patch: Partial<GradeReminderSettings>
): Promise<GradeReminderSettings> {
  const current = await getGradeReminderSettings();
  const next: GradeReminderSettings = { ...current, ...patch };
  await adminDb.doc(SETTINGS_DOC).set({ gradeReminders: next }, { merge: true });
  return next;
}

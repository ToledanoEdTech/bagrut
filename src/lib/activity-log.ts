import { FieldValue, Timestamp } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase/admin";
import type { AuthSession } from "@/lib/types";
import type {
  ActivityActor,
  ActivityCategory,
  ActivityEvent,
  ActivityEventInput,
  ActivityAction,
  ActivityEntityType,
} from "@/lib/activity-log-types";

export type {
  ActivityActor,
  ActivityCategory,
  ActivityEvent,
  ActivityEventInput,
  ActivityAction,
  ActivityEntityType,
} from "@/lib/activity-log-types";

export {
  ACTIVITY_CATEGORY_LABELS,
  obligationLabel,
} from "@/lib/activity-log-types";

export function actorFromSession(session: AuthSession): ActivityActor {
  return {
    uid: session.uid,
    email: session.email,
    name: session.name,
  };
}

function newId() {
  return adminDb.collection("_").doc().id;
}

function serializeAt(value: unknown): string {
  if (value instanceof Timestamp) return value.toDate().toISOString();
  if (
    value &&
    typeof value === "object" &&
    "toDate" in value &&
    typeof (value as { toDate: () => Date }).toDate === "function"
  ) {
    return (value as { toDate: () => Date }).toDate().toISOString();
  }
  if (typeof value === "string") return value;
  return new Date().toISOString();
}

async function writeActivity(input: ActivityEventInput): Promise<void> {
  const id = newId();
  await adminDb
    .collection("activityLog")
    .doc(id)
    .set({
      id,
      at: FieldValue.serverTimestamp(),
      actorUid: input.actor.uid,
      actorEmail: input.actor.email,
      actorName: input.actor.name,
      action: input.action,
      category: input.category,
      entityType: input.entityType,
      entityId: input.entityId,
      summaryHe: input.summaryHe,
      meta: input.meta ?? null,
    });
}

/** כותב אירוע ליומן. כשל ביומן לא מפיל את הפעולה העסקית. */
export async function recordActivity(input: ActivityEventInput): Promise<void> {
  try {
    await writeActivity(input);
  } catch (err) {
    console.error("[activity-log] failed to record", err);
  }
}

const EXPORT_FORMAT_LABELS: Record<string, string> = {
  xlsx: "אקסל",
  pdf: "PDF",
  zip: "קובץ מכווץ",
};

export function exportFormatLabel(format: string): string {
  return EXPORT_FORMAT_LABELS[format] ?? format;
}

/**
 * רושם ייצוא של מידע על תלמידים. כישלון בכתיבה נזרק החוצה,
 * כדי שהקובץ לא יישלח בלי רשומה ביומן.
 */
export async function recordExport(input: {
  session: AuthSession;
  action: Extract<ActivityAction, `export.${string}`>;
  entityId: string;
  summaryHe: string;
  meta?: Record<string, unknown>;
}): Promise<void> {
  await writeActivity({
    actor: actorFromSession(input.session),
    action: input.action,
    category: "exports",
    entityType: "export",
    entityId: input.entityId,
    summaryHe: input.summaryHe,
    meta: input.meta,
  });
}

export async function listActivityEvents(options?: {
  limit?: number;
  category?: ActivityCategory | null;
}): Promise<ActivityEvent[]> {
  const limit = Math.min(Math.max(options?.limit ?? 80, 1), 200);
  const category = options?.category ?? null;

  // Fetch a bit more when filtering in-memory so category chips stay useful
  const fetchLimit = category ? Math.min(limit * 3, 300) : limit;

  const snap = await adminDb
    .collection("activityLog")
    .orderBy("at", "desc")
    .limit(fetchLimit)
    .get();

  const events = snap.docs.map((doc) => {
    const data = doc.data();
    return {
      id: doc.id,
      at: serializeAt(data.at),
      actorUid: String(data.actorUid ?? ""),
      actorEmail: String(data.actorEmail ?? ""),
      actorName: String(data.actorName ?? ""),
      action: data.action as ActivityAction,
      category: (data.category as ActivityCategory) ?? "other",
      entityType: (data.entityType as ActivityEntityType) ?? "system",
      entityId: String(data.entityId ?? ""),
      summaryHe: String(data.summaryHe ?? ""),
      meta:
        data.meta && typeof data.meta === "object"
          ? (data.meta as Record<string, unknown>)
          : undefined,
    };
  });

  const filtered = category
    ? events.filter((e) => e.category === category)
    : events;

  return filtered.slice(0, limit);
}

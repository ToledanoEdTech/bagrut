import { NextRequest, NextResponse } from "next/server";
import { bulkUpdateObligationFields } from "@/lib/firestore";
import { requireAdmin } from "@/lib/api-auth";
import type { Obligation } from "@/lib/types";
import { defaultGradeEntryDueDate } from "@/lib/grade-due-date";

type AllowedField =
  | "name"
  | "questionnaireNumber"
  | "weightPercent"
  | "examType"
  | "studyMaterial"
  | "examEvent"
  | "gradeYear"
  | "gradeEntryDueDate"
  | "sortOrder";

const ALLOWED_FIELDS: AllowedField[] = [
  "name",
  "questionnaireNumber",
  "weightPercent",
  "examType",
  "studyMaterial",
  "examEvent",
  "gradeYear",
  "gradeEntryDueDate",
  "sortOrder",
];

export async function PATCH(req: NextRequest) {
  const { error } = await requireAdmin();
  if (error) return error;

  const body = await req.json().catch(() => null);
  const rawUpdates = body?.updates;
  if (!Array.isArray(rawUpdates) || rawUpdates.length === 0) {
    return NextResponse.json({ error: "לא התקבלו עדכונים" }, { status: 400 });
  }

  const updates: Array<{
    subjectId: string;
    obligationId: string;
    patch: Partial<Obligation>;
  }> = [];

  for (const u of rawUpdates) {
    if (!u?.subjectId || !u?.obligationId || typeof u.patch !== "object") continue;
    const patch: Partial<Obligation> = {};
    for (const key of ALLOWED_FIELDS) {
      if (key in u.patch) {
        const value = u.patch[key];
        if (key === "weightPercent" || key === "sortOrder") {
          const num = Number(value);
          if (!Number.isFinite(num)) {
            return NextResponse.json(
              { error: `ערך מספרי לא תקין בשדה ${key}` },
              { status: 400 }
            );
          }
          if (key === "weightPercent" && (num < 0 || num > 100)) {
            return NextResponse.json(
              { error: "משקל חייב להיות בין 0 ל-100" },
              { status: 400 }
            );
          }
          (patch as Record<string, unknown>)[key] = num;
        } else {
          if (key === "gradeEntryDueDate" && (value === "" || value == null)) {
            (patch as Record<string, unknown>)[key] = defaultGradeEntryDueDate();
          } else {
            (patch as Record<string, unknown>)[key] =
              value === "" ? null : value;
          }
        }
      }
    }
    if (Array.isArray(u.patch.subItems)) {
      patch.subItems = u.patch.subItems.map(
        (
          si: { name: string; weightPercent: number; sortOrder?: number; gradeEntryDueDate?: string },
          i: number
        ) => ({
          name: si.name,
          weightPercent: si.weightPercent,
          sortOrder: si.sortOrder ?? i,
          gradeEntryDueDate: si.gradeEntryDueDate ?? defaultGradeEntryDueDate(),
        })
      );
    }
    if (Object.keys(patch).length > 0) {
      updates.push({ subjectId: u.subjectId, obligationId: u.obligationId, patch });
    }
  }

  if (updates.length === 0) {
    return NextResponse.json({ error: "אין שדות תקינים לעדכון" }, { status: 400 });
  }

  try {
    const updated = await bulkUpdateObligationFields(updates);
    return NextResponse.json({ updated });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "שגיאה בעדכון מטלות";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

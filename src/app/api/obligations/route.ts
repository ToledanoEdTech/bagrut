import { NextRequest, NextResponse } from "next/server";
import {
  addObligation,
  deleteObligation,
  updateObligation,
} from "@/lib/firestore";
import { requireAdmin } from "@/lib/api-auth";
import { defaultGradeEntryDueDate } from "@/lib/grade-due-date";
import { validateCanonicalGradeYear } from "@/lib/grade-year";

function normalizeSubItemGradeYear(
  value: string | null | undefined
): { ok: true; value: string | null } | { ok: false; error: string } {
  if (value == null || value === "") return { ok: true, value: null };
  const check = validateCanonicalGradeYear(value);
  if (!check.ok) return check;
  return { ok: true, value: check.value };
}

function mapSubItems(
  subItems: Array<{
    name: string;
    weightPercent: number;
    gradeEntryDueDate?: string;
    gradeYear?: string | null;
  }>
):
  | {
      ok: true;
      value: Array<{
        name: string;
        weightPercent: number;
        sortOrder: number;
        gradeEntryDueDate: string;
        gradeYear: string | null;
      }>;
    }
  | { ok: false; error: string } {
  const mapped = [];
  for (let i = 0; i < subItems.length; i++) {
    const si = subItems[i]!;
    const gy = normalizeSubItemGradeYear(si.gradeYear);
    if (!gy.ok) return gy;
    mapped.push({
      name: si.name,
      weightPercent: si.weightPercent,
      sortOrder: i,
      gradeEntryDueDate: si.gradeEntryDueDate ?? defaultGradeEntryDueDate(),
      gradeYear: gy.value,
    });
  }
  return { ok: true, value: mapped };
}

export async function POST(req: NextRequest) {
  const { error } = await requireAdmin();
  if (error) return error;

  try {
    const body = await req.json();
    if (!body.subjectId) {
      return NextResponse.json({ error: "חסר מזהה מקצוע" }, { status: 400 });
    }
    const gradeYearCheck = validateCanonicalGradeYear(body.gradeYear);
    if (!gradeYearCheck.ok) {
      return NextResponse.json({ error: gradeYearCheck.error }, { status: 400 });
    }
    const subItemsMapped = mapSubItems(body.subItems ?? []);
    if (!subItemsMapped.ok) {
      return NextResponse.json({ error: subItemsMapped.error }, { status: 400 });
    }
    const obligation = await addObligation(body.subjectId, {
      questionnaireNumber: body.questionnaireNumber ?? null,
      name: body.name ?? null,
      weightPercent: body.weightPercent,
      examType: body.examType ?? "פנימי",
      studyMaterial: body.studyMaterial ?? null,
      examEvent: body.examEvent ?? null,
      gradeYear: gradeYearCheck.value,
      gradeEntryDueDate: body.gradeEntryDueDate ?? defaultGradeEntryDueDate(),
      sortOrder: body.sortOrder ?? 0,
      components: (body.components ?? []).map(
        (c: { name: string; weightPercent: number }, i: number) => ({
          ...c,
          sortOrder: i,
        })
      ),
      subItems: subItemsMapped.value,
    });

    return NextResponse.json(obligation);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "שגיאה בשמירת מטלה";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  const { error } = await requireAdmin();
  if (error) return error;

  try {
    const body = await req.json();
    const { subjectId, ...obligation } = body;
    if (!subjectId || !obligation.id) {
      return NextResponse.json({ error: "חסר מזהה" }, { status: 400 });
    }
    if (obligation.gradeYear !== undefined) {
      const gradeYearCheck = validateCanonicalGradeYear(obligation.gradeYear);
      if (!gradeYearCheck.ok) {
        return NextResponse.json({ error: gradeYearCheck.error }, { status: 400 });
      }
      obligation.gradeYear = gradeYearCheck.value;
    }
    const subItemsMapped = mapSubItems(obligation.subItems ?? []);
    if (!subItemsMapped.ok) {
      return NextResponse.json({ error: subItemsMapped.error }, { status: 400 });
    }
    const result = await updateObligation(subjectId, {
      ...obligation,
      components: (obligation.components ?? []).map(
        (c: { name: string; weightPercent: number }, i: number) => ({
          ...c,
          sortOrder: i,
        })
      ),
      subItems: subItemsMapped.value,
    });
    return NextResponse.json(result);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "שגיאה בעדכון מטלה";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const { error } = await requireAdmin();
  if (error) return error;

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  const subjectId = searchParams.get("subjectId");
  if (!id || !subjectId) {
    return NextResponse.json({ error: "חסר מזהה" }, { status: 400 });
  }

  await deleteObligation(subjectId, id);
  return NextResponse.json({ success: true });
}

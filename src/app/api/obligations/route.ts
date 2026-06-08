import { NextRequest, NextResponse } from "next/server";
import {
  addObligation,
  deleteObligation,
  updateObligation,
} from "@/lib/firestore";
import { requireAdmin } from "@/lib/api-auth";

export async function POST(req: NextRequest) {
  const { error } = await requireAdmin();
  if (error) return error;

  try {
  const body = await req.json();
  if (!body.subjectId) {
    return NextResponse.json({ error: "חסר מזהה מקצוע" }, { status: 400 });
  }
  const obligation = await addObligation(body.subjectId, {
    questionnaireNumber: body.questionnaireNumber ?? null,
    name: body.name ?? null,
    weightPercent: body.weightPercent,
    examType: body.examType ?? "פנימי",
    studyMaterial: body.studyMaterial ?? null,
    examEvent: body.examEvent ?? null,
    gradeYear: body.gradeYear ?? null,
    sortOrder: body.sortOrder ?? 0,
    components: (body.components ?? []).map(
      (c: { name: string; weightPercent: number }, i: number) => ({
        ...c,
        sortOrder: i,
      })
    ),
    subItems: (body.subItems ?? []).map(
      (si: { name: string; weightPercent: number }, i: number) => ({
        ...si,
        sortOrder: i,
      })
    ),
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
  const result = await updateObligation(subjectId, {
    ...obligation,
    components: (obligation.components ?? []).map(
      (c: { name: string; weightPercent: number }, i: number) => ({
        ...c,
        sortOrder: i,
      })
    ),
    subItems: (obligation.subItems ?? []).map(
      (si: { name: string; weightPercent: number }, i: number) => ({
        ...si,
        sortOrder: i,
      })
    ),
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

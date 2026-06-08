import { NextRequest, NextResponse } from "next/server";
import {
  addObligation,
  deleteObligation,
  getSubjectById,
  updateSubject,
} from "@/lib/firestore";
import { requireAdmin } from "@/lib/api-auth";

export async function POST(req: NextRequest) {
  const { error } = await requireAdmin();
  if (error) return error;

  const body = await req.json();
  const obligation = await addObligation(body.subjectId, {
    questionnaireNumber: body.questionnaireNumber ?? null,
    name: body.name ?? null,
    weightPercent: body.weightPercent,
    examType: body.examType ?? "פנימי",
    studyMaterial: body.studyMaterial ?? null,
    examEvent: body.examEvent ?? null,
    gradeYear: body.gradeYear ?? null,
    sortOrder: body.sortOrder ?? 0,
    components: body.components ?? [],
    subItems: body.subItems ?? [],
  });

  return NextResponse.json(obligation);
}

export async function PATCH(req: NextRequest) {
  const { error } = await requireAdmin();
  if (error) return error;

  const body = await req.json();
  const { subjectId, ...obligation } = body;
  const result = await updateSubject(subjectId, {
    obligations: (
      await getSubjectById(subjectId)
    )?.obligations.map((o) => (o.id === obligation.id ? obligation : o)),
  });
  return NextResponse.json(result);
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

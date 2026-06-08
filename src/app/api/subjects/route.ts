import { NextRequest, NextResponse } from "next/server";
import {
  createSubject,
  deleteSubject,
  listSubjectsByPath,
  listSubjectsEnriched,
  updateSubject,
} from "@/lib/firestore";
import { requireAdmin } from "@/lib/api-auth";

export async function GET(req: NextRequest) {
  const { error } = await requireAdmin();
  if (error) return error;

  const { searchParams } = new URL(req.url);
  const pathId = searchParams.get("pathId");

  if (pathId) {
    return NextResponse.json(await listSubjectsByPath(pathId));
  }

  return NextResponse.json(await listSubjectsEnriched());
}

export async function POST(req: NextRequest) {
  const { error } = await requireAdmin();
  if (error) return error;

  const body = await req.json();
  const obligations = (body.obligations ?? []).map(
    (
      o: {
        questionnaireNumber?: string;
        name?: string;
        weightPercent: number;
        examType?: string;
        studyMaterial?: string;
        examEvent?: string;
        gradeYear?: string;
        components?: Array<{ name: string; weightPercent: number }>;
        subItems?: Array<{ name: string; weightPercent: number }>;
      },
      i: number
    ) => ({
      id: `ob_${Date.now()}_${i}`,
      questionnaireNumber: o.questionnaireNumber ?? null,
      name: o.name ?? null,
      weightPercent: o.weightPercent,
      examType: o.examType ?? "פנימי",
      studyMaterial: o.studyMaterial ?? null,
      examEvent: o.examEvent ?? null,
      gradeYear: o.gradeYear ?? null,
      sortOrder: i,
      components: (o.components ?? []).map((c, j) => ({ ...c, sortOrder: j })),
      subItems: (o.subItems ?? []).map((si, j) => ({ ...si, sortOrder: j })),
    })
  );

  const subject = await createSubject({
    name: body.name,
    units: body.units,
    category: body.category,
    trackId: null,
    obligations,
  });

  return NextResponse.json(subject);
}

export async function PATCH(req: NextRequest) {
  const { error } = await requireAdmin();
  if (error) return error;

  const body = await req.json();
  const { id, ...data } = body;
  const subject = await updateSubject(id, data);
  return NextResponse.json(subject);
}

export async function DELETE(req: NextRequest) {
  const { error } = await requireAdmin();
  if (error) return error;

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "חסר מזהה" }, { status: 400 });

  await deleteSubject(id);
  return NextResponse.json({ success: true });
}

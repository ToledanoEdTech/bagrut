import { NextRequest, NextResponse } from "next/server";
import {
  createSubject,
  deleteSubject,
  listSubjectsByPath,
  listSubjectsEnriched,
  updateSubject,
} from "@/lib/firestore";
import { requireAdmin } from "@/lib/api-auth";
import { defaultGradeEntryDueDate } from "@/lib/grade-due-date";
import { validateCanonicalGradeYear } from "@/lib/grade-year";

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
  const rawObligations = body.obligations ?? [];
  for (const o of rawObligations) {
    if (o.gradeYear) {
      const check = validateCanonicalGradeYear(o.gradeYear);
      if (!check.ok) {
        return NextResponse.json({ error: check.error }, { status: 400 });
      }
      o.gradeYear = check.value;
    }
  }
  const obligations = rawObligations.map(
    (
      o: {
        questionnaireNumber?: string;
        name?: string;
        weightPercent: number;
        examType?: string;
        studyMaterial?: string;
        examEvent?: string;
        gradeYear?: string;
        gradeEntryDueDate?: string;
        components?: Array<{ name: string; weightPercent: number }>;
        subItems?: Array<{
          name: string;
          weightPercent: number;
          gradeEntryDueDate?: string;
          gradeYear?: string | null;
        }>;
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
      gradeEntryDueDate: o.gradeEntryDueDate ?? defaultGradeEntryDueDate(),
      sortOrder: i,
      components: (o.components ?? []).map((c, j) => ({ ...c, sortOrder: j })),
      subItems: (o.subItems ?? []).map(
        (
          si: {
            name: string;
            weightPercent: number;
            gradeEntryDueDate?: string;
            gradeYear?: string | null;
          },
          j: number
        ) => ({
          name: si.name,
          weightPercent: si.weightPercent,
          sortOrder: j,
          gradeEntryDueDate: si.gradeEntryDueDate ?? defaultGradeEntryDueDate(),
          gradeYear: si.gradeYear ?? null,
        })
      ),
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
  const { id, teacherId, ...data } = body;
  const patch: Parameters<typeof updateSubject>[1] = { ...data };
  if (teacherId !== undefined) {
    patch.teacherId = teacherId || null;
  }
  const subject = await updateSubject(id, patch);
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

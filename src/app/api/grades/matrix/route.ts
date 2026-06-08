import { NextRequest, NextResponse } from "next/server";
import { findObligation, getStudentById, upsertGradesBulk } from "@/lib/firestore";
import { getMatrixData, isObligationRelevantForStudent } from "@/lib/grade-matrix";
import { isValidSubmissionStatus, validateScore } from "@/lib/grade-status";
import { checkPermission, requireStaff } from "@/lib/api-auth";
import type { SubmissionStatus } from "@/lib/types";

export async function GET(req: NextRequest) {
  const { error, session } = await requireStaff();
  if (error || !session) return error;

  if (!checkPermission(session, "grades")) {
    return NextResponse.json({ error: "אין הרשאה" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const classId = searchParams.get("classId");
  const obligationId = searchParams.get("obligationId");

  if (!classId || !obligationId) {
    return NextResponse.json({ error: "חסרים פרמטרים" }, { status: 400 });
  }

  try {
    return NextResponse.json(await getMatrixData(classId, obligationId));
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "שגיאה" },
      { status: 404 }
    );
  }
}

export async function PUT(req: NextRequest) {
  const { error, session } = await requireStaff();
  if (error || !session) return error;

  if (!checkPermission(session, "grades")) {
    return NextResponse.json({ error: "אין הרשאה" }, { status: 403 });
  }

  const body = await req.json();
  const { obligationId, entries } = body as {
    obligationId: string;
    entries: Array<{
      studentId: string;
      score?: number | null;
      status: string;
      notes?: string | null;
    }>;
  };

  if (!obligationId || !Array.isArray(entries)) {
    return NextResponse.json({ error: "נתונים לא תקינים" }, { status: 400 });
  }

  const found = await findObligation(obligationId);
  if (!found) {
    return NextResponse.json({ error: "מטלה לא נמצאה" }, { status: 404 });
  }

  const validated: Array<{
    studentId: string;
    obligationId: string;
    score: number | null;
    status: SubmissionStatus;
    notes: string | null;
  }> = [];

  for (const entry of entries) {
    if (!entry.studentId) {
      return NextResponse.json({ error: "חסר מזהה תלמיד" }, { status: 400 });
    }

    const student = await getStudentById(entry.studentId);
    if (!student) {
      return NextResponse.json(
        { error: `תלמיד לא נמצא: ${entry.studentId}` },
        { status: 400 }
      );
    }

    if (!(await isObligationRelevantForStudent(student, obligationId))) {
      return NextResponse.json(
        { error: `המטלה לא רלוונטית לתלמיד ${student.name}` },
        { status: 400 }
      );
    }

    if (!isValidSubmissionStatus(entry.status)) {
      return NextResponse.json({ error: "סטטוס לא חוקי" }, { status: 400 });
    }

    const score = entry.score ?? null;
    if (!validateScore(score)) {
      return NextResponse.json({ error: "ציון לא חוקי (0–100)" }, { status: 400 });
    }

    validated.push({
      studentId: entry.studentId,
      obligationId,
      score,
      status: entry.status,
      notes: entry.notes ?? null,
    });
  }

  const grades = await upsertGradesBulk(validated);
  return NextResponse.json({ updated: grades.length, grades });
}

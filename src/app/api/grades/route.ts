import { NextRequest, NextResponse } from "next/server";
import { getGradesByStudent, upsertGrades } from "@/lib/firestore";
import { checkPermission, requireAuth, requireGradeWrite, requireStaff, requireStudentView } from "@/lib/api-auth";
import { validateComponentScores, validateSubItemScores } from "@/lib/grade-components";
import { isValidSubmissionStatus, validateScore } from "@/lib/grade-status";
import { isValidQualitativeLevel } from "@/lib/social-involvement";
import type { QualitativeLevel, SubmissionStatus } from "@/lib/types";

export async function GET(req: NextRequest) {
  const { error, session } = await requireAuth();
  if (error || !session) return error;

  const { searchParams } = new URL(req.url);
  const studentId = searchParams.get("studentId");

  if (session.role === "STUDENT") {
    if (!session.studentId) {
      return NextResponse.json({ error: "לא נמצא תלמיד" }, { status: 404 });
    }
    return NextResponse.json(await getGradesByStudent(session.studentId));
  }

  if (!checkPermission(session, "grades")) {
    return NextResponse.json({ error: "אין הרשאה" }, { status: 403 });
  }

  if (!studentId) {
    return NextResponse.json({ error: "חסר מזהה תלמיד" }, { status: 400 });
  }

  const viewError = await requireStudentView(session, { studentId });
  if (viewError) return viewError;

  return NextResponse.json(await getGradesByStudent(studentId));
}

export async function PUT(req: NextRequest) {
  const { error, session } = await requireStaff();
  if (error || !session) return error;

  if (!checkPermission(session, "grades")) {
    return NextResponse.json({ error: "אין הרשאה" }, { status: 403 });
  }

  const body = await req.json();
  const { studentId, grades } = body as {
    studentId: string;
    grades: Array<{
      obligationId: string;
      score?: number | null;
      qualitativeLevel?: QualitativeLevel | null;
      componentScores?: Record<number, number | null> | null;
      subItemScores?: Record<number, number | null> | null;
      status: string;
      notes?: string;
    }>;
  };

  if (!studentId) {
    return NextResponse.json({ error: "חסר מזהה תלמיד" }, { status: 400 });
  }

  for (const g of grades) {
    const writeError = await requireGradeWrite(session, {
      studentId,
      obligationId: g.obligationId,
    });
    if (writeError) return writeError;

    if (!isValidSubmissionStatus(g.status)) {
      return NextResponse.json({ error: "סטטוס לא חוקי" }, { status: 400 });
    }
    if (!validateScore(g.score)) {
      return NextResponse.json({ error: "ציון לא חוקי (0–100)" }, { status: 400 });
    }
    if (
      g.qualitativeLevel != null &&
      g.qualitativeLevel !== undefined &&
      !isValidQualitativeLevel(g.qualitativeLevel)
    ) {
      return NextResponse.json({ error: "רמת הערכה לא חוקית" }, { status: 400 });
    }
    if (!validateComponentScores(g.componentScores)) {
      return NextResponse.json({ error: "ציון רכיב לא חוקי (0–100)" }, { status: 400 });
    }
    if (!validateSubItemScores(g.subItemScores)) {
      return NextResponse.json({ error: "ציון תת-מטלה לא חוקי (0–100)" }, { status: 400 });
    }
  }

  const results = await upsertGrades(
    studentId,
    grades.map((g) => ({
      obligationId: g.obligationId,
      score: g.score,
      qualitativeLevel: g.qualitativeLevel ?? null,
      componentScores: g.componentScores,
      subItemScores: g.subItemScores,
      status: g.status as SubmissionStatus,
      notes: g.notes,
    }))
  );

  return NextResponse.json(results);
}

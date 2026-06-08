import { NextRequest, NextResponse } from "next/server";
import { getGradesByStudent, upsertGrades } from "@/lib/firestore";
import { checkPermission, requireAuth, requireStaff } from "@/lib/api-auth";
import type { SubmissionStatus } from "@/lib/types";

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
      status: string;
      notes?: string;
    }>;
  };

  const results = await upsertGrades(
    studentId,
    grades.map((g) => ({
      obligationId: g.obligationId,
      score: g.score,
      status: g.status as SubmissionStatus,
      notes: g.notes,
    }))
  );

  return NextResponse.json(results);
}

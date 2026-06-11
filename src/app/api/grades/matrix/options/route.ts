import { NextRequest, NextResponse } from "next/server";
import { getMatrixOptions } from "@/lib/grade-matrix";
import { checkPermission, requireGradeWrite, requireStaff } from "@/lib/api-auth";
import { getAllowedSubjectIds } from "@/lib/permissions";

export async function GET(req: NextRequest) {
  const { error, session } = await requireStaff();
  if (error || !session) return error;

  if (!checkPermission(session, "grades")) {
    return NextResponse.json({ error: "אין הרשאה" }, { status: 403 });
  }

  const classId = new URL(req.url).searchParams.get("classId");
  if (!classId) {
    return NextResponse.json({ error: "חסר מזהה כיתה" }, { status: 400 });
  }

  const accessError = await requireGradeWrite(session, { classId });
  if (accessError) return accessError;

  try {
    const options = await getMatrixOptions(classId);
    const allowedSubjects = getAllowedSubjectIds(session);
    if (allowedSubjects) {
      options.subjects = options.subjects.filter((s) => allowedSubjects.includes(s.id));
    }
    return NextResponse.json(options);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "שגיאה" },
      { status: 404 }
    );
  }
}

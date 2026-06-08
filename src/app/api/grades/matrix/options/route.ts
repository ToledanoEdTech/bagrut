import { NextRequest, NextResponse } from "next/server";
import { getMatrixOptions } from "@/lib/grade-matrix";
import { checkPermission, requireStaff } from "@/lib/api-auth";

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

  try {
    return NextResponse.json(await getMatrixOptions(classId));
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "שגיאה" },
      { status: 404 }
    );
  }
}

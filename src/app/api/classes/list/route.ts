import { NextResponse } from "next/server";
import { listClassesSimple } from "@/lib/firestore";
import { checkPermission, requireStaff } from "@/lib/api-auth";

export async function GET() {
  const { error, session } = await requireStaff();
  if (error || !session) return error;

  if (!checkPermission(session, "students")) {
    return NextResponse.json({ error: "אין הרשאה" }, { status: 403 });
  }

  return NextResponse.json(await listClassesSimple());
}

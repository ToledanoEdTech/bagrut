import { NextRequest, NextResponse } from "next/server";
import {
  deleteStudent,
  enrichStudent,
  listStudents,
  listStudentsEnriched,
  updateStudent,
} from "@/lib/firestore";
import { checkPermission, requireStaff, requireAdmin } from "@/lib/api-auth";

export async function GET() {
  const { error, session } = await requireStaff();
  if (error || !session) return error;
  if (!checkPermission(session, "students")) {
    return NextResponse.json({ error: "אין הרשאה" }, { status: 403 });
  }

  const students = await listStudentsEnriched();
  return NextResponse.json(students);
}

export async function PATCH(req: NextRequest) {
  const { error, session } = await requireAdmin();
  if (error || !session) return error;

  const body = await req.json();
  const { id, classId, trackId, mathUnits, englishUnits, extensions, name, email } = body;

  if (!id) {
    return NextResponse.json({ error: "חסר מזהה תלמיד" }, { status: 400 });
  }

  await updateStudent(id, {
    classId,
    trackId: trackId || null,
    mathUnits,
    englishUnits,
    extensions,
    name,
    email,
  });

  const student = await listStudents().then((s) => s.find((x) => x.id === id));
  if (!student) return NextResponse.json({ error: "לא נמצא" }, { status: 404 });

  return NextResponse.json(await enrichStudent(student));
}

export async function DELETE(req: NextRequest) {
  const { error } = await requireAdmin();
  if (error) return error;

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "חסר מזהה" }, { status: 400 });

  await deleteStudent(id);
  return NextResponse.json({ success: true });
}

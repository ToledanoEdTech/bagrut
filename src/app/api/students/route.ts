import { NextRequest, NextResponse } from "next/server";
import {
  createStudent,
  deleteStudent,
  enrichStudent,
  getClassById,
  getStudentByEmail,
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

export async function POST(req: NextRequest) {
  const { error } = await requireAdmin();
  if (error) return error;

  const body = await req.json();
  const { name, email, classId, trackIds, trackId, mathUnits, englishUnits } = body;

  if (!name?.trim()) {
    return NextResponse.json({ error: "חסר שם תלמיד" }, { status: 400 });
  }
  if (!email?.trim()) {
    return NextResponse.json({ error: "חסר אימייל" }, { status: 400 });
  }
  if (!classId) {
    return NextResponse.json({ error: "חסרה כיתה" }, { status: 400 });
  }

  const cls = await getClassById(classId);
  if (!cls) {
    return NextResponse.json({ error: "כיתה לא נמצאה" }, { status: 400 });
  }

  const normalizedEmail = email.toLowerCase().trim();
  const existing = await getStudentByEmail(normalizedEmail);
  if (existing) {
    return NextResponse.json({ error: "תלמיד עם אימייל זה כבר קיים" }, { status: 409 });
  }

  const resolvedTrackIds = Array.isArray(trackIds)
    ? trackIds.filter(Boolean)
    : trackId
      ? [trackId]
      : [];

  const resolvedMathUnits = mathUnits ?? 3;
  const resolvedEnglishUnits = englishUnits ?? 3;
  if (![3, 4, 5].includes(resolvedMathUnits) || ![3, 4, 5].includes(resolvedEnglishUnits)) {
    return NextResponse.json({ error: "יחידות לימוד חייבות להיות 3, 4 או 5" }, { status: 400 });
  }

  try {
    const student = await createStudent({
      name: name.trim(),
      email: normalizedEmail,
      classId,
      trackIds: resolvedTrackIds,
      mathUnits: resolvedMathUnits,
      englishUnits: resolvedEnglishUnits,
      extensions: null,
    });
    return NextResponse.json(await enrichStudent(student), { status: 201 });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "שגיאה ביצירת תלמיד" },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  const { error, session } = await requireAdmin();
  if (error || !session) return error;

  const body = await req.json();
  const { id, classId, trackId, trackIds, mathUnits, englishUnits, extensions, name, email } =
    body;

  if (!id) {
    return NextResponse.json({ error: "חסר מזהה תלמיד" }, { status: 400 });
  }

  const resolvedTrackIds = Array.isArray(trackIds)
    ? trackIds.filter(Boolean)
    : trackId
      ? [trackId]
      : [];

  try {
    await updateStudent(id, {
      ...(classId !== undefined && { classId }),
      trackIds: resolvedTrackIds,
      ...(mathUnits !== undefined && { mathUnits }),
      ...(englishUnits !== undefined && { englishUnits }),
      ...(extensions !== undefined && { extensions }),
      ...(name !== undefined && { name }),
      ...(email !== undefined && { email }),
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "שגיאה בעדכון תלמיד" },
      { status: 500 }
    );
  }

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

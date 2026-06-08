import { NextRequest, NextResponse } from "next/server";
import {
  buildStudentWithRelations,
  getRelevantSubjects,
} from "@/lib/student-subjects";
import { getStudentById } from "@/lib/firestore";
import { requireStaff } from "@/lib/api-auth";

export async function GET(req: NextRequest) {
  const { error } = await requireStaff();
  if (error) return error;

  const studentId = new URL(req.url).searchParams.get("studentId");
  if (!studentId) {
    return NextResponse.json({ error: "חסר מזהה תלמיד" }, { status: 400 });
  }

  const student = await getStudentById(studentId);
  if (!student) {
    return NextResponse.json({ error: "תלמיד לא נמצא" }, { status: 404 });
  }

  const studentWithRelations = await buildStudentWithRelations(student);
  const subjects = await getRelevantSubjects(studentWithRelations);

  return NextResponse.json(subjects);
}

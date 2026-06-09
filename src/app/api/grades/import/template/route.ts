import { NextRequest, NextResponse } from "next/server";
import { listClassesSimple, listStudents, listSubjects } from "@/lib/firestore";
import { obligationDisplayLabel } from "@/lib/grade-components";
import { STATUS_LABELS, SUBMISSION_STATUSES } from "@/lib/grade-status";
import { checkPermission, requireStaff } from "@/lib/api-auth";

export async function GET(req: NextRequest) {
  const { error, session } = await requireStaff();
  if (error || !session) return error;

  if (!checkPermission(session, "grades")) {
    return NextResponse.json({ error: "אין הרשאה" }, { status: 403 });
  }

  const classId = new URL(req.url).searchParams.get("classId");

  const [classes, subjects, students] = await Promise.all([
    listClassesSimple(),
    listSubjects(),
    listStudents(),
  ]);

  const classNames = classes
    .map((c) => c.name)
    .sort((a, b) => a.localeCompare(b, "he"));

  const subjectNames = Array.from(new Set(subjects.map((s) => s.name))).sort((a, b) =>
    a.localeCompare(b, "he")
  );

  const obligationLabels = Array.from(
    new Set(
      subjects.flatMap((s) =>
        s.obligations.map((o) => obligationDisplayLabel(o))
      )
    )
  ).sort((a, b) => a.localeCompare(b, "he"));

  const statuses = SUBMISSION_STATUSES.map((s) => STATUS_LABELS[s].label);

  const subjectOptions = subjects
    .map((s) => ({
      id: s.id,
      name: s.name,
      obligations: s.obligations
        .map((o) => ({
          id: o.id,
          label: obligationDisplayLabel(o),
        }))
        .sort((a, b) => a.label.localeCompare(b.label, "he")),
    }))
    .sort((a, b) => a.name.localeCompare(b.name, "he"));

  let classStudents: string[] | undefined;
  if (classId) {
    const cls = classes.find((c) => c.id === classId);
    if (!cls) {
      return NextResponse.json({ error: "כיתה לא נמצאה" }, { status: 404 });
    }
    classStudents = students
      .filter((s) => s.classId === classId)
      .map((s) => s.name)
      .sort((a, b) => a.localeCompare(b, "he"));
  }

  return NextResponse.json({
    classes: classNames,
    subjects: subjectNames,
    obligations: obligationLabels,
    statuses,
    subjectOptions,
    classStudents,
  });
}

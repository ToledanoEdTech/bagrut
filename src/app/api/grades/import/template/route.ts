import { NextRequest, NextResponse } from "next/server";
import { listClassesSimple, listExamPaths, listStudents, listSubjects } from "@/lib/firestore";
import { obligationDisplayLabel } from "@/lib/grade-components";
import { STATUS_LABELS, SUBMISSION_STATUSES } from "@/lib/grade-status";
import { checkPermission, requireGradeWrite, requireStaff } from "@/lib/api-auth";
import { getAllowedClassIds, getAllowedSubjectIds } from "@/lib/permissions";
import { attachPathLabels, buildPathLabelsBySubjectId } from "@/lib/subject-display";

export async function GET(req: NextRequest) {
  const { error, session } = await requireStaff();
  if (error || !session) return error;

  if (!checkPermission(session, "grades")) {
    return NextResponse.json({ error: "אין הרשאה" }, { status: 403 });
  }

  const classId = new URL(req.url).searchParams.get("classId");

  const [allClasses, subjects, students, examPaths] = await Promise.all([
    listClassesSimple(),
    listSubjects(),
    listStudents(),
    listExamPaths(),
  ]);
  const pathLabelsBySubjectId = buildPathLabelsBySubjectId(examPaths);
  const subjectsWithPaths = attachPathLabels(subjects, pathLabelsBySubjectId);

  const allowedClassIds = getAllowedClassIds(session, allClasses);
  const classes =
    allowedClassIds === null
      ? allClasses
      : allClasses.filter((c) => allowedClassIds.includes(c.id));

  const allowedSubjectIds = getAllowedSubjectIds(session);
  const filteredSubjects =
    allowedSubjectIds === null
      ? subjectsWithPaths
      : subjectsWithPaths.filter((s) => allowedSubjectIds.includes(s.id));

  if (classId) {
    const accessError = await requireGradeWrite(session, { classId });
    if (accessError) return accessError;
  }

  const classNames = classes
    .map((c) => c.name)
    .sort((a, b) => a.localeCompare(b, "he"));

  const subjectNames = Array.from(new Set(filteredSubjects.map((s) => s.displayName))).sort(
    (a, b) => a.localeCompare(b, "he")
  );

  const obligationLabels = Array.from(
    new Set(
      filteredSubjects.flatMap((s) =>
        s.obligations.map((o) => obligationDisplayLabel(o))
      )
    )
  ).sort((a, b) => a.localeCompare(b, "he"));

  const statuses = SUBMISSION_STATUSES.map((s) => STATUS_LABELS[s].label);

  const subjectOptions = filteredSubjects
    .map((s) => ({
      id: s.id,
      name: s.displayName,
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

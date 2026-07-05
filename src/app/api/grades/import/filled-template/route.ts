import { NextRequest, NextResponse } from "next/server";
import {
  getClassById,
  listAllGrades,
  listClassesSimple,
  listExamPaths,
  listStudents,
  listSubjects,
  listTracks,
} from "@/lib/firestore";
import { buildGradeImportTemplateRows } from "@/lib/grade-import-template";
import { STATUS_LABELS, SUBMISSION_STATUSES } from "@/lib/grade-status";
import { checkPermission, requireGradeWrite, requireStaff } from "@/lib/api-auth";
import { buildPathLabelsBySubjectId } from "@/lib/subject-display";
import type { Track } from "@/lib/types";

export async function GET(req: NextRequest) {
  const { error, session } = await requireStaff();
  if (error || !session) return error;

  if (!checkPermission(session, "grades")) {
    return NextResponse.json({ error: "אין הרשאה" }, { status: 403 });
  }

  const params = new URL(req.url).searchParams;
  const classId = params.get("classId");
  const subjectId = params.get("subjectId") || undefined;
  const obligationId = params.get("obligationId") || undefined;
  const taskSortOrderRaw = params.get("taskSortOrder");
  const taskSortOrder =
    taskSortOrderRaw !== null && taskSortOrderRaw !== ""
      ? Number(taskSortOrderRaw)
      : undefined;
  if (taskSortOrderRaw && (taskSortOrder === undefined || isNaN(taskSortOrder))) {
    return NextResponse.json({ error: "תת-מטלה לא חוקית" }, { status: 400 });
  }

  if (!classId) {
    return NextResponse.json({ error: "חסר מזהה כיתה" }, { status: 400 });
  }

  const accessError = await requireGradeWrite(session, {
    classId,
    subjectId,
    obligationId,
  });
  if (accessError) return accessError;

  const [classes, students, subjects, examPaths, tracks, grades] =
    await Promise.all([
      listClassesSimple(),
      listStudents(),
      listSubjects(),
      listExamPaths(),
      listTracks(),
      listAllGrades(),
    ]);

  const cls = classes.find((c) => c.id === classId);
  if (!cls) {
    return NextResponse.json({ error: "כיתה לא נמצאה" }, { status: 404 });
  }

  if (subjectId && !subjects.some((s) => s.id === subjectId)) {
    return NextResponse.json({ error: "מקצוע לא נמצא" }, { status: 404 });
  }

  if (obligationId) {
    const found = subjects.some((s) =>
      s.obligations.some((o) => o.id === obligationId)
    );
    if (!found) {
      return NextResponse.json({ error: "מטלה לא נמצאה" }, { status: 404 });
    }
  }

  const fullClass = await getClassById(classId);
  const examPathId = fullClass?.examPathId ?? "";
  const examPath = examPaths.find((p) => p.id === examPathId) ?? null;
  const pathLabelsBySubjectId = buildPathLabelsBySubjectId(examPaths);
  const tracksById = new Map<string, Track>(tracks.map((t) => [t.id, t]));

  const classStudents = students
    .filter((s) => s.classId === classId)
    .sort((a, b) => a.name.localeCompare(b.name, "he"));

  const rows = buildGradeImportTemplateRows({
    className: cls.name,
    examPathId,
    gradeYear: cls.gradeYear,
    students: classStudents,
    subjects,
    examPath,
    tracksById,
    grades,
    pathLabelsBySubjectId,
    filters: { subjectId, obligationId, taskSortOrder },
  });

  return NextResponse.json({
    className: cls.name,
    statuses: SUBMISSION_STATUSES.map((s) => STATUS_LABELS[s].label),
    rows,
  });
}

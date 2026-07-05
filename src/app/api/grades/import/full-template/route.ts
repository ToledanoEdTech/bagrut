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
import {
  expandObligationMatrixTasks,
  obligationDisplayLabel,
} from "@/lib/grade-components";
import { STATUS_LABELS, SUBMISSION_STATUSES } from "@/lib/grade-status";
import { checkPermission, requireGradeWrite, requireStaff } from "@/lib/api-auth";
import {
  attachPathLabels,
  buildPathLabelsBySubjectId,
} from "@/lib/subject-display";
import { resolveRelevantSubjects } from "@/lib/student-subjects";
import type { Grade, Track } from "@/lib/types";

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

  const fullClass = await getClassById(classId);
  const examPathId = fullClass?.examPathId ?? "";
  const examPath = examPaths.find((p) => p.id === examPathId) ?? null;

  const pathLabelsBySubjectId = buildPathLabelsBySubjectId(examPaths);
  const tracksById = new Map<string, Track>(tracks.map((t) => [t.id, t]));

  const classStudents = students
    .filter((s) => s.classId === classId)
    .sort((a, b) => a.name.localeCompare(b.name, "he"));

  const gradeByKey = new Map<string, Grade>(
    grades.map((g) => [`${g.studentId}:${g.obligationId}`, g])
  );

  const rows: Array<{
    className: string;
    subjectName: string;
    obligationName: string;
    taskName: string;
    studentName: string;
    score: number | string;
    status: string;
  }> = [];

  for (const student of classStudents) {
    const relevant = resolveRelevantSubjects(
      {
        ...student,
        class: {
          examPathId,
          name: cls.name,
          gradeYear: cls.gradeYear,
        },
      },
      subjects,
      examPath,
      tracksById
    );
    const withPaths = attachPathLabels(relevant, pathLabelsBySubjectId);

    for (const subject of withPaths) {
      for (const ob of subject.obligations) {
        const grade = gradeByKey.get(`${student.id}:${ob.id}`);
        const statusLabel = grade
          ? STATUS_LABELS[grade.status]?.label ?? ""
          : "";
        const tasks = expandObligationMatrixTasks(ob, 0);
        for (const task of tasks) {
          let score: number | string = "";
          if (grade) {
            if (task.taskKind === "single") {
              score = grade.score ?? "";
            } else if (task.taskKind === "component") {
              score = grade.componentScores?.[task.sortOrder] ?? "";
            } else {
              score = grade.subItemScores?.[task.sortOrder] ?? "";
            }
          }
          rows.push({
            className: cls.name,
            subjectName: subject.displayName,
            obligationName: obligationDisplayLabel(ob),
            taskName: tasks.length === 1 && task.taskKind === "single" ? "" : task.taskName,
            studentName: student.name,
            score,
            status: statusLabel,
          });
        }
      }
    }
  }

  return NextResponse.json({
    className: cls.name,
    statuses: SUBMISSION_STATUSES.map((s) => STATUS_LABELS[s].label),
    rows,
  });
}

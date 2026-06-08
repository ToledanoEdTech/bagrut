import { NextResponse } from "next/server";
import { calcSubjectProgress } from "@/lib/progress";
import {
  buildStudentWithRelations,
  getRelevantSubjects,
} from "@/lib/student-subjects";
import {
  getGradesByStudent,
  getStudentById,
  getStudentTrackIds,
  getTrackById,
} from "@/lib/firestore";
import { requireStudent } from "@/lib/api-auth";

export async function GET() {
  const { error, session } = await requireStudent();
  if (error || !session) return error;

  const student = await getStudentById(session.studentId!);
  if (!student) {
    return NextResponse.json({ error: "לא נמצא תלמיד" }, { status: 404 });
  }

  const trackIds = getStudentTrackIds(student);
  const [studentWithRelations, grades, tracks] = await Promise.all([
    buildStudentWithRelations(student),
    getGradesByStudent(student.id),
    Promise.all(trackIds.map((id) => getTrackById(id))).then((items) =>
      items.filter(Boolean)
    ),
  ]);
  const subjects = await getRelevantSubjects(studentWithRelations);

  const subjectsWithProgress = subjects.map((subject) => {
    const subjectGrades = grades.filter((g) =>
      subject.obligations.some((o) => o.id === g.obligationId)
    );
    const progress = calcSubjectProgress(subject.obligations, subjectGrades);
    return { ...subject, progress, grades: subjectGrades };
  });

  const overallProgress =
    subjectsWithProgress.length > 0
      ? subjectsWithProgress.reduce((s, sub) => s + sub.progress.progressPercent, 0) /
        subjectsWithProgress.length
      : 0;

  return NextResponse.json({
    student: {
      ...studentWithRelations,
      user: { name: student.name, email: student.email },
      class: studentWithRelations.class,
      tracks,
      track: tracks[0] ?? null,
    },
    subjects: subjectsWithProgress,
    overallProgress,
  });
}

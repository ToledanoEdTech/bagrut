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
  listExamPaths,
} from "@/lib/firestore";
import { attachPathLabels, buildPathLabelsBySubjectId } from "@/lib/subject-display";

export async function buildStudentDashboard(studentId: string) {
  const student = await getStudentById(studentId);
  if (!student) return null;

  const trackIds = getStudentTrackIds(student);
  const [studentWithRelations, grades, tracks] = await Promise.all([
    buildStudentWithRelations(student),
    getGradesByStudent(student.id),
    Promise.all(trackIds.map((id) => getTrackById(id))).then((items) =>
      items.filter(Boolean)
    ),
  ]);
  const [subjects, examPaths] = await Promise.all([
    getRelevantSubjects(studentWithRelations),
    listExamPaths(),
  ]);
  const pathLabelsBySubjectId = buildPathLabelsBySubjectId(examPaths);
  const subjectsWithPaths = attachPathLabels(subjects, pathLabelsBySubjectId);

  const subjectsWithProgress = subjectsWithPaths.map((subject) => {
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

  return {
    student: {
      ...studentWithRelations,
      user: { name: student.name, email: student.email },
      class: studentWithRelations.class,
      tracks,
      track: tracks[0] ?? null,
    },
    subjects: subjectsWithProgress,
    overallProgress,
  };
}

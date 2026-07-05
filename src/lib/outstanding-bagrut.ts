export {
  OUTSTANDING_BAGRUT_MIN_AVERAGE,
  OUTSTANDING_BAGRUT_MIN_ENGLISH_UNITS,
  OUTSTANDING_BAGRUT_MIN_MATH_UNITS,
  OUTSTANDING_BAGRUT_TIER_YELLOW_MIN,
  OUTSTANDING_BAGRUT_TIER_GREEN_MIN,
  OUTSTANDING_BAGRUT_TIER_LABELS,
  evaluateOutstandingBagrut,
  type OutstandingBagrutTier,
  type OutstandingBagrutResult,
  type OutstandingBagrutStudent,
} from "@/lib/outstanding-bagrut-core";

import { calcSubjectProgressForObligations } from "@/lib/progress";
import {
  loadSubjectContext,
  resolveRelevantSubjects,
  type StudentWithRelations,
} from "@/lib/student-subjects";
import {
  listAllGrades,
  listClasses,
  listExamPaths,
  listStudents,
} from "@/lib/firestore";
import type { Class, ExamPath, Grade, Student, Subject } from "@/lib/types";
import {
  evaluateOutstandingBagrut,
  type OutstandingBagrutStudent,
} from "@/lib/outstanding-bagrut-core";

function buildSubjectsWithProgress(
  student: StudentWithRelations,
  allSubjects: Subject[],
  examPathsById: Map<string, ExamPath>,
  tracksById: Map<string, import("@/lib/types").Track>,
  gradesByStudent: Map<string, Grade[]>
) {
  const examPath = examPathsById.get(student.class.examPathId) ?? null;
  const subjects = resolveRelevantSubjects(
    student,
    allSubjects,
    examPath,
    tracksById
  );
  const grades = gradesByStudent.get(student.id) ?? [];

  return subjects.map((subject) => {
    const subjectGrades = grades.filter((g) =>
      subject.obligations.some((o) => o.id === g.obligationId)
    );
    return {
      units: subject.units,
      category: subject.category,
      progress: calcSubjectProgressForObligations(subject.obligations, subjectGrades),
    };
  });
}

export async function computeOutstandingBagrutForStudents(
  students: Student[],
  classesById?: Map<string, Class>
): Promise<OutstandingBagrutStudent[]> {
  if (students.length === 0) return [];

  const [ctx, examPaths, allGrades, classes] = await Promise.all([
    loadSubjectContext(),
    listExamPaths(),
    listAllGrades(),
    classesById ? Promise.resolve(null) : listClasses(),
  ]);

  const classMap =
    classesById ??
    new Map((classes ?? []).map((cls) => [cls.id, cls]));
  const examPathsById = new Map(examPaths.map((path) => [path.id, path]));
  const gradesByStudent = new Map<string, Grade[]>();
  for (const grade of allGrades) {
    const list = gradesByStudent.get(grade.studentId) ?? [];
    list.push(grade);
    gradesByStudent.set(grade.studentId, list);
  }

  const results: OutstandingBagrutStudent[] = [];

  for (const student of students) {
    const cls = classMap.get(student.classId);
    const withRelations: StudentWithRelations = {
      ...student,
      class: {
        examPathId: cls?.examPathId ?? "",
        name: cls?.name ?? "",
        gradeYear: cls?.gradeYear ?? null,
      },
    };
    const subjectsWithProgress = buildSubjectsWithProgress(
      withRelations,
      ctx.allSubjects,
      examPathsById,
      ctx.tracksById,
      gradesByStudent
    );
    const outstandingBagrut = evaluateOutstandingBagrut(student, subjectsWithProgress);

    results.push({
      studentId: student.id,
      name: student.name,
      email: student.email,
      className: cls?.name ?? "—",
      gradeYear: cls?.gradeYear ?? null,
      mathUnits: student.mathUnits,
      englishUnits: student.englishUnits,
      outstandingBagrut,
    });
  }

  return results.sort((a, b) => a.name.localeCompare(b.name, "he"));
}

export async function computeAllOutstandingBagrutCandidates(): Promise<
  OutstandingBagrutStudent[]
> {
  const students = await listStudents();
  const all = await computeOutstandingBagrutForStudents(students);
  return all.filter((item) => item.outstandingBagrut.isCandidate);
}

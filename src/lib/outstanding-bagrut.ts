import { calcSubjectProgress } from "@/lib/progress";
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

export const OUTSTANDING_BAGRUT_MIN_AVERAGE = 90;
export const OUTSTANDING_BAGRUT_MIN_ENGLISH_UNITS = 5;
export const OUTSTANDING_BAGRUT_MIN_MATH_UNITS = 4;

export type OutstandingBagrutResult = {
  isCandidate: boolean;
  average: number | null;
  gradedSubjectsCount: number;
  totalSubjectsCount: number;
  meetsEnglishUnits: boolean;
  meetsMathUnits: boolean;
  meetsAverage: boolean;
  missingReasons: string[];
};

export type OutstandingBagrutStudent = {
  studentId: string;
  name: string;
  email: string;
  className: string;
  gradeYear: string | null;
  mathUnits: number;
  englishUnits: number;
  outstandingBagrut: OutstandingBagrutResult;
};

type SubjectWithProgress = {
  progress: { estimatedGrade: number | null };
};

export function evaluateOutstandingBagrut(
  student: { mathUnits: number; englishUnits: number },
  subjects: SubjectWithProgress[]
): OutstandingBagrutResult {
  const meetsEnglishUnits = student.englishUnits === OUTSTANDING_BAGRUT_MIN_ENGLISH_UNITS;
  const meetsMathUnits = student.mathUnits >= OUTSTANDING_BAGRUT_MIN_MATH_UNITS;

  const gradedSubjects = subjects.filter((s) => s.progress.estimatedGrade != null);
  const totalSubjectsCount = subjects.length;
  const gradedSubjectsCount = gradedSubjects.length;

  const average =
    gradedSubjectsCount > 0
      ? gradedSubjects.reduce((sum, s) => sum + s.progress.estimatedGrade!, 0) /
        gradedSubjectsCount
      : null;

  const meetsAverage =
    average != null && average >= OUTSTANDING_BAGRUT_MIN_AVERAGE;

  const missingReasons: string[] = [];
  if (!meetsEnglishUnits) {
    missingReasons.push(
      `נדרשות ${OUTSTANDING_BAGRUT_MIN_ENGLISH_UNITS} יח"ל אנגלית (כרגע ${student.englishUnits})`
    );
  }
  if (!meetsMathUnits) {
    missingReasons.push(
      `נדרשות לפחות ${OUTSTANDING_BAGRUT_MIN_MATH_UNITS} יח"ל מתמטיקה (כרגע ${student.mathUnits})`
    );
  }
  if (average == null) {
    missingReasons.push("אין עדיין ציונים למיצוע");
  } else if (!meetsAverage) {
    missingReasons.push(
      `ממוצע ${average.toFixed(1)} — נדרש ${OUTSTANDING_BAGRUT_MIN_AVERAGE}+`
    );
  }

  const isCandidate = meetsEnglishUnits && meetsMathUnits && meetsAverage;

  return {
    isCandidate,
    average,
    gradedSubjectsCount,
    totalSubjectsCount,
    meetsEnglishUnits,
    meetsMathUnits,
    meetsAverage,
    missingReasons,
  };
}

function buildSubjectsWithProgress(
  student: StudentWithRelations,
  allSubjects: Subject[],
  examPathsById: Map<string, ExamPath>,
  tracksById: Map<string, import("@/lib/types").Track>,
  gradesByStudent: Map<string, Grade[]>
): SubjectWithProgress[] {
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
    return { progress: calcSubjectProgress(subject.obligations, subjectGrades) };
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

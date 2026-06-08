import {
  findObligation,
  getClassById,
  getExamPathById,
  getGradesByStudentsAndObligation,
  listStudents,
} from "@/lib/firestore";
import {
  buildStudentWithRelations,
  loadSubjectContext,
  resolveRelevantSubjects,
  type StudentWithRelations,
  type SubjectContext,
} from "@/lib/student-subjects";
import type { Class, ExamPath, Student } from "@/lib/types";

function withClass(student: Student, cls: Class): StudentWithRelations {
  return {
    ...student,
    class: {
      examPathId: cls.examPathId,
      name: cls.name,
      gradeYear: cls.gradeYear,
    },
  };
}

function studentHasObligation(
  student: StudentWithRelations,
  obligationId: string,
  examPath: ExamPath | null,
  ctx: SubjectContext
): boolean {
  const subjects = resolveRelevantSubjects(
    student,
    ctx.allSubjects,
    examPath,
    ctx.tracksById
  );
  return subjects.some((s) => s.obligations.some((o) => o.id === obligationId));
}

async function loadClassContext(classId: string) {
  const cls = await getClassById(classId);
  if (!cls) return null;

  const [examPath, ctx, students] = await Promise.all([
    getExamPathById(cls.examPathId),
    loadSubjectContext(),
    listStudents(),
  ]);

  return {
    cls,
    examPath,
    ctx,
    students: students.filter((student) => student.classId === classId),
  };
}

export async function getMatrixOptions(classId: string) {
  const classContext = await loadClassContext(classId);
  if (!classContext) throw new Error("כיתה לא נמצאה");

  const { cls, examPath, ctx, students } = classContext;
  const subjectsMap = new Map<
    string,
    {
      id: string;
      name: string;
      units: number | null;
      obligations: Map<
        string,
        {
          id: string;
          name: string | null;
          questionnaireNumber: string | null;
          relevantStudentCount: number;
        }
      >;
    }
  >();

  for (const student of students) {
    const withRelations = withClass(student, cls);
    const subjects = resolveRelevantSubjects(
      withRelations,
      ctx.allSubjects,
      examPath,
      ctx.tracksById
    );

    for (const subject of subjects) {
      if (!subjectsMap.has(subject.id)) {
        subjectsMap.set(subject.id, {
          id: subject.id,
          name: subject.name,
          units: subject.units,
          obligations: new Map(),
        });
      }
      const entry = subjectsMap.get(subject.id)!;
      for (const ob of subject.obligations) {
        const existing = entry.obligations.get(ob.id);
        if (existing) {
          existing.relevantStudentCount++;
        } else {
          entry.obligations.set(ob.id, {
            id: ob.id,
            name: ob.name,
            questionnaireNumber: ob.questionnaireNumber,
            relevantStudentCount: 1,
          });
        }
      }
    }
  }

  return {
    subjects: Array.from(subjectsMap.values()).map((s) => ({
      id: s.id,
      name: s.name,
      units: s.units,
      obligations: Array.from(s.obligations.values()),
    })),
  };
}

export async function getMatrixData(classId: string, obligationId: string) {
  const found = await findObligation(obligationId);
  if (!found) throw new Error("מטלה לא נמצאה");

  const classContext = await loadClassContext(classId);
  if (!classContext) throw new Error("כיתה לא נמצאה");

  const { cls, examPath, ctx, students } = classContext;
  const relevantStudents: Student[] = [];
  let notRelevantCount = 0;

  for (const student of students) {
    const withRelations = withClass(student, cls);
    if (studentHasObligation(withRelations, obligationId, examPath, ctx)) {
      relevantStudents.push(student);
    } else {
      notRelevantCount++;
    }
  }

  relevantStudents.sort((a, b) => a.name.localeCompare(b.name, "he"));

  const gradesMap = await getGradesByStudentsAndObligation(
    relevantStudents.map((s) => s.id),
    obligationId
  );

  return {
    class: { id: cls.id, name: cls.name, gradeYear: cls.gradeYear },
    subject: {
      id: found.subject.id,
      name: found.subject.name,
      units: found.subject.units,
    },
    obligation: {
      id: found.obligation.id,
      name: found.obligation.name,
      questionnaireNumber: found.obligation.questionnaireNumber,
      weightPercent: found.obligation.weightPercent,
      examType: found.obligation.examType,
    },
    rows: relevantStudents.map((s) => {
      const grade = gradesMap.get(s.id);
      return {
        studentId: s.id,
        studentName: s.name,
        grade: grade
          ? {
              score: grade.score,
              status: grade.status,
              notes: grade.notes,
            }
          : null,
      };
    }),
    notRelevantCount,
  };
}

export async function isObligationRelevantForStudent(
  student: Student,
  obligationId: string
): Promise<boolean> {
  const withRelations = await buildStudentWithRelations(student);
  const [examPath, ctx] = await Promise.all([
    getExamPathById(withRelations.class.examPathId),
    loadSubjectContext(),
  ]);
  return studentHasObligation(withRelations, obligationId, examPath, ctx);
}

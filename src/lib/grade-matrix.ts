import {
  findObligation,
  getClassById,
  getGradesByStudentsAndObligation,
  listStudents,
} from "@/lib/firestore";
import {
  buildStudentWithRelations,
  getRelevantSubjects,
  type StudentWithRelations,
} from "@/lib/student-subjects";
import type { Class, Student } from "@/lib/types";

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

async function studentHasObligation(
  student: StudentWithRelations,
  obligationId: string
): Promise<boolean> {
  const subjects = await getRelevantSubjects(student);
  return subjects.some((s) => s.obligations.some((o) => o.id === obligationId));
}

export async function getMatrixOptions(classId: string) {
  const cls = await getClassById(classId);
  if (!cls) throw new Error("כיתה לא נמצאה");

  const students = (await listStudents()).filter((s) => s.classId === classId);
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
    const subjects = await getRelevantSubjects(withRelations);

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

  const cls = await getClassById(classId);
  if (!cls) throw new Error("כיתה לא נמצאה");

  const allStudents = (await listStudents()).filter((s) => s.classId === classId);
  const relevantStudents: Student[] = [];
  let notRelevantCount = 0;

  for (const student of allStudents) {
    const withRelations = withClass(student, cls);
    if (await studentHasObligation(withRelations, obligationId)) {
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
  return studentHasObligation(withRelations, obligationId);
}

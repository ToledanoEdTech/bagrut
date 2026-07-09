import {
  findObligation,
  getClassById,
  getExamPathById,
  getGradesByStudentsAndObligation,
  listExamPaths,
  listStudents,
} from "@/lib/firestore";
import {
  attachPathLabels,
  buildPathLabelsBySubjectId,
  formatSubjectDisplayName,
} from "@/lib/subject-display";
import {
  buildStudentWithRelations,
  loadSubjectContext,
  resolveRelevantSubjects,
  type StudentWithRelations,
  type SubjectContext,
} from "@/lib/student-subjects";
import {
  calcPartialWeightedSubItemScore,
  calcWeightedComponentScore,
  calcWeightedSubItemScore,
  expandObligationMatrixTasks,
  formatSubItemProgressLabel,
  getObligationSubItemProgress,
  hasSeparateComponentGrades,
  hasSubItemGrades,
  isObligationSubItemsComplete,
  normalizeComponents,
  normalizeSubItems,
  type MatrixTaskKind,
  type MatrixTaskOption,
} from "@/lib/grade-components";
import type { Class, ExamPath, Student } from "@/lib/types";
import { isObligationDueForStudent } from "@/lib/grade-year";

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
  const pathLabelsBySubjectId = buildPathLabelsBySubjectId(await listExamPaths());
  const subjectsMap = new Map<
    string,
    {
      id: string;
      name: string;
      units: number | null;
      category: (typeof ctx.allSubjects)[0]["category"];
      obligations: Map<
        string,
        {
          obligation: (typeof ctx.allSubjects)[0]["obligations"][0];
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
          category: subject.category,
          obligations: new Map(),
        });
      }
      const entry = subjectsMap.get(subject.id)!;
      for (const ob of subject.obligations) {
        if (!isObligationDueForStudent(ob.gradeYear, cls.gradeYear)) continue;
        const existing = entry.obligations.get(ob.id);
        if (existing) {
          existing.relevantStudentCount++;
        } else {
          entry.obligations.set(ob.id, { obligation: ob, relevantStudentCount: 1 });
        }
      }
    }
  }

  return {
    subjects: attachPathLabels(
      Array.from(subjectsMap.values()).map((s) => ({
        id: s.id,
        name: s.name,
        units: s.units,
        category: s.category,
        tasks: Array.from(s.obligations.values()).flatMap(({ obligation, relevantStudentCount }) =>
          expandObligationMatrixTasks(obligation, relevantStudentCount)
        ),
      })),
      pathLabelsBySubjectId
    ),
  };
}

export async function getMatrixData(
  classId: string,
  obligationId: string,
  taskKind?: MatrixTaskKind,
  taskSortOrder?: number
) {
  const found = await findObligation(obligationId);
  if (!found) throw new Error("מטלה לא נמצאה");

  const classContext = await loadClassContext(classId);
  if (!classContext) throw new Error("כיתה לא נמצאה");

  const { cls, examPath, ctx, students } = classContext;
  if (!isObligationDueForStudent(found.obligation.gradeYear, cls.gradeYear)) {
    throw new Error("מטלה זו אינה רלוונטית לשכבת הכיתה");
  }

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

  const subItems = normalizeSubItems(found.obligation.subItems);
  const components = normalizeComponents(found.obligation.components);
  const usesSubItems = hasSubItemGrades(subItems);

  let selectedTaskName = "ציון";
  let tableComponents: Array<{ name: string; weightPercent: number; sortOrder: number }> = [];

  if (taskKind === "subItem" && taskSortOrder != null) {
    const selected = subItems.find((s) => s.sortOrder === taskSortOrder);
    if (selected) {
      selectedTaskName = selected.name ?? "ציון";
      tableComponents = [
        {
          name: selectedTaskName,
          weightPercent: selected.weightPercent,
          sortOrder: selected.sortOrder,
        },
      ];
    }
  } else if (taskKind === "component" && taskSortOrder != null) {
    const selected = components.find((c) => c.sortOrder === taskSortOrder);
    if (selected) {
      selectedTaskName = selected.name ?? "ציון";
      tableComponents = [
        {
          name: selectedTaskName,
          weightPercent: selected.weightPercent,
          sortOrder: selected.sortOrder,
        },
      ];
    }
  } else if (usesSubItems) {
    tableComponents = subItems.map((s) => ({
      name: s.name ?? "ציון",
      weightPercent: s.weightPercent,
      sortOrder: s.sortOrder,
    }));
  } else if (hasSeparateComponentGrades(components)) {
    tableComponents = components.map((c) => ({
      name: c.name ?? "ציון",
      weightPercent: c.weightPercent,
      sortOrder: c.sortOrder,
    }));
  } else if (components.length === 1) {
    selectedTaskName = components[0]!.name ?? "ציון";
    tableComponents = [
      {
        name: selectedTaskName,
        weightPercent: components[0]!.weightPercent,
        sortOrder: components[0]!.sortOrder,
      },
    ];
  } else {
    tableComponents = [{ name: "ציון", weightPercent: 100, sortOrder: 0 }];
  }

  const pathLabelsBySubjectId = buildPathLabelsBySubjectId(await listExamPaths());
  const subjectPathLabels = pathLabelsBySubjectId.get(found.subject.id) ?? [];

  return {
    class: { id: cls.id, name: cls.name, gradeYear: cls.gradeYear },
    subject: {
      id: found.subject.id,
      name: found.subject.name,
      displayName: formatSubjectDisplayName(found.subject.name, {
        pathLabels: subjectPathLabels,
        units: found.subject.units,
        category: found.subject.category,
      }),
      pathLabels: subjectPathLabels,
      category: found.subject.category,
      units: found.subject.units,
    },
    obligation: {
      id: found.obligation.id,
      name: found.obligation.name,
      questionnaireNumber: found.obligation.questionnaireNumber,
      weightPercent: found.obligation.weightPercent,
      examType: found.obligation.examType,
      taskKind: taskKind ?? null,
      taskSortOrder: taskSortOrder ?? null,
      components: tableComponents,
    },
    rows: relevantStudents.map((s) => {
      const grade = gradesMap.get(s.id);
      let itemScore: number | null = null;

      if (taskKind === "subItem" && taskSortOrder != null) {
        itemScore = grade?.subItemScores?.[taskSortOrder] ?? null;
      } else if (taskKind === "component" && taskSortOrder != null) {
        itemScore = grade?.componentScores?.[taskSortOrder] ?? null;
      } else if (usesSubItems) {
        const complete = isObligationSubItemsComplete(
          { subItems: found.obligation.subItems },
          grade ?? {}
        );
        itemScore = complete
          ? calcWeightedSubItemScore(subItems, grade?.subItemScores)
          : calcPartialWeightedSubItemScore(subItems, grade?.subItemScores);
      } else if (hasSeparateComponentGrades(components)) {
        itemScore = calcWeightedComponentScore(components, grade?.componentScores);
      } else {
        itemScore = grade?.score ?? null;
      }

      return {
        studentId: s.id,
        studentName: s.name,
        grade: grade
          ? {
              score: itemScore,
              displayLabel:
                usesSubItems && taskKind == null && taskSortOrder == null
                  ? (() => {
                      const progress = getObligationSubItemProgress(
                        { subItems: found.obligation.subItems },
                        grade
                      );
                      if (
                        progress &&
                        progress.enteredCount > 0 &&
                        !isObligationSubItemsComplete(
                          { subItems: found.obligation.subItems },
                          grade
                        )
                      ) {
                        return formatSubItemProgressLabel(
                          progress.enteredCount,
                          progress.totalCount
                        );
                      }
                      return null;
                    })()
                  : null,
              componentScores: grade.componentScores ?? null,
              subItemScores: grade.subItemScores ?? null,
              qualitativeLevel: grade.qualitativeLevel ?? null,
              status: grade.status,
              notes: grade.notes,
            }
          : null,
      };
    }),
    notRelevantCount,
  };
}

export type { MatrixTaskOption };

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

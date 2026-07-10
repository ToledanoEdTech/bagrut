import {
  findObligation,
  getClassById,
  getExamPathById,
  getGradesByStudentsAndObligation,
  listClassesSimple,
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
import { isObligationDueForStudent, normalizeGradeYear } from "@/lib/grade-year";

type ClassRef = {
  id: string;
  name: string;
  gradeYear: string | null;
  examPathId: string;
};

type MatrixStudent = {
  student: Student;
  cls: ClassRef;
  examPath: ExamPath | null;
};

type SubjectsMap = Map<
  string,
  {
    id: string;
    name: string;
    units: number | null;
    category: SubjectContext["allSubjects"][0]["category"];
    obligations: Map<
      string,
      {
        obligation: SubjectContext["allSubjects"][0]["obligations"][0];
        relevantStudentCount: number;
      }
    >;
  }
>;

function withClass(student: Student, cls: ClassRef): StudentWithRelations {
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

function accumulateSubjectsForStudent(
  subjectsMap: SubjectsMap,
  student: MatrixStudent,
  ctx: SubjectContext,
  layerGradeYear: string | null
) {
  const withRelations = withClass(student.student, student.cls);
  const subjects = resolveRelevantSubjects(
    withRelations,
    ctx.allSubjects,
    student.examPath,
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
      if (!isObligationDueForStudent(ob.gradeYear, layerGradeYear)) continue;
      const existing = entry.obligations.get(ob.id);
      if (existing) {
        existing.relevantStudentCount++;
      } else {
        entry.obligations.set(ob.id, { obligation: ob, relevantStudentCount: 1 });
      }
    }
  }
}

async function buildOptionsFromStudents(
  matrixStudents: MatrixStudent[],
  layerGradeYear: string | null
) {
  const ctx = await loadSubjectContext();
  const pathLabelsBySubjectId = buildPathLabelsBySubjectId(await listExamPaths());
  const subjectsMap: SubjectsMap = new Map();

  for (const ms of matrixStudents) {
    accumulateSubjectsForStudent(subjectsMap, ms, ctx, layerGradeYear);
  }

  return {
    subjects: attachPathLabels(
      Array.from(subjectsMap.values()).map((s) => ({
        id: s.id,
        name: s.name,
        units: s.units,
        category: s.category,
        tasks: Array.from(s.obligations.values()).flatMap(
          ({ obligation, relevantStudentCount }) =>
            expandObligationMatrixTasks(obligation, relevantStudentCount)
        ),
      })),
      pathLabelsBySubjectId
    ),
  };
}

function buildTableComponents(
  obligation: {
    name: string | null;
    components: Parameters<typeof normalizeComponents>[0];
    subItems: Parameters<typeof normalizeSubItems>[0];
  },
  taskKind?: MatrixTaskKind,
  taskSortOrder?: number
) {
  const subItems = normalizeSubItems(obligation.subItems);
  const components = normalizeComponents(obligation.components);
  const usesSubItems = hasSubItemGrades(subItems);

  let selectedTaskName = "ציון";
  let tableComponents: Array<{ name: string; weightPercent: number; sortOrder: number }> =
    [];

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

  return { subItems, components, usesSubItems, tableComponents };
}

async function buildMatrixRows(
  found: NonNullable<Awaited<ReturnType<typeof findObligation>>>,
  relevantStudents: MatrixStudent[],
  notRelevantCount: number,
  scope: {
    class?: { id: string; name: string; gradeYear: string | null };
    gradeYear?: string | null;
  },
  taskKind?: MatrixTaskKind,
  taskSortOrder?: number
) {
  const gradesMap = await getGradesByStudentsAndObligation(
    relevantStudents.map((s) => s.student.id),
    found.obligation.id
  );

  const { subItems, components, usesSubItems, tableComponents } = buildTableComponents(
    found.obligation,
    taskKind,
    taskSortOrder
  );

  const pathLabelsBySubjectId = buildPathLabelsBySubjectId(await listExamPaths());
  const subjectPathLabels = pathLabelsBySubjectId.get(found.subject.id) ?? [];

  return {
    class: scope.class ?? null,
    gradeYear: scope.gradeYear ?? scope.class?.gradeYear ?? null,
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
    rows: relevantStudents.map((ms) => {
      const s = ms.student;
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
        classId: ms.cls.id,
        className: ms.cls.name,
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

async function loadClassMatrixStudents(classId: string): Promise<{
  cls: Class;
  matrixStudents: MatrixStudent[];
} | null> {
  const cls = await getClassById(classId);
  if (!cls) return null;

  const [examPath, students] = await Promise.all([
    getExamPathById(cls.examPathId),
    listStudents(),
  ]);

  const classRef: ClassRef = {
    id: cls.id,
    name: cls.name,
    gradeYear: cls.gradeYear,
    examPathId: cls.examPathId,
  };

  return {
    cls,
    matrixStudents: students
      .filter((student) => student.classId === classId)
      .map((student) => ({
        student,
        cls: classRef,
        examPath,
      })),
  };
}

async function loadGradeYearMatrixStudents(
  gradeYear: string,
  allowedClassIds?: string[] | null
): Promise<{
  gradeYear: string;
  matrixStudents: MatrixStudent[];
} | null> {
  const normalized = normalizeGradeYear(gradeYear);
  if (!normalized) return null;

  const [classes, examPaths, students] = await Promise.all([
    listClassesSimple(),
    listExamPaths(),
    listStudents(),
  ]);

  let layerClasses = classes.filter(
    (c) => normalizeGradeYear(c.gradeYear) === normalized
  );
  if (allowedClassIds) {
    const allowed = new Set(allowedClassIds);
    layerClasses = layerClasses.filter((c) => allowed.has(c.id));
  }
  if (layerClasses.length === 0) return null;

  const classById = new Map(layerClasses.map((c) => [c.id, c]));
  const examPathById = new Map(examPaths.map((p) => [p.id, p]));

  const matrixStudents: MatrixStudent[] = students
    .filter((s) => classById.has(s.classId))
    .map((student) => {
      const cls = classById.get(student.classId)!;
      return {
        student,
        cls,
        examPath: examPathById.get(cls.examPathId) ?? null,
      };
    });

  return { gradeYear: normalized, matrixStudents };
}

export async function getMatrixOptions(classId: string) {
  const loaded = await loadClassMatrixStudents(classId);
  if (!loaded) throw new Error("כיתה לא נמצאה");

  return buildOptionsFromStudents(loaded.matrixStudents, loaded.cls.gradeYear);
}

export async function getMatrixOptionsByGradeYear(
  gradeYear: string,
  allowedClassIds?: string[] | null
) {
  const loaded = await loadGradeYearMatrixStudents(gradeYear, allowedClassIds);
  if (!loaded) throw new Error("לא נמצאו כיתות בשכבה זו");

  return buildOptionsFromStudents(loaded.matrixStudents, loaded.gradeYear);
}

export async function getMatrixData(
  classId: string,
  obligationId: string,
  taskKind?: MatrixTaskKind,
  taskSortOrder?: number
) {
  const found = await findObligation(obligationId);
  if (!found) throw new Error("מטלה לא נמצאה");

  const loaded = await loadClassMatrixStudents(classId);
  if (!loaded) throw new Error("כיתה לא נמצאה");

  const { cls, matrixStudents } = loaded;
  if (!isObligationDueForStudent(found.obligation.gradeYear, cls.gradeYear)) {
    throw new Error("מטלה זו אינה רלוונטית לשכבת הכיתה");
  }

  const ctx = await loadSubjectContext();
  const relevant: MatrixStudent[] = [];
  let notRelevantCount = 0;

  for (const ms of matrixStudents) {
    const withRelations = withClass(ms.student, ms.cls);
    if (studentHasObligation(withRelations, obligationId, ms.examPath, ctx)) {
      relevant.push(ms);
    } else {
      notRelevantCount++;
    }
  }

  relevant.sort((a, b) => a.student.name.localeCompare(b.student.name, "he"));

  return buildMatrixRows(
    found,
    relevant,
    notRelevantCount,
    { class: { id: cls.id, name: cls.name, gradeYear: cls.gradeYear } },
    taskKind,
    taskSortOrder
  );
}

export async function getMatrixDataByGradeYear(
  gradeYear: string,
  obligationId: string,
  taskKind?: MatrixTaskKind,
  taskSortOrder?: number,
  allowedClassIds?: string[] | null
) {
  const found = await findObligation(obligationId);
  if (!found) throw new Error("מטלה לא נמצאה");

  const loaded = await loadGradeYearMatrixStudents(gradeYear, allowedClassIds);
  if (!loaded) throw new Error("לא נמצאו כיתות בשכבה זו");

  if (!isObligationDueForStudent(found.obligation.gradeYear, loaded.gradeYear)) {
    throw new Error("מטלה זו אינה רלוונטית לשכבה");
  }

  const ctx = await loadSubjectContext();
  const relevant: MatrixStudent[] = [];
  let notRelevantCount = 0;

  for (const ms of loaded.matrixStudents) {
    const withRelations = withClass(ms.student, ms.cls);
    if (studentHasObligation(withRelations, obligationId, ms.examPath, ctx)) {
      relevant.push(ms);
    } else {
      notRelevantCount++;
    }
  }

  relevant.sort((a, b) => {
    const byClass = a.cls.name.localeCompare(b.cls.name, "he");
    if (byClass !== 0) return byClass;
    return a.student.name.localeCompare(b.student.name, "he");
  });

  return buildMatrixRows(
    found,
    relevant,
    notRelevantCount,
    { gradeYear: loaded.gradeYear },
    taskKind,
    taskSortOrder
  );
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

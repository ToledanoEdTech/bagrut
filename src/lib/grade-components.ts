import { filterSubItemsDueForStudent } from "@/lib/grade-year";
import type { ObligationComponent } from "@/lib/types";

type WeightedItemLike = Pick<ObligationComponent, "weightPercent" | "sortOrder"> & {
  name?: string;
  gradeYear?: string | null;
};

export type MatrixTaskKind = "subItem" | "component" | "single";

export function normalizeWeightedItems(
  items: Array<{
    weightPercent: number;
    sortOrder?: number;
    name?: string;
    gradeYear?: string | null;
  }>
): WeightedItemLike[] {
  return items.map((item, i) => ({
    weightPercent: item.weightPercent,
    sortOrder: item.sortOrder ?? i,
    name: item.name,
    gradeYear: item.gradeYear,
  }));
}

export function normalizeComponents(
  components: Array<{ weightPercent: number; sortOrder?: number; name?: string }>
): WeightedItemLike[] {
  return normalizeWeightedItems(components);
}

export function normalizeSubItems(
  subItems: Array<{
    weightPercent: number;
    sortOrder?: number;
    name?: string;
    gradeYear?: string | null;
  }>
): WeightedItemLike[] {
  return normalizeWeightedItems(subItems);
}

/** תתי-מטלות שחלות על שכבת התלמיד (או כולן אם לא סופקה שכבה). */
export function selectRelevantSubItems<
  T extends { gradeYear?: string | null; weightPercent: number; sortOrder?: number; name?: string },
>(
  subItems: T[],
  obligationGradeYear: string | null | undefined,
  studentGradeYear?: string | null
): T[] {
  if (studentGradeYear === undefined) return subItems;
  return filterSubItemsDueForStudent(subItems, obligationGradeYear, studentGradeYear);
}

export function hasMultipleWeightedGrades(items: WeightedItemLike[]): boolean {
  return items.length > 1;
}

export function hasSeparateComponentGrades(components: WeightedItemLike[]): boolean {
  return hasMultipleWeightedGrades(components);
}

export function hasSubItemGrades(subItems: WeightedItemLike[]): boolean {
  return subItems.length > 0;
}

export function countEnteredWeightedScores(
  items: WeightedItemLike[],
  scores: Record<number, number | null> | null | undefined
): { enteredCount: number; totalCount: number } {
  const totalCount = items.length;
  if (!scores || totalCount === 0) return { enteredCount: 0, totalCount };
  const enteredCount = items.filter((item) => scores[item.sortOrder] != null).length;
  return { enteredCount, totalCount };
}

export function formatSubItemProgressLabel(enteredCount: number, totalCount: number): string {
  return `${enteredCount} מתוך ${totalCount}`;
}

export function isWeightedScoreComplete(
  items: WeightedItemLike[],
  scores: Record<number, number | null> | null | undefined
): boolean {
  if (items.length === 0) return false;
  if (items.length === 1) return scores?.[items[0]!.sortOrder] != null;
  if (!scores) return false;
  return items.every((item) => scores[item.sortOrder] != null);
}

export function calcWeightedItemScore(
  items: WeightedItemLike[],
  scores: Record<number, number | null> | null | undefined
): number | null {
  if (items.length === 0) return null;
  if (items.length === 1) {
    return scores?.[items[0]!.sortOrder] ?? null;
  }
  if (!scores) return null;

  let weightedSum = 0;
  for (const item of items) {
    const s = scores[item.sortOrder];
    if (s == null) return null;
    weightedSum += s * (item.weightPercent / 100);
  }
  return Math.round(weightedSum * 10) / 10;
}

/** ממוצע משוקלל מתתי-מטלות שהוזנו בלבד (ללא דרישה שכל המשבצות ימולאו). */
export function calcPartialWeightedItemScore(
  items: WeightedItemLike[],
  scores: Record<number, number | null> | null | undefined
): number | null {
  if (items.length === 0) return null;
  if (items.length === 1) {
    return scores?.[items[0]!.sortOrder] ?? null;
  }
  if (!scores) return null;

  let weightedSum = 0;
  let enteredWeight = 0;
  for (const item of items) {
    const s = scores[item.sortOrder];
    if (s != null) {
      weightedSum += s * (item.weightPercent / 100);
      enteredWeight += item.weightPercent;
    }
  }
  if (enteredWeight === 0) return null;
  return Math.round((weightedSum / enteredWeight) * 1000) / 10;
}

export const calcWeightedComponentScore = calcWeightedItemScore;
export const calcWeightedSubItemScore = calcWeightedItemScore;
export const calcPartialWeightedComponentScore = calcPartialWeightedItemScore;
export const calcPartialWeightedSubItemScore = calcPartialWeightedItemScore;

export function isObligationSubItemsComplete(
  obligation: {
    gradeYear?: string | null;
    subItems: Array<{
      weightPercent: number;
      sortOrder?: number;
      name?: string;
      gradeYear?: string | null;
    }>;
  },
  grade: { subItemScores?: Record<number, number | null> | null },
  studentGradeYear?: string | null
): boolean {
  const subItems = selectRelevantSubItems(
    normalizeSubItems(obligation.subItems),
    obligation.gradeYear,
    studentGradeYear
  );
  return subItems.length > 0 && isWeightedScoreComplete(subItems, grade.subItemScores);
}

export function getObligationSubItemProgress(
  obligation: {
    gradeYear?: string | null;
    subItems: Array<{
      weightPercent: number;
      sortOrder?: number;
      name?: string;
      gradeYear?: string | null;
    }>;
  },
  grade: { subItemScores?: Record<number, number | null> | null } | undefined,
  studentGradeYear?: string | null
): { enteredCount: number; totalCount: number } | null {
  const subItems = selectRelevantSubItems(
    normalizeSubItems(obligation.subItems),
    obligation.gradeYear,
    studentGradeYear
  );
  if (subItems.length === 0) return null;
  return countEnteredWeightedScores(subItems, grade?.subItemScores);
}

export function resolveObligationGradeScore(
  obligation: {
    gradeYear?: string | null;
    components: Array<{ weightPercent: number; sortOrder?: number; name?: string }>;
    subItems: Array<{
      weightPercent: number;
      sortOrder?: number;
      name?: string;
      gradeYear?: string | null;
    }>;
  },
  grade: {
    score?: number | null;
    componentScores?: Record<number, number | null> | null;
    subItemScores?: Record<number, number | null> | null;
  },
  options?: { requireComplete?: boolean; studentGradeYear?: string | null }
): number | null {
  const subItems = selectRelevantSubItems(
    normalizeSubItems(obligation.subItems),
    obligation.gradeYear,
    options?.studentGradeYear
  );
  if (subItems.length > 0) {
    const complete = isWeightedScoreComplete(subItems, grade.subItemScores);
    if (options?.requireComplete) {
      return complete ? calcWeightedSubItemScore(subItems, grade.subItemScores) : null;
    }
    return complete
      ? calcWeightedSubItemScore(subItems, grade.subItemScores)
      : calcPartialWeightedSubItemScore(subItems, grade.subItemScores);
  }
  const components = normalizeComponents(obligation.components);
  if (hasSeparateComponentGrades(components)) {
    return calcWeightedComponentScore(components, grade.componentScores);
  }
  return grade.score ?? null;
}

/** אחוז המשקל של פריטים שהוזנו מתוך סך משקלי הפריטים (לפי weightPercent, לא לפי מספר). */
export function getEnteredWeightedItemFraction(
  items: WeightedItemLike[],
  scores: Record<number, number | null> | null | undefined
): number {
  if (items.length === 0) return 0;
  const totalWeight = items.reduce((sum, item) => sum + item.weightPercent, 0);
  if (totalWeight <= 0) return 0;
  let enteredWeight = 0;
  for (const item of items) {
    if (scores?.[item.sortOrder] != null) {
      enteredWeight += item.weightPercent;
    }
  }
  return enteredWeight / totalWeight;
}


export function getObligationCompletionFraction(
  obligation: {
    gradeYear?: string | null;
    components: Array<{ weightPercent: number; sortOrder?: number; name?: string }>;
    subItems: Array<{
      weightPercent: number;
      sortOrder?: number;
      name?: string;
      gradeYear?: string | null;
    }>;
  },
  grade:
    | {
        score?: number | null;
        componentScores?: Record<number, number | null> | null;
        subItemScores?: Record<number, number | null> | null;
        status?: string;
      }
    | undefined,
  studentGradeYear?: string | null
): number {
  if (!grade) return 0;
  if (grade.status === "EXEMPT") return 1;

  const subItems = selectRelevantSubItems(
    normalizeSubItems(obligation.subItems ?? []),
    obligation.gradeYear,
    studentGradeYear
  );
  if (subItems.length > 0) {
    return getEnteredWeightedItemFraction(subItems, grade.subItemScores);
  }

  const components = normalizeComponents(obligation.components ?? []);
  if (hasSeparateComponentGrades(components)) {
    const fraction = getEnteredWeightedItemFraction(components, grade.componentScores);
    if (fraction > 0) return fraction;
  }

  if (resolveProgressScore(obligation, grade, studentGradeYear) != null) return 1;
  if (grade.status === "SUBMITTED") return 0.5;
  return 0;
}

function formatProgressNumber(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

/** תווית ציון שנצבר במטלה מתוך משקלה במקצוע (למשל "8.5 מתוך 30"). */
export function formatObligationEarnedScoreLabel(earned: number, total: number): string {
  return `${formatProgressNumber(earned)} מתוך ${formatProgressNumber(total)}`;
}

/**
 * כמה נקודות מהציון הסופי של המקצוע נצברו במטלה (לפי משקל המטלה ואחוזי תתי-המטלות).
 * מוחזר null למטלות ללא תתי-מטלות או כשאין ציונים שהוזנו.
 */
export function calcObligationEarnedSubjectPoints(
  obligation: {
    weightPercent: number;
    gradeYear?: string | null;
    components: Array<{ weightPercent: number; sortOrder?: number; name?: string }>;
    subItems: Array<{
      weightPercent: number;
      sortOrder?: number;
      name?: string;
      gradeYear?: string | null;
    }>;
  },
  grade:
    | {
        score?: number | null;
        componentScores?: Record<number, number | null> | null;
        subItemScores?: Record<number, number | null> | null;
        status?: string;
      }
    | undefined,
  studentGradeYear?: string | null
): { earned: number; total: number } | null {
  const subItems = selectRelevantSubItems(
    normalizeSubItems(obligation.subItems),
    obligation.gradeYear,
    studentGradeYear
  );
  if (subItems.length === 0) return null;

  const totalWeightOfRelevant = subItems.reduce((s, i) => s + i.weightPercent, 0);
  const allSubItems = normalizeSubItems(obligation.subItems);
  const totalWeightOfAll = allSubItems.reduce((s, i) => s + i.weightPercent, 0);
  const total =
    totalWeightOfAll > 0
      ? obligation.weightPercent * (totalWeightOfRelevant / totalWeightOfAll)
      : obligation.weightPercent;
  let earned = 0;
  let hasAny = false;

  for (const item of subItems) {
    const score = grade?.subItemScores?.[item.sortOrder];
    if (score != null) {
      hasAny = true;
      earned += (score / 100) * (item.weightPercent / 100) * obligation.weightPercent;
    }
  }

  if (!hasAny) return null;
  return { earned: Math.round(earned * 10) / 10, total: Math.round(total * 10) / 10 };
}

export type ObligationProgressContribution = {
  completedWeight: number;
  scoredSum: number;
  scoredWeight: number;
  isComplete: boolean;
};

function resolveProgressScore(
  obligation: {
    gradeYear?: string | null;
    components: Array<{ weightPercent: number; sortOrder?: number; name?: string }>;
    subItems: Array<{
      weightPercent: number;
      sortOrder?: number;
      name?: string;
      gradeYear?: string | null;
    }>;
  },
  grade: {
    score?: number | null;
    componentScores?: Record<number, number | null> | null;
    subItemScores?: Record<number, number | null> | null;
  },
  studentGradeYear?: string | null
): number | null {
  return (
    resolveObligationGradeScore(obligation, grade, { studentGradeYear }) ??
    (typeof grade.score === "number" && !isNaN(grade.score) ? grade.score : null)
  );
}

function contributionFromWeightedParts(
  obligationWeight: number,
  items: WeightedItemLike[],
  scores: Record<number, number | null> | null | undefined,
  resolveScore: () => number | null
): ObligationProgressContribution | null {
  const weightFraction = getEnteredWeightedItemFraction(items, scores);
  if (weightFraction <= 0) return null;

  const effectiveWeight = obligationWeight * weightFraction;
  const score = resolveScore();
  const isComplete = isWeightedScoreComplete(items, scores);

  return {
    completedWeight: effectiveWeight,
    scoredSum: score != null ? score * (effectiveWeight / 100) : 0,
    scoredWeight: score != null ? effectiveWeight : 0,
    isComplete,
  };
}

/** תרומת מטלה בודדת להתקדמות ולציון המשוער במקצוע. */
export function calcObligationProgressContribution(
  obligation: {
    weightPercent: number;
    gradeYear?: string | null;
    components: Array<{ weightPercent: number; sortOrder?: number; name?: string }>;
    subItems: Array<{
      weightPercent: number;
      sortOrder?: number;
      name?: string;
      gradeYear?: string | null;
    }>;
  },
  grade:
    | {
        score?: number | null;
        componentScores?: Record<number, number | null> | null;
        subItemScores?: Record<number, number | null> | null;
        status?: string;
      }
    | undefined,
  studentGradeYear?: string | null
): ObligationProgressContribution {
  const empty: ObligationProgressContribution = {
    completedWeight: 0,
    scoredSum: 0,
    scoredWeight: 0,
    isComplete: false,
  };
  const allSubItems = normalizeSubItems(obligation.subItems ?? []);
  const relevantSubItems = selectRelevantSubItems(
    allSubItems,
    obligation.gradeYear,
    studentGradeYear
  );
  const relevantWeightFraction =
    allSubItems.length > 0
      ? (() => {
          const allW = allSubItems.reduce((s, i) => s + i.weightPercent, 0);
          const relW = relevantSubItems.reduce((s, i) => s + i.weightPercent, 0);
          return allW > 0 ? relW / allW : 1;
        })()
      : 1;
  const obligationWeight = obligation.weightPercent * relevantWeightFraction;
  if (!grade) return empty;

  if (grade.status === "EXEMPT") {
    return {
      completedWeight: obligationWeight,
      scoredSum: 0,
      scoredWeight: 0,
      isComplete: true,
    };
  }

  if (relevantSubItems.length > 0) {
    const subItemContribution = contributionFromWeightedParts(
      obligationWeight,
      relevantSubItems,
      grade.subItemScores,
      () => resolveObligationGradeScore(obligation, grade, { studentGradeYear })
    );
    if (subItemContribution) return subItemContribution;
  } else if (allSubItems.length > 0) {
    // כל תתי-המטלות בעתיד — לא נספרות להתקדמות הנוכחית
    return { ...empty, isComplete: true };
  }

  const components = normalizeComponents(obligation.components ?? []);
  if (hasSeparateComponentGrades(components)) {
    const componentContribution = contributionFromWeightedParts(
      obligationWeight,
      components,
      grade.componentScores,
      () => calcPartialWeightedItemScore(components, grade.componentScores)
    );
    if (componentContribution) return componentContribution;
  }

  const score = resolveProgressScore(obligation, grade, studentGradeYear);
  if (score != null) {
    return {
      completedWeight: obligationWeight,
      scoredSum: score * (obligationWeight / 100),
      scoredWeight: obligationWeight,
      isComplete: true,
    };
  }

  if (grade.status === "SUBMITTED") {
    return {
      completedWeight: obligationWeight * 0.5,
      scoredSum: 0,
      scoredWeight: 0,
      isComplete: false,
    };
  }

  return empty;
}

export function obligationDisplayLabel(ob: {
  name: string | null;
  questionnaireNumber: string | null;
}): string {
  const parts: string[] = [];
  if (ob.name) parts.push(ob.name);
  if (ob.questionnaireNumber) parts.push(`שאלון ${ob.questionnaireNumber}`);
  return parts.length > 0 ? parts.join(" — ") : "חובה";
}

export function matrixTaskLabel(ob: {
  name: string | null;
  questionnaireNumber: string | null;
  taskName: string;
}): string {
  const parts: string[] = [];
  if (ob.questionnaireNumber) parts.push(`שאלון ${ob.questionnaireNumber}`);
  else if (ob.name) parts.push(ob.name);
  parts.push(ob.taskName);
  return parts.length > 0 ? parts.join(" — ") : ob.taskName;
}

export type MatrixTaskOption = {
  id: string;
  taskKind: MatrixTaskKind;
  sortOrder: number;
  taskName: string;
  questionnaireNumber: string | null;
  name: string | null;
  relevantStudentCount: number;
  label: string;
};

function disambiguateTaskName(name: string, weightPercent: number, duplicate: boolean): string {
  return duplicate ? `${name} (${weightPercent}%)` : name;
}

function expandWeightedMatrixTasks(
  ob: {
    id: string;
    name: string | null;
    questionnaireNumber: string | null;
    examType: string;
  },
  items: WeightedItemLike[],
  taskKind: MatrixTaskKind,
  relevantStudentCount: number
): MatrixTaskOption[] {
  const nameCounts = new Map<string, number>();
  for (const item of items) {
    const name = item.name ?? "ציון";
    nameCounts.set(name, (nameCounts.get(name) ?? 0) + 1);
  }

  const usedNames = new Set<string>();

  return items.map((item, index) => {
    const baseName = item.name ?? "ציון";
    let taskName = disambiguateTaskName(
      baseName,
      item.weightPercent,
      (nameCounts.get(baseName) ?? 0) > 1
    );
    if (usedNames.has(taskName)) {
      taskName = `${taskName} — ${index + 1}`;
    }
    usedNames.add(taskName);
    return {
      id: ob.id,
      taskKind,
      sortOrder: item.sortOrder,
      taskName,
      questionnaireNumber: ob.questionnaireNumber,
      name: ob.name,
      relevantStudentCount,
      label: matrixTaskLabel({
        name: ob.name,
        questionnaireNumber: ob.questionnaireNumber,
        taskName,
      }),
    };
  });
}

export function expandObligationMatrixTasks(
  ob: {
    id: string;
    name: string | null;
    questionnaireNumber: string | null;
    examType: string;
    components: Array<{ name: string; weightPercent: number; sortOrder?: number }>;
    subItems: Array<{ name: string; weightPercent: number; sortOrder?: number }>;
  },
  relevantStudentCount: number
): MatrixTaskOption[] {
  const subItems = normalizeSubItems(ob.subItems);
  if (subItems.length > 0) {
    return expandWeightedMatrixTasks(ob, subItems, "subItem", relevantStudentCount);
  }

  const components =
    ob.components.length > 0
      ? normalizeComponents(ob.components)
      : [{ name: "ציון", weightPercent: 100, sortOrder: 0 }];

  if (components.length === 1) {
    const only = components[0]!;
    return [
      {
        id: ob.id,
        taskKind: "single",
        sortOrder: only.sortOrder,
        taskName: only.name ?? "ציון",
        questionnaireNumber: ob.questionnaireNumber,
        name: ob.name,
        relevantStudentCount,
        label: matrixTaskLabel({
          name: ob.name,
          questionnaireNumber: ob.questionnaireNumber,
          taskName: only.name ?? "ציון",
        }),
      },
    ];
  }

  return expandWeightedMatrixTasks(ob, components, "component", relevantStudentCount);
}

export function makeMatrixTaskKey(
  obligationId: string,
  taskKind: MatrixTaskKind,
  sortOrder: number
): string {
  return `${obligationId}:${taskKind}:${sortOrder}`;
}

export function parseMatrixTaskKey(taskKey: string): {
  obligationId: string;
  taskKind: MatrixTaskKind;
  sortOrder: number;
} | null {
  const parts = taskKey.split(":");
  if (parts.length !== 3) return null;
  const [obligationId, taskKindRaw, sortOrderRaw] = parts;
  if (!obligationId || !taskKindRaw || sortOrderRaw == null) return null;
  if (taskKindRaw !== "subItem" && taskKindRaw !== "component" && taskKindRaw !== "single") {
    return null;
  }
  const sortOrder = Number(sortOrderRaw);
  if (isNaN(sortOrder)) return null;
  return { obligationId, taskKind: taskKindRaw, sortOrder };
}

export function validateScoreMap(
  scores: Record<number, number | null> | null | undefined
): boolean {
  if (!scores) return true;
  for (const score of Object.values(scores)) {
    if (score != null && (typeof score !== "number" || isNaN(score) || score < 0 || score > 100)) {
      return false;
    }
  }
  return true;
}

export const validateComponentScores = validateScoreMap;
export const validateSubItemScores = validateScoreMap;

export function resolveGradeScore(
  components: WeightedItemLike[],
  score: number | null | undefined,
  componentScores: Record<number, number | null> | null | undefined
): number | null {
  if (hasSeparateComponentGrades(components)) {
    return calcWeightedComponentScore(components, componentScores);
  }
  return score ?? null;
}

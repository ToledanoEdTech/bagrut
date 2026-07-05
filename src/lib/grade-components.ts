import type { ObligationComponent, ObligationSubItem } from "@/lib/types";

type WeightedItemLike = Pick<ObligationComponent, "weightPercent" | "sortOrder"> & {
  name?: string;
};

export type MatrixTaskKind = "subItem" | "component" | "single";

export function normalizeWeightedItems(
  items: Array<{ weightPercent: number; sortOrder?: number; name?: string }>
): WeightedItemLike[] {
  return items.map((item, i) => ({
    weightPercent: item.weightPercent,
    sortOrder: item.sortOrder ?? i,
    name: item.name,
  }));
}

export function normalizeComponents(
  components: Array<{ weightPercent: number; sortOrder?: number; name?: string }>
): WeightedItemLike[] {
  return normalizeWeightedItems(components);
}

export function normalizeSubItems(
  subItems: Array<{ weightPercent: number; sortOrder?: number; name?: string }>
): WeightedItemLike[] {
  return normalizeWeightedItems(subItems);
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

export const calcWeightedComponentScore = calcWeightedItemScore;
export const calcWeightedSubItemScore = calcWeightedItemScore;

export function resolveObligationGradeScore(
  obligation: {
    components: Array<{ weightPercent: number; sortOrder?: number; name?: string }>;
    subItems: Array<{ weightPercent: number; sortOrder?: number; name?: string }>;
  },
  grade: {
    score?: number | null;
    componentScores?: Record<number, number | null> | null;
    subItemScores?: Record<number, number | null> | null;
  }
): number | null {
  const subItems = normalizeSubItems(obligation.subItems);
  if (subItems.length > 0) {
    return calcWeightedSubItemScore(subItems, grade.subItemScores);
  }
  const components = normalizeComponents(obligation.components);
  if (hasSeparateComponentGrades(components)) {
    return calcWeightedComponentScore(components, grade.componentScores);
  }
  return grade.score ?? null;
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

export function calcSubjectProgress(
  obligations: Array<{ id: string; weightPercent: number }>,
  grades: Array<{ obligationId: string; score: number | null; status: string }>
) {
  const gradeMap = new Map(grades.map((g) => [g.obligationId, g]));
  let completedWeight = 0;
  let scoredSum = 0;
  let scoredWeight = 0;

  for (const o of obligations) {
    const g = gradeMap.get(o.id);
    if (g && (g.status === "GRADED" || g.status === "SUBMITTED") && g.score != null) {
      completedWeight += o.weightPercent;
      scoredSum += g.score * (o.weightPercent / 100);
      scoredWeight += o.weightPercent;
    } else if (g && g.status === "SUBMITTED") {
      completedWeight += o.weightPercent * 0.5;
    }
  }

  const totalWeight = obligations.reduce((s, o) => s + o.weightPercent, 0);
  const progressPercent = totalWeight > 0 ? (completedWeight / totalWeight) * 100 : 0;
  const estimatedGrade = scoredWeight > 0 ? (scoredSum / scoredWeight) * 100 : null;

  return { progressPercent, estimatedGrade, completedWeight, totalWeight };
}

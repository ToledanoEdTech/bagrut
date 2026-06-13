import { resolveObligationGradeScore } from "@/lib/grade-components";

type ProgressObligation = {
  id: string;
  weightPercent: number;
  components: Array<{ weightPercent: number; sortOrder?: number; name?: string }>;
  subItems: Array<{ weightPercent: number; sortOrder?: number; name?: string }>;
};

type ProgressGrade = {
  obligationId: string;
  score?: number | null;
  componentScores?: Record<number, number | null> | null;
  subItemScores?: Record<number, number | null> | null;
  status: string;
};

/**
 * Resolves each grade's effective score from its components/sub-items before
 * computing subject progress. The top-level `score` field on a grade can be
 * stale for obligations that are graded via weighted components or sub-items,
 * so the estimated grade must always be derived from the resolved score.
 *
 * Use this everywhere the estimated grade ("ציון משוער") is shown so all
 * surfaces (student card, grade entry, dashboards) stay consistent.
 */
export function calcSubjectProgressForObligations(
  obligations: ProgressObligation[],
  grades: ProgressGrade[]
) {
  const obligationById = new Map(obligations.map((o) => [o.id, o]));
  const resolvedGrades = grades.map((g) => {
    const obligation = obligationById.get(g.obligationId);
    const score = obligation
      ? resolveObligationGradeScore(obligation, g)
      : (g.score ?? null);
    return { obligationId: g.obligationId, score, status: g.status };
  });
  return calcSubjectProgress(obligations, resolvedGrades);
}

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

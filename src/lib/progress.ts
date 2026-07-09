import {
  calcObligationProgressContribution,
} from "@/lib/grade-components";

type ProgressObligation = {
  id: string;
  weightPercent: number;
  gradeYear?: string | null;
  components: Array<{ weightPercent: number; sortOrder?: number; name?: string }>;
  subItems: Array<{
    weightPercent: number;
    sortOrder?: number;
    name?: string;
    gradeYear?: string | null;
  }>;
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
 * Progress and grade are always computed over the **entire subject** (all
 * bagrut obligations), not only the current year's due tasks.
 * "ציון סופי" only when every obligation is complete; otherwise "ציון ביניים".
 *
 * The optional `studentGradeYear` argument is kept for call-site compatibility
 * but is ignored — year filtering belongs in UI timing badges, not in the
 * bagrut grade / progress math.
 */
export function calcSubjectProgressForObligations(
  obligations: ProgressObligation[],
  grades: ProgressGrade[],
  _studentGradeYear?: string | null
) {
  const gradeByObligationId = new Map(grades.map((g) => [g.obligationId, g]));
  return calcSubjectProgress(obligations, gradeByObligationId);
}

export function calcSubjectProgress(
  obligations: ProgressObligation[],
  gradeByObligationId: Map<string, ProgressGrade>,
  /** @deprecated Ignored — progress is always full-subject. */
  _studentGradeYear?: string | null
) {
  let completedWeight = 0;
  let scoredSum = 0;
  let scoredWeight = 0;

  // "ציון סופי" = כל מטלות המקצוע (בגרות) הושלמו ויש ציון מלא; אחרת "ציון ביניים".
  let allFinal = obligations.length > 0;

  for (const obligation of obligations) {
    const grade = gradeByObligationId.get(obligation.id);
    // undefined year → full obligation weight / all sub-items
    const contribution = calcObligationProgressContribution(
      obligation,
      grade,
      undefined
    );

    completedWeight += contribution.completedWeight;
    scoredSum += contribution.scoredSum;
    scoredWeight += contribution.scoredWeight;

    if (!grade) {
      allFinal = false;
    } else if (grade.status === "EXEMPT") {
      // פטור נחשב מושלם ואינו דורש ציון
    } else if (contribution.isComplete) {
      // מושלם
    } else {
      allFinal = false;
    }
  }

  const totalWeight = obligations.reduce((s, o) => s + o.weightPercent, 0);
  const progressPercent = totalWeight > 0 ? (completedWeight / totalWeight) * 100 : 0;
  const estimatedGrade = scoredWeight > 0 ? (scoredSum / scoredWeight) * 100 : null;
  const isFinal = allFinal && estimatedGrade != null;

  return { progressPercent, estimatedGrade, isFinal, completedWeight, totalWeight };
}

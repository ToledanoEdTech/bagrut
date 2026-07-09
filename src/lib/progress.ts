import {
  calcObligationProgressContribution,
  selectRelevantSubItems,
} from "@/lib/grade-components";
import { filterObligationsDueForStudent } from "@/lib/grade-year";

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

function relevantObligationWeight(
  obligation: ProgressObligation,
  studentGradeYear?: string | null
): number {
  const subItems = obligation.subItems ?? [];
  if (subItems.length === 0 || studentGradeYear === undefined) {
    return obligation.weightPercent;
  }
  const allW = subItems.reduce((sum, i) => sum + i.weightPercent, 0);
  if (allW <= 0) return obligation.weightPercent;
  const due = selectRelevantSubItems(subItems, obligation.gradeYear, studentGradeYear);
  const dueW = due.reduce((sum, i) => sum + i.weightPercent, 0);
  return obligation.weightPercent * (dueW / allW);
}

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
  grades: ProgressGrade[],
  studentGradeYear?: string | null
) {
  const relevantObligations =
    studentGradeYear !== undefined
      ? filterObligationsDueForStudent(obligations, studentGradeYear)
      : obligations;
  const gradeByObligationId = new Map(grades.map((g) => [g.obligationId, g]));
  return calcSubjectProgress(relevantObligations, gradeByObligationId, studentGradeYear);
}

export function calcSubjectProgress(
  obligations: ProgressObligation[],
  gradeByObligationId: Map<string, ProgressGrade>,
  studentGradeYear?: string | null
) {
  let completedWeight = 0;
  let scoredSum = 0;
  let scoredWeight = 0;

  // "ציון סופי" = כל המטלות הרלוונטיות הוגשו/נבדקו/פטורות, ולכל מטלה שאינה פטורה יש ציון מלא.
  let allFinal = obligations.length > 0;

  for (const obligation of obligations) {
    const grade = gradeByObligationId.get(obligation.id);
    const contribution = calcObligationProgressContribution(
      obligation,
      grade,
      studentGradeYear
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

  const totalWeight = obligations.reduce(
    (s, o) => s + relevantObligationWeight(o, studentGradeYear),
    0
  );
  const progressPercent = totalWeight > 0 ? (completedWeight / totalWeight) * 100 : 0;
  const estimatedGrade = scoredWeight > 0 ? (scoredSum / scoredWeight) * 100 : null;
  const isFinal = allFinal && estimatedGrade != null;

  return { progressPercent, estimatedGrade, isFinal, completedWeight, totalWeight };
}

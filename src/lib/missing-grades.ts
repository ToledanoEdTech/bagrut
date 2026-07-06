import { resolveObligationGradeScore } from "@/lib/grade-components";
import { isFailingGradeScore } from "@/lib/grade-status";
import { formatSubjectDisplayName } from "@/lib/subject-display";

type ObligationLike = {
  id: string;
  name: string | null;
  examEvent: string | null;
  questionnaireNumber: string | null;
  components?: Array<{ weightPercent: number; sortOrder?: number; name?: string }>;
  subItems?: Array<{ weightPercent: number; sortOrder?: number; name?: string }>;
};

type GradeLike = {
  obligationId: string;
  score?: number | null;
  componentScores?: Record<number, number | null> | null;
  subItemScores?: Record<number, number | null> | null;
  status: string;
};

type SubjectLike = {
  id: string;
  name: string;
  pathLabels?: string[];
  category?: string | null;
  units?: number | null;
  obligations: ObligationLike[];
  grades: GradeLike[];
};

export type MissingGradeEntry = {
  subjectId: string;
  subjectLabel: string;
  obligationId: string;
  obligationLabel: string;
};

export type NegativeGradeEntry = MissingGradeEntry & {
  score: number;
};

export function formatObligationLabel(obligation: ObligationLike): string {
  const base = obligation.name || obligation.examEvent || "חובה";
  if (obligation.questionnaireNumber) {
    return `${base} (שאלון ${obligation.questionnaireNumber})`;
  }
  return base;
}

function isGradedStatus(status: string): boolean {
  return status === "GRADED" || status === "SUBMITTED";
}

export function getNegativeGradeScore(
  obligation: ObligationLike,
  grade: GradeLike | undefined
): number | null {
  if (!grade || grade.status === "EXEMPT" || grade.status === "MISSING") return null;
  if (!isGradedStatus(grade.status)) return null;

  const resolved = resolveObligationGradeScore(
    { components: obligation.components ?? [], subItems: obligation.subItems ?? [] },
    grade
  );
  if (!isFailingGradeScore(resolved)) return null;
  return resolved;
}

export function isNegativeGradeEntry(
  obligation: ObligationLike,
  grade: GradeLike | undefined
): boolean {
  return getNegativeGradeScore(obligation, grade) != null;
}

export function collectMissingGrades(subjects: SubjectLike[]): MissingGradeEntry[] {
  const entries: MissingGradeEntry[] = [];

  for (const subject of subjects) {
    const subjectLabel = formatSubjectDisplayName(subject.name, {
      pathLabels: subject.pathLabels,
      units: subject.units,
      category: subject.category,
    });

    for (const grade of subject.grades) {
      if (grade.status !== "MISSING") continue;
      const obligation = subject.obligations.find((o) => o.id === grade.obligationId);
      if (!obligation) continue;
      entries.push({
        subjectId: subject.id,
        subjectLabel,
        obligationId: obligation.id,
        obligationLabel: formatObligationLabel(obligation),
      });
    }
  }

  return entries;
}

export function collectNegativeGrades(subjects: SubjectLike[]): NegativeGradeEntry[] {
  const entries: NegativeGradeEntry[] = [];

  for (const subject of subjects) {
    const subjectLabel = formatSubjectDisplayName(subject.name, {
      pathLabels: subject.pathLabels,
      units: subject.units,
      category: subject.category,
    });

    for (const obligation of subject.obligations) {
      const grade = subject.grades.find((g) => g.obligationId === obligation.id);
      const negativeScore = getNegativeGradeScore(obligation, grade);
      if (negativeScore == null) continue;
      entries.push({
        subjectId: subject.id,
        subjectLabel,
        obligationId: obligation.id,
        obligationLabel: formatObligationLabel(obligation),
        score: negativeScore,
      });
    }
  }

  return entries;
}

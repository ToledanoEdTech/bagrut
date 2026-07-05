import { formatSubjectDisplayName } from "@/lib/subject-display";

type ObligationLike = {
  id: string;
  name: string | null;
  examEvent: string | null;
  questionnaireNumber: string | null;
};

type SubjectLike = {
  id: string;
  name: string;
  pathLabels?: string[];
  category?: string | null;
  units?: number | null;
  obligations: ObligationLike[];
  grades: Array<{ obligationId: string; status: string }>;
};

export type MissingGradeEntry = {
  subjectId: string;
  subjectLabel: string;
  obligationId: string;
  obligationLabel: string;
};

export function formatObligationLabel(obligation: ObligationLike): string {
  const base = obligation.name || obligation.examEvent || "חובה";
  if (obligation.questionnaireNumber) {
    return `${base} (שאלון ${obligation.questionnaireNumber})`;
  }
  return base;
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

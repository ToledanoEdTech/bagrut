import type { ExamPath } from "@/lib/types";

export type SubjectPathLink = {
  path: { id?: string; label: string; key?: string };
};

export function getPathLabels(pathLinks?: SubjectPathLink[] | null): string[] {
  if (!pathLinks?.length) return [];
  return [...new Set(pathLinks.map((link) => link.path.label))].sort((a, b) =>
    a.localeCompare(b, "he")
  );
}

export function formatSubjectDisplayName(
  name: string,
  pathLabels?: string[] | null
): string {
  if (!pathLabels?.length) return name;
  return `${name} (${pathLabels.join(", ")})`;
}

export function formatSubjectWithPathLinks(
  name: string,
  pathLinks?: SubjectPathLink[] | null
): string {
  return formatSubjectDisplayName(name, getPathLabels(pathLinks));
}

export function buildPathLabelsBySubjectId(
  paths: Array<Pick<ExamPath, "id" | "label" | "key" | "subjectIds">>
): Map<string, string[]> {
  const map = new Map<string, string[]>();

  for (const path of paths) {
    if (path.key === "flexible") continue;
    for (const subjectId of path.subjectIds) {
      const labels = map.get(subjectId) ?? [];
      if (!labels.includes(path.label)) labels.push(path.label);
      map.set(subjectId, labels);
    }
  }

  for (const [subjectId, labels] of map) {
    map.set(
      subjectId,
      [...labels].sort((a, b) => a.localeCompare(b, "he"))
    );
  }

  return map;
}

export function attachPathLabels<T extends { id: string; name: string }>(
  subjects: T[],
  pathLabelsBySubjectId: Map<string, string[]>
): Array<T & { pathLabels: string[]; displayName: string }> {
  return subjects.map((subject) => {
    const pathLabels = pathLabelsBySubjectId.get(subject.id) ?? [];
    return {
      ...subject,
      pathLabels,
      displayName: formatSubjectDisplayName(subject.name, pathLabels),
    };
  });
}

export function attachPathLabelsFromLinks<T extends { id: string; name: string }>(
  subjects: T[],
  pathLinksBySubjectId: Map<string, SubjectPathLink[]>
): Array<T & { pathLabels: string[]; displayName: string }> {
  return subjects.map((subject) => {
    const pathLabels = getPathLabels(pathLinksBySubjectId.get(subject.id));
    return {
      ...subject,
      pathLabels,
      displayName: formatSubjectDisplayName(subject.name, pathLabels),
    };
  });
}

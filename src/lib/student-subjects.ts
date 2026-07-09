import {
  ensureSocialInvolvementSubject,
  getClassById,
  getExamPathById,
  getStudentTrackIds,
  listSubjects,
  listTracks,
} from "@/lib/firestore";
import type { ExamPath, Student, Subject, Track } from "@/lib/types";

export type SubjectWithObligations = Subject;

export type StudentWithRelations = Student & {
  class: { examPathId: string; name: string; gradeYear: string | null };
};

export type SubjectContext = {
  allSubjects: Subject[];
  tracksById: Map<string, Track>;
};

export { calcSubjectProgress } from "@/lib/progress";

export async function loadSubjectContext(): Promise<SubjectContext> {
  const [allSubjects, tracks] = await Promise.all([listSubjects(), listTracks()]);
  return {
    allSubjects,
    tracksById: new Map(tracks.map((track) => [track.id, track])),
  };
}

export function resolveRelevantSubjects(
  student: StudentWithRelations,
  allSubjects: Subject[],
  examPath: ExamPath | null,
  tracksById: Map<string, Track>
): SubjectWithObligations[] {
  if (!examPath) return [];

  const subjectById = new Map(allSubjects.map((s) => [s.id, s]));
  const pathSubjects = examPath.subjectIds
    .map((id) => subjectById.get(id))
    .filter(Boolean) as Subject[];

  const pathMandatory = pathSubjects.filter((s) => s.category === "MANDATORY");
  const mandatoryById = new Map(
    allSubjects.filter((s) => s.category === "MANDATORY").map((s) => [s.id, s])
  );
  const mandatory =
    student.mandatorySubjectIds === undefined || student.mandatorySubjectIds === null
      ? pathMandatory
      : (student.mandatorySubjectIds
          .map((id) => mandatoryById.get(id))
          .filter(Boolean) as Subject[]);

  const math = allSubjects.find(
    (s) => s.category === "MATH" && s.units === student.mathUnits
  );
  const english = allSubjects.find(
    (s) => s.category === "ENGLISH" && s.units === student.englishUnits
  );

  // מעורבות חברתית — מקצוע חובה לכל תלמיד (לא תלוי בתוכנית בחינות)
  const social =
    allSubjects.find((s) => s.category === "SOCIAL") ??
    pathSubjects.find((s) => s.category === "SOCIAL") ??
    allSubjects.find((s) => s.name.trim() === "מעורבות חברתית");

  const trackIds = getStudentTrackIds(student);
  const trackSubjects: Subject[] = [];
  for (const trackId of trackIds) {
    let trackSubject =
      allSubjects.find(
        (s) => s.category === "TRACK" && s.trackId === trackId
      ) ?? null;

    if (!trackSubject) {
      const track = tracksById.get(trackId);
      if (track) {
        trackSubject =
          allSubjects.find(
            (s) =>
              s.category === "TRACK" &&
              s.name.includes(track.name.split(" ")[0]!)
          ) ?? null;
      }
    }

    if (trackSubject) trackSubjects.push(trackSubject);
  }

  const all: Subject[] = [
    ...mandatory,
    ...(math ? [math] : []),
    ...(english ? [english] : []),
    ...trackSubjects,
    ...(social ? [social] : []),
  ];

  const seen = new Set<string>();
  return all.filter((s) => {
    if (seen.has(s.id)) return false;
    seen.add(s.id);
    return true;
  });
}

export async function getRelevantSubjects(
  student: StudentWithRelations
): Promise<SubjectWithObligations[]> {
  await ensureSocialInvolvementSubject();
  const [examPath, ctx] = await Promise.all([
    getExamPathById(student.class.examPathId),
    loadSubjectContext(),
  ]);
  return resolveRelevantSubjects(
    student,
    ctx.allSubjects,
    examPath,
    ctx.tracksById
  );
}

export async function buildStudentWithRelations(
  student: Student
): Promise<StudentWithRelations> {
  const cls = await getClassById(student.classId);
  return {
    ...student,
    class: {
      examPathId: cls?.examPathId ?? "",
      name: cls?.name ?? "",
      gradeYear: cls?.gradeYear ?? null,
    },
  };
}

export async function resolveMandatorySubjectIdsForClass(
  classId: string,
  mandatorySubjectIds: string[] | null | undefined
): Promise<string[] | undefined> {
  if (mandatorySubjectIds === undefined) return undefined;
  if (mandatorySubjectIds === null) return undefined;
  if (mandatorySubjectIds.length === 0) return [];

  const cls = await getClassById(classId);
  if (!cls) {
    throw new Error("כיתה לא נמצאה");
  }

  const examPath = await getExamPathById(cls.examPathId);
  if (!examPath) {
    throw new Error("תוכנית חובה לא נמצאה");
  }

  const allSubjects = await listSubjects();
  const mandatoryById = new Map(
    allSubjects.filter((s) => s.category === "MANDATORY").map((s) => [s.id, s])
  );

  const invalid = mandatorySubjectIds.filter((id) => !mandatoryById.has(id));
  if (invalid.length > 0) {
    throw new Error("מקצועות חובה לא תקינים");
  }

  const pathMandatoryIds = examPath.subjectIds.filter((id) => mandatoryById.has(id));
  const selected = mandatorySubjectIds.filter((id) => mandatoryById.has(id));
  if (
    selected.length === pathMandatoryIds.length &&
    pathMandatoryIds.every((id) => selected.includes(id))
  ) {
    return undefined;
  }

  return selected;
}

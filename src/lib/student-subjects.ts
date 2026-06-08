import {
  getClassById,
  getExamPathById,
  getStudentTrackIds,
  getTrackById,
  listSubjects,
} from "@/lib/firestore";
import type { Student, Subject } from "@/lib/types";

export type SubjectWithObligations = Subject;

export type StudentWithRelations = Student & {
  class: { examPathId: string; name: string; gradeYear: string | null };
};

export { calcSubjectProgress } from "@/lib/progress";

export async function getRelevantSubjects(
  student: StudentWithRelations
): Promise<SubjectWithObligations[]> {
  const [examPath, allSubjects] = await Promise.all([
    getExamPathById(student.class.examPathId),
    listSubjects(),
  ]);
  if (!examPath) return [];

  const subjectById = new Map(allSubjects.map((s) => [s.id, s]));
  const pathSubjects = examPath.subjectIds
    .map((id) => subjectById.get(id))
    .filter(Boolean) as Subject[];

  const mandatory = pathSubjects.filter((s) => s.category === "MANDATORY");

  const math = allSubjects.find(
    (s) => s.category === "MATH" && s.units === student.mathUnits
  );
  const english = allSubjects.find(
    (s) => s.category === "ENGLISH" && s.units === student.englishUnits
  );

  const trackIds = getStudentTrackIds(student);
  const trackSubjects: Subject[] = [];
  for (const trackId of trackIds) {
    let trackSubject =
      allSubjects.find(
        (s) => s.category === "TRACK" && s.trackId === trackId
      ) ?? null;

    if (!trackSubject) {
      const track = await getTrackById(trackId);
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
  ];

  const seen = new Set<string>();
  return all.filter((s) => {
    if (seen.has(s.id)) return false;
    seen.add(s.id);
    return true;
  });
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

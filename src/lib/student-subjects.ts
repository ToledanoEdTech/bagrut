import {
  getClassById,
  getExamPathById,
  getSubjectById,
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
  const examPath = await getExamPathById(student.class.examPathId);
  if (!examPath) return [];

  const pathSubjects = (
    await Promise.all(examPath.subjectIds.map(getSubjectById))
  ).filter(Boolean) as Subject[];

  const mandatory = pathSubjects.filter((s) => s.category === "MANDATORY");
  const allSubjects = await listSubjects();

  const math = allSubjects.find(
    (s) => s.category === "MATH" && s.units === student.mathUnits
  );
  const english = allSubjects.find(
    (s) => s.category === "ENGLISH" && s.units === student.englishUnits
  );

  let trackSubject: Subject | null = null;
  if (student.trackId) {
    trackSubject =
      allSubjects.find(
        (s) => s.category === "TRACK" && s.trackId === student.trackId
      ) ?? null;

    if (!trackSubject) {
      const track = await getTrackById(student.trackId);
      if (track) {
        trackSubject =
          allSubjects.find(
            (s) =>
              s.category === "TRACK" &&
              s.name.includes(track.name.split(" ")[0]!)
          ) ?? null;
      }
    }
  }

  const all: Subject[] = [
    ...mandatory,
    ...(math ? [math] : []),
    ...(english ? [english] : []),
    ...(trackSubject ? [trackSubject] : []),
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

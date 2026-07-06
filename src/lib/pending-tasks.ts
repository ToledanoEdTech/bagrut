import {
  getGradeEntryTargets,
  getIsraelYmd,
  isTargetIncomplete,
} from "@/lib/grade-reminders";
import { STATUS_LABELS } from "@/lib/grade-status";
import {
  getAllowedClassIds,
  getAllowedSubjectIds,
  isFullAdmin,
} from "@/lib/permissions";
import { formatSubjectDisplayName } from "@/lib/subject-display";
import { resolveRelevantSubjects, type StudentWithRelations } from "@/lib/student-subjects";
import type { AuthSession, Class, ExamPath, Grade, Student, Subject, Track } from "@/lib/types";
import {
  listAllGrades,
  listClasses,
  listExamPaths,
  listStudents,
  listSubjects,
  listTracks,
} from "@/lib/firestore";

export type PendingTaskEntry = {
  studentId: string;
  studentName: string;
  classId: string;
  className: string;
  gradeYear: string | null;
  subjectId: string;
  subjectLabel: string;
  obligationId: string;
  taskLabel: string;
  dueDate: string;
  statusLabel: string;
  isOverdue: boolean;
};

export type PendingTasksGroupBy = "gradeYear" | "class" | "subject" | "student";

export type PendingTasksFilter = {
  groupBy: PendingTasksGroupBy;
  gradeYear?: string;
  classId?: string;
  subjectId?: string;
  studentId?: string;
};

type PendingTasksInput = {
  subjects: Subject[];
  students: Student[];
  classes: Class[];
  examPaths: ExamPath[];
  tracks: Track[];
  grades: Grade[];
  today?: string;
};

function withClass(student: Student, cls: Class): StudentWithRelations {
  return {
    ...student,
    class: {
      examPathId: cls.examPathId,
      name: cls.name,
      gradeYear: cls.gradeYear,
    },
  };
}

function buildGradeMap(grades: Grade[]): Map<string, Grade> {
  const map = new Map<string, Grade>();
  for (const g of grades) {
    map.set(`${g.studentId}::${g.obligationId}`, g);
  }
  return map;
}

function gradeStatusLabel(grade: Grade | undefined): string {
  if (!grade) return STATUS_LABELS.NOT_STARTED.label;
  if (grade.status in STATUS_LABELS) {
    return STATUS_LABELS[grade.status as keyof typeof STATUS_LABELS].label;
  }
  return grade.status;
}

function filterStudentsForScope(
  session: AuthSession,
  students: Student[],
  classes: Class[],
  subjects: Subject[],
  examPaths: ExamPath[],
  tracks: Track[]
): Student[] {
  if (isFullAdmin(session)) return students;

  const classById = new Map(classes.map((c) => [c.id, c]));
  const examPathById = new Map(examPaths.map((p) => [p.id, p]));
  const tracksById = new Map(tracks.map((t) => [t.id, t]));

  const allowedSubjectIds = getAllowedSubjectIds(session);
  if (allowedSubjectIds !== null) {
    const allowed = new Set(allowedSubjectIds);
    return students.filter((student) => {
      const cls = classById.get(student.classId);
      if (!cls) return false;
      const relevant = resolveRelevantSubjects(
        withClass(student, cls),
        subjects,
        examPathById.get(cls.examPathId) ?? null,
        tracksById
      );
      return relevant.some((s) => allowed.has(s.id));
    });
  }

  const allowedClassIds = getAllowedClassIds(session, classes);
  if (allowedClassIds === null) return students;

  const allowed = new Set(allowedClassIds);
  return students.filter((s) => allowed.has(s.classId));
}

function filterSubjectsForScope(session: AuthSession, subjects: Subject[]): Subject[] {
  const allowedSubjectIds = getAllowedSubjectIds(session);
  if (allowedSubjectIds === null) return subjects;
  const allowed = new Set(allowedSubjectIds);
  return subjects.filter((s) => allowed.has(s.id));
}

export function collectPendingTasks(
  input: PendingTasksInput,
  filter: PendingTasksFilter
): PendingTaskEntry[] {
  const today = input.today ?? getIsraelYmd();
  const classById = new Map(input.classes.map((c) => [c.id, c]));
  const examPathById = new Map(input.examPaths.map((p) => [p.id, p]));
  const tracksById = new Map(input.tracks.map((t) => [t.id, t]));
  const gradeMap = buildGradeMap(input.grades);
  const entries: PendingTaskEntry[] = [];

  let students = input.students.filter((s) => classById.has(s.classId));

  if (filter.groupBy === "student" && filter.studentId) {
    students = students.filter((s) => s.id === filter.studentId);
  } else if (filter.groupBy === "class" && filter.classId) {
    students = students.filter((s) => s.classId === filter.classId);
  } else if (filter.groupBy === "gradeYear" && filter.gradeYear) {
    students = students.filter((s) => {
      const cls = classById.get(s.classId);
      return cls?.gradeYear === filter.gradeYear;
    });
  }

  for (const student of students) {
    const cls = classById.get(student.classId);
    if (!cls) continue;

    const withRelations = withClass(student, cls);
    const relevant = resolveRelevantSubjects(
      withRelations,
      input.subjects,
      examPathById.get(cls.examPathId) ?? null,
      tracksById
    );

    for (const subject of relevant) {
      if (filter.groupBy === "subject" && filter.subjectId && subject.id !== filter.subjectId) {
        continue;
      }

      const subjectLabel = formatSubjectDisplayName(subject.name, {
        units: subject.units,
        category: subject.category,
      });

      for (const obligation of subject.obligations) {
        const grade = gradeMap.get(`${student.id}::${obligation.id}`);
        const targets = getGradeEntryTargets(obligation);

        for (const target of targets) {
          if (!isTargetIncomplete(obligation, grade, target)) continue;

          entries.push({
            studentId: student.id,
            studentName: student.name,
            classId: cls.id,
            className: cls.name,
            gradeYear: cls.gradeYear,
            subjectId: subject.id,
            subjectLabel,
            obligationId: obligation.id,
            taskLabel: target.label,
            dueDate: target.dueDate,
            statusLabel: gradeStatusLabel(grade),
            isOverdue: target.dueDate < today,
          });
        }
      }
    }
  }

  entries.sort((a, b) => {
    const byDue = a.dueDate.localeCompare(b.dueDate);
    if (byDue !== 0) return byDue;
    const byClass = a.className.localeCompare(b.className, "he");
    if (byClass !== 0) return byClass;
    const byStudent = a.studentName.localeCompare(b.studentName, "he");
    if (byStudent !== 0) return byStudent;
    return a.subjectLabel.localeCompare(b.subjectLabel, "he");
  });

  return entries;
}

export type PendingTasksMeta = {
  entries: PendingTaskEntry[];
  total: number;
  overdueCount: number;
  studentCount: number;
  classCount: number;
};

export function summarizePendingTasks(entries: PendingTaskEntry[]): Omit<PendingTasksMeta, "entries"> {
  const studentIds = new Set(entries.map((e) => e.studentId));
  const classIds = new Set(entries.map((e) => e.classId));
  return {
    total: entries.length,
    overdueCount: entries.filter((e) => e.isOverdue).length,
    studentCount: studentIds.size,
    classCount: classIds.size,
  };
}

export async function getPendingTasksForSession(
  session: AuthSession,
  filter: PendingTasksFilter
): Promise<PendingTasksMeta> {
  const [subjects, students, classes, examPaths, tracks, grades] = await Promise.all([
    listSubjects(),
    listStudents(),
    listClasses(),
    listExamPaths(),
    listTracks(),
    listAllGrades(),
  ]);

  const scopedStudents = filterStudentsForScope(
    session,
    students,
    classes,
    subjects,
    examPaths,
    tracks
  );
  const scopedSubjects = filterSubjectsForScope(session, subjects);

  const entries = collectPendingTasks(
    {
      subjects: scopedSubjects,
      students: scopedStudents,
      classes,
      examPaths,
      tracks,
      grades,
    },
    filter
  );

  return {
    entries,
    ...summarizePendingTasks(entries),
  };
}

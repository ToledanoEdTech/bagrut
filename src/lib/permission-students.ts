import { getStudentById } from "@/lib/firestore";
import { buildStudentWithRelations, getRelevantSubjects } from "@/lib/student-subjects";
import type { AuthSession } from "@/lib/types";
import {
  getAllowedClassIds,
  getEffectivePermissions,
  isFullAdmin,
  type ResolvedPermissionContext,
} from "@/lib/permissions";
import { resolvePermissionContext } from "@/lib/permission-resolve";

function getSubjectIdsFromPermissions(
  session: AuthSession,
  actions: Array<"students:view" | "grades:write">
): string[] {
  const perms = getEffectivePermissions(session);
  const ids = new Set<string>();
  for (const action of actions) {
    for (const p of perms) {
      if (p.action === action && p.scope === "subject") {
        ids.add(p.subjectId);
      }
    }
  }
  return [...ids];
}

export async function studentHasRelevantSubject(
  studentId: string,
  subjectIds: string[]
): Promise<boolean> {
  if (subjectIds.length === 0) return false;
  const student = await getStudentById(studentId);
  if (!student) return false;
  const withRelations = await buildStudentWithRelations(student);
  const relevant = await getRelevantSubjects(withRelations);
  const allowed = new Set(subjectIds);
  return relevant.some((s) => allowed.has(s.id));
}

function matchesNonSubjectScope(
  perm: { scope: string; gradeYear?: string; classId?: string },
  ctx: ResolvedPermissionContext
): boolean {
  if (perm.scope === "all") return true;
  if (perm.scope === "class") return !!ctx.classId && ctx.classId === perm.classId;
  if (perm.scope === "gradeYear") {
    return !!ctx.gradeYear && ctx.gradeYear === perm.gradeYear;
  }
  return false;
}

export async function canViewStudentAccess(
  session: AuthSession,
  ctx: { studentId?: string; classId?: string; obligationId?: string }
): Promise<boolean> {
  if (isFullAdmin(session)) return true;
  if (session.role !== "TEACHER") return false;

  const resolved = await resolvePermissionContext(ctx);
  const perms = getEffectivePermissions(session);

  const viewPerms = perms.filter((p) => p.action === "students:view");
  if (viewPerms.some((p) => p.scope !== "subject" && matchesNonSubjectScope(p, resolved))) {
    return true;
  }

  const subjectIds = getSubjectIdsFromPermissions(session, ["students:view", "grades:write"]);
  if (subjectIds.length > 0 && ctx.studentId) {
    return studentHasRelevantSubject(ctx.studentId, subjectIds);
  }

  const gradePerms = perms.filter(
    (p) => p.action === "grades:write" && p.scope !== "subject"
  );
  if (gradePerms.some((p) => matchesNonSubjectScope(p, resolved))) {
    return true;
  }

  return false;
}

export async function filterStudentsForSession<
  T extends { id: string; class?: { id: string; gradeYear: string | null } | null },
>(session: AuthSession, students: T[]): Promise<T[]> {
  if (isFullAdmin(session)) return students;

  const subjectIds = getSubjectIdsFromPermissions(session, [
    "students:view",
    "grades:write",
  ]);

  if (subjectIds.length > 0) {
    const allowed: T[] = [];
    for (const student of students) {
      if (await studentHasRelevantSubject(student.id, subjectIds)) {
        allowed.push(student);
      }
    }
    return allowed;
  }

  const classRefs = students
    .filter((s) => s.class)
    .map((s) => ({ id: s.class!.id, gradeYear: s.class!.gradeYear }));

  const allowedClassIds = getAllowedClassIds(session, classRefs);
  if (allowedClassIds === null) return students;

  const allowed = new Set(allowedClassIds);
  return students.filter((s) => s.class && allowed.has(s.class.id));
}

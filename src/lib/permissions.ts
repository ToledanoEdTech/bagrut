import type { AuthSession, StaffPermission } from "@/lib/types";
import { isAdminEmail } from "@/lib/roles";

export type PermissionContext = {
  classId?: string;
  subjectId?: string;
  gradeYear?: string | null;
  obligationId?: string;
  studentId?: string;
};

export type ResolvedPermissionContext = {
  classId?: string;
  subjectId?: string;
  gradeYear?: string | null;
};

/** מורים קיימים ללא permissions — תאימות לאחור */
export const LEGACY_TEACHER_PERMISSIONS: StaffPermission[] = [
  { action: "grades:write", scope: "all" },
  { action: "students:view", scope: "all" },
];

export function isFullAdmin(session: Pick<AuthSession, "email" | "role">): boolean {
  return isAdminEmail(session.email) || session.role === "ADMIN";
}

export function getEffectivePermissions(session: AuthSession): StaffPermission[] {
  if (isFullAdmin(session)) return LEGACY_TEACHER_PERMISSIONS;
  if (session.role !== "TEACHER") return [];
  if (session.permissions === undefined) return LEGACY_TEACHER_PERMISSIONS;
  return session.permissions;
}

function matchesScope(
  perm: StaffPermission,
  ctx: ResolvedPermissionContext
): boolean {
  if (perm.scope === "all") return true;
  if (perm.scope === "class") return !!ctx.classId && ctx.classId === perm.classId;
  if (perm.scope === "gradeYear") {
    return !!ctx.gradeYear && ctx.gradeYear === perm.gradeYear;
  }
  if (perm.scope === "subject") {
    if (perm.action === "grades:write" && !ctx.subjectId) {
      return true;
    }
    return !!ctx.subjectId && ctx.subjectId === perm.subjectId;
  }
  return false;
}

function hasGradesWrite(
  session: AuthSession,
  ctx: ResolvedPermissionContext
): boolean {
  if (isFullAdmin(session)) return true;
  if (session.role !== "TEACHER") return false;
  const perms = getEffectivePermissions(session).filter((p) => p.action === "grades:write");
  if (perms.length === 0) return false;
  return perms.some((p) => matchesScope(p, ctx));
}

function hasStudentsViewSync(
  session: AuthSession,
  ctx: ResolvedPermissionContext
): boolean {
  if (isFullAdmin(session)) return true;
  if (session.role !== "TEACHER") return false;
  const perms = getEffectivePermissions(session);
  const viewPerms = perms.filter((p) => p.action === "students:view");
  if (viewPerms.some((p) => p.scope !== "subject" && matchesScope(p, ctx))) return true;

  const gradePerms = perms.filter(
    (p) => p.action === "grades:write" && p.scope !== "subject"
  );
  return gradePerms.some((p) => matchesScope(p, ctx));
}

export function canWriteGrades(
  session: AuthSession,
  ctx: ResolvedPermissionContext = {}
): boolean {
  return hasGradesWrite(session, ctx);
}

/** בדיקה סינכרונית — לסינון גס; לבדיקת תלמיד בודד השתמש ב-canViewStudentAccess */
export function canViewStudents(
  session: AuthSession,
  ctx: ResolvedPermissionContext = {}
): boolean {
  return hasStudentsViewSync(session, ctx);
}

export function canEditStudents(
  session: AuthSession,
  ctx: ResolvedPermissionContext = {}
): boolean {
  if (isFullAdmin(session)) return true;
  if (session.role !== "TEACHER") return false;
  const perms = getEffectivePermissions(session).filter((p) => p.action === "students:edit");
  return perms.some((p) => matchesScope(p, ctx));
}

export function hasAnyGradeWrite(session: AuthSession): boolean {
  if (isFullAdmin(session)) return true;
  if (session.role !== "TEACHER") return false;
  return getEffectivePermissions(session).some((p) => p.action === "grades:write");
}

export function hasAnyStudentView(session: AuthSession): boolean {
  if (isFullAdmin(session)) return true;
  if (session.role !== "TEACHER") return false;
  const perms = getEffectivePermissions(session);
  return perms.some(
    (p) =>
      p.action === "students:view" ||
      p.action === "grades:write"
  );
}

export function hasAnyStudentEdit(session: AuthSession): boolean {
  if (isFullAdmin(session)) return true;
  if (session.role !== "TEACHER") return false;
  return getEffectivePermissions(session).some((p) => p.action === "students:edit");
}

/** מנהלים ורכזי שכבות/כיתות — לא מורים מקצועיים (הרשאת מקצוע בלבד) */
export function canViewOutstandingBagrut(session: AuthSession): boolean {
  if (isFullAdmin(session)) return true;
  if (session.role !== "TEACHER") return false;

  const perms = getEffectivePermissions(session);
  const relevant = perms.filter(
    (p) =>
      p.action === "grades:write" ||
      p.action === "students:view" ||
      p.action === "students:edit"
  );

  return relevant.some(
    (p) => p.scope === "all" || p.scope === "gradeYear" || p.scope === "class"
  );
}

type ClassRef = { id: string; gradeYear: string | null };

export function getAllowedClassIds(
  session: AuthSession,
  classes: ClassRef[]
): string[] | null {
  if (isFullAdmin(session)) return null;

  const perms = getEffectivePermissions(session).filter(
    (p) =>
      p.action === "grades:write" ||
      p.action === "students:view" ||
      p.action === "students:edit"
  );
  if (perms.some((p) => p.scope === "all")) return null;
  if (perms.some((p) => p.scope === "subject")) return null;

  const allowed = new Set<string>();
  for (const p of perms) {
    if (p.scope === "class") allowed.add(p.classId);
    if (p.scope === "gradeYear") {
      for (const c of classes) {
        if (c.gradeYear === p.gradeYear) allowed.add(c.id);
      }
    }
  }
  return [...allowed];
}

export function getAllowedSubjectIds(session: AuthSession): string[] | null {
  if (isFullAdmin(session)) return null;

  const perms = getEffectivePermissions(session).filter(
    (p) => p.action === "grades:write"
  );
  if (perms.some((p) => p.scope === "all" || p.scope === "gradeYear" || p.scope === "class")) {
    return null;
  }

  const subjectIds = perms
    .filter((p) => p.action === "grades:write" && p.scope === "subject")
    .map((p) => (p as { subjectId: string }).subjectId);

  return subjectIds.length > 0 ? [...new Set(subjectIds)] : null;
}

export function summarizePermissions(
  role: string,
  permissions?: StaffPermission[]
): string {
  if (role === "ADMIN") return "מנהל — הרשאות מלאות";
  if (!permissions || permissions.length === 0) {
    return "מורה — כל המערכת (ברירת מחדל)";
  }

  const parts: string[] = [];
  const grades = permissions.filter((p) => p.action === "grades:write");
  const views = permissions.filter((p) => p.action === "students:view");
  const edits = permissions.filter((p) => p.action === "students:edit");

  if (grades.some((p) => p.scope === "all")) {
    parts.push("ציונים: כל המערכת");
  } else {
    const gradeParts: string[] = [];
    for (const p of grades) {
      if (p.scope === "gradeYear") gradeParts.push(`שכבת ${p.gradeYear}`);
      if (p.scope === "class") gradeParts.push(`כיתה`);
      if (p.scope === "subject") gradeParts.push(`מקצוע`);
    }
    if (gradeParts.length) parts.push(`ציונים: ${gradeParts.join(", ")}`);
  }

  if (views.some((p) => p.scope === "all")) {
    parts.push("תלמידים: צפייה בכל המערכת");
  } else if (views.length > 0) {
    parts.push("תלמידים: צפייה מוגבלת");
  }

  if (edits.length > 0) {
    parts.push("תלמידים: עריכה");
  }

  return parts.length > 0 ? parts.join(" · ") : "ללא הרשאות";
}

export function buildPermissionsFromForm(input: {
  scopeMode: "all" | "gradeYear" | "class" | "subject";
  gradeYears: string[];
  classIds: string[];
  subjectIds: string[];
  includeStudentView: boolean;
  includeStudentEdit: boolean;
}): StaffPermission[] {
  const perms: StaffPermission[] = [];

  if (input.scopeMode === "all") {
    perms.push({ action: "grades:write", scope: "all" });
    if (input.includeStudentView) perms.push({ action: "students:view", scope: "all" });
    if (input.includeStudentEdit) perms.push({ action: "students:edit", scope: "all" });
    return perms;
  }

  if (input.scopeMode === "gradeYear") {
    for (const gradeYear of input.gradeYears) {
      perms.push({ action: "grades:write", scope: "gradeYear", gradeYear });
      if (input.includeStudentView) {
        perms.push({ action: "students:view", scope: "gradeYear", gradeYear });
      }
      if (input.includeStudentEdit) {
        perms.push({ action: "students:edit", scope: "gradeYear", gradeYear });
      }
    }
    return perms;
  }

  if (input.scopeMode === "class") {
    for (const classId of input.classIds) {
      perms.push({ action: "grades:write", scope: "class", classId });
      if (input.includeStudentView) {
        perms.push({ action: "students:view", scope: "class", classId });
      }
      if (input.includeStudentEdit) {
        perms.push({ action: "students:edit", scope: "class", classId });
      }
    }
    return perms;
  }

  for (const subjectId of input.subjectIds) {
    perms.push({ action: "grades:write", scope: "subject", subjectId });
    perms.push({ action: "students:view", scope: "subject", subjectId });
  }
  return perms;
}

export function parsePermissionsToForm(permissions?: StaffPermission[]): {
  scopeMode: "all" | "gradeYear" | "class" | "subject";
  gradeYears: string[];
  classIds: string[];
  subjectIds: string[];
  includeStudentView: boolean;
  includeStudentEdit: boolean;
} {
  if (!permissions || permissions.length === 0) {
    return {
      scopeMode: "all",
      gradeYears: [],
      classIds: [],
      subjectIds: [],
      includeStudentView: true,
      includeStudentEdit: false,
    };
  }

  const grades = permissions.filter((p) => p.action === "grades:write");
  const views = permissions.filter((p) => p.action === "students:view");
  const edits = permissions.filter((p) => p.action === "students:edit");

  if (grades.some((p) => p.scope === "all")) {
    return {
      scopeMode: "all",
      gradeYears: [],
      classIds: [],
      subjectIds: [],
      includeStudentView: views.some((p) => p.scope === "all"),
      includeStudentEdit: edits.some((p) => p.scope === "all"),
    };
  }

  if (grades.some((p) => p.scope === "gradeYear")) {
    return {
      scopeMode: "gradeYear",
      gradeYears: grades
        .filter((p) => p.scope === "gradeYear")
        .map((p) => (p as { gradeYear: string }).gradeYear),
      classIds: [],
      subjectIds: [],
      includeStudentView: views.length > 0,
      includeStudentEdit: edits.length > 0,
    };
  }

  if (grades.some((p) => p.scope === "class")) {
    return {
      scopeMode: "class",
      gradeYears: [],
      classIds: grades
        .filter((p) => p.scope === "class")
        .map((p) => (p as { classId: string }).classId),
      subjectIds: [],
      includeStudentView: views.length > 0,
      includeStudentEdit: edits.length > 0,
    };
  }

  return {
    scopeMode: "subject",
    gradeYears: [],
    classIds: [],
    subjectIds: grades
      .filter((p) => p.scope === "subject")
      .map((p) => (p as { subjectId: string }).subjectId),
    includeStudentView: views.length > 0,
    includeStudentEdit: false,
  };
}

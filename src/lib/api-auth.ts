import { NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth-server";
import type { AuthSession, Role } from "@/lib/types";
import {
  canEditGrades,
  canImportStudents,
  canManageStructure,
  canViewStudents,
  isStaffRole,
} from "@/lib/roles";

type AuthResult =
  | { error: NextResponse; session: null }
  | { error: null; session: AuthSession };

export async function requireAuth(): Promise<AuthResult> {
  const session = await getAuthSession();
  if (!session) {
    return { error: NextResponse.json({ error: "לא מחובר" }, { status: 401 }), session: null };
  }
  return { error: null, session };
}

export async function requireRole(...roles: Role[]): Promise<AuthResult> {
  const result = await requireAuth();
  if (result.error) return result;
  if (!roles.includes(result.session.role)) {
    return { error: NextResponse.json({ error: "אין הרשאה" }, { status: 403 }), session: null };
  }
  return result;
}

export async function requireStaff(): Promise<AuthResult> {
  const result = await requireAuth();
  if (result.error) return result;
  if (!isStaffRole(result.session.role)) {
    return { error: NextResponse.json({ error: "אין הרשאה" }, { status: 403 }), session: null };
  }
  return result;
}

export async function requireAdmin(): Promise<AuthResult> {
  return requireRole("ADMIN");
}

export async function requireStudent(): Promise<AuthResult> {
  const result = await requireRole("STUDENT");
  if (result.error) return result;
  if (!result.session.studentId) {
    return { error: NextResponse.json({ error: "לא נמצא פרופיל תלמיד" }, { status: 404 }), session: null };
  }
  return result;
}

export function checkPermission(
  session: AuthSession,
  action: "structure" | "import" | "grades" | "students"
): boolean {
  switch (action) {
    case "structure":
      return canManageStructure(session.role);
    case "import":
      return canImportStudents(session.role);
    case "grades":
      return canEditGrades(session.role);
    case "students":
      return canViewStudents(session.role);
    default:
      return false;
  }
}

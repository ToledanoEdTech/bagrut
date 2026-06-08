import { cookies } from "next/headers";
import { adminAuth } from "@/lib/firebase/admin";
import { getOrCreateUserProfile, resolveUserRole } from "@/lib/firestore";
import type { AuthSession } from "@/lib/types";
import { isAdminEmail } from "@/lib/roles";

const SESSION_COOKIE = "fb_session";
const SESSION_MAX_AGE_MS = 60 * 60 * 24 * 5 * 1000; // 5 days

export { SESSION_COOKIE, SESSION_MAX_AGE_MS };

export async function createSessionCookie(idToken: string): Promise<string> {
  return adminAuth.createSessionCookie(idToken, {
    expiresIn: SESSION_MAX_AGE_MS,
  });
}

export async function getAuthSession(): Promise<AuthSession | null> {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get(SESSION_COOKIE)?.value;
  if (!sessionCookie) return null;

  try {
    const decoded = await adminAuth.verifySessionCookie(sessionCookie, true);
    const email = (decoded.email ?? "").toLowerCase();
    const profile = await getOrCreateUserProfile({
      uid: decoded.uid,
      email,
      name: decoded.name ?? email,
      photoURL: decoded.picture ?? null,
    });

    const resolved = await resolveUserRole(email);
    if (!resolved.role) return null;

    const role = isAdminEmail(email) ? "ADMIN" : resolved.role;
    const studentId = resolved.studentId;

    return {
      uid: decoded.uid,
      email,
      name: profile.name,
      role,
      studentId,
      photoURL: profile.photoURL,
    };
  } catch {
    return null;
  }
}

import { cookies } from "next/headers";
import { adminAuth } from "@/lib/firebase/admin";
import { getUserProfile } from "@/lib/firestore";
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
    const profile = await getUserProfile(decoded.uid);

    if (!profile?.role) return null;

    const role = isAdminEmail(email) ? "ADMIN" : profile.role;
    if (role === "STUDENT" && !profile.studentId) return null;

    return {
      uid: decoded.uid,
      email,
      name: profile.name ?? decoded.name ?? email,
      role,
      studentId: profile.studentId,
      photoURL: profile.photoURL ?? decoded.picture ?? null,
    };
  } catch {
    return null;
  }
}

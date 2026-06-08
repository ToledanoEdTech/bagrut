"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { GraduationCap, Loader2 } from "lucide-react";
import { useAuth } from "@/components/AuthProvider";

export default function LoginPage() {
  const router = useRouter();
  const { signInWithGoogle, session, loading: authLoading, configError } = useAuth();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  if (!authLoading && session) {
    router.replace(session.role === "STUDENT" ? "/student" : "/admin");
  }

  async function handleGoogleSignIn() {
    setLoading(true);
    setError("");
    try {
      await signInWithGoogle();
      router.push("/");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "שגיאה בהתחברות");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen">
      <div className="hidden w-1/2 bg-gradient-to-bl from-primary-700 via-primary-600 to-primary-800 lg:flex lg:flex-col lg:justify-center lg:px-16">
        <div className="max-w-md text-white">
          <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-2xl bg-white/20">
            <GraduationCap className="h-8 w-8" />
          </div>
          <h1 className="text-4xl font-bold leading-tight">מערכת מעקב בגרות</h1>
          <p className="mt-4 text-lg text-primary-100">
            ניהול פדגוגי ומעקב אחרי בחינות בגרות וחובות תלמידים בישיבה תיכונית
          </p>
          <div className="mt-8 space-y-3 text-sm text-primary-100">
            <p>• מנהלים — הרשאות מלאות</p>
            <p>• מורים — צפייה והזנת ציונים</p>
            <p>• תלמידים — דשבורד אישי</p>
          </div>
        </div>
      </div>

      <div className="flex flex-1 items-center justify-center px-6">
        <div className="w-full max-w-md">
          <div className="mb-8 text-center lg:text-right">
            <h2 className="text-2xl font-bold text-slate-900">התחברות</h2>
            <p className="mt-2 text-sm text-slate-500">
              התחברו עם חשבון Google הארגוני שלכם
            </p>
          </div>

          <div className="card space-y-5 p-8">
            {configError && (
              <div className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">
                {configError}
              </div>
            )}
            {error && (
              <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600">
                {error}
              </div>
            )}

            <button
              type="button"
              onClick={handleGoogleSignIn}
              disabled={loading || Boolean(configError)}
              className="btn-primary w-full"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <svg className="h-5 w-5" viewBox="0 0 24 24">
                  <path
                    fill="currentColor"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
                  />
                  <path
                    fill="currentColor"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="currentColor"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  />
                  <path
                    fill="currentColor"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  />
                </svg>
              )}
              התחברות עם Google
            </button>
          </div>

          <p className="mt-6 text-center text-xs text-slate-400">
            גישה למערכת מותנית בהרשאות מוגדרות מראש
          </p>
        </div>
      </div>
    </div>
  );
}

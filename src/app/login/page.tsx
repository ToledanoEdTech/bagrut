"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import { FadeIn } from "@/components/motion/FadeIn";
import { Button } from "@/components/ui/Button";
import { SiteLogos } from "@/components/ui/SiteLogos";

export default function LoginPage() {
  const router = useRouter();
  const { signInWithGoogle, session, loading: authLoading, configError } = useAuth();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!authLoading && session) {
      router.replace(session.role === "STUDENT" ? "/student" : "/admin");
    }
  }, [authLoading, session, router]);

  async function handleGoogleSignIn() {
    setLoading(true);
    setError("");
    try {
      await signInWithGoogle();
    } catch (e) {
      setError(e instanceof Error ? e.message : "שגיאה בהתחברות");
      setLoading(false);
    }
  }

  if (authLoading || session) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100/80">
        <Loader2 className="h-10 w-10 animate-spin text-primary-600" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-gradient-to-br from-slate-50 to-slate-100/80">
      <div className="hidden w-1/2 bg-gradient-to-bl from-primary-700 via-primary-600 to-primary-800 lg:flex lg:flex-col lg:justify-center lg:px-16">
        <div className="max-w-md text-white">
          <SiteLogos size="hero" className="mb-8 items-start" />
          <h1 className="text-display text-white leading-tight">מערכת מעקב בגרות</h1>
          <p className="mt-4 text-lg text-primary-100">
            ניהול פדגוגי ומעקב אחרי בחינות בגרות וחובות תלמידים בישיבה תיכונית
          </p>
          <div className="mt-8 space-y-3 text-base text-primary-100">
            <p>• מנהלים — הרשאות מלאות</p>
            <p>• מורים — צפייה והזנת ציונים</p>
            <p>• תלמידים — דשבורד אישי</p>
          </div>
        </div>
      </div>

      <div className="flex flex-1 items-center justify-center px-6">
        <FadeIn className="w-full max-w-md">
          <div className="mb-8 text-center lg:text-right">
            <div className="mb-6 flex justify-center lg:hidden">
              <SiteLogos size="hero" className="items-center" />
            </div>
            <h2 className="text-h1 text-slate-900">התחברות</h2>
            <p className="mt-2 text-base text-slate-500">
              התחברו עם חשבון Google הארגוני שלכם
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200/80 bg-white/90 p-8 shadow-lg backdrop-blur-sm">
            {configError && (
              <div className="mb-5 rounded-xl bg-amber-50 px-4 py-3 text-base text-amber-800">
                {configError}
              </div>
            )}
            {error && (
              <div className="mb-5 rounded-xl bg-red-50 px-4 py-3 text-base text-red-600">
                {error}
              </div>
            )}

            <Button
              type="button"
              onClick={handleGoogleSignIn}
              disabled={loading || Boolean(configError)}
              size="lg"
              className="w-full"
            >
              {loading ? (
                <Loader2 className="h-5 w-5 animate-spin" />
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
            </Button>
          </div>

          <p className="mt-6 text-center text-caption">
            גישה למערכת מותנית בהרשאות מוגדרות מראש
          </p>
        </FadeIn>
      </div>
    </div>
  );
}

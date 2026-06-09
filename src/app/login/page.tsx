"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  Loader2,
  ShieldCheck,
  GraduationCap,
  LineChart,
  Sparkles,
  CheckCircle2,
} from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import { SiteLogos } from "@/components/ui/SiteLogos";

const features = [
  {
    icon: ShieldCheck,
    title: "מנהלים",
    desc: "ניהול מלא של מבנה, כיתות, מקצועות וצוות",
  },
  {
    icon: LineChart,
    title: "מורים",
    desc: "צפייה בתלמידים והזנת ציונים בקלות",
  },
  {
    icon: GraduationCap,
    title: "תלמידים",
    desc: "דשבורד אישי עם מעקב התקדמות וציונים",
  },
];

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
      <div className="flex min-h-screen items-center justify-center bg-mesh-light">
        <div className="relative">
          <div className="absolute inset-0 animate-pulse-ring rounded-full bg-primary-400/40" />
          <Loader2 className="relative h-11 w-11 animate-spin text-primary-600" />
        </div>
      </div>
    );
  }

  return (
    <div className="grid min-h-screen grid-cols-1 lg:grid-cols-2">
      {/* ===== Brand / hero panel (right side in RTL) ===== */}
      <aside className="relative hidden overflow-hidden bg-primary-800 lg:flex lg:flex-col lg:justify-between lg:p-12 xl:p-16">
        {/* layered background */}
        <div className="absolute inset-0 bg-gradient-to-bl from-primary-700 via-brand-700 to-primary-900" />
        <div className="absolute inset-0 bg-mesh-hero" />
        <div className="absolute -right-24 -top-24 h-[26rem] w-[26rem] animate-float rounded-full bg-brand-500/30 blur-3xl" />
        <div className="absolute -bottom-20 -left-16 h-[28rem] w-[28rem] animate-float-slow rounded-full bg-primary-400/25 blur-3xl" />
        <div
          className="absolute inset-0 opacity-[0.08]"
          style={{
            backgroundImage:
              "linear-gradient(white 1px, transparent 1px), linear-gradient(90deg, white 1px, transparent 1px)",
            backgroundSize: "46px 46px",
          }}
        />

        {/* top: logos */}
        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="relative z-10"
        >
          <div className="inline-flex rounded-2xl bg-white/95 p-4 shadow-2xl ring-1 ring-white/40 backdrop-blur">
            <SiteLogos size="hero" className="items-center" />
          </div>
        </motion.div>

        {/* middle: headline + features */}
        <div className="relative z-10 my-10">
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
          >
            <span className="inline-flex items-center gap-2 rounded-full bg-white/15 px-4 py-1.5 text-sm font-semibold text-white ring-1 ring-inset ring-white/25 backdrop-blur">
              <Sparkles className="h-4 w-4" />
              ישיבה תיכונית צביה אלישיב
            </span>
            <h1 className="mt-6 text-5xl font-extrabold leading-[1.1] text-white xl:text-6xl">
              מערכת מעקב
              <br />
              <span className="bg-gradient-to-l from-white via-primary-100 to-brand-200 bg-clip-text text-transparent">
                בגרות חכמה
              </span>
            </h1>
            <p className="mt-5 max-w-md text-lg leading-relaxed text-primary-100/90">
              פלטפורמה פדגוגית מתקדמת למעקב אחר בחינות בגרות, חובות תלמידים
              והתקדמות אישית — הכל במקום אחד, בזמן אמת.
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="mt-10 grid max-w-md gap-3"
          >
            {features.map((f) => (
              <div
                key={f.title}
                className="flex items-center gap-4 rounded-2xl border border-white/15 bg-white/10 p-4 backdrop-blur-md transition hover:bg-white/15"
              >
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/20 text-white ring-1 ring-inset ring-white/25">
                  <f.icon className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-bold text-white">{f.title}</p>
                  <p className="text-sm text-primary-100/80">{f.desc}</p>
                </div>
              </div>
            ))}
          </motion.div>
        </div>

        {/* bottom: footer */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.35 }}
          className="relative z-10 text-sm text-primary-200/70"
        >
          © {new Date().getFullYear()} — מערכת ניהול פדגוגית
        </motion.p>
      </aside>

      {/* ===== Form panel (left side in RTL) ===== */}
      <main className="relative flex items-center justify-center overflow-hidden bg-mesh-light px-6 py-12">
        <div className="pointer-events-none absolute -right-20 top-10 h-72 w-72 rounded-full bg-primary-200/40 blur-3xl" />
        <div className="pointer-events-none absolute -left-20 bottom-10 h-72 w-72 rounded-full bg-brand-200/40 blur-3xl" />

        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45 }}
          className="relative w-full max-w-md"
        >
          {/* mobile logo */}
          <div className="mb-8 flex justify-center lg:hidden">
            <div className="rounded-2xl bg-white p-4 shadow-card ring-1 ring-slate-200/70">
              <SiteLogos size="hero" className="items-center" />
            </div>
          </div>

          <div className="overflow-hidden rounded-3xl border border-white/70 bg-white/80 shadow-card-hover backdrop-blur-2xl">
            <div className="h-1.5 w-full bg-gradient-to-l from-primary-600 via-brand-500 to-accent-500" />
            <div className="p-8 sm:p-10">
              <div className="text-center">
                <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-primary-600 to-brand-600 text-white shadow-glow">
                  <GraduationCap className="h-7 w-7" />
                </div>
                <h2 className="text-3xl font-extrabold tracking-tight text-slate-900">
                  ברוכים הבאים
                </h2>
                <p className="mt-2 text-base text-slate-500">
                  התחברו עם חשבון Google הארגוני שלכם
                </p>
              </div>

              {configError && (
                <div className="mt-6 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
                  {configError}
                </div>
              )}
              {error && (
                <div className="mt-6 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600">
                  {error}
                </div>
              )}

              <button
                type="button"
                onClick={handleGoogleSignIn}
                disabled={loading || Boolean(configError)}
                className="group mt-8 flex w-full items-center justify-center gap-3 rounded-2xl border border-slate-200 bg-white px-5 py-4 text-base font-semibold text-slate-700 shadow-soft transition-all duration-200 hover:border-primary-200 hover:shadow-card disabled:cursor-not-allowed disabled:opacity-60 focus:outline-none focus-visible:ring-4 focus-visible:ring-primary-100"
              >
                {loading ? (
                  <Loader2 className="h-5 w-5 animate-spin text-primary-600" />
                ) : (
                  <svg className="h-5 w-5" viewBox="0 0 24 24" aria-hidden>
                    <path
                      fill="#4285F4"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                    />
                  </svg>
                )}
                <span>{loading ? "מתחבר..." : "התחברות עם Google"}</span>
              </button>

              <div className="mt-6 flex items-center justify-center gap-2 text-center text-sm text-slate-500">
                <ShieldCheck className="h-4 w-4 shrink-0 text-accent-600" />
                גישה מאובטחת ומותנית בהרשאות מוגדרות מראש
              </div>
            </div>
          </div>

          <ul className="mt-6 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-sm text-slate-500">
            {["מעקב בזמן אמת", "נגיש ומאובטח", "ממשק בעברית"].map((t) => (
              <li key={t} className="flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4 text-accent-500" />
                {t}
              </li>
            ))}
          </ul>
        </motion.div>
      </main>
    </div>
  );
}

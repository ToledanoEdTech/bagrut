"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { onAuthStateChanged, signInWithPopup, signOut as fbSignOut } from "firebase/auth";
import {
  getFirebaseAuth,
  googleProvider,
  isFirebaseClientConfigured,
} from "@/lib/firebase/client";
import type { AuthSession } from "@/lib/types";

type AuthContextValue = {
  session: AuthSession | null;
  loading: boolean;
  configError: string | null;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [configError, setConfigError] = useState<string | null>(null);
  const initialAuthEventRef = useRef(true);

  const refreshSession = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/me");
      if (res.ok) {
        setSession(await res.json());
      } else {
        setSession(null);
      }
    } catch {
      setSession(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isFirebaseClientConfigured()) {
      setConfigError(
        "חסרה הגדרת Firebase בשרת. ודא שמשתני NEXT_PUBLIC_FIREBASE_* מוגדרים ב-Vercel."
      );
      setLoading(false);
      return;
    }

    let unsub: (() => void) | undefined;
    try {
      void refreshSession();
      unsub = onAuthStateChanged(getFirebaseAuth(), async (user) => {
        if (initialAuthEventRef.current) {
          initialAuthEventRef.current = false;
          if (user) return;
        }

        if (!user) {
          setSession(null);
          setLoading(false);
          return;
        }

        await refreshSession();
      });
    } catch (error) {
      setConfigError(
        error instanceof Error ? error.message : "שגיאה באתחול Firebase"
      );
      setLoading(false);
    }

    return () => unsub?.();
  }, [refreshSession]);

  async function signInWithGoogle() {
    if (configError) {
      throw new Error(configError);
    }
    const result = await signInWithPopup(getFirebaseAuth(), googleProvider);
    const idToken = await result.user.getIdToken();
    const res = await fetch("/api/auth/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idToken }),
    });
    const data = await res.json();
    if (!res.ok) {
      await fbSignOut(getFirebaseAuth());
      throw new Error(data.error ?? "שגיאה בהתחברות");
    }
    setLoading(true);
    await refreshSession();
  }

  async function signOut() {
    await fetch("/api/auth/session", { method: "DELETE" });
    if (!configError) {
      await fbSignOut(getFirebaseAuth());
    }
    setSession(null);
    window.location.href = "/login";
  }

  return (
    <AuthContext.Provider
      value={{ session, loading, configError, signInWithGoogle, signOut }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

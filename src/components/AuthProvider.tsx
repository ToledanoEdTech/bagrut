"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { onAuthStateChanged, signInWithPopup, signOut as fbSignOut } from "firebase/auth";
import { getFirebaseAuth, googleProvider } from "@/lib/firebase/client";
import type { AuthSession } from "@/lib/types";

type AuthContextValue = {
  session: AuthSession | null;
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshSession = useCallback(async () => {
    const res = await fetch("/api/auth/me");
    if (res.ok) {
      setSession(await res.json());
    } else {
      setSession(null);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    refreshSession();
    const unsub = onAuthStateChanged(getFirebaseAuth(), async (user) => {
      if (!user) {
        setSession(null);
        setLoading(false);
        return;
      }
      await refreshSession();
    });
    return unsub;
  }, [refreshSession]);

  async function signInWithGoogle() {
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
    await refreshSession();
  }

  async function signOut() {
    await fetch("/api/auth/session", { method: "DELETE" });
    await fbSignOut(getFirebaseAuth());
    setSession(null);
    window.location.href = "/login";
  }

  return (
    <AuthContext.Provider value={{ session, loading, signInWithGoogle, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

"use client";

import { useCallback, useEffect, useState } from "react";
import { ApiError, fetchCached, getCached, subscribe } from "@/lib/api-cache";

export function useApi<T>(key: string | null) {
  const [state, setState] = useState(() => {
    const cached = key ? getCached<T>(key) : undefined;
    return {
      data: cached,
      loading: key ? cached === undefined : false,
      error: null as string | null,
    };
  });

  useEffect(() => {
    if (!key) return;

    const sync = () => {
      const cached = getCached<T>(key);
      setState((prev) => ({
        data: cached ?? prev.data,
        loading: cached === undefined && prev.data === undefined,
        error: cached !== undefined ? null : prev.error,
      }));
    };

    const unsub = subscribe(key, sync);
    void fetchCached<T>(key)
      .catch((err: unknown) => {
        if (err instanceof ApiError && err.status === 401) return;
        const message = err instanceof Error ? err.message : "שגיאה בטעינת הנתונים";
        setState((prev) => ({
          ...prev,
          loading: false,
          error: message,
        }));
      })
      .finally(sync);

    return unsub;
  }, [key]);

  const mutate = useCallback(async () => {
    if (!key) return;
    try {
      await fetchCached<T>(key, { force: true });
      setState((prev) => ({ ...prev, error: null }));
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) return;
      const message = err instanceof Error ? err.message : "שגיאה בטעינת הנתונים";
      setState((prev) => ({ ...prev, loading: false, error: message }));
      throw err;
    }
  }, [key]);

  return { ...state, mutate };
}

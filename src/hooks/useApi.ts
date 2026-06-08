"use client";

import { useCallback, useEffect, useState } from "react";
import { fetchCached, getCached, subscribe } from "@/lib/api-cache";

export function useApi<T>(key: string | null) {
  const [state, setState] = useState(() => ({
    data: key ? getCached<T>(key) : undefined,
    loading: key ? getCached<T>(key) === undefined : false,
  }));

  useEffect(() => {
    if (!key) return;

    const sync = () => {
      const cached = getCached<T>(key);
      setState({ data: cached, loading: cached === undefined });
    };

    const unsub = subscribe(key, sync);
    if (getCached<T>(key) === undefined) {
      void fetchCached<T>(key).finally(sync);
    }

    return unsub;
  }, [key]);

  const mutate = useCallback(async () => {
    if (!key) return;
    await fetchCached<T>(key, { force: true });
  }, [key]);

  return { ...state, mutate };
}

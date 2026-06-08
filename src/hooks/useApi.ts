"use client";

import { useCallback, useEffect, useState } from "react";
import { fetchCached, getCached, subscribe } from "@/lib/api-cache";

export function useApi<T>(key: string | null) {
  const [state, setState] = useState(() => {
    const cached = key ? getCached<T>(key) : undefined;
    return {
      data: cached,
      loading: key ? cached === undefined : false,
    };
  });

  useEffect(() => {
    if (!key) return;

    const sync = () => {
      const cached = getCached<T>(key);
      setState((prev) => ({
        data: cached ?? prev.data,
        loading: cached === undefined && prev.data === undefined,
      }));
    };

    const unsub = subscribe(key, sync);
    void fetchCached<T>(key).finally(sync);

    return unsub;
  }, [key]);

  const mutate = useCallback(async () => {
    if (!key) return;
    await fetchCached<T>(key, { force: true });
  }, [key]);

  return { ...state, mutate };
}

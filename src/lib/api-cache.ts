type CacheEntry<T = unknown> = {
  data: T;
  ts: number;
  promise?: Promise<T>;
};

const cache = new Map<string, CacheEntry>();
const listeners = new Map<string, Set<() => void>>();

const DEFAULT_TTL = 5 * 60 * 1000;

export async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error((body as { error?: string }).error ?? `שגיאה ${res.status}`);
  }
  return res.json() as Promise<T>;
}

function notify(key: string) {
  listeners.get(key)?.forEach((fn) => fn());
}

export function subscribe(key: string, fn: () => void) {
  if (!listeners.has(key)) listeners.set(key, new Set());
  listeners.get(key)!.add(fn);
  return () => {
    listeners.get(key)?.delete(fn);
  };
}

export function getCached<T>(key: string): T | undefined {
  return cache.get(key)?.data as T | undefined;
}

export function invalidateCache(key?: string) {
  if (!key) {
    cache.clear();
    listeners.forEach((_, k) => notify(k));
    return;
  }
  for (const k of cache.keys()) {
    if (k === key || k.startsWith(key)) {
      cache.delete(k);
      notify(k);
    }
  }
}

export async function fetchCached<T>(
  key: string,
  options?: { force?: boolean; ttl?: number }
): Promise<T> {
  const ttl = options?.ttl ?? DEFAULT_TTL;
  const entry = cache.get(key) as CacheEntry<T> | undefined;
  const fresh = entry && Date.now() - entry.ts < ttl;

  if (!options?.force && fresh && entry) {
    return entry.data;
  }

  if (entry?.promise && !options?.force) {
    return entry.promise;
  }

  const promise = fetchJson<T>(key).then((data) => {
    cache.set(key, { data, ts: Date.now() });
    notify(key);
    return data;
  });

  cache.set(key, {
    data: entry?.data as T,
    ts: entry?.ts ?? 0,
    promise,
  });

  try {
    return await promise;
  } catch (err) {
    if (entry?.data !== undefined) return entry.data;
    throw err;
  } finally {
    const current = cache.get(key);
    if (current?.promise === promise) {
      cache.set(key, { data: current.data, ts: current.ts });
    }
  }
}

export function prefetch(key: string) {
  const entry = cache.get(key);
  if (entry && Date.now() - entry.ts < DEFAULT_TTL) return;
  if (entry?.promise) return;
  void fetchCached(key);
}

const ROUTE_PREFETCH: Record<string, string[]> = {
  "/admin": ["/api/admin/dashboard"],
  "/admin/students": ["/api/students", "/api/classes", "/api/tracks", "/api/students/outstanding-bagrut"],
  "/admin/outstanding-bagrut": ["/api/students/outstanding-bagrut"],
  "/admin/classes": ["/api/classes", "/api/paths"],
  "/admin/subjects": ["/api/subjects"],
  "/admin/grades": ["/api/students", "/api/classes/list"],
  "/admin/grades/matrix": ["/api/classes/list"],
  "/admin/grades/import": ["/api/classes/list", "/api/grades/import/template"],
  "/admin/import": [],
  "/admin/staff": ["/api/staff"],
  "/student": ["/api/student/dashboard"],
};

export function prefetchRoute(href: string) {
  const urls = ROUTE_PREFETCH[href];
  if (!urls) return;
  urls.forEach(prefetch);
}

export function prefetchAllRoutes(hrefs: string[]) {
  hrefs.forEach(prefetchRoute);
}

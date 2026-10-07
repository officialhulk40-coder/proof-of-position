/** Single-value cache: concurrent callers share one load; a failed load is not cached. */
export function createTtlCache<T>(ttlMs: number, now: () => number) {
  let value: { data: T; expires: number } | null = null;
  let pending: Promise<T> | null = null;
  return {
    async get(load: () => Promise<T>): Promise<T> {
      if (value !== null && now() < value.expires) return value.data;
      if (pending !== null) return pending;
      pending = load()
        .then((data) => {
          value = { data, expires: now() + ttlMs };
          return data;
        })
        .finally(() => {
          pending = null;
        });
      return pending;
    },
  };
}

/** Per-key cache with a TTL chosen per value (e.g. long for found evidence, short for "not yet"). */
export function createKeyedCache<K, T>(now: () => number) {
  const entries = new Map<K, { data: T; expires: number }>();
  return {
    async get(key: K, load: () => Promise<T>, ttlFor: (data: T) => number): Promise<T> {
      const hit = entries.get(key);
      if (hit && now() < hit.expires) return hit.data;
      const data = await load();
      entries.set(key, { data, expires: now() + ttlFor(data) });
      return data;
    },
  };
}

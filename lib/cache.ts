/**
 * Caché en memoria del servidor con TTL.
 * Evita que el dashboard golpee Back4App en cada poll de React Query.
 * Se almacena en globalThis para sobrevivir hot-reloads de Next.js.
 */

interface CacheEntry<T> {
  data: T
  expiresAt: number
}

const g = globalThis as { _serverCache?: Map<string, CacheEntry<unknown>> }
if (!g._serverCache) g._serverCache = new Map()
const store = g._serverCache

export async function withCache<T>(
  key: string,
  ttlMs: number,
  fetcher: () => Promise<T>
): Promise<T> {
  const now = Date.now()
  const cached = store.get(key)
  if (cached && cached.expiresAt > now) {
    return cached.data as T
  }
  const data = await fetcher()
  store.set(key, { data, expiresAt: now + ttlMs })
  return data
}

export function invalidateCache(key: string) {
  store.delete(key)
}

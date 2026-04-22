export const CACHE_SERVICE = 'CACHE_SERVICE';

export interface ICacheService {
  get<T>(key: string): Promise<T | null>;
  set(key: string, value: unknown): Promise<void>;
  del(...keys: string[]): Promise<void>;
  invalidatePattern(pattern: string): Promise<void>;
  increment(key: string, ttlSeconds: number): Promise<number>;
  ping(): Promise<boolean>;
}

import { Test } from '@nestjs/testing';
import { ThrottlerStorageRedisService } from './throttler-storage.service';
import { CacheService } from '@libs/server-cache';

const mockCache = { increment: jest.fn() };

describe('ThrottlerStorageRedisService', () => {
  let storage: ThrottlerStorageRedisService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module = await Test.createTestingModule({
      providers: [
        ThrottlerStorageRedisService,
        { provide: CacheService, useValue: mockCache },
      ],
    }).compile();
    storage = module.get(ThrottlerStorageRedisService);
  });

  const call = (hits: number, limit = 10) =>
    storage.increment('key', 60_000, limit, 0, 'default');

  it('returns totalHits and isBlocked=false when under limit', async () => {
    mockCache.increment.mockResolvedValue(5);
    const result = await call(5);
    expect(result.totalHits).toBe(5);
    expect(result.isBlocked).toBe(false);
  });

  it('returns isBlocked=false exactly at limit', async () => {
    mockCache.increment.mockResolvedValue(10);
    const result = await call(10);
    expect(result.isBlocked).toBe(false);
  });

  it('returns isBlocked=true when over limit', async () => {
    mockCache.increment.mockResolvedValue(11);
    const result = await call(11);
    expect(result.isBlocked).toBe(true);
  });

  it('fails open (isBlocked=false) when Redis unavailable (count=0)', async () => {
    mockCache.increment.mockResolvedValue(0);
    const result = await call(0);
    expect(result.isBlocked).toBe(false);
    expect(result.totalHits).toBe(0);
  });

  it('converts ttl from ms to seconds for cache.increment', async () => {
    mockCache.increment.mockResolvedValue(1);
    await storage.increment('key', 30_000, 10, 0, 'default');
    const [, ttlSec] = mockCache.increment.mock.calls[0] as [string, number];
    expect(ttlSec).toBe(30);
  });

  it('uses at least 1 second TTL for sub-second inputs', async () => {
    mockCache.increment.mockResolvedValue(1);
    await storage.increment('key', 100, 10, 0, 'default');
    const [, ttlSec] = mockCache.increment.mock.calls[0] as [string, number];
    expect(ttlSec).toBeGreaterThanOrEqual(1);
  });
});

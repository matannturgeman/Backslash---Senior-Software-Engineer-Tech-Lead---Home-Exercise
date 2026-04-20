import { Test } from '@nestjs/testing';
import { HttpException, HttpStatus, ExecutionContext } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { RateLimitGuard } from './rate-limit.guard.js';
import { CacheService } from '../cache/cache.service.js';

const mockCache  = { increment: jest.fn() };
const mockConfig = { get: jest.fn((key: string, def: unknown) => def) };

function makeContext(ip = '1.2.3.4'): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => ({ ip }),
    }),
  } as unknown as ExecutionContext;
}

describe('RateLimitGuard', () => {
  let guard: RateLimitGuard;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module = await Test.createTestingModule({
      providers: [
        RateLimitGuard,
        { provide: CacheService,  useValue: mockCache  },
        { provide: ConfigService, useValue: mockConfig },
      ],
    }).compile();
    guard = module.get(RateLimitGuard);
  });

  it('allows request when count is within limit', async () => {
    mockCache.increment.mockResolvedValue(5);
    await expect(guard.canActivate(makeContext())).resolves.toBe(true);
  });

  it('allows request exactly at the limit', async () => {
    // default limit is 60
    mockCache.increment.mockResolvedValue(60);
    await expect(guard.canActivate(makeContext())).resolves.toBe(true);
  });

  it('throws 429 when count exceeds limit', async () => {
    mockCache.increment.mockResolvedValue(61);
    await expect(guard.canActivate(makeContext())).rejects.toThrow(HttpException);

    try {
      await guard.canActivate(makeContext());
    } catch (err) {
      expect((err as HttpException).getStatus()).toBe(HttpStatus.TOO_MANY_REQUESTS);
    }
  });

  it('fails open (allows request) when Redis is unavailable (count = 0)', async () => {
    mockCache.increment.mockResolvedValue(0);
    await expect(guard.canActivate(makeContext())).resolves.toBe(true);
  });

  it('uses IP address as part of the cache key', async () => {
    mockCache.increment.mockResolvedValue(1);
    await guard.canActivate(makeContext('9.9.9.9'));

    const [key] = mockCache.increment.mock.calls[0] as [string];
    expect(key).toContain('9.9.9.9');
  });

  it('uses default window of 60 seconds for the TTL', async () => {
    mockCache.increment.mockResolvedValue(1);
    await guard.canActivate(makeContext());

    const [, ttl] = mockCache.increment.mock.calls[0] as [string, number];
    expect(ttl).toBe(60);
  });

  it('respects RATE_LIMIT_MAX config override', async () => {
    mockConfig.get.mockImplementation((key: string, def: unknown) =>
      key === 'RATE_LIMIT_MAX' ? 10 : def,
    );

    const module = await Test.createTestingModule({
      providers: [
        RateLimitGuard,
        { provide: CacheService,  useValue: mockCache  },
        { provide: ConfigService, useValue: mockConfig },
      ],
    }).compile();
    const g = module.get(RateLimitGuard);

    mockCache.increment.mockResolvedValue(11);
    await expect(g.canActivate(makeContext())).rejects.toThrow(HttpException);

    mockCache.increment.mockResolvedValue(10);
    await expect(g.canActivate(makeContext())).resolves.toBe(true);
  });
});

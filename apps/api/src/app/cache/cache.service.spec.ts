import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { CacheService } from './cache.service.js';

// ─── Mock ioredis ─────────────────────────────────────────────────────────────
// We intercept ioredis at the module level so CacheService never opens a real socket.

const mockRedis = {
  on:     jest.fn(),
  connect: jest.fn().mockResolvedValue(undefined),
  get:    jest.fn(),
  set:    jest.fn(),
  del:    jest.fn(),
  scan:   jest.fn(),
  ping:   jest.fn(),
  quit:   jest.fn().mockResolvedValue(undefined),
  incr:   jest.fn(),
  expire: jest.fn(),
};

jest.mock('ioredis', () => {
  return jest.fn().mockImplementation(() => mockRedis);
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Makes CacheService believe Redis is connected so available = true. */
function simulateConnect() {
  // Find the 'connect' handler registered via on() and call it
  const connectCall = mockRedis.on.mock.calls.find(([event]: [string]) => event === 'connect');
  if (connectCall) (connectCall[1] as () => void)();
}

const mockConfig = { get: jest.fn((key: string, def: unknown) => def) };

describe('CacheService', () => {
  let service: CacheService;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockRedis.connect.mockResolvedValue(undefined);
    mockRedis.quit.mockResolvedValue(undefined);

    const module = await Test.createTestingModule({
      providers: [
        CacheService,
        { provide: ConfigService, useValue: mockConfig },
      ],
    }).compile();

    service = module.get(CacheService);
  });

  afterEach(async () => {
    await service.onModuleDestroy();
  });

  // ─── availability gate ────────────────────────────────────────────────────

  it('returns null from get() when redis is not yet connected', async () => {
    // available starts false — no connect event fired
    const result = await service.get('key');
    expect(result).toBeNull();
    expect(mockRedis.get).not.toHaveBeenCalled();
  });

  it('skips set() when redis is not yet connected', async () => {
    await service.set('key', { foo: 1 });
    expect(mockRedis.set).not.toHaveBeenCalled();
  });

  // ─── get ──────────────────────────────────────────────────────────────────

  it('returns parsed JSON from redis on cache hit', async () => {
    simulateConnect();
    const payload = { nodes: [], edges: [] };
    mockRedis.get.mockResolvedValue(JSON.stringify(payload));

    const result = await service.get('graph:full');
    expect(result).toEqual(payload);
  });

  it('returns null on cache miss', async () => {
    simulateConnect();
    mockRedis.get.mockResolvedValue(null);

    expect(await service.get('missing')).toBeNull();
  });

  it('returns null and does not throw when redis.get rejects', async () => {
    simulateConnect();
    mockRedis.get.mockRejectedValue(new Error('redis error'));

    await expect(service.get('key')).resolves.toBeNull();
  });

  // ─── set ──────────────────────────────────────────────────────────────────

  it('stores serialised value with EX ttl', async () => {
    simulateConnect();
    mockRedis.set.mockResolvedValue('OK');

    await service.set('key', { x: 1 });

    expect(mockRedis.set).toHaveBeenCalledWith('key', '{"x":1}', 'EX', expect.any(Number));
  });

  it('does not throw when redis.set rejects', async () => {
    simulateConnect();
    mockRedis.set.mockRejectedValue(new Error('OOM'));

    await expect(service.set('key', {})).resolves.toBeUndefined();
  });

  // ─── del ──────────────────────────────────────────────────────────────────

  it('deletes specified keys', async () => {
    simulateConnect();
    mockRedis.del.mockResolvedValue(1);

    await service.del('k1', 'k2');

    expect(mockRedis.del).toHaveBeenCalledWith('k1', 'k2');
  });

  it('skips del() when no keys supplied', async () => {
    simulateConnect();
    await service.del();
    expect(mockRedis.del).not.toHaveBeenCalled();
  });

  // ─── invalidatePattern ────────────────────────────────────────────────────

  it('scans and deletes all matching keys', async () => {
    simulateConnect();
    mockRedis.scan
      .mockResolvedValueOnce(['5', ['graph:full', 'graph:filtered:x']])
      .mockResolvedValueOnce(['0', []]);
    mockRedis.del.mockResolvedValue(2);

    await service.invalidatePattern('graph:*');

    expect(mockRedis.del).toHaveBeenCalledWith('graph:full', 'graph:filtered:x');
  });

  it('skips del when scan returns no keys', async () => {
    simulateConnect();
    mockRedis.scan.mockResolvedValue(['0', []]);

    await service.invalidatePattern('graph:*');

    expect(mockRedis.del).not.toHaveBeenCalled();
  });

  // ─── ping ─────────────────────────────────────────────────────────────────

  it('returns false from ping() when not available', async () => {
    expect(await service.ping()).toBe(false);
    expect(mockRedis.ping).not.toHaveBeenCalled();
  });

  it('returns true when ping succeeds', async () => {
    simulateConnect();
    mockRedis.ping.mockResolvedValue('PONG');

    expect(await service.ping()).toBe(true);
  });

  it('returns false and marks unavailable when ping throws', async () => {
    simulateConnect();
    mockRedis.ping.mockRejectedValue(new Error('timeout'));

    expect(await service.ping()).toBe(false);
    // After a failed ping, subsequent calls should bypass redis
    mockRedis.get.mockResolvedValue('{}');
    const val = await service.get('any');
    expect(val).toBeNull();
    expect(mockRedis.get).not.toHaveBeenCalled();
  });

  // ─── increment ───────────────────────────────────────────────────────────────

  it('returns 0 from increment() when not available', async () => {
    expect(await service.increment('ratelimit:ip', 60)).toBe(0);
    expect(mockRedis.incr).not.toHaveBeenCalled();
  });

  it('increments and sets TTL on first write', async () => {
    simulateConnect();
    mockRedis.incr.mockResolvedValue(1);
    mockRedis.expire.mockResolvedValue(1);

    const count = await service.increment('ratelimit:ip', 60);

    expect(count).toBe(1);
    expect(mockRedis.incr).toHaveBeenCalledWith('ratelimit:ip');
    expect(mockRedis.expire).toHaveBeenCalledWith('ratelimit:ip', 60);
  });

  it('does not reset TTL on subsequent increments', async () => {
    simulateConnect();
    mockRedis.incr.mockResolvedValue(5);

    await service.increment('ratelimit:ip', 60);

    expect(mockRedis.expire).not.toHaveBeenCalled();
  });

  it('returns 0 and does not throw when redis.incr rejects', async () => {
    simulateConnect();
    mockRedis.incr.mockRejectedValue(new Error('READONLY'));

    await expect(service.increment('ratelimit:ip', 60)).resolves.toBe(0);
  });

  // ─── onModuleDestroy ──────────────────────────────────────────────────────

  it('calls quit on module destroy', async () => {
    await service.onModuleDestroy();
    expect(mockRedis.quit).toHaveBeenCalledTimes(1);
  });
});

import { Test } from '@nestjs/testing';
import { GraphImporter } from './graph.importer.js';
import { GraphLoader } from './graph.loader.js';
import { Neo4jService } from '../neo4j/neo4j.service.js';
import { CacheService } from '../cache/cache.service.js';
import { CACHE_KEY_PATTERN_ALL } from './graph.cache-keys.js';

const HASH = 'abc123';

const mockLoader = {
  fileHash: HASH,
  nodes: new Map([
    ['svc-a', { name: 'svc-a', kind: 'service' }],
    ['db',    { name: 'db',    kind: 'rds' }],
  ]),
  edges: [{ from: 'svc-a', to: 'db' }],
};

const mockTx = { run: jest.fn().mockResolvedValue(undefined) };
const mockNeo4j = {
  run: jest.fn(),
  writeTransaction: jest.fn((fn: (tx: typeof mockTx) => Promise<void>) => fn(mockTx)),
};
const mockCache = { invalidatePattern: jest.fn().mockResolvedValue(undefined) };

describe('GraphImporter', () => {
  let importer: GraphImporter;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockTx.run.mockResolvedValue(undefined);
    mockCache.invalidatePattern.mockResolvedValue(undefined);

    const module = await Test.createTestingModule({
      providers: [
        GraphImporter,
        { provide: GraphLoader,   useValue: mockLoader  },
        { provide: Neo4jService,  useValue: mockNeo4j   },
        { provide: CacheService,  useValue: mockCache   },
      ],
    }).compile();
    importer = module.get(GraphImporter);
  });

  // ─── hash-based skip ────────────────────────────────────────────────────────

  it('skips seed when stored hash matches file hash', async () => {
    mockNeo4j.run.mockResolvedValue({
      records: [{ get: () => HASH }],
    });

    await importer.onModuleInit();

    expect(mockNeo4j.writeTransaction).not.toHaveBeenCalled();
    expect(mockCache.invalidatePattern).not.toHaveBeenCalled();
  });

  it('seeds when stored hash differs', async () => {
    mockNeo4j.run.mockResolvedValueOnce({
      records: [{ get: () => 'old-hash' }],
    }).mockResolvedValue(undefined); // constraint run

    await importer.onModuleInit();

    expect(mockNeo4j.writeTransaction).toHaveBeenCalledTimes(1);
    expect(mockCache.invalidatePattern).toHaveBeenCalledWith(CACHE_KEY_PATTERN_ALL);
  });

  it('seeds when no GraphMeta record exists yet', async () => {
    mockNeo4j.run.mockResolvedValueOnce({ records: [] })
               .mockResolvedValue(undefined);

    await importer.onModuleInit();

    expect(mockNeo4j.writeTransaction).toHaveBeenCalledTimes(1);
  });

  // ─── dangling edge detection ─────────────────────────────────────────────────

  it('throws on dangling edges (edge.to not in nodes)', async () => {
    const badLoader = {
      ...mockLoader,
      fileHash: 'new-hash',
      edges: [{ from: 'svc-a', to: 'ghost' }],
    };

    mockNeo4j.run.mockResolvedValue({ records: [] });

    const module = await Test.createTestingModule({
      providers: [
        GraphImporter,
        { provide: GraphLoader,   useValue: badLoader  },
        { provide: Neo4jService,  useValue: mockNeo4j  },
        { provide: CacheService,  useValue: mockCache  },
      ],
    }).compile();
    const imp = module.get(GraphImporter);

    await expect(imp.onModuleInit()).rejects.toThrow(/Seed aborted/);
    await expect(imp.onModuleInit()).rejects.toThrow(/"svc-a" → "ghost"/);
  });

  // ─── retry logic ─────────────────────────────────────────────────────────────

  it('retries on ServiceUnavailable and eventually succeeds', async () => {
    const transient = Object.assign(new Error('unavailable'), { code: 'ServiceUnavailable' });

    mockNeo4j.run
      .mockRejectedValueOnce(transient)
      .mockRejectedValueOnce(transient)
      .mockResolvedValue({ records: [{ get: () => HASH }] }); // hash matches → skip

    // Use 3-attempt retry with no real delay
    const withRetry = (importer as unknown as {
      withRetry(fn: () => Promise<void>, attempts?: number, delayMs?: number): Promise<void>
    }).withRetry.bind(importer);

    let calls = 0;
    const fn = async () => {
      calls++;
      if (calls < 3) throw transient;
    };

    await withRetry(fn, 4, 0);
    expect(calls).toBe(3);
  });

  it('does not retry non-transient errors', async () => {
    const logic = new Error('Syntax error in Cypher');

    mockNeo4j.run.mockRejectedValue(logic);

    let calls = 0;
    const withRetry = (importer as unknown as {
      withRetry(fn: () => Promise<void>, attempts?: number, delayMs?: number): Promise<void>
    }).withRetry.bind(importer);

    await expect(
      withRetry(async () => { calls++; throw logic; }, 4, 0)
    ).rejects.toThrow('Syntax error in Cypher');

    expect(calls).toBe(1);
  });

  it('throws after exhausting all retry attempts', async () => {
    const transient = Object.assign(new Error('down'), { code: 'ECONNREFUSED' });

    let calls = 0;
    const withRetry = (importer as unknown as {
      withRetry(fn: () => Promise<void>, attempts?: number, delayMs?: number): Promise<void>
    }).withRetry.bind(importer);

    await expect(
      withRetry(async () => { calls++; throw transient; }, 3, 0)
    ).rejects.toThrow('down');

    expect(calls).toBe(3);
  });

  // ─── isTransientError ────────────────────────────────────────────────────────

  it.each([
    'ServiceUnavailable',
    'SessionExpired',
    'ECONNREFUSED',
    'ENOTFOUND',
    'ETIMEDOUT',
  ])('treats %s as transient', (code) => {
    const err = Object.assign(new Error('err'), { code });
    const isTransient = (GraphImporter as unknown as {
      isTransientError(e: unknown): boolean
    }).isTransientError(err);
    expect(isTransient).toBe(true);
  });

  it('does not treat generic errors as transient', () => {
    const isTransient = (GraphImporter as unknown as {
      isTransientError(e: unknown): boolean
    }).isTransientError(new Error('Something went wrong'));
    expect(isTransient).toBe(false);
  });
});

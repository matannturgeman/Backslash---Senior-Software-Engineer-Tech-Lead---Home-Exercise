import { Test } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { GraphService } from './graph.service';
import { Neo4jService } from '@libs/server-neo4j';
import { ConfigService } from '@nestjs/config';
import { CacheService } from '@libs/server-cache';

const mockNeo4j  = { run: jest.fn() };
const mockCache  = { get: jest.fn().mockResolvedValue(null), set: jest.fn().mockResolvedValue(undefined) };
const mockConfig = { get: jest.fn((key: string, def: unknown) => def) };

const makeNodeRecord = (props: Record<string, unknown>) => ({
  get: (key: string) => key === 'n' ? { properties: props } : props[key],
});

const makeSegment = (fromProps: Record<string, unknown>, toProps: Record<string, unknown>) => ({
  start: { properties: fromProps },
  end:   { properties: toProps },
});

const validNode = (name: string, kind = 'service') => ({ name, kind });

describe('GraphService', () => {
  let service: GraphService;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockCache.get.mockResolvedValue(null);
    const module = await Test.createTestingModule({
      providers: [
        GraphService,
        { provide: Neo4jService,   useValue: mockNeo4j  },
        { provide: ConfigService,  useValue: mockConfig  },
        { provide: CacheService,   useValue: mockCache   },
      ],
    }).compile();
    service = module.get(GraphService);
  });

  // ─── getFullGraph ───────────────────────────────────────────────────────────

  describe('getFullGraph', () => {
    it('returns nodes and edges from neo4j', async () => {
      mockNeo4j.run
        .mockResolvedValueOnce({
          records: [
            makeNodeRecord({ name: 'svc-a', kind: 'service', publicExposed: true }),
            makeNodeRecord({ name: 'db',    kind: 'rds' }),
          ],
        })
        .mockResolvedValueOnce({
          records: [{ get: (k: string) => ({ from: 'svc-a', to: 'db' }[k]) }],
        });

      const graph = await service.getFullGraph();
      expect(graph.nodes).toHaveLength(2);
      expect(graph.edges).toEqual([{ from: 'svc-a', to: 'db' }]);
    });

    it('returns cached value without querying neo4j', async () => {
      const cached = { nodes: [{ name: 'svc-a', kind: 'service' }], edges: [] };
      mockCache.get.mockResolvedValueOnce(cached);

      const graph = await service.getFullGraph();
      expect(graph).toBe(cached);
      expect(mockNeo4j.run).not.toHaveBeenCalled();
    });

    it('stores result in cache after neo4j query', async () => {
      mockNeo4j.run
        .mockResolvedValueOnce({ records: [makeNodeRecord({ name: 'svc-a', kind: 'service' })] })
        .mockResolvedValueOnce({ records: [] });

      await service.getFullGraph();
      expect(mockCache.set).toHaveBeenCalledWith('graph:full', expect.objectContaining({ nodes: expect.any(Array) }));
    });
  });

  // ─── getFilteredGraph ───────────────────────────────────────────────────────

  describe('getFilteredGraph', () => {
    it('throws 400 for unknown filter', async () => {
      await expect(service.getFilteredGraph(['bogus'])).rejects.toThrow(BadRequestException);
    });

    it('returns cached value without querying neo4j', async () => {
      const cached = { nodes: [], edges: [] };
      mockCache.get.mockResolvedValueOnce(cached);

      const graph = await service.getFilteredGraph(['publicStart']);
      expect(graph).toBe(cached);
      expect(mockNeo4j.run).not.toHaveBeenCalled();
    });

    it('includes LIMIT in the cypher query', async () => {
      mockNeo4j.run.mockResolvedValueOnce({ records: [] });

      await service.getFilteredGraph(['publicStart']);

      const [cypher] = mockNeo4j.run.mock.calls[0] as [string];
      expect(cypher).toMatch(/LIMIT \d+/);
    });

    it('builds cypher with all filter conditions', async () => {
      mockNeo4j.run.mockResolvedValueOnce({ records: [] });

      await service.getFilteredGraph(['publicStart', 'sinkEnd']);

      const [cypher] = mockNeo4j.run.mock.calls[0] as [string];
      expect(cypher).toContain('start.publicExposed = true');
      expect(cypher).toContain('end.kind IN ["rds", "sql"]');
    });

    it('returns filter results sorted as cache key (order-independent)', async () => {
      mockNeo4j.run.mockResolvedValue({ records: [] });

      await service.getFilteredGraph(['sinkEnd', 'publicStart']);
      const key1 = mockCache.set.mock.calls[0]?.[0];

      jest.clearAllMocks();
      mockCache.get.mockResolvedValue(null);
      mockNeo4j.run.mockResolvedValue({ records: [] });

      await service.getFilteredGraph(['publicStart', 'sinkEnd']);
      const key2 = mockCache.set.mock.calls[0]?.[0];

      expect(key1).toBe(key2);
    });

    it('deduplicates nodes and edges across path segments', async () => {
      const seg = (f: string, t: string) => makeSegment(validNode(f), validNode(t));
      mockNeo4j.run.mockResolvedValueOnce({
        records: [
          { get: () => ({ segments: [seg('a', 'b'), seg('b', 'c')] }) },
          { get: () => ({ segments: [seg('a', 'b')] }) },
        ],
      });

      const graph = await service.getFilteredGraph(['publicStart']);
      const names = graph.nodes.map((n) => n.name);
      expect(new Set(names).size).toBe(names.length);
    });

    it('throws 400 when node count exceeds MAX_RESPONSE_NODES', async () => {
      mockConfig.get.mockImplementation((key: string, def: unknown) =>
        key === 'MAX_RESPONSE_NODES' ? 1 : def,
      );

      const seg = (f: string, t: string) => makeSegment(validNode(f), validNode(t));
      mockNeo4j.run.mockResolvedValueOnce({
        records: [
          { get: () => ({ segments: [seg('a', 'b'), seg('c', 'd')] }) },
        ],
      });

      await expect(service.getFilteredGraph(['publicStart'])).rejects.toThrow(BadRequestException);
    });

    it('throws ZodError when neo4j returns a node with invalid kind', async () => {
      const seg = makeSegment({ name: 'svc', kind: 'mysql' }, { name: 'db', kind: 'rds' });
      mockNeo4j.run.mockResolvedValueOnce({
        records: [{ get: () => ({ segments: [seg] }) }],
      });

      await expect(service.getFilteredGraph(['sinkEnd'])).rejects.toThrow();
    });
  });

  // ─── positiveInt (via config behaviour) ────────────────────────────────────

  describe('positiveInt fallback', () => {
    it('uses default when env var is NaN', async () => {
      mockConfig.get.mockImplementation((key: string, def: unknown) =>
        key === 'MAX_PATH_DEPTH' ? NaN : def,
      );
      mockNeo4j.run.mockResolvedValueOnce({ records: [] });

      await service.getFilteredGraph(['publicStart']);
      const [cypher] = mockNeo4j.run.mock.calls[0] as [string];
      // Default depth is 20
      expect(cypher).toContain('CALLS*1..20');
    });

    it('uses default when env var is zero', async () => {
      mockConfig.get.mockImplementation((key: string, def: unknown) =>
        key === 'MAX_PATH_DEPTH' ? 0 : def,
      );
      mockNeo4j.run.mockResolvedValueOnce({ records: [] });

      await service.getFilteredGraph(['publicStart']);
      const [cypher] = mockNeo4j.run.mock.calls[0] as [string];
      expect(cypher).toContain('CALLS*1..20');
    });
  });
});

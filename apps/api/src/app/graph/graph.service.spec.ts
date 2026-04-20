import { Test } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { GraphService } from './graph.service.js';
import { Neo4jService } from '../neo4j/neo4j.service.js';

const mockNeo4j = { run: jest.fn() };

const makeNodeRecord = (props: Record<string, unknown>) => ({
  get: (key: string) =>
    key === 'n' ? { properties: props } : props[key],
});

describe('GraphService', () => {
  let service: GraphService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module = await Test.createTestingModule({
      providers: [
        GraphService,
        { provide: Neo4jService, useValue: mockNeo4j },
      ],
    }).compile();
    service = module.get(GraphService);
  });

  describe('getFullGraph', () => {
    it('returns nodes and edges from neo4j', async () => {
      mockNeo4j.run
        .mockResolvedValueOnce({
          records: [
            makeNodeRecord({ name: 'svc-a', kind: 'service', publicExposed: true }),
            makeNodeRecord({ name: 'db', kind: 'rds', publicExposed: false }),
          ],
        })
        .mockResolvedValueOnce({
          records: [{ get: (k: string) => ({ from: 'svc-a', to: 'db' }[k]) }],
        });

      const graph = await service.getFullGraph();
      expect(graph.nodes).toHaveLength(2);
      expect(graph.edges).toEqual([{ from: 'svc-a', to: 'db' }]);
    });
  });

  describe('getFilteredGraph', () => {
    it('throws 400 for unknown filter', async () => {
      await expect(service.getFilteredGraph(['bogus'])).rejects.toThrow(BadRequestException);
    });

    it('builds correct cypher and returns subgraph', async () => {
      const segment = {
        start: { properties: { name: 'frontend', kind: 'service', publicExposed: true } },
        end:   { properties: { name: 'db', kind: 'rds', publicExposed: false } },
      };
      mockNeo4j.run.mockResolvedValueOnce({
        records: [{ get: () => ({ segments: [segment] }) }],
      });

      const graph = await service.getFilteredGraph(['publicStart', 'sinkEnd']);

      const [cypher] = mockNeo4j.run.mock.calls[0] as [string];
      expect(cypher).toContain('start.publicExposed = true');
      expect(cypher).toContain('end.kind IN ["rds", "sql"]');
      expect(graph.nodes.map((n) => n.name)).toContain('frontend');
      expect(graph.nodes.map((n) => n.name)).toContain('db');
    });

    it('deduplicates nodes and edges across path segments', async () => {
      const seg = (from: string, to: string) => ({
        start: { properties: { name: from, kind: 'service' } },
        end:   { properties: { name: to, kind: 'service' } },
      });
      mockNeo4j.run.mockResolvedValueOnce({
        records: [
          { get: () => ({ segments: [seg('a', 'b'), seg('b', 'c')] }) },
          { get: () => ({ segments: [seg('a', 'b')] }) }, // duplicate
        ],
      });

      const graph = await service.getFilteredGraph(['publicStart']);
      const names = graph.nodes.map((n) => n.name);
      expect(new Set(names).size).toBe(names.length);
    });
  });
});

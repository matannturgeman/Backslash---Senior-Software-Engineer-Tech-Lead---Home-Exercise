import { Test } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { GraphController } from './graph.controller';
import { GraphService, AVAILABLE_FILTERS } from '@libs/server-graph';

const mockGraphService = {
  getFullGraph:     jest.fn(),
  getFilteredGraph: jest.fn(),
};

describe('GraphController', () => {
  let controller: GraphController;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module = await Test.createTestingModule({
      controllers: [GraphController],
      providers: [{ provide: GraphService, useValue: mockGraphService }],
    }).compile();
    controller = module.get(GraphController);
  });

  // ─── getGraph ───────────────────────────────────────────────────────────────

  describe('getGraph', () => {
    it('delegates to GraphService.getFullGraph', async () => {
      const graph = { nodes: [], edges: [] };
      mockGraphService.getFullGraph.mockResolvedValue(graph);

      await expect(controller.getGraph()).resolves.toBe(graph);
      expect(mockGraphService.getFullGraph).toHaveBeenCalledTimes(1);
    });
  });

  // ─── getFilters ─────────────────────────────────────────────────────────────

  describe('getFilters', () => {
    it('returns the list of available filter names', () => {
      const result = controller.getFilters();
      expect(result).toEqual({ filters: AVAILABLE_FILTERS });
    });
  });

  // ─── getRoutes ──────────────────────────────────────────────────────────────

  describe('getRoutes', () => {
    it('throws 400 when filters param is empty string', async () => {
      expect(() => controller.getRoutes('')).toThrow(BadRequestException);
    });

    it('throws 400 when filters param is whitespace only', async () => {
      expect(() => controller.getRoutes('   ')).toThrow(BadRequestException);
    });

    it('delegates parsed filter names to GraphService.getFilteredGraph', async () => {
      const graph = { nodes: [], edges: [] };
      mockGraphService.getFilteredGraph.mockResolvedValue(graph);

      await expect(controller.getRoutes('publicStart,sinkEnd')).resolves.toBe(graph);
      expect(mockGraphService.getFilteredGraph).toHaveBeenCalledWith(['publicStart', 'sinkEnd']);
    });

    it('trims whitespace around individual filter names', async () => {
      mockGraphService.getFilteredGraph.mockResolvedValue({ nodes: [], edges: [] });

      await controller.getRoutes(' publicStart , sinkEnd ');

      expect(mockGraphService.getFilteredGraph).toHaveBeenCalledWith(['publicStart', 'sinkEnd']);
    });

    it('ignores empty segments from double commas', async () => {
      mockGraphService.getFilteredGraph.mockResolvedValue({ nodes: [], edges: [] });

      await controller.getRoutes('publicStart,,sinkEnd');

      expect(mockGraphService.getFilteredGraph).toHaveBeenCalledWith(['publicStart', 'sinkEnd']);
    });

    it('propagates BadRequestException from GraphService (unknown filter)', async () => {
      mockGraphService.getFilteredGraph.mockRejectedValue(new BadRequestException('Unknown filter'));

      await expect(controller.getRoutes('bogus')).rejects.toThrow(BadRequestException);
    });
  });
});

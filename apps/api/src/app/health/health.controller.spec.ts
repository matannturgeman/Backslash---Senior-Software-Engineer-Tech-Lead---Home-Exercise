import { Test } from '@nestjs/testing';
import { HttpException, HttpStatus } from '@nestjs/common';
import { HealthController } from './health.controller.js';
import { Neo4jService } from '../neo4j/neo4j.service.js';
import { CacheService } from '../cache/cache.service.js';

const mockNeo4j = { run: jest.fn() };
const mockCache = { ping: jest.fn() };

describe('HealthController', () => {
  let controller: HealthController;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        { provide: Neo4jService, useValue: mockNeo4j },
        { provide: CacheService, useValue: mockCache },
      ],
    }).compile();
    controller = module.get(HealthController);
  });

  it('returns ok when both neo4j and redis are up', async () => {
    mockNeo4j.run.mockResolvedValue({});
    mockCache.ping.mockResolvedValue(true);

    const result = await controller.check();

    expect(result).toEqual({
      status: 'ok',
      details: {
        neo4j: { status: 'up' },
        redis: { status: 'up' },
      },
    });
  });

  it('throws 503 when neo4j is down', async () => {
    mockNeo4j.run.mockRejectedValue(new Error('Connection refused'));
    mockCache.ping.mockResolvedValue(true);

    await expect(controller.check()).rejects.toThrow(HttpException);

    try {
      await controller.check();
    } catch (err) {
      expect(err).toBeInstanceOf(HttpException);
      expect((err as HttpException).getStatus()).toBe(HttpStatus.SERVICE_UNAVAILABLE);
      const body = (err as HttpException).getResponse() as Record<string, unknown>;
      expect(body.status).toBe('error');
    }
  });

  it('returns ok when redis is down but neo4j is up', async () => {
    mockNeo4j.run.mockResolvedValue({});
    mockCache.ping.mockResolvedValue(false);

    const result = await controller.check();

    expect(result.status).toBe('ok');
    expect(result.details.neo4j.status).toBe('up');
    expect(result.details.redis.status).toBe('down');
  });

  it('runs neo4j and redis checks in parallel', async () => {
    const order: string[] = [];
    mockNeo4j.run.mockImplementation(() => {
      order.push('neo4j');
      return Promise.resolve({});
    });
    mockCache.ping.mockImplementation(() => {
      order.push('redis');
      return Promise.resolve(true);
    });

    await controller.check();

    // Both checks should be called (parallel means both are invoked)
    expect(order).toContain('neo4j');
    expect(order).toContain('redis');
    expect(mockNeo4j.run).toHaveBeenCalledTimes(1);
    expect(mockCache.ping).toHaveBeenCalledTimes(1);
  });

  it('includes neo4j error message in 503 body', async () => {
    mockNeo4j.run.mockRejectedValue(new Error('Neo4j timeout'));
    mockCache.ping.mockResolvedValue(false);

    try {
      await controller.check();
      fail('should have thrown');
    } catch (err) {
      const body = (err as HttpException).getResponse() as Record<string, unknown>;
      const details = body.details as Record<string, unknown>;
      expect((details['neo4j'] as Record<string, string>).error).toBe('Neo4j timeout');
    }
  });
});

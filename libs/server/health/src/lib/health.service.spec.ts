import { Test } from '@nestjs/testing';
import { HttpException, HttpStatus } from '@nestjs/common';
import { HealthService } from './health.service';
import { GRAPH_REPOSITORY } from '@libs/server-neo4j';
import { CACHE_SERVICE } from '@libs/server-cache';

const mockGraphRepo = { run: jest.fn() };
const mockCache     = { ping: jest.fn() };

const getBody = (err: HttpException) =>
  err.getResponse() as { status: string; details: Record<string, unknown> };

describe('HealthService', () => {
  let service: HealthService;

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      providers: [
        HealthService,
        { provide: GRAPH_REPOSITORY, useValue: mockGraphRepo },
        { provide: CACHE_SERVICE,    useValue: mockCache     },
      ],
    }).compile();
    service = module.get(HealthService);
  });

  beforeEach(() => jest.clearAllMocks());

  // ─── check ──────────────────────────────────────────────────────────────────

  describe('check', () => {
    it('returns ok when both neo4j and redis are up', async () => {
      mockGraphRepo.run.mockResolvedValue(undefined);
      mockCache.ping.mockResolvedValue(true);

      await expect(service.check()).resolves.toEqual({
        status: 'ok',
        details: {
          neo4j: { status: 'up' },
          redis: { status: 'up' },
        },
      });
    });

    it('returns ok with redis degraded when only redis is down', async () => {
      mockGraphRepo.run.mockResolvedValue(undefined);
      mockCache.ping.mockResolvedValue(false);

      const result = await service.check();

      expect(result.status).toBe('ok');
      expect(result.details.redis).toEqual({ status: 'down', error: 'Redis unavailable' });
    });

    it('returns ok with redis degraded when ping() throws', async () => {
      mockGraphRepo.run.mockResolvedValue(undefined);
      mockCache.ping.mockRejectedValue(new Error('connection reset'));

      const result = await service.check();

      expect(result.status).toBe('ok');
      expect(result.details.redis).toMatchObject({ status: 'down', error: 'connection reset' });
    });

    it('throws 503 when neo4j is down, with full details in body', async () => {
      expect.assertions(4);
      mockGraphRepo.run.mockRejectedValue(new Error('bolt handshake failed'));
      mockCache.ping.mockResolvedValue(true);

      try {
        await service.check();
      } catch (err) {
        expect(err).toBeInstanceOf(HttpException);
        expect((err as HttpException).getStatus()).toBe(HttpStatus.SERVICE_UNAVAILABLE);
        const { status, details } = getBody(err as HttpException);
        expect(status).toBe('error');
        expect(details['neo4j']).toMatchObject({ status: 'down', error: 'bolt handshake failed' });
      }
    });

    it('includes redis status in 503 body when both are down', async () => {
      expect.assertions(2);
      mockGraphRepo.run.mockRejectedValue(new Error('neo4j gone'));
      mockCache.ping.mockResolvedValue(false);

      try {
        await service.check();
      } catch (err) {
        const { details } = getBody(err as HttpException);
        expect(details['neo4j']).toMatchObject({ status: 'down' });
        expect(details['redis']).toMatchObject({ status: 'down' });
      }
    });

    it('calls both neo4j and redis checks on each invocation', async () => {
      mockGraphRepo.run.mockResolvedValue(undefined);
      mockCache.ping.mockResolvedValue(true);

      await service.check();

      expect(mockGraphRepo.run).toHaveBeenCalledTimes(1);
      expect(mockCache.ping).toHaveBeenCalledTimes(1);
    });
  });
});

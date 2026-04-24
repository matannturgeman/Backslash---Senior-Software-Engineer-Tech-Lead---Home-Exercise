import { Test } from '@nestjs/testing';
import { HttpException, HttpStatus } from '@nestjs/common';
import { HealthController } from './health.controller';
import { HealthService } from '@libs/server-health';

const mockHealthService = { check: jest.fn() };

describe('HealthController', () => {
  let controller: HealthController;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [{ provide: HealthService, useValue: mockHealthService }],
    }).compile();
    controller = module.get(HealthController);
  });

  it('delegates to HealthService.check and returns its result', async () => {
    const response = {
      status: 'ok' as const,
      details: { database: { status: 'up' as const }, redis: { status: 'up' as const } },
    };
    mockHealthService.check.mockResolvedValue(response);

    await expect(controller.check()).resolves.toBe(response);
    expect(mockHealthService.check).toHaveBeenCalledTimes(1);
  });

  it('propagates HttpException from HealthService', async () => {
    const error = new HttpException(
      { status: 'error', details: { database: { status: 'down', error: 'gone' }, redis: { status: 'up' } } },
      HttpStatus.SERVICE_UNAVAILABLE,
    );
    mockHealthService.check.mockRejectedValue(error);

    await expect(controller.check()).rejects.toThrow(HttpException);
  });
});

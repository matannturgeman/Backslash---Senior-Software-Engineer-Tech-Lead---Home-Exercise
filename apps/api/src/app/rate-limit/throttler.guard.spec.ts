import { ExecutionContext } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AppThrottlerGuard } from './throttler.guard.js';

const fakeContext = {} as ExecutionContext;

async function buildGuard(nodeEnv: string | undefined): Promise<AppThrottlerGuard> {
  const mockConfig = { get: jest.fn((key: string) => key === 'NODE_ENV' ? nodeEnv : undefined) };
  const module = await Test.createTestingModule({
    imports: [ThrottlerModule.forRoot([{ ttl: 60_000, limit: 60 }])],
    providers: [
      AppThrottlerGuard,
      { provide: ConfigService, useValue: mockConfig },
    ],
  }).compile();
  return module.get(AppThrottlerGuard);
}

describe('AppThrottlerGuard', () => {
  it('skips throttling when NODE_ENV is development', async () => {
    const guard = await buildGuard('development');
    await expect(guard.canActivate(fakeContext)).resolves.toBe(true);
  });

  it('skips throttling when NODE_ENV is test', async () => {
    const guard = await buildGuard('test');
    await expect(guard.canActivate(fakeContext)).resolves.toBe(true);
  });

  it('skips throttling when NODE_ENV is undefined', async () => {
    const guard = await buildGuard(undefined);
    await expect(guard.canActivate(fakeContext)).resolves.toBe(true);
  });

  it('delegates to ThrottlerGuard when NODE_ENV is production', async () => {
    const guard = await buildGuard('production');
    const spy = jest
      .spyOn(ThrottlerGuard.prototype, 'canActivate')
      .mockResolvedValue(true);

    const result = await guard.canActivate(fakeContext);

    expect(spy).toHaveBeenCalledWith(fakeContext);
    expect(result).toBe(true);
    spy.mockRestore();
  });
});

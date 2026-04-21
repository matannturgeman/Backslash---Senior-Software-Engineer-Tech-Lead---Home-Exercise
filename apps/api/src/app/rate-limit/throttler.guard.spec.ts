import { ExecutionContext } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ThrottlerModule } from '@nestjs/throttler';
import { AppThrottlerGuard } from './throttler.guard.js';

const fakeContext = {} as ExecutionContext;

describe('AppThrottlerGuard', () => {
  let guard: AppThrottlerGuard;
  const originalEnv = process.env['NODE_ENV'];

  afterEach(() => {
    process.env['NODE_ENV'] = originalEnv;
  });

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      imports: [ThrottlerModule.forRoot([{ ttl: 60_000, limit: 60 }])],
      providers: [AppThrottlerGuard],
    }).compile();
    guard = module.get(AppThrottlerGuard);
  });

  it('skips throttling when NODE_ENV is development', async () => {
    process.env['NODE_ENV'] = 'development';
    await expect(guard.canActivate(fakeContext)).resolves.toBe(true);
  });

  it('skips throttling when NODE_ENV is test', async () => {
    process.env['NODE_ENV'] = 'test';
    await expect(guard.canActivate(fakeContext)).resolves.toBe(true);
  });

  it('skips throttling when NODE_ENV is undefined', async () => {
    delete process.env['NODE_ENV'];
    await expect(guard.canActivate(fakeContext)).resolves.toBe(true);
  });

  it('delegates to ThrottlerGuard when NODE_ENV is production', async () => {
    process.env['NODE_ENV'] = 'production';
    // super.canActivate will throw because fakeContext is not a real HTTP context —
    // that confirms it actually called the parent (throttler logic ran)
    await expect(guard.canActivate(fakeContext)).rejects.toThrow();
  });
});

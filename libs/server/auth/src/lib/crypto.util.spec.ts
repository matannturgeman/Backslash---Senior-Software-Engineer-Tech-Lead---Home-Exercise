import { createHash } from 'node:crypto';
import {
  createOpaqueToken,
  hashOpaqueToken,
  hashPassword,
  verifyPassword,
} from './crypto.util';

describe('crypto.util', () => {
  it('hashes and verifies password successfully', async () => {
    const hashed = await hashPassword('super-secret');

    expect(hashed.startsWith('scrypt:')).toBe(true);
    await expect(verifyPassword('super-secret', hashed)).resolves.toBe(true);
    await expect(verifyPassword('wrong-password', hashed)).resolves.toBe(false);
  });

  it('returns false for malformed password hash payload', async () => {
    await expect(verifyPassword('super-secret', 'invalid-format')).resolves.toBe(
      false,
    );
  });

  it('creates opaque token as 64-char hex string', () => {
    const token = createOpaqueToken();

    expect(token).toMatch(/^[0-9a-f]{64}$/i);
  });

  it('hashes opaque token with sha256', () => {
    const token = 'abc123';
    const expected = createHash('sha256').update(token).digest('hex');

    expect(hashOpaqueToken(token)).toBe(expected);
  });
});

import { createHash, randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const scryptAsync = promisify(scrypt);
const HASH_ALGORITHM = 'scrypt';
const SALT_BYTES = 16;
const KEY_LENGTH = 64;

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_BYTES).toString('hex');
  const derived = (await scryptAsync(password, salt, KEY_LENGTH)) as Buffer;

  return `${HASH_ALGORITHM}:${salt}:${derived.toString('hex')}`;
}

export async function verifyPassword(
  password: string,
  encodedHash: string,
): Promise<boolean> {
  const [algorithm, salt, storedHashHex] = encodedHash.split(':');

  if (algorithm !== HASH_ALGORITHM || !salt || !storedHashHex) {
    return false;
  }

  const storedHash = Buffer.from(storedHashHex, 'hex');
  const derived = (await scryptAsync(password, salt, storedHash.length)) as Buffer;

  if (derived.length !== storedHash.length) {
    return false;
  }

  return timingSafeEqual(derived, storedHash);
}

export function createOpaqueToken(): string {
  return randomBytes(32).toString('hex');
}

export function hashOpaqueToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

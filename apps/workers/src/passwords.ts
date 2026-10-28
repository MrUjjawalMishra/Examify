import { pbkdf2, randomBytes, timingSafeEqual } from 'node:crypto';

const ITERATIONS = 600000;
function derive(password: string, salt: string): Promise<Buffer> {
  return new Promise((resolve, reject) => pbkdf2(password, salt, ITERATIONS, 32, 'sha256',
    (error, key) => error ? reject(error) : resolve(key)));
}
export function validPassword(value: unknown): value is string {
  return typeof value === 'string' && value.length >= 1 && new TextEncoder().encode(value).length <= 256;
}
export async function hashPassword(password: string): Promise<string> {
  if (!validPassword(password)) throw new Error('INVALID_PASSWORD');
  const salt = randomBytes(16).toString('hex');
  return `pbkdf2-sha256$${ITERATIONS}$${salt}$${(await derive(password, salt)).toString('hex')}`;
}
export async function verifyPassword(password: string, encoded: string): Promise<boolean> {
  if (!validPassword(password)) return false;
  const match = /^pbkdf2-sha256\$600000\$([a-f0-9]{32})\$([a-f0-9]{64})$/.exec(encoded);
  if (!match) return false;
  return timingSafeEqual(await derive(password, match[1]), Buffer.from(match[2], 'hex'));
}
// Equivalent password work for nonexistent accounts; never a usable account credential.
export const DUMMY_HASH = `pbkdf2-sha256$600000$${'0'.repeat(32)}$${'0'.repeat(64)}`;

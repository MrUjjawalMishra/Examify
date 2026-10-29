import { pbkdf2, scrypt, randomBytes, timingSafeEqual } from "node:crypto";

const ITERATIONS = 600000;
function derive(password: string, salt: string): Promise<Buffer> {
  return new Promise((resolve, reject) =>
    pbkdf2(password, salt, ITERATIONS, 32, "sha256", (error, key) =>
      error ? reject(error) : resolve(key),
    ),
  );
}
function deriveScrypt(password: string, salt: string): Promise<Buffer> {
  return new Promise((resolve, reject) =>
    scrypt(
      password,
      salt,
      32,
      { N: 16384, r: 8, p: 5, maxmem: 32 * 1024 * 1024 },
      (error, key) => (error ? reject(error) : resolve(key)),
    ),
  );
}
export function validPassword(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length >= 1 &&
    new TextEncoder().encode(value).length <= 256
  );
}
export async function hashPassword(password: string): Promise<string> {
  if (!validPassword(password)) throw new Error("INVALID_PASSWORD");
  const salt = randomBytes(16).toString("hex");
  return `scrypt$16384$8$5$${salt}$${(await deriveScrypt(password, salt)).toString("hex")}`;
}
export async function verifyPassword(
  password: string,
  encoded: string,
): Promise<boolean> {
  if (!validPassword(password)) return false;
  const scryptMatch =
    /^scrypt\$16384\$8\$5\$([a-f0-9]{32})\$([a-f0-9]{64})$/.exec(encoded);
  if (scryptMatch)
    return timingSafeEqual(
      await deriveScrypt(password, scryptMatch[1]),
      Buffer.from(scryptMatch[2], "hex"),
    );
  const match = /^pbkdf2-sha256\$600000\$([a-f0-9]{32})\$([a-f0-9]{64})$/.exec(
    encoded,
  );
  if (!match) return false;
  return timingSafeEqual(
    await derive(password, match[1]),
    Buffer.from(match[2], "hex"),
  );
}
// Equivalent password work for nonexistent accounts; never a usable account credential.
export const DUMMY_HASH = `scrypt$16384$8$5$${"0".repeat(32)}$${"0".repeat(64)}`;

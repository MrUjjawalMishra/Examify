// Operator-only setup. Generates test credentials into an ignored directory; prints no secrets.
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { randomBytes, randomUUID, scryptSync } from "node:crypto";
const dir = new URL("../../../.local/", import.meta.url);
await mkdir(dir, { recursive: true });
const target = new URL("staging-credentials.json", dir);
let credentials;
try {
  credentials = JSON.parse(await readFile(target, "utf8"));
} catch (e) {
  if (e.code !== "ENOENT") throw e;
  credentials = {
    ownerEmail: "owner@examify.test",
    ownerPassword: randomBytes(24).toString("base64url"),
    adminPassword: randomBytes(24).toString("base64url"),
    internalKey: randomBytes(32).toString("hex"),
  };
  await writeFile(target, JSON.stringify(credentials, null, 2), {
    mode: 0o600,
  });
}
const salt = randomBytes(16).toString("hex");
// Match passwords.ts serialization exactly.
const passwordHash = `scrypt$16384$8$5$${salt}$${scryptSync(credentials.ownerPassword, salt, 32, { N: 16384, r: 8, p: 5, maxmem: 32 * 1024 * 1024 }).toString("hex")}`;
const quote = (s) => "'" + s.replaceAll("'", "''") + "'";
await writeFile(
  new URL("bootstrap-owner.sql", dir),
  `INSERT INTO owners(id,email,password_hash) VALUES(${quote(randomUUID())},${quote(credentials.ownerEmail)},${quote(passwordHash)}) ON CONFLICT(email) DO NOTHING;`,
);
if (process.argv.includes("--repair-unusable-pbkdf2"))
  await writeFile(
    new URL("repair-staging-owner.sql", dir),
    `UPDATE owners SET password_hash=${quote(passwordHash)},credential_version=credential_version+1 WHERE email=${quote(credentials.ownerEmail)} AND password_hash LIKE 'pbkdf2-sha256$600000$%';`,
  );
await writeFile(
  new URL("worker-secrets.json", dir),
  JSON.stringify({ INTERNAL_KEY: credentials.internalKey }),
  { mode: 0o600 },
);
console.log(
  "Prepared ignored staging credential, owner bootstrap and Worker secret files.",
);

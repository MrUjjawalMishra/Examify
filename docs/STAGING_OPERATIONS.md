# Staging operations

Public application: https://examify-staging.mr-ujjawalmishra.workers.dev

Production `examify` is unchanged. Use only fabricated data on staging.

## Resources

| Worker | D1 database | Private R2 bucket |
|---|---|---|
| examify-staging | examify-staging-control (`d6971e11-d463-41f8-a5c1-7c93b98e57b0`) | none |
| examify-staging-school-1 | examify-staging-school-1 (`1e0658d7-d666-4a20-9c97-f156d7faf608`) | examify-staging-school-1-private |
| examify-staging-school-2 | examify-staging-school-2 (`a5b97f8e-360d-432d-8493-10d1ca56059a`) | examify-staging-school-2-private |

The tenant Workers disable workers.dev and preview URLs. Gateway bindings select tenants; request bodies cannot select a database. INTERNAL_KEY is configured as a secret on all three Workers. Never commit or print it. Buckets have no configured public routes.

## Reproduce verification

Use Node 24 and run from the repository root:

```sh
npm ci --prefix apps/web
npm ci --prefix apps/workers
npm --prefix apps/workers run typecheck
npm --prefix apps/workers test
npm --prefix apps/web run build
```

From `apps/workers`, run `node scripts/staging-browser.mjs` for the live Chrome test. Chrome must be installed; set EXAMIFY_BROWSER_CHANNEL=msedge to use installed Edge. The script only targets the named staging host and uses the ignored `.local/staging-credentials.json`. It creates or reuses C8 and ABC, provisions a teacher and a 30-student roster, verifies role interfaces and private media, changes a test student's password, then resets it. It writes non-secret evidence under `test-results/`. Do not use it against production.

## Migrate and deploy

Run from `apps/workers` using the installed Wrangler:

```sh
npx wrangler d1 migrations apply CONTROL --remote -c wrangler.staging.json
npx wrangler d1 migrations apply DB --remote -c wrangler.staging-school-1.json
npx wrangler d1 migrations apply DB --remote -c wrangler.staging-school-2.json
npx wrangler deploy -c wrangler.staging-school-1.json
npx wrangler deploy -c wrangler.staging-school-2.json
npx wrangler deploy -c wrangler.staging.json
```

Wrangler's migration ledger prevents repeated migration application. Deploy only after the web build and tests succeed. Preserve a known Git commit and record the returned Worker version IDs. Do not use the old default wrangler.toml to target staging.

## Owner bootstrap and operation

`node scripts/prepare-staging.mjs` creates random staging-only owner/admin credentials and the internal key in an ignored local file. It never prints them. It creates a bootstrap SQL file containing only a salted hash. Apply it to CONTROL with `wrangler d1 execute CONTROL --remote -c wrangler.staging.json --file ../../.local/bootstrap-owner.sql`. Existing owner records are not overwritten.

Configure secrets with `wrangler secret bulk ../../.local/worker-secrets.json -c <staging-config>` for each of the three configurations. Existing credentials must be backed up securely before local-file removal. File mode requests are not a substitute for Windows account access controls; keep this directory private to the operator. No credentials are provided through public signup or public setup routes.

Open `/owner` and use the local owner credentials. Create a school with its code, administrator ID and initial password. Once active, search for its code on the school sign-in page. Administrators create teachers and assign class/section/subject. Teachers import reviewed CSV/XLSX rosters and print credential slips. Retried rows do not disclose passwords again; authorized teachers can reset them. Students may voluntarily change passwords. Private images are currently uploader-only, without examination sharing.

## Limits and recovery

Two staging slots are allocated. Expansion requires reviewed dedicated Worker/D1/R2 resources and service bindings. No paid plan was activated. Capacity failure does not allocate unrelated resources. Retry a failed school initialization using the same request ID; do not delete or reassign its database. Resource deletion and production migrations require backup and owner approval.

New passwords use scrypt N=16384, r=8, p=5, a random salt, and constant-time verification. These are [OWASP-listed parameters](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html). Native scrypt is supported by [Cloudflare node:crypto](https://developers.cloudflare.com/workers/runtime-apis/nodejs/crypto/). The deployed runtime rejected the previous 600,000-iteration PBKDF2 implementation despite local tests passing; the single staging bootstrap owner was repaired before user provisioning. Previously generated local PBKDF2 fixtures require re-provisioning or an authorized password reset before remote use; do not lower their work factor silently.

Assessment-aware file permissions, retention scheduling, scalable provisioning, load testing, AI credentials and all examination workflows remain release work. The current ExcelJS dependency audit reports two moderate findings through uuid (GHSA-w5hq-g745-h8pq); the app does not call the affected v3/v5/v6 buffer APIs, but dependency remediation remains tracked. XLSX code loads only when importing and produces a large optional browser chunk.

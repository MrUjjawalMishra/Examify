# Managed authentication operations

Supabase Free handles salted password storage and verification. Cloudflare D1 is authoritative for users, roles, assignments, school status and sessions. Provider tokens are discarded. School identity comes from the immutable tenant database and gateway service binding, never the submitted school ID.

## Configuration

Staging uses `AUTH_MODE=supabase` and the public `SUPABASE_URL`. Store `SUPABASE_ADMIN_KEY` and `AUTH_PASSWORD_PEPPER` as Worker secrets on the gateway and both existing tenant Workers. The pepper must be identical across those Workers and preserved across deployments. Changing it is a credential migration, not a routine rotation. The provider administrator key can rotate independently.

The ignored `.local/supabase-auth.json` holds `{url,adminKey}`. Never print it. `verify-supabase.mjs --provision-test` checks disabled public/anonymous signup, authorized provider creation and provider login. It retains a synthetic provider-only fixture under `.local/`; that user has no D1 account or application privileges.

## Existing synthetic staging migration

From `apps/workers`, run `node scripts/migrate-managed-staging.mjs --apply` only after the owner confirms compromised-key retirement. It targets exactly the existing staging gateway and two school resources, exports backups to ignored `.local/managed-backup-*`, verifies known fixture passwords against their existing hashes, then applies tenant migration 0005. Unknown passwords stop migration rather than being reset. Existing user IDs, usernames and plaintext login conventions are preserved. Never use this fixture-specific script for production users.

The script stores a durable random pepper locally, reconciles provider identities, verifies provider login, replaces local password hashes with a managed-state marker and bumps credential versions. It uploads only the provider administrator key and pepper as staging secrets. Deploy the tested code immediately after a successful migration; old local-password handlers cannot authenticate migrated records. If migration stops midway, preserve backups and pepper and rerun after resolving the reported error. Do not automatically restore old credentials over new account changes.

## Provisioning and recovery

New account IDs are deterministic UUIDs derived from school, creator and request ID. Creation first reserves an inactive D1 account and idempotency record. Provider creation uses that exact ID and school metadata; retries reconcile existing provider identities without resetting passwords. Only successful provider provisioning activates the D1 account. Retrying a pending request must preserve its original input. Completed retries do not redisplay passwords. Teachers retain authorized password reset capability if the creation response was lost.

Password changes first invalidate all sessions and record the intended credential version and keyed fingerprint in D1. Login stays blocked until provider and D1 updates complete. The fingerprint is SHA-256 over a secret-keyed HMAC preprocessing value; it is not the provider password or a reusable bearer credential. Keep the pepper separate from D1 exports. Supabase still performs the password verification before a session is issued.

The same intended password can resume a failed operation. A login supplying that exact password resumes the pending operation and returns `CREDENTIALS_CHANGED_RETRY_LOGIN`; a subsequent login verifies with Supabase and issues a new D1 session. A different password cannot replace a pending operation. Concurrent suspension/version changes fail closed and may require operator reconciliation; do not clear pending records or reactivate accounts without checking current authorization and provider state.

## Acceptance and limits

Local tests with real D1 and a provider contract double do not establish deployed acceptance. Run the live provider check, full Worker tests, frontend build, staging browser workflow and Cloudflare CPU/error inspection. Record exact deployed versions. Production is excluded from these scripts and configurations.

No paid plans are enabled by these commands. Provider outages and quota failures deny authentication rather than falling back to local hashing or synthetic sessions. The strict zero-cost requirement still requires account-level monitoring and conservative R2 usage limits before broader launch; R2 allowances are not a hard spending cap. Examination/AI workflows remain separate unfinished product work.

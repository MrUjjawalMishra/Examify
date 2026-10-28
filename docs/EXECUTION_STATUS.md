# Execution evidence — 28 October 2026

## Access and existing infrastructure

Cloudflare MCP whoami and authenticated API reads succeeded. Account: e746f9041a0f5eddfd51c206531b3393. Confirmed Worker: examify, with static assets, no bindings, compatibility date 2026-10-19, enabled workers.dev and preview URLs. Existing deployment version: cb8df9f3-213c-4949-9215-fa67ee313d56. Address derived from the enabled Worker and account subdomain: https://examify.mr-ujjawalmishra.workers.dev. This is an existing deployment, not a newly delivered release.

No D1 databases exist. R2 API returned error 10042 requiring dashboard enablement. Connection has R2 read/write permissions; reconnecting is not the remedy. Owner must review billing and enable R2. Unrelated Pages project ujjawal is excluded from changes.

cf auth whoami reports authenticated=true and tokenValid=true. Local Wrangler reports 4.153.0. Remote write/deployment has not been exercised; successful reads alone are not proof of a successful deployment.

## Preserved baseline

Commit 118094b on codex/production-foundation was pushed to MrUjjawalMishra/Examify. Contains previous tenant/score fixes, classroom credential generation, dependency repair, updated tooling, and removal of generated dependencies from Git tracking. All 37 baseline tests and Worker TypeScript checks passed after restart.

## New session foundation

Tenant migration creates identity, users, hashed-token sessions and append-only application audit tables. Schools use separate databases; tenant identity is checked on session creation and every lookup. Sessions enforce account activation, school activation, credential version and server expiry. Cookies use Secure, HttpOnly, SameSite=Strict and __Host- scope. Raw tokens are never stored in the database. Same-origin validation is provided for authenticated writes.

Local integration tests use actual workerd D1 bindings for two databases and verify cross-school token rejection, incorrect tenant identity, expiry boundary, school suspension, credential-version invalidation and logout. Password verification, owner authentication, HTTP endpoint integration, role dashboards and full provisioning are NOT completed by this foundation. The session creation helper is internal and must only be invoked after password verification.

No remote resources were created, no migrations were applied remotely, no production code was replaced, and no AI requests were sent. Product acceptance remains incomplete.

## R2 activation follow-up

Owner confirmed activation. Authenticated R2 bucket listing now succeeds and returns an empty list. The activation blocker is resolved; no bucket has been created yet.

Session creation now requires the credential version observed during password verification and compares it atomically in the INSERT. A password reset between verification and session issuance therefore rejects the stale login. The D1 integration test covers this race.

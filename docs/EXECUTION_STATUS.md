# Execution status — 2 November 2026

## Managed authentication: staging verified

Commit `56cbf35ab34a75df3dfcdbb172085e07bcf8a5f5` is pushed to `codex/production-foundation`. Live URL: https://examify-staging.mr-ujjawalmishra.workers.dev . Production Worker `examify` was not changed.

Versions verified on 31 October:
- Gateway: `302db74e-5a36-4a6e-ad69-eb31e8c2088c`
- School 1: `9a1c4597-c449-401c-a1dc-13493b7ba26b`
- School 2: `f280e4f8-aca6-4da6-a2fc-d69e0b3ddc40`

The completed real-browser workflow verified owner login; C8/ABC environment listing; school selection and admin login; existing teacher login and subject assignment; a 30-student CSV roster including retry recovery; student profile; private R2 image upload; cross-school/owner access denial; voluntary password change; teacher reset; invalidation of prior student sessions; and no browser JavaScript errors. Existing schools/teacher were reused, not recreated in that run. Local integration tests separately exercise new school and teacher provisioning. Evidence: ignored `test-results/staging-browser.json`, completed 2026-10-31T02:43:41.571Z.

Cloudflare telemetry sampled 156 completed invocations of those versions over the queried 20-minute window: maximum CPU 9 ms, zero exceededCpu outcomes. Owner login max 5 ms, school login max 7 ms, student creation max 9 ms, password change 9 ms, reset 6 ms. This is workflow evidence, not a 250-concurrent-user load test or a guarantee for every request.

56 tests passed in 15 files before paper development, with TypeScript checks, frontend build and real workerd transport regression. The first managed deployment failed because Workers rejected fetch redirect mode `error`; manual handling now rejects every 3xx without forwarding credentials. The browser upload test subsequently found unread response-body behavior; the UI now consumes the successful response before refreshing, and full acceptance passed.

## Security and migration

Public Supabase signup and anonymous signin are disabled; real requests returned signup_disabled and anonymous_provider_disabled. Administrative provider provisioning and password login passed. The owner confirmed replacement of the exposed key in response to the retirement request; retirement is owner-attested, not independently inspected through management access. The replacement was verified and installed only as staging Worker secrets. Secrets and synthetic credentials remain ignored under `.local/`. Prior Git/source/bundle scans found no matches for the checked Supabase secret formats; this is not a universal secret-scan guarantee.

22 existing synthetic staging accounts were migrated without changing their verified passwords. All three D1 databases were exported first; backups remain under ignored `.local/managed-backup-*`. Tenant migration 0005 was applied remotely. Teacher/student creation reserves inactive D1 identities before provider provisioning. Password changes revoke sessions first and persist recovery intent. D1 remains authoritative for roles, assignments, suspension and versioned sessions. Provider tokens alone never authorize the application. Dedicated school Workers, databases and private R2 buckets are preserved.

See MANAGED_AUTH_OPERATIONS.md for configuration, pepper preservation and partial-failure recovery. No paid Cloudflare or Supabase plan was enabled. Expenditure authorization remains ₹0.

## Question papers: implementation in progress

New migration 0006 adds persistent question papers. Authenticated staff APIs and a teacher/admin UI support assigned-class/subject papers, multiple-choice answer keys, written-answer rubrics, bounded marks, immutable saved papers and idempotent creation. Students cannot access this staff paper library. The two new validation/D1 HTTP tests passed. This addition is not yet staging verified.

## Remaining product and release gates

Scheduling, attempts/autosave/deadlines, grading, publication, examination integrity, approved free AI conversion/evaluation, physical-paper workflows, assessment-aware image sharing and analytics remain unfinished. No fake AI results are served. R2 currently has per-user upload limits, but aggregate budgets/retention are still needed before a broad zero-cost launch; free allowances alone are not a spending cap. Load testing, broader security acceptance and production release remain outstanding.

The dependency audit tracked two moderate ExcelJS/uuid findings. The optional XLSX bundle remains large and is loaded on demand. Classroom credentials and optional password changes are preserved. No production-readiness claim is made.

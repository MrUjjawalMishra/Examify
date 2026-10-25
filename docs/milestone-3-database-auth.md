# Milestone 3 — Database and authentication

## Goal

Build the tenant-safe foundation for Examify:

- PostgreSQL schema for schools, roles, users, classes, and subjects
- strict school-level isolation
- server-side auth model with role checks
- seeded demo data for development

## Prerequisites

- Supabase project created
- Cloudflare Pages connected to repo
- local frontend build passing
- no real student data in repository

## Security rule

Every school-owned record must have a `school_id` and every privileged API route must verify the user’s school and role before serving data.

## Schema files

- `supabase/schema.sql`
- `supabase/seed/initial_seed.sql`

## Auth helpers

- `apps/workers/src/auth.ts`
- `apps/workers/src/security.ts`

## Key decisions

- Supabase Auth is the recommended auth provider
- the frontend only receives safe public data and anon key values
- the service role key stays server-side only
- cross-school data access is blocked by design

## Verification

Run the worker tests:

```bash
cd /workspaces/Examify/apps/workers
npm install
npm test
```

Expected result:

- matching school access passes
- cross-school access fails
- forbidden role combinations are rejected

## Next step

This lays the groundwork for Milestone 4: exam system, question banks, and teacher review flows.

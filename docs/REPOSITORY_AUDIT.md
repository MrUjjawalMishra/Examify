# Examify source audit — 27 October 2026

Source: https://github.com/MrUjjawalMishra/Examify, main at 60b7ebef053a4b63048c55c2d618f0e4f9a54e38.

## Verified implementation

React 18/Vite/Tailwind 3 frontend with five role views, including a parent prototype outside the requested launch scope. App.tsx imports syntheticData, starts signed in, and stores operational records in React state. These are prototype interactions, not authenticated persistent workflows.

Worker routes provide health, mock question drafting, upload-metadata validation and caller-supplied analytics. They do not authenticate requests. Auth utilities define session shapes but do not verify or persist sessions. The mock AI implementation generates canned suggestions; it is not a real provider integration. Wrangler's AI mode variable does not select an adapter.

Supabase schema is a proposed shared PostgreSQL schema, not dedicated school infrastructure. Several RLS policies grant FOR ALL operations based on school membership, without the required operation-specific role checks. Many protected tables lack usable policies. Do not apply this schema as a production-ready authorization system. Deployment and existing remote data have not been inspected.

## Feature classification

| Capability | Status |
| --- | --- |
| Dashboard layouts and exam editor interactions | Partially implemented, synthetic prototype |
| Real authentication, school selection and account provisioning | Missing |
| Dedicated school Worker/database provisioning | Missing |
| XLSX/CSV enrollment and required credentials | Missing |
| Trusted scheduling, persistence, autosave synchronization and timeout finalization | Missing |
| Grading helper and security helpers | Partial, not connected to trusted persistence |
| AI conversion and evaluation | Mock only |
| Private uploads and R2 persistence | Missing; metadata validation is not file validation |
| Result publication and communication | Prototype only |
| Automated tests and CI | Present; not sufficient for production acceptance |
| Cloudflare deployment | Configuration only; not verified |

## Immediate fixes made

- Removed implicit platform-owner bypass from the school isolation helper. An audited support mechanism remains to be implemented separately.
- Rejected non-finite marks/maxima and negative maxima in grading validation.
- Added regression cases for both issues.
- Added root ignore rules. Already tracked node_modules remain tracked; removing them requires a subsequent repository hygiene change, not merely an ignore rule.

## Verification evidence

- Worker TypeScript `tsc --noEmit`: passed using bundled Node 24.22.1.
- Compiled auth/security/exam modules and ran Node assertions: 13 passed, covering normal/cross-school access, owner denial, invalid scores and a valid score.
- Vitest suite attempted: failed before test execution because @rollup/rollup-win32-x64-msvc is missing. The repository contains approximately 2,400 tracked node_modules files in the Worker subtree. Reinstall platform-correct dependencies before full tests.
- No frontend build, browser E2E, database migration, live AI call or deployment verified.

## Next implementation gates

1. Repair dependency reproducibility, run existing suites and build baseline.
2. Retain useful UI components while separating prototype data from production routes.
3. Finalize dedicated Worker/D1 architecture against school count and budget; no paid resources enabled yet.
4. Implement real sessions and role/resource authorization, then owner-to-school-to-teacher-to-student provisioning.
5. Implement persistent assessment and deterministic grading before AI/media workflows.
6. Verify two-school isolation, reconnect/deadline races, publication, private media and restore procedures.
7. Deploy staging, then approved production and live smoke tests.

Owner confirmed a Cloudflare account but no custom domain. Initial school/student counts, budget, authenticated deployment access and approved AI configuration remain outstanding. No secrets should be supplied in chat.

# Examify — Cross-device project and conversation handoff

Last compiled: 2026-11-04. This is a **curated summary** of relevant available project conversations and authenticated repository documents, not a verbatim export of all conversations. It is intended for `docs/PROJECT_CONTEXT.md` in the Examify GitHub repository. It must never contain credentials, real student records, private student answers, raw chat archives, or local backups. This document does not automatically update itself when future chats occur.

## Identity and hard requirements

- Product: **Examify**; older name **Papperly**, occasional variant **Xamify**. Same product. Commercial multi-school AI examination and assessment SaaS, designed for Indian schools and low-bandwidth/mobile student access.
- **Four roles from launch**: Platform Owner → School Admin → Teacher → Student. Owner provisions schools and controls plans/quotas, school admins manage teachers/classes/subjects, teachers manage students/exams/marks, students take tests and view published feedback.
- **Multi-school tenancy is NOT a future roadmap**. Enforce cross-school isolation in routing, databases, media and API permissions. Owner does not automatically have unrestricted access to school answers; use authorized/audited support access.
- **Cloudflare-first deployment**; old Lovable Cloud references in early Papperly blueprint were educational context only. Do not move this product back to Lovable. Existing production Worker must remain unchanged until explicit owner approval.
- **Strict financial limit: ₹0 / USD $0 recurring authorized spending**. No Workers Paid, Supabase Pro, paid AI, pay-as-you-go or paid infrastructure. Never regard free allowances as unlimited. Measure quotas, throttle use, and explain any free-tier ceiling rather than activate billing.
- No public signup, anonymous sign-in, Google/social sign-in. Authorized account creation only: Owner creates School Admin → Admin creates Teacher → Teacher creates Student.
- Login: owner by email/password; all school roles choose school by name/code and then username/password. School code routes but is not authorization.
- Teacher readable ID format: `t-<normalized.name>`. Student username format: `<normalized.full.name>.<class><section><roll>`, with deliberately classroom-friendly initial password format `<first.name>.<class><section><roll>`. These are **format placeholders**, not account credentials. Preserve pattern and deterministic duplicate safeguards. The owner is aware predictable student initial passwords are weaker but explicitly wants this classroom convenience; compensate with rate limits, teacher-only resets, secure hashing and tenant isolation. **No forced first-login password change**; students may change passwords in Profile, teachers may reset and revoke sessions.
- Teacher subject allocation supports one subject assigned to multiple classes; roster import via CSV/XLSX, validation/preview, retries, generated credentials and printable slips.

## Technology and cloud location

- Source and documentation: https://github.com/MrUjjawalMishra/Examify ; development branch `codex/production-foundation`. Default `main` is separate and must not be assumed current.
- Staging school app: https://examify-staging.mr-ujjawalmishra.workers.dev/
- Staging owner: https://examify-staging.mr-ujjawalmishra.workers.dev/owner
- Existing staging uses Cloudflare Worker gateway + separate control D1 + two preprovisioned per-school Workers, isolated D1 databases and private R2 buckets. Dedicated school Workers are called through trusted service bindings and do not accept direct public API ingress. Staging has two school slots (C8 and ABC synthetic schools); more schools require reviewed operator resource provisioning. This is not automated unlimited school-worker orchestration.
- Managed auth uses Supabase **Free** Auth for password verification; Cloudflare D1 is authoritative for roles, tenant membership, school status, assignments, app sessions and exam data. The Supabase public signup and anonymous sign-in settings are OFF. Do not expose provider admin keys. The application managed-auth pepper, stored as a secret on the gateway and tenant Workers, must be retained across devices/deployments; regenerating it is a credential migration, not routine setup.
- Use existing staging resources. No unnecessary duplicate Cloudflare projects. Production `examify` Worker is not the staging release.
- Browser-local offline exam drafts do **not** move between devices automatically; synchronize accepted answers to the server before switching devices.
- Passwords, secrets, ignored `.local/`, logs with credentials, local database exports and private student records are **not GitHub content**. Store sensitive credentials only in private password manager and/or Cloudflare secrets. Do not paste them into chats or Codex prompts.

## Exam requirements and behaviors

- Teacher creates/edits paper, optionally AI parses pasted raw paper, teacher approves questions and keys/rubrics, assigns to authorized class, schedules, monitors, grades and publishes.
- Original full vision: MCQ single/multiple choice, match columns with partial credit, short/long text, math rendering using KaTeX, diagram/photo answer uploads, scanned physical answer-sheet grading. Some remain future implementation and must not be claimed finished merely because historical blueprint mentions them.
- Server-authoritative deadlines, stable question and option shuffles for each attempt, revision-checked autosave, IndexedDB offline drafts and recoverable reconnection, idempotent submissions, expiry finalization, teacher-authorized extension, integer-based objective marking and optional negative marks, private answer keys, teacher-controlled subjective grade approval and result publication.
- Integrity event capture (tab focus/visibility) is non-invasive, imperfect evidence; do not claim it proves cheating; no invasive webcam/mic by default. Teacher review and appeal should be supported.
- A student's API must never include unpublished answer keys, hidden rubrics, private grades, cross-school data or another student's attempt.

## Latest verified status at time of this handoff

- User/agent reported pushed code `7a022b2` for staged examination engine, followed by code/tests/documentation `94345f6b483f2a3939d73a7d2948962a767ac15f`; another cloud-access handoff commit `49dd7170d9ab42888f80fa995f7de061e870eca7` was observed on `codex/production-foundation` on Nov 4.
- Detailed authoritative staging evidence in `docs/EXECUTION_STATUS.md`, `docs/EXAMINATION_OPERATIONS.md`, `docs/CLOUD_ACCESS.md`.
- Reported **62 Worker tests passing**, TypeScript and frontend build passing. Live browser: **50-question** scheduled/shuffled exam with offline answer sync and refresh, submission, accurate 100/100 grading, teacher publication and student result. **100-question** expiry test showed late-answer rejection, negative marking, teacher written-answer review and result publication. Cross-school denial and answer-key protection checked.
- Sampled Cloudflare telemetry: **322 invocations, max 9 ms CPU, 0 CPU limit failures**. This is a sample, **not** proof of 250 simultaneous users or unlimited free capacity.
- Tenant migration `0007` applied to both staging school databases. Cron configured for periodic finalization, but Cron's actual independent background execution was not observed at that checkpoint; request-time expiry was observed.
- Locally tested NVIDIA adapter for model `nvidia/nemotron-3.5-lightning-30b-a3b`, but **not live wired and verified**; no verified user free quota. Do not fake AI. Separate genuinely free multimodal service requires investigation/owner approval. No AI secrets in GitHub.
- **Incomplete**: live AI paper conversion/grading, physical-paper and handwriting/diagram evaluation, assessment-aware teacher access to private R2 submissions, aggregate per-school free-tier quotas and retention, load/concurrency testing, independent cron verification, wider security/reliability acceptance, production release. Prior dependency advisory for optional ExcelJS/uuid and large XLSX browser chunk should be reevaluated.
- This is **staging only**. Production remains unchanged; no paid plan was activated.

## Historical milestones (background, not current claims)

- Oct 27: initial repo synthetic frontend/mock AI; audit and tenant/score fixes.
- Oct 28: GitHub/Cloudflare connections, R2 activation, D1 sessions, password-reset race fix, school HTTP auth, 41 tests.
- Oct 29–31: owner/school provisioning, 4 role UI integration, Supabase Free managed auth avoiding Workers Free CPU exceeded limit; authenticated staging browser workflows.
- Oct 30: Supabase public signup OFF, anonymous login OFF, previously screenshot-exposed key rotation owner-attested; do not leak keys.
- Nov 2: paper library, 58 tests; 50/100-question exam engine, 62 tests, staging live acceptance.
- Nov 4: cloud access documentation for cross-device operation.

## Next engineering tasks

1. Verify newest GitHub branch head and all deployed versions and tests before editing; never overwrite another device's unpushed edits.
2. Integrate NVIDIA adapter in authenticated teacher-only paper-draft and evaluation routes/UI, with actual free-only quota checks, bounded model calls, schema validation, audit and teacher approval. Never accept model grades as final without teacher review; avoid fabricated fallbacks.
3. Implement secure association of R2 photographs/scans to exam attempts, authorized teacher viewing, image and handwriting review (only approved free AI options), media retention.
4. Enforce aggregate account/student/exam/storage/AI quotas and backup/retention policy, including explicit safe behavior when free allowances are exhausted; do not trigger billing.
5. Independently verify cron expiry/finalization and batch backlog. Run measured multi-user load tests to validate free-tier limits; don't claim target 250 concurrent students until proven.
6. Complete role-based analytics, policy/security testing, production readiness and **owner-approved** production deployment. Keep production untouched until approval.

## Codex, GitHub and conversation continuity rules

- GitHub is the **source of truth for reviewed code and curated non-sensitive decisions**, not automatic storage for every ChatGPT/Codex conversation. This file is not a full transcript and cannot import inaccessible past chats or future chats automatically.
- At the start of a new Codex local/cloud session, inspect the working tree and branch before fetching GitHub changes. Use `codex/production-foundation`; only switch or fast-forward when safe, and never discard local work. Read this file and `docs/EXECUTION_STATUS.md`, `docs/CLOUD_ACCESS.md`, `docs/MANAGED_AUTH_OPERATIONS.md`, and `docs/EXAMINATION_OPERATIONS.md`. Compare against current code/tests and current owner instructions.
- At the end of each authorized development task, update execution evidence **and** this curated context with any new owner decisions, date, verified results, caveats, and next tasks. Commit and push safe changes. Show actual SHA and deployment evidence. Avoid claims of unobserved live work.
- **Future conversations require explicit synchronization.** When the owner provides new requirements in a connected session, summarize approved Examify-relevant changes and push them. Do not silently copy unrelated chat content or sensitive material.
- Separate ChatGPT conversations are not automatically imported into Codex Cloud. A running Codex cloud environment requires setup/connection beyond a GitHub branch; don't claim cloud tasks/history are synced simply because the repository is hosted online.
- If full chat archives are desired, the owner should export/review and redact them before saving privately; do not push sensitive conversation archives to the public repository.
- This handoff concerns Examify only; other school website, Launchpad, single-file class quizzes and other projects remain distinct unless explicitly incorporated.


## Repository reconciliation — 4 November 2026

Imported from the owner-supplied `EXAMIFY_PROJECT_CONTEXT.md`, read in full and checked against the fetched branch at `9bf701c3712f1604afefb1c26915e8fdc650c761`. The local and remote heads matched before this documentation update. The source file in Downloads was not modified.

- Compared the credential conventions with `apps/workers/src/credentials.ts`; managed authentication with its operating document and tenant HTTP routing; the NVIDIA model/adapter with `apps/workers/src/nvidia-ai.ts`; and staging bindings/cron configuration with the checked-in Wrangler configuration.
- Compared implementation and acceptance claims with `docs/EXECUTION_STATUS.md` and the existing examination/cloud-access documentation. Historical tests, deployed versions, provider settings and telemetry are dated evidence, not a fresh live verification in this documentation-only task.
- Paper editing is a product requirement: the current saved-paper implementation is immutable; multiple-choice questions currently support one correct option. Broader question formats, appeals and owner support access are requirements, not claims of completed implementation.
- Older milestone documents describe prototype designs and can contain stale completion statements. Prefer current code and the dated execution status for implementation state, while retaining unimplemented product requirements here.
- `AGENTS.md` already requires reading this context and execution status at each new session and committing/pushing sanitized relevant updates. No automatic chat synchronization is implied.
- Reviewed the full supplied document and outgoing changes for credentials and confidential data. No actual secret or student record was identified; fictional login examples were replaced with format placeholders. Public project URLs and commit identifiers were retained.
- This update changes documentation only. No infrastructure, production deployment, billing setting or application behavior was changed; the strict zero-cost constraint remains active.


## Codex Cloud setup request — 4 November 2026

The owner requested a private Codex Cloud development environment for the maintained branch and then deleted the former non-runnable environment. Authenticated listing confirmed no environments remain. Replacement creation is pending ChatGPT sign-in in the controllable browser; no replacement is claimed published or runnable. Setup instructions are preserved in `docs/CODEX_CLOUD_SETUP.md`. This is development-environment setup, with the existing zero-cost and production-approval constraints preserved.


### Cloud setup follow-up — 4 November 2026

The replacement Examify environment now exists as an owner-only saved draft. Setup resumed after the usage-limit interruption, but its managed proxy refused GitHub and npm connections; the checkout remains an older revision and the configuration still references main. Install/start instructions were saved with branch guards. No successful cloud installation/test/build or publication is claimed. See docs/CODEX_CLOUD_SETUP.md for the configuration identifier and recovery details. Production and spending remain unchanged.

### Cloud networking correction — 4 November 2026

The earlier proxy-blocked setup was recovered using supported approved command execution (`require_escalated`), without proxy bypass, broader policy, new credentials or restart. The cloud checkout at `69bea10` passed installation, 62 Worker tests and both TypeScript checks/frontend build. The existing private draft now pins that exact commit and carries corrected reusable instructions; it is prepared for publication review, not yet published or fresh-task verified. Preserve the zero-cost policy and production boundary. See `docs/CODEX_CLOUD_SETUP.md` for diagnostic evidence and snapshot semantics.

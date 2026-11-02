# Examination operations

The engine uses each school's existing isolated D1 database. Gateway sessions, active school status, current role, enrollment and teacher assignments authorize requests. A client school code is routing information, not authorization.

## Scheduling and attempts

Create a saved question paper, refresh the examinations panel, and select its assigned class. Papers support up to 100 questions and 1,000 total marks within a 256 KiB request. Scheduling copies an immutable snapshot, answer keys and rubrics. Student responses contain an explicit safe question projection; keys and rubrics are excluded.

Students start or resume through the lobby. The unique exam/student constraint permits one attempt. The server establishes its deadline and persists question and option permutations. Answer revisions provide compare-and-swap protection; retries reuse operation IDs. Offline IndexedDB drafts are provisional until acknowledged before the server deadline. Conflicts require an explicit choice. Changing the device clock cannot extend the server deadline.

Submission first freezes the attempt, then grades its accepted answers. Objective scores use integer hundredths of a mark. Optional penalties apply only to wrong answers, not unanswered questions. Displayed total scores have a zero floor. Written answers remain unconfirmed until teacher review. Published results cannot be edited.

## Expiry and review

Tenant Workers have a once-per-minute scheduled handler that processes at most five expired/submitted attempts. Request-time finalization handles an expired student's next request immediately; management polling processes a bounded batch too. Larger abandoned cohorts can take multiple invocations. Late answers are rejected even while finalization is pending. Cron propagation can take several minutes: see [Cloudflare Cron Triggers](https://developers.cloudflare.com/workers/configuration/cron-triggers/).

Teachers may end examinations or extend still-active deadlines. Extensions compare the displayed end time against the current value to reject duplicate/stale requests. Already expired attempts are not revived. Teacher grade changes require the latest revision and append immutable history. Unconfirmed grades and review flags block publication. Results are available only to the participating student after publication.

Focus/visibility events are limited evidence for review, never automatic proof of cheating. No camera or microphone is used. Do not use these events alone for penalties.

## Verification and deployment

From `apps/workers`, run `node node_modules/vitest/vitest.mjs run` and `node node_modules/typescript/bin/tsc --noEmit`. Build the frontend with its TypeScript and Vite commands. Apply additive tenant migration `0007_examination_engine.sql` to each staging school, then deploy the tenant Workers before the staging gateway. Never apply these commands to production without release approval.

Run `node scripts/staging-examinations.mjs` for the real managed-login browser acceptance. It uses ignored local staging credentials, only synthetic school C8 students, and writes evidence to ignored `test-results/staging-examinations.json`. It creates a new test paper/exam; do not run against real student data. Local tests separately cover two physical D1 databases, stale writes, expiry, subjective review and history.

## Free-tier limits and remaining gates

No paid service is selected. This implementation is not a guarantee of unlimited free classroom capacity. Every acknowledged answer, rate-limit update, integrity event, polling request and grade consumes requests/database allowances. Two minute-level cron schedules add up to 2,880 daily invocations. Avoid continuous idle dashboard polling. Five-school/250-concurrent-user load acceptance, aggregate admission/storage budgets and quota-exhaustion recovery remain release gates. Do not enable paid upgrades to bypass a limit.

Physical-answer media, approved free AI conversion/grading, analytics and production release are separate unfinished requirements. An AI suggestion must never silently become a confirmed teacher grade.

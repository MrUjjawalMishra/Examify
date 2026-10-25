# Milestone 8 — Security, performance, and pilot

## 1) Goal

Harden the exam platform before any production claim and prepare the pilot test plan.

This milestone adds:

- auth and permission verification
- input validation and upload checks
- tenant isolation testing
- rate limiting and abuse prevention
- exam attempt recovery and monitoring validation
- performance checks and bottleneck review
- pilot readiness checklist using synthetic data only

The key rule is clear: do not describe the platform as production-ready until the required checks have actually been run and documented.

## 2) Prerequisites

Before starting this milestone:

- Milestones 3 through 7 are planned or implemented
- SQL structures and role checks are in place for schools, users, exams, queries, and analytics
- the app uses synthetic data only
- no production student data or secret keys are present in the repository

## 3) Cost

Expected cost:

- local testing remains free
- Supabase free tier should be sufficient for early prototype security checks
- Cloudflare free tier is suitable for pilot testing
- do not activate paid production features

Billing risks:

- traffic spikes can increase usage unexpectedly
- large file uploads or heavy AI calls can increase costs
- any pilot traffic should remain synthetic and under control

## 4) Exact steps

1. Review authentication security
   - verify JWT validation is server-side only
   - verify refresh and session flows work correctly
   - ensure the frontend never stores service-role keys or privileged tokens

2. Review authorization rules
   - test all role permissions for platform owner, school admin, teacher, student, and parent
   - confirm each API route checks user role and school membership before data access

3. Test tenant isolation
   - create two schools in test data
   - attempt cross-school queries, exam views, and result lookup from each account
   - confirm every unauthorized attempt fails with rejection or 403-style denial

4. Validate input and uploads
   - test invalid input, oversized files, bad file types, and malformed payloads
   - ensure upload routes reject unsupported or malicious content
   - ensure all file uploads are school-scoped and safe by default

5. Test exam integrity and recovery
   - simulate tab switch, focus loss, network interruption, and autosave recovery
   - verify student work is never lost silently
   - verify teacher override path exists and is logged

6. Test rate limits and abuse prevention
   - simulate repeated failed login attempts or excessive API calls
   - confirm rate limits or throttling are in place
   - review logs for repeated suspicious activity

7. Run performance checks
   - measure page load for the dashboard and exam pages
   - measure backend response time for school-scoped requests
   - inspect bottlenecks in SQL, API routes, or front-end rendering

8. Build a pilot test checklist
   - define the exact number of demo users, schools, classes, and exams used for test runs
   - define how to record issues and fixes
   - define what is still “not production ready”

9. Document production gaps
   - list which items cannot be satisfied by the free-tier setup
   - identify required paid or managed services for later production stages
   - state precisely what still needs approval before launch

## 5) Code files

### apps/workers/src/security/tenantGuard.ts

```ts
export function ensureTenantMatch(
  userSchoolId: string,
  targetSchoolId: string,
): boolean {
  return userSchoolId === targetSchoolId;
}
```

### apps/workers/src/security/permissionGuard.ts

```ts
export function canAccessRole(
  userRole: string,
  allowedRoles: string[],
): boolean {
  return allowedRoles.includes(userRole);
}
```

### apps/workers/src/security/rateLimit.ts

```ts
export function isRateLimited(calls: number[], windowMs: number): boolean {
  if (calls.length === 0) return false;
  const now = Date.now();
  const recent = calls.filter((time) => now - time < windowMs);
  return recent.length > 10;
}
```

### apps/web/src/features/pilot/PilotChecklist.tsx

```tsx
export function PilotChecklist() {
  const items = [
    "Two schools with synthetic tenants",
    "Teacher can create and review a draft exam",
    "Student can attempt and recover autosave state",
    "Admin can view school metrics without cross-school access",
    "AI suggestions remain pending approval",
  ];

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-500">
        Pilot checklist
      </p>
      <h2 className="mt-2 text-xl font-semibold text-slate-900">
        Safety and readiness checks
      </h2>

      <ul className="mt-5 space-y-3">
        {items.map((item) => (
          <li
            key={item}
            className="flex items-start gap-3 rounded-xl bg-slate-50 p-3 text-sm text-slate-700"
          >
            <span className="mt-1 h-2.5 w-2.5 rounded-full bg-emerald-500" />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
```

## 6) Configuration

Required variables:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `APP_ENV`
- `RATE_LIMIT_WINDOW_MS`
- `RATE_LIMIT_MAX_REQUESTS`

Where to set them:

- local development environment
- Cloudflare Worker environment for server-side checks
- never in source control or frontend code if they are privileged

## 7) Commands

Run front-end validation:

```bash
cd /workspaces/Examify/apps/web
npm run build
npm run lint
```

Run any worker checks if created:

```bash
cd /workspaces/Examify/apps/workers
npm install
npm run build
```

If load testing is added later:

```bash
npm install -D artillery
```

## 8) Verification

Expected results:

- two-school test data exists and remains isolated
- unauthorized cross-school access attempts are denied
- invalid input and upload cases are rejected safely
- exam autosave and recovery flow survives connection loss simulations
- rate limits trigger correctly under repeated abuse patterns
- performance logs identify bottlenecks and show improvement opportunities
- pilot checklist is documented and no production claim is made without completion

## 9) Troubleshooting

Problem: unauthorized access still works

- likely cause: server-side check missing or weak role validation
- fix: add tenant and role checks before all SQL and file accesses

Problem: file uploads are accepted without validation

- likely cause: upload route lacks MIME and size checks
- fix: validate both file type and size before storing or processing

Problem: exam recovery fails after connection issue

- likely cause: autosave snapshot not persisted or not restored correctly
- fix: verify snapshot creation and restore logic before pilot run

Problem: performance is poor under moderate load

- likely cause: unindexed queries, excessive data fetch, or large payloads
- fix: index key query paths and reduce data transfer size before launch

Problem: rate limiting is inconsistent

- likely cause: timestamps are not tracked correctly
- fix: centralize rate-limit checks and store timestamps securely in the server path

## 10) Security check

Before moving to a production readiness claim, verify all of the following:

- all privileged actions are server-only
- school isolation is enforced in the DB and API layer
- student data is not stored in Git or unapproved file paths
- uploaded files and AI payloads are scoped to the relevant school
- failed auth and unusual access patterns are logged
- no free-tier limitations are hidden or assumed to be production-safe
- the pilot uses synthetic data only

## 11) GitHub checkpoint

Before continuing:

```bash
cd /workspaces/Examify
git add .
git commit -m "feat: add security, performance, and pilot checks"
git push origin main
```

Then confirm:

```bash
git status
git log -1
```

## 12) Completion checklist

- [ ] auth checks verified
- [ ] role checks verified
- [ ] tenant isolation tested across two schools
- [ ] invalid input and uploads rejected
- [ ] autosave recovery tested
- [ ] rate limiting and logging reviewed
- [ ] performance bottlenecks identified
- [ ] pilot checklist completed with synthetic data only
- [ ] production-readiness claim withheld until checks pass
- [ ] GitHub checkpoint completed

## 13) Next step

The next step is Milestone 9: Production readiness.

This final milestone adds:

- domain and HTTPS checklist
- environment separation
- migrations and backup/restore
- monitoring and error reporting
- security review
- data retention and deletion
- onboarding and incident procedures

This milestone does not declare the app production-ready unless the required checks above have actually been completed and verified.

# Milestone 9 — Production readiness

## 1) Goal

Prepare the final deployment and operational checklist for Examify.

This milestone covers:

- domain and HTTPS setup
- environment separation
- migration and backup procedures
- monitoring and error reporting
- security review
- cost control
- privacy and legal review
- school onboarding and support process
- disaster recovery and rollback

This milestone must not claim the app is production-ready unless each required check has actually been completed and documented.

## 2) Prerequisites

Before starting this milestone:

- all previous milestones have been implemented or explicitly documented as pending
- security checks have been run and reviewed
- pilot testing has been documented with synthetic data only
- no real student data is committed to GitHub or local repo state
- all secrets remain outside source control

## 3) Cost

Expected cost:

- domain registration and paid hosting are not included unless explicitly approved
- Cloudflare and Supabase free tiers may be used for early pilot operations
- production-grade monitoring, alerts, and email providers may require paid accounts later

Billing risks:

- a production domain or managed provider can add costs quickly
- object storage and AI services can grow unexpectedly with real usage
- backup retention and log retention can become paid over time
- pilot traffic should remain low until cost controls are reviewed

## 4) Exact steps

1. Define the production environment split
   - development environment for local work and synthetic data
   - staging or preview environment for Cloudflare Pages or a test Worker
   - production environment only after a security review and approval

2. Prepare the HTTPS and domain plan
   - choose a domain only after the prototype is stable and approved
   - enable HTTPS by using the platform’s default secure options
   - keep custom domains out of the project until approved

3. Set up migration and backup strategy
   - store all database schema changes in versioned SQL files
   - define how to create a backup before each production migration
   - define restore steps and who can trigger them

4. Configure monitoring and logs
   - record failed logins, rejected API routes, and tenant-access errors
   - track build failures, deployment errors, and Worker runtime issues
   - assign a clear owner for alert review

5. Complete security review
   - verify all privileged operations are server-side
   - verify cross-school access is blocked in both API and DB checks
   - verify uploaded files and AI inputs remain school-scoped
   - verify no secrets are in Git or frontend code

6. Review data retention and deletion
   - define how long queries, exam records, and logs are kept
   - define how a school can request deletion of data under policy
   - ensure deletion workflows are documented and auditable

7. Review privacy and legal readiness
   - identify applicable school policies and legal obligations
   - reflect that this is not legal advice and required legal review must be done by the school or legal team
   - keep privacy policy and consent docs outside the prototype code until approved

8. Prepare onboarding and support procedures
   - define school onboarding steps
   - define admin setup flow for users, classes, subjects, and roles
   - define support channels and escalation path for failures

9. Prepare rollback and incident handling
   - define how to revert a failed deployment
   - define who can approve a rollback
   - document emergency contacts and issue triage steps

## 5) Code files

### docs/deployment-checklist.md

```md
# Deployment checklist

## Core readiness

- [ ] Domain approved
- [ ] HTTPS enabled
- [ ] Source code in GitHub
- [ ] Environment variables separated by environment
- [ ] Supabase project created and secure
- [ ] Cloudflare project connected and reviewed
- [ ] No secrets in GitHub
- [ ] No production data in repo

## Backups and migrations

- [ ] Migration scripts versioned
- [ ] Backup procedure documented
- [ ] Restore procedure documented
- [ ] Migration rollback plan recorded

## Security

- [ ] Server-side auth checks implemented
- [ ] Role checks reviewed
- [ ] School isolation tests passed
- [ ] File upload checks reviewed
- [ ] AI-only actions gated by approval

## Monitoring

- [ ] Build logs reviewed
- [ ] Worker logs reviewed
- [ ] Error tracking configured
- [ ] Alert ownership assigned

## Privacy and support

- [ ] Retention policy understood
- [ ] Data deletion process defined
- [ ] Support procedures defined
- [ ] School onboarding process defined
```

### apps/web/src/features/readiness/ReadinessChecklist.tsx

```tsx
export function ReadinessChecklist() {
  const items = [
    "Domain and HTTPS reviewed",
    "Environment separation documented",
    "DB backup and restore flow defined",
    "Monitoring and error tracking configured",
    "Privacy, data retention, and legal review recorded",
  ];

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-500">
        Production readiness
      </p>
      <h2 className="mt-2 text-xl font-semibold text-slate-900">Checklist</h2>

      <ul className="mt-5 space-y-3">
        {items.map((item) => (
          <li
            key={item}
            className="flex items-start gap-3 rounded-xl bg-slate-50 p-3 text-sm text-slate-700"
          >
            <span className="mt-1 h-2.5 w-2.5 rounded-full bg-indigo-500" />
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

- `APP_ENV`
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `VITE_API_BASE_URL`
- `LOG_LEVEL`
- `ERROR_REPORTING_ENDPOINT` if enabled later

Where to set them:

- local `.env` for development
- Cloudflare Pages/Workers environment for deployed app
- separate config for production and testing environments
- no secrets in GitHub

## 7) Commands

Run the repo checks:

```bash
cd /workspaces/Examify
git status
```

Run web validation:

```bash
cd /workspaces/Examify/apps/web
npm run build
npm run lint
```

Run current deployment or preview checks before claiming readiness:

```bash
curl -I http://localhost:5173
```

## 8) Verification

Expected results:

- environment separation is documented
- deployment checklist is completed or clearly marked as pending
- monitoring and backup plans are stated with specific owners
- no “production-ready” claim is made unless each item is explicitly checked
- no real student data is in the repo or deployment environment
- school onboarding and support procedures are written down

## 9) Troubleshooting

Problem: domain or HTTPS is added too early

- likely cause: readiness review is incomplete
- fix: delay custom domain setup until the app passes the pilot checklist and security review

Problem: environment variables are reused across environments

- likely cause: dev and prod values were mixed
- fix: separate environment files and deployment config for each environment

Problem: no backup or rollback plan exists

- likely cause: deployment was treated as final too early
- fix: define both before any production changes are staged

Problem: “production-ready” is used without evidence

- likely cause: checks were not actually run
- fix: remove the claim and keep the project in pilot or pre-production status until evidence exists

## 10) Security check

Before final production declaration, verify:

- no secrets are in source control
- service-role keys are only in secure environments
- school isolation tests have passed
- all high-impact actions require explicit authorization
- retention and deletion policies are documented
- only synthetic data is used for pilot work
- all legal and privacy obligations are identified, even if not fully resolved yet

## 11) GitHub checkpoint

Before finishing this milestone:

```bash
cd /workspaces/Examify
git add .
git commit -m "docs: add production readiness checklist"
git push origin main
```

Then confirm:

```bash
git status
git log -1
```

## 12) Completion checklist

- [ ] environment split documented
- [ ] domain and HTTPS plan reviewed
- [ ] migration and backup process documented
- [ ] monitoring and error reporting plan recorded
- [ ] security review completed
- [ ] cost controls identified
- [ ] retention and deletion policy documented
- [ ] privacy review recorded
- [ ] onboarding and support procedures defined
- [ ] rollback and incident process defined
- [ ] no production-ready claim made without verification
- [ ] GitHub checkpoint completed

## 13) Final note

This is the final milestone in the guided plan. The app should remain in pilot or pre-production mode until each checklist item is verified with real evidence. The project is only production-ready when that evidence exists, not simply because the code looks finished.

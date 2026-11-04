# Access Examify from another device

## Use the hosted application

- School login: https://examify-staging.mr-ujjawalmishra.workers.dev
- Platform owner login: https://examify-staging.mr-ujjawalmishra.workers.dev/owner

Open these links in a browser on your phone, tablet or another computer. Sign in with your existing account. School users select their school code first. Sessions are separate on each device. The application runs on Cloudflare; this development computer does not need to remain on.

This is staging, for synthetic test data. It is not a production release. The examination workflow is verified; AI integration and the remaining release gates are tracked in EXECUTION_STATUS.md.

## Continue development from another computer

The maintained branch is:
https://github.com/MrUjjawalMishra/Examify/tree/codex/production-foundation

Sign in to your authorized GitHub account and clone it:

```sh
git clone --branch codex/production-foundation https://github.com/MrUjjawalMishra/Examify.git
cd Examify
npm ci --prefix apps/workers
npm ci --prefix apps/web
```

Use Node 24. Read docs/EXECUTION_STATUS.md, docs/MANAGED_AUTH_OPERATIONS.md and docs/EXAMINATION_OPERATIONS.md before deploying. Authenticate Wrangler on the new device through its browser authorization workflow. Use the existing staging configurations; do not create replacement projects or target production by default.

The repository is available through GitHub's browser interface too. A cloud development environment has not been created or enabled; check any provider's free allowance before starting one because the project's expenditure authorization remains zero.

## Where the cloud data lives

- Source, migrations, tests and operating documentation: GitHub.
- Hosted frontend/API: Cloudflare staging gateway and dedicated school Workers.
- School records, examinations, accepted answers and results: dedicated Cloudflare D1 databases.
- Uploaded private files: the existing school-specific R2 buckets.
- Managed authentication: the existing Supabase project.
- Deployed runtime secrets: Cloudflare Worker secrets, not GitHub source.

Offline answer drafts stay in the browser/device where they were entered. Synchronize them before switching devices. Only server-confirmed answers are available on another device.

## Credentials and local operator files

Ignored `.local/` files, backups, browser sessions and locally generated test reports are not GitHub backups. Do not upload these files to the source repository. Keep any needed operator credentials in your private password manager and use its secure synchronization to access them from another device. In particular, preserve the managed-auth pepper according to MANAGED_AUTH_OPERATIONS.md; do not regenerate it during workstation setup.

On the original development computer, the owner/test credentials are in `source/.local/staging-credentials.json`. Access that file privately; do not paste its contents into chat or GitHub. If you only want to use the application, you need your login credentials, not provider API keys.

Verification on 4 November 2026: school and owner routes returned HTTP 200; the GitHub branch contained application checkpoint `94345f6b483f2a3939d73a7d2948962a767ac15f`. These reachability checks are not a repeat of the full examination acceptance tests documented in EXECUTION_STATUS.md.

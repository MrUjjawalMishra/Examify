# Examify project instructions

## Start every new session

1. Read `docs/PROJECT_CONTEXT.md` completely, then read `docs/EXECUTION_STATUS.md` completely before implementation. If the context file is missing, report that fact and request the owner's document; do not invent its contents or claim to have read it. Continue independent work where possible.
2. Check the Git remote, current branch, working tree and latest commits. The maintained working branch is `codex/production-foundation` in `MrUjjawalMishra/Examify`. Preserve existing uncommitted work and Git history.
3. Compare historical context and status with the actual code, migrations, tests and deployment evidence. Distinguish requirements, reported history, locally tested functionality, staging verification and production deployment. Record discrepancies rather than silently treating plans as completed work.

## Maintain context across devices

When the owner supplies new Examify requirements or decisions, update the relevant project documentation. Record verified progress with its date, evidence, applicable commit/environment and remaining limitations. Keep durable product decisions in `docs/PROJECT_CONTEXT.md`, implementation status in `docs/EXECUTION_STATUS.md`, and detailed operating procedures in their relevant documents.

Before committing documentation, review the entire proposed change for secrets, credentials, private account information and confidential student data. Remove or redact sensitive values; retain safe configuration names and public project links where useful. Never commit `.local/`, secret files, private credential slips, raw private logs or student records. Do not copy raw chat transcripts into the repository.

Commit and push sanitized, relevant documentation changes to `codex/production-foundation` as part of the authorized work. Report the commit SHA and any push failure accurately. Do not overwrite unrelated edits. GitHub stores only the changes explicitly committed and pushed: past or future ChatGPT/Codex messages do not automatically synchronize across chats or devices.

## Cost, deployment and product constraints

- Preserve the strict ₹0 expenditure requirement. Do not activate paid plans, purchase resources or bypass exhausted free allowances with paid services.
- Keep production unchanged without the owner's explicit approval. Authorized reversible work may proceed in the existing staging resources after appropriate checks. Destructive changes require an approved recovery plan and explicit approval.
- Continue the existing application and four-role hierarchy: platform owner, school admin, teacher and student. Preserve dedicated school isolation, classroom credential conventions and voluntary student password changes. No public signup, fake application data or fabricated AI fallback responses.
- When interacting with Cloudflare, use the `cf` CLI unless the project has a Wrangler configuration file. This repository's staging configurations use Wrangler; target the explicit staging configuration and existing resources.
- Keep provider secrets server-side. Use secure local configuration or supported authorization flows, never passwords or secret keys pasted in chat.
- Report actual tests and deployment evidence. Do not imply that staging acceptance proves production readiness or the untested 250-user concurrency target.

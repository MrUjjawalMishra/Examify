# Examify Codex Cloud setup

Status on 4 November 2026: the owner deleted the former non-runnable environment. The authenticated environment listing now returns no saved environments. A replacement has not yet been created or published. The controllable web browser requires the owner's ChatGPT sign-in before setup can continue.

## Intended private environment

- Name: Examify
- Repository: MrUjjawalMishra/Examify
- Working branch: codex/production-foundation
- Runtime: Node.js 24, npm, Git; Linux tooling compatible with workerd/Miniflare.
- Access: owner only; no new paid plan or purchased usage.
- Context: read AGENTS.md, docs/PROJECT_CONTEXT.md and docs/EXECUTION_STATUS.md at task startup.
- Application hosting remains the existing Cloudflare staging environment. Creating a Codex development environment does not publish the application or authorize a production release.

## Setup task instructions

Use this instruction when preparing the environment:

> Prepare this existing repository for cloud development. Inspect the checkout and safely select codex/production-foundation; do not reset or discard changes. Read AGENTS.md and the project context/status completely. Use Node 24. Install both applications with their existing lockfiles, run Worker TypeScript/tests and the web production build, and report actual results. Use local D1 emulation for tests. Do not deploy, migrate remote data, enable paid services, copy private .local files, or request production credentials as part of setup. Record the install commands and startup instructions in the environment configuration. Keep the environment private. Publish only after setup verification succeeds.

From the repository root, dependency installation is:

```sh
npm ci --prefix apps/workers
npm ci --prefix apps/web
```

Verification commands:

```sh
npm --prefix apps/workers run typecheck
npm --prefix apps/workers test
npm --prefix apps/web run build
```

If frontend build does not include TypeScript checking in its package script, also run `node apps/web/node_modules/typescript/bin/tsc -b apps/web`. Cloud tests must actually run before their success is reported. Do not assume that prior Windows test results validate a new Linux environment. Browser acceptance additionally requires Playwright browser installation and separately supplied synthetic staging credentials; ordinary unit/D1 tests do not require remote service secrets.

## Continuity

Start new cloud work from the published Examify environment and verify the selected branch/head. Read the repository context at the start and explicitly commit/push reviewed changes at the end. Preserve existing task changes before any synchronization. A saved cloud task and a new task have different filesystem state; don't assume an existing task automatically switches to another task's latest code. Repository context is curated; raw chat histories are not automatically imported.

Official setup reference: https://learn.chatgpt.com/docs/environments/cloud-environments . Use the current Create environment workflow and its setup report, then Publish. A repository guide alone is not proof that an environment exists or is runnable.

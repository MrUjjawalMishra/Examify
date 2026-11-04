# Examify Codex Cloud setup

Status on 4 November 2026: replacement Examify environment created and saved as a private draft, not published or runnable. Setup conversation: https://chatgpt.com/local/01a1a4a3-56ee-703a-9c44-c9176026a068?hostId=local . Configuration ID: `a3adb1c3-9450-4edc-97df-5b06267fe45f~asenvcfg_3f8da456cbcc81918185f05ec41910e8`.

Setup reports Node 24.22.1 and a clean older checkout at `60b7ebef053a4b63048c55c2d618f0e4f9a54e38`, but both GitHub and npm requests fail connecting to the managed `proxy:8080` before TLS/authentication. The saved repository ref still reports `main`; the desired branch is not available in that checkout. Branch-gated install/start instructions are saved. Installation, tests and builds remain unvalidated. Do not publish this snapshot. Restore the managed cloud proxy/setup instance through supported platform recovery, select the maintained branch, then rerun setup checks. No proxy bypass, paid upgrade, secret import or production deployment was performed.

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

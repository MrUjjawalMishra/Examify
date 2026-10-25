# Examify

Examify is a multi-school exam and learning management platform prototype built with React, TypeScript, Vite, Tailwind CSS, Cloudflare Workers, Supabase, and Cloudflare R2.

## Milestone 1 status

This repository currently contains the foundation for the frontend and design system for a school operations dashboard. The app is intentionally using synthetic demo data while the backend is still under development.

## Local development

```bash
cd /workspaces/Examify/apps/web
npm install
npm run dev -- --host 0.0.0.0
```

Then open the local Vite URL printed in the terminal.

## Basic checks

```bash
cd /workspaces/Examify/apps/web
npm run build
npm run lint
```

## Project structure

```text
apps/web/
  src/
  package.json
  vite.config.ts
  tailwind.config.js
  postcss.config.js
```

## Notes

- Do not store real student data or secrets in the repository.
- Use Supabase and Cloudflare environment variables locally, never in Git.
- This is a prototype stage with safe mock data and no production deployment yet.

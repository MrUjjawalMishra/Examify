# Examify — Project Status & Milestone Tracker

- **Current Architecture:** React + TypeScript + Vite (`apps/web`), Cloudflare Workers (`apps/workers`), Supabase PostgreSQL (`supabase/schema.sql`), Cloudflare R2 adapter ready.
- **Completed Deliverables:**
  - [x] Milestone 1: Complete 5-Role Responsive UI Prototype (Platform Owner, School Admin, Teacher, Student, Parent) with labelled synthetic data.
  - [x] Milestone 2: Modular TypeScript configuration, `.env.example` placeholders, CI workflow (`.github/workflows/ci.yml`).
  - [x] Milestone 3: Relational PostgreSQL schema (18 tables) + strict `school_id` Row-Level Security (RLS) policies.
  - [x] Milestone 4–7 Core Modules: Guided Exam Builder, Live Test Runner (timer + localStorage autosave + tab-visibility violation policy + camera/image upload), Teacher-Approved AI Grading, 48h–7d Student Query SLA system, Private Class Communities, Role-Scoped Analytics, and Mock AI Adapter.
- **Pending External Account Connections (Requires Your Manual Dashboard Access):**
  - [ ] Create free Supabase project and run `supabase/schema.sql` + `supabase/seed/initial_seed.sql`.
  - [ ] Fill `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in `apps/web/.env.local` (never commit `.env.local`).
  - [ ] Connect GitHub repo to Cloudflare Pages (`apps/web`) and deploy `apps/workers` via `npx wrangler login && npm run deploy`.
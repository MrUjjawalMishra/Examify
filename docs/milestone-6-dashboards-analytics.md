# Milestone 6 — Dashboards and analytics

## 1) Goal

Build role-based dashboards and analytics for the platform owner, school admin, teacher, student, and parent.

This milestone adds:

- platform-level summaries and usage metrics
- school-level results and trends
- teacher workload and pending tasks
- student progress and subject trends
- parent-friendly progress reports
- query resolution and overdue metrics
- documented formulas and source tables for every metric

The most important rule is that analytics must be accurate, traceable, and school-scoped. We do not fabricate student data or display synthetic numbers as if they are real.

## 2) Prerequisites

Before starting this milestone:

- Milestones 3, 4, and 5 foundations are in place or planned
- schools, users, classes, exams, attempts, queries, and communities are represented in the data model
- local app is running with synthetic data only
- role checks are defined so each user sees only their allowed data

## 3) Cost

Expected cost:

- local development remains free
- Supabase free tier is suitable for analytics prototype data
- Cloudflare Pages and Worker usage remains low-cost for prototype reviews
- no paid AI prediction or external analytics platform should be enabled yet

Billing risks:

- large analytics datasets can increase storage and compute usage
- reporting features should remain read-only in early stages
- avoid connecting external analytics or paid dashboards without approval

## 4) Exact steps

1. Define the analytic sources
   - subject marks come from exam_attempts and exam results
   - completion rates come from attempted and submitted exam records
   - query metrics come from queries and query_deadlines
   - attendance is used only if a verified attendance table exists
   - parent progress is derived only from the child’s school records

2. Define role-specific dashboards
   - Platform Owner: school count, active teachers, exams, usage trends, and system-level metrics
   - School Admin: class summaries, teacher workload, query backlog, and school health overview
   - Teacher: assigned class performance, pending review items, and query queue
   - Student: subject trends, scores, query status, and upcoming deadlines
   - Parent: permitted child progress and summary of performance without exposing unrelated data

3. Define metric formulas
   - completion rate = completed attempts / assigned attempts
   - average score = sum of marks / number of graded assessments
   - query resolution time = resolved_at - created_at in hours or days
   - overdue rate = overdue queries / total open queries
   - class improvement = current average score - previous average score

4. Build dashboard UI cards
   - each card includes title, value, trend, and source description
   - each metric must be traceable to a database table or computed formula

5. Add role filters and school scoping
   - school admin sees only one school
   - teacher sees only their assigned classes and subjects
   - student sees only their attempts and permitted results
   - parent sees only their child’s data

6. Add safety and privacy controls
   - do not show rankings or disciplinary labels as the only basis for decisions
   - do not expose hidden data via URL parameters or browser storage
   - all analytics queries should filter by school_id and user permissions on the server

7. Seed demo analytics data
   - use synthetic results, subjects, and query metrics only
   - model one school with multiple classes and a few query states

8. Test every dashboard role
   - verify a user from one school cannot access another school’s dashboard
   - verify each role receives only the permitted metrics

## 5) Code files

### apps/web/src/features/analytics/types.ts

```ts
export type DashboardMetric = {
  label: string;
  value: string;
  trend?: string;
  source: string;
  formula?: string;
};

export type RoleDashboard = {
  role: "platform_owner" | "school_admin" | "teacher" | "student" | "parent";
  metrics: DashboardMetric[];
};
```

### apps/web/src/features/analytics/RoleDashboard.tsx

```tsx
import type { RoleDashboard } from "./types";

export function RoleDashboard({ role, metrics }: RoleDashboard) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-500">
            Analytics
          </p>
          <h2 className="mt-2 text-xl font-semibold text-slate-900">{role}</h2>
        </div>
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {metrics.map((metric) => (
          <div
            key={metric.label}
            className="rounded-xl border border-slate-200 p-4"
          >
            <p className="text-sm text-slate-500">{metric.label}</p>
            <p className="mt-3 text-2xl font-bold text-slate-900">
              {metric.value}
            </p>
            {metric.trend && (
              <p className="mt-2 text-xs text-emerald-600">{metric.trend}</p>
            )}
            <p className="mt-3 text-xs text-slate-400">
              Source: {metric.source}
            </p>
            {metric.formula && (
              <p className="mt-1 text-[10px] text-slate-500">
                Formula: {metric.formula}
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
```

### apps/web/src/features/analytics/demoData.ts

```ts
export const platformOwnerMetrics = [
  {
    label: "Schools",
    value: "12",
    trend: "+2 this term",
    source: "schools",
    formula: "COUNT(schools)",
  },
  {
    label: "Active teachers",
    value: "168",
    trend: "+9%",
    source: "teachers",
    formula: "COUNT(DISTINCT teachers)",
  },
  {
    label: "Exam completion",
    value: "91%",
    trend: "+3.4%",
    source: "exam_attempts",
    formula: "completed_attempts / assigned_attempts",
  },
  {
    label: "Query resolution",
    value: "4.2 days",
    trend: "-0.8 days",
    source: "queries",
    formula: "AVG(resolved_at - created_at)",
  },
];
```

## 6) Configuration

Required variables:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `APP_ENV`
- `VITE_API_BASE_URL`

Where to set them:

- local `.env` file for development testing
- Cloudflare worker environment for server-side analytics routes
- never in source control or browser code if they are privileged

## 7) Commands

Run these in the repo root:

```bash
cd /workspaces/Examify
git status
```

Run the frontend checks:

```bash
cd /workspaces/Examify/apps/web
npm run build
npm run lint
```

If analytics API routes are added later:

```bash
cd /workspaces/Examify/apps/workers
npm install
npm run build
```

## 8) Verification

Expected results:

- dashboard cards render for each role type
- metrics include source and formula labels
- each metric matches a real data table or computation path
- cross-school access test consistently fails for unauthorized users
- no synthetic data is presented as production analytics
- parent dashboard shows only child-linked reports

## 9) Troubleshooting

Problem: a teacher sees metrics for another school

- likely cause: server-side filter missing for school_id
- fix: add explicit `WHERE school_id = current_school_id` logic before selecting metrics

Problem: formula labels are present but the values do not match the source data

- likely cause: wrong aggregation or stale data
- fix: confirm table sources and recalc using SQL or service logic

Problem: parent sees too much information

- likely cause: the permission filter is defined too broadly
- fix: restrict to student_id = child_id and school_id = parent’s school

Problem: dashboard still displays sample values as if they are real statistics

- likely cause: mock data was not clearly labeled as demo data
- fix: label all demo cards and keep them clearly separate from production records

## 10) Security check

Before moving on, check the following:

- every metric query has school_id filtering
- student and parent access is restricted to their own school and records only
- teacher metrics are limited to assigned classes, subjects, and students
- platform owner metrics are only platform-wide and not school-private data
- no ranking or AI-based predictions are used as the sole basis for disciplinary decisions
- formulas and dataset sources are documented in the UI or project docs

## 11) GitHub checkpoint

Before continuing:

```bash
cd /workspaces/Examify
git add .
git commit -m "feat: add analytics dashboard foundation"
git push origin main
```

Then confirm:

```bash
git status
git log -1
```

## 12) Completion checklist

- [ ] dashboard roles identified
- [ ] formula list defined for each metric
- [ ] platform owner metrics mapped to sources
- [ ] school admin metrics mapped to sources
- [ ] teacher metrics mapped to sources
- [ ] student and parent metrics mapped to sources
- [ ] role-access security checked
- [ ] synthetic data labeling reviewed
- [ ] GitHub checkpoint completed

## 13) Next step

The next step is Milestone 7: AI integration.

This milestone adds:

- provider adapter abstraction
- document extraction workflows
- AI-generated question drafts and summaries
- safe assistant actions
- teacher approval for AI-suggested marks and content
- usage limits and failure handling

AI should remain read-only or draft-only until explicit approval and provider configuration are completed.

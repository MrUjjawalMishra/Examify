# Milestone 5 — Queries and communities

## 1) Goal

Build the student query/ticket workflow and the teacher community layer.

This milestone adds:

- student queries and support tickets
- teacher assignment and reassignment
- query statuses and deadlines
- audit trail and escalation
- group announcements and class-based communities
- notifications for replies, reminders, and overdue items

These features must stay school-scoped and permission-checked. A student from one school must never see another school’s query or group data.

## 2) Prerequisites

Before beginning this milestone:

- Milestone 3 schema and role model are approved
- Milestone 4 exam engine foundation exists
- schools, users, roles, classes, sections, and subjects are available
- local web app is running with synthetic demo data
- Supabase Auth and server-side checks are planned but not yet fully connected

## 3) Cost

Expected cost:

- Supabase free tier is enough for prototype data
- Cloudflare Pages and Workers remain free-tier friendly for a small prototype
- no AI provider or paid notification service should be enabled in this milestone
- no paid domain or production traffic should be added yet

Billing risks:

- push notifications and email integrations can become paid later
- file attachments can use storage capacity quickly
- a production school tenant should never be created before security review

## 4) Exact steps

1. Add query and audit schema
   - create tables for queries, query messages, query assignments, and audit logs
   - tie every record to school_id
   - define query status values and deadlines

2. Add teacher communities schema
   - create group tables for memberships, announcements, posts, and permissions
   - restrict access using school and membership checks

3. Seed demo data
   - one school with multiple students and a teacher
   - one open query, one assigned query, and one overdue query
   - one private teacher group and one class group

4. Build the student query form
   - student chooses subject, exam, class, and description
   - system stores the ticket and assigns the default teacher or category
   - query remains linked to the school and student

5. Build the teacher query dashboard
   - teacher can view assigned queries
   - teacher can reassign a query, add notes, and set response deadlines
   - status changes are logged in audit trail

6. Add deadline policy
   - default resolution deadline is between 48 hours and 7 days
   - overdued queries trigger reminders and administrator alerts
   - weekend and holiday logic should be documented before production use

7. Build group communities
   - teacher-created group with membership restrictions
   - announcements, study materials, and reminders
   - only approved members can read or post

8. Add notifications
   - in-app notification feed for query updates, group announcements, deadlines, and reminders
   - do not rely on browser push or email as a core dependency

9. Test authorization checks
   - student cannot access another school’s query
   - teacher cannot view other school’s groups
   - admin or teacher can only act within their school

10. Review the query escalation path

- overdue query alerts go to the admin only if the policy allows
- reminders and warnings must be recorded in audit logs

## 5) Code files

### supabase/migrations/005_queries_communities.sql

```sql
create type community_visibility as enum ('public', 'private');
create type query_priority as enum ('normal', 'urgent');

create table queries (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references schools(id) on delete cascade,
  student_id uuid not null references students(id) on delete cascade,
  teacher_id uuid references users(id),
  subject_id uuid references subjects(id),
  exam_id uuid references exams(id),
  title text not null,
  description text not null,
  priority query_priority not null default 'normal',
  status text not null default 'open',
  due_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table query_messages (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references schools(id) on delete cascade,
  query_id uuid not null references queries(id) on delete cascade,
  sender_id uuid not null references users(id),
  message text not null,
  attachment_url text,
  created_at timestamptz not null default now()
);

create table query_deadlines (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references schools(id) on delete cascade,
  query_id uuid not null references queries(id) on delete cascade,
  assigned_by uuid not null references users(id),
  resolution_deadline timestamptz not null,
  reminder_sent_at timestamptz,
  warning_sent_at timestamptz,
  created_at timestamptz not null default now()
);

create table communities (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references schools(id) on delete cascade,
  created_by uuid not null references users(id),
  name text not null,
  description text,
  visibility community_visibility not null default 'private',
  subject_id uuid references subjects(id),
  class_id uuid references classes(id),
  created_at timestamptz not null default now()
);

create table community_members (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references schools(id) on delete cascade,
  community_id uuid not null references communities(id) on delete cascade,
  user_id uuid not null references users(id),
  role text not null default 'member',
  joined_at timestamptz not null default now(),
  unique (school_id, community_id, user_id)
);

create table community_posts (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references schools(id) on delete cascade,
  community_id uuid not null references communities(id) on delete cascade,
  author_id uuid not null references users(id),
  title text not null,
  body text not null,
  created_at timestamptz not null default now()
);

create table community_announcements (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references schools(id) on delete cascade,
  community_id uuid not null references communities(id) on delete cascade,
  author_id uuid not null references users(id),
  title text not null,
  message text not null,
  created_at timestamptz not null default now()
);

create table notifications (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references schools(id) on delete cascade,
  user_id uuid not null references users(id),
  type text not null,
  title text not null,
  body text,
  is_read boolean not null default false,
  metadata jsonb default '{}',
  created_at timestamptz not null default now()
);

create trigger queries_updated_at
before update on queries
for each row execute procedure set_updated_at();

create index idx_queries_school_status on queries(school_id, status);
create index idx_query_messages_query on query_messages(query_id, created_at);
create index idx_community_members_school on community_members(school_id, community_id);
create index idx_notifications_user on notifications(user_id, is_read, created_at);
```

### apps/web/src/features/queries/QueryBoard.tsx

```tsx
export function QueryBoard() {
  const queries = [
    {
      id: "q1",
      title: "Problem with Biology exam timing",
      status: "Open",
      priority: "Urgent",
      teacher: "Ms. Rahman",
      hoursLeft: 14,
    },
    {
      id: "q2",
      title: "Clarification on Math worksheet",
      status: "Assigned",
      priority: "Normal",
      teacher: "Mr. Rao",
      hoursLeft: 39,
    },
  ];

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-500">
            Student queries
          </p>
          <h2 className="mt-2 text-xl font-semibold text-slate-900">
            Query board
          </h2>
        </div>
        <button className="rounded-full bg-slate-900 px-4 py-2 text-sm font-medium text-white">
          New query
        </button>
      </div>

      <div className="mt-5 space-y-3">
        {queries.map((query) => (
          <div
            key={query.id}
            className="rounded-xl border border-slate-200 p-4"
          >
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="font-semibold text-slate-900">{query.title}</p>
                <p className="mt-1 text-sm text-slate-500">
                  Assigned to {query.teacher}
                </p>
              </div>
              <span className="rounded-full bg-indigo-100 px-2.5 py-1 text-xs font-semibold text-indigo-700">
                {query.status}
              </span>
            </div>

            <div className="mt-3 flex items-center justify-between text-sm text-slate-600">
              <span className="rounded-full bg-amber-50 px-2 py-1 text-amber-700">
                {query.priority}
              </span>
              <span>{query.hoursLeft} hours left</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
```

### apps/web/src/features/communities/CommunityHub.tsx

```tsx
export function CommunityHub() {
  const groups = [
    { id: "g1", name: "Class 9C - Computer Science", members: 24 },
    { id: "g2", name: "Grade 8A - Mathematics", members: 31 },
    { id: "g3", name: "Biology Revision Circle", members: 18 },
  ];

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-indigo-500">
            Communities
          </p>
          <h2 className="mt-2 text-xl font-semibold text-slate-900">
            Group dashboard
          </h2>
        </div>
        <button className="rounded-full bg-indigo-50 px-4 py-2 text-sm font-medium text-indigo-700">
          New group
        </button>
      </div>

      <div className="mt-5 space-y-3">
        {groups.map((group) => (
          <div
            key={group.id}
            className="rounded-xl border border-slate-200 p-4"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="font-semibold text-slate-900">{group.name}</p>
                <p className="text-sm text-slate-500">
                  {group.members} members
                </p>
              </div>
              <span className="rounded-full bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700">
                private
              </span>
            </div>
          </div>
        ))}
      </div>
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
- `VITE_API_BASE_URL`

Where to set them:

- local environment variables for local dev
- Cloudflare Worker environment variables for server-side APIs
- do not store secrets in GitHub or frontend source files

## 7) Commands

Run these in the repo root:

```bash
cd /workspaces/Examify
git status
```

Run frontend build checks:

```bash
cd /workspaces/Examify/apps/web
npm run build
npm run lint
```

If you later create Worker endpoints for query logic:

```bash
cd /workspaces/Examify/apps/workers
npm install
npm run build
```

## 8) Verification

Expected result:

- query schema runs without errors
- communities schema runs without errors
- seeded records exist for school-specific examples
- student can only see their own query history
- teacher can review and reassign queries
- private group members can access their group while non-members cannot
- notifications show read and unread states

## 9) Troubleshooting

Problem: queries are visible across schools

- likely cause: school_id filtering missing from API or SQL
- fix: query must include `school_id = current_user.school_id` before returning the result

Problem: a non-member can open a community

- likely cause: membership permission not verified on the server
- fix: use community_members table with `user_id` and `school_id` checks before reading posts

Problem: deadline logic is inconsistent

- likely cause: weekend or holiday rules were not defined before implementation
- fix: define a school policy for business days and adjust due_at calculations with consistent rules

Problem: reminders are sent multiple times

- likely cause: reminders table not set to prevent duplicates
- fix: add a `reminder_sent_at` check before sending a new reminder

Problem: audit trail missing

- likely cause: status changes are not recorded at transition time
- fix: add a trigger or API function to insert `audit_logs` whenever a query is reassigned or resolved

## 10) Security check

Before moving forward, verify:

- every query and group record has a school_id
- every API route checks the user’s school before returning data
- teacher can only access their own school queries and groups
- non-members cannot read private community content
- query reassignment and admin escalation are logged
- all deadlines remain tied to school policy and not a global fixed rule
- no real student data is stored yet

## 11) GitHub checkpoint

Before continuing:

```bash
cd /workspaces/Examify
git add .
git commit -m "feat: add queries and communities foundation"
git push origin main
```

Then confirm:

```bash
git status
git log -1
```

## 12) Completion checklist

- [ ] query schema added
- [ ] community schema added
- [ ] status and deadline logic defined
- [ ] query board UI built
- [ ] community hub UI built
- [ ] tenant isolation tested
- [ ] audit trail plan added
- [ ] notification flow defined
- [ ] GitHub checkpoint completed

## 13) Next step

The next step is Milestone 6: Dashboards and analytics.

This milestone builds on the query and community layer by adding:

- role-specific dashboards
- student progress analytics
- school-level analytics
- query resolution metrics
- parent-friendly reporting
- documented formulas and calculations

We should not move to the analytics layer until the query and community access rules pass the tenant-isolation checks above.

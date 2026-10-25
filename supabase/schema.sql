create extension if not exists pgcrypto;

create type user_role as enum (
  'platform_owner',
  'school_admin',
  'teacher',
  'student',
  'parent'
);

create table schools (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  domain text,
  settings jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table users (
  id uuid primary key,
  school_id uuid not null references schools(id) on delete cascade,
  email text not null,
  full_name text not null,
  role user_role not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (school_id, email)
);

create table classes (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references schools(id) on delete cascade,
  name text not null,
  section text,
  grade_level text,
  created_at timestamptz not null default now()
);

create table subjects (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references schools(id) on delete cascade,
  name text not null,
  code text,
  created_at timestamptz not null default now()
);

create table teachers (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references schools(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  designation text,
  created_at timestamptz not null default now(),
  unique (school_id, user_id)
);

create table students (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references schools(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  roll_number text,
  grade_level text,
  section text,
  created_at timestamptz not null default now(),
  unique (school_id, user_id)
);

create table parents (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references schools(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (school_id, user_id)
);

create function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger schools_updated_at
before update on schools
for each row execute procedure set_updated_at();

create trigger users_updated_at
before update on users
for each row execute procedure set_updated_at();

/**
 * The whole database, as SQL that is safe to run more than once.
 *
 * It is a TypeScript string rather than a .sql file so a serverless bundle
 * carries it with the code — there is no file to forget to ship.
 *
 * Row-level security is switched on with no policies. That is deliberate:
 * Supabase exposes every table in `public` through its REST API using a
 * public "anon" key, and with RLS off a stranger could read the password
 * hashes with it. With RLS on and no policy, that key sees nothing; this
 * server connects as the table owner, which RLS does not apply to. On Neon it
 * is a harmless no-op.
 */
export const SCHEMA = `
create table if not exists users (
  id            uuid primary key,
  email         text not null unique,
  name          text not null default '',
  password_hash text not null,
  follows       text[] not null default '{}',
  digest        boolean not null default false,
  created_at    timestamptz not null default now()
);

create table if not exists sessions (
  token_hash text primary key,
  user_id    uuid not null references users(id) on delete cascade,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
create index if not exists sessions_user_idx on sessions(user_id);

create table if not exists saves (
  user_id  uuid not null references users(id) on delete cascade,
  story_id text not null,
  title    text not null,
  url      text not null,
  source   text not null,
  slug     text,
  saved_at timestamptz not null default now(),
  primary key (user_id, story_id)
);

create table if not exists subscribers (
  email      text primary key,
  created_at timestamptz not null default now()
);

create table if not exists rate_limits (
  key      text primary key,
  count    int not null,
  reset_at timestamptz not null
);

alter table users        enable row level security;
alter table sessions     enable row level security;
alter table saves        enable row level security;
alter table subscribers  enable row level security;
alter table rate_limits  enable row level security;
`;

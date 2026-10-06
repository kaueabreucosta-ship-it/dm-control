-- Banidos do site (Crimson Beams X + dm-control). Rode UMA vez no Supabase: SQL Editor > New query > Run.
-- Use o MESMO projeto Supabase que a Zoe usa.

create table if not exists banned_users (
  discord_id  text primary key,
  username    text,
  reason      text,
  banned_at   timestamptz not null default now()
);

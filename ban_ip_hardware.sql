-- Extensão do sistema de banimento: IP e hardware (fingerprint do navegador).
-- Rode UMA vez no Supabase: SQL Editor > New query > Run.
-- Mesmo projeto Supabase que a Zoe / dm-control / Crimson já usam.

alter table members add column if not exists ip            text;
alter table members add column if not exists ip_hash       text;
alter table members add column if not exists device_label  text;
alter table members add column if not exists device_hash   text;
alter table members add column if not exists proxy_flag    boolean;
alter table members add column if not exists proxy_score   integer;

alter table banned_users add column if not exists ip_hash     text;
alter table banned_users add column if not exists device_hash text;
alter table banned_users add column if not exists ban_ip      boolean not null default false;
alter table banned_users add column if not exists ban_device  boolean not null default false;

create index if not exists banned_users_ip_hash_idx     on banned_users (ip_hash)     where ip_hash is not null;
create index if not exists banned_users_device_hash_idx on banned_users (device_hash) where device_hash is not null;

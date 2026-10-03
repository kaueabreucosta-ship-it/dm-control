-- Guarda a autorização OAuth2 (criptografada) de cada membro verificado.
-- Rode UMA vez no Supabase: SQL Editor > New query > Run.
-- Serve para "puxar" os membros para outro servidor mesmo se o servidor atual ou o bot caírem.

alter table members add column if not exists access_token     text;
alter table members add column if not exists refresh_token    text;
alter table members add column if not exists token_expires_at timestamptz;

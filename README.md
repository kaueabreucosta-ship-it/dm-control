# DM Control

Painel admin que guarda os membros verificados do Discord e manda DM em massa
através do bot (Zoe). Projeto separado do Crimson Beams X, mas usa o MESMO
banco (Supabase) que a Zoe já usa.

## 1. Banco de dados (Supabase)

Use o mesmo projeto Supabase que já está configurado na Zoe (`SUPABASE_URL` e
`SUPABASE_KEY` do bot). No painel do Supabase:

1. **SQL Editor → New query**
2. Cole o conteúdo de `members.sql` (deste projeto) e rode

A tabela `members` passa a existir no mesmo banco que o bot usa.

## 2. App do Discord (OAuth2)

1. https://discord.com/developers/applications → sua aplicação (a mesma da
   Zoe ou uma nova, tanto faz)
2. **OAuth2 → General**: copie o **Client ID** e gere/copie o **Client Secret**
3. Em **Redirects**, adicione:
   `https://SEU-SITE.vercel.app/api/auth/discord/callback`

## 3. Variáveis de ambiente (Vercel → Settings → Environment Variables)

- `SUPABASE_URL` / `SUPABASE_KEY` — as mesmas da Zoe
- `SESSION_SECRET` — string longa e aleatória (login do painel)
- `ADMIN_USERNAME` / `ADMIN_PASSWORD` — login do painel
- `BOT_SHARED_SECRET` — string aleatória; **precisa ser IGUAL** à configurada
  no bot
- `BOT_API_URL` — endereço do bot no Railway
- `DISCORD_CLIENT_ID` / `DISCORD_CLIENT_SECRET` — da aplicação do Discord
- `DISCORD_REDIRECT_URI` — a mesma URL cadastrada no passo 2

Nunca coloque essas variáveis no GitHub — só na Vercel.

## 4. Deploy

1. Suba esta pasta (sem `node_modules`) para um repositório novo no GitHub
2. Vercel → **Add New → Project** → importe o repositório
3. Configure as variáveis acima → Deploy

## Páginas

- `/verificar` — página pública, botão "Verificar com Discord"
- `/login` → `/dashboard` — painel admin (lista de membros + enviar DM)

## Como a verificação funciona

1. Pessoa entra em `/verificar` e clica em "Verificar com Discord"
2. Discord confirma a identidade dela pro site (OAuth2, só o essencial: ID e
   username — sem acesso a mensagens, servidores etc)
3. O site pergunta pro bot (`GET /membro/:id`) se ela está no servidor
4. Se estiver, o site pede pro bot (`POST /verificar`) mandar uma DM pedindo
   o link do webhook dela
5. A pessoa responde a DM com o webhook; o bot valida e avisa o site
   (`POST /api/members`), que guarda tudo na tabela `members`

## Enviar DM pra todos

No `/dashboard`, escreva a mensagem e clique em "Enviar DM pra todos". O site
chama `POST <BOT_API_URL>/send-dm` e o bot manda a mensagem na DM (e no
webhook, se tiver) de cada membro que não estiver marcado como "excluído".

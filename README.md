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

1. https://discord.com/developers/applications → sua aplicação
2. **OAuth2 → General**: copie o **Client ID** e gere/copie o **Client Secret**
3. Em **Redirects**, adicione:
   `https://SEU-SITE.vercel.app/api/auth/discord/callback`

## 3. Variáveis de ambiente

Configure na Vercel:

- `SUPABASE_URL` / `SUPABASE_KEY`
- `SESSION_SECRET`
- `ADMIN_USERNAME` / `ADMIN_PASSWORD`
- `BOT_SHARED_SECRET`
- `BOT_API_URL`
- `DISCORD_CLIENT_ID` / `DISCORD_CLIENT_SECRET`
- `DISCORD_REDIRECT_URI`

Nunca coloque essas variáveis no GitHub — só na Vercel.

## 4. Deploy

1. Suba esta pasta (sem `node_modules`) para um repositório no GitHub
2. Vercel → **Add New → Project** → importe o repositório
3. Configure as variáveis acima → Deploy

Deploy Vercel

## Páginas

- `/verificar` — página pública
- `/login` → `/dashboard` — painel admin

## Enviar DM pra todos

No `/dashboard`, escreva a mensagem e clique em "Enviar DM pra todos". O site
chama `POST <BOT_API_URL>/send-dm` e o bot manda a mensagem na DM (e no
webhook, se tiver) de cada membro que não estiver marcado como "excluído".

## Banir do site

<<<<<<< HEAD
No `/dashboard` há o botão **Banir** em cada membro e a seção **Banidos do site**.
Rode `banned.sql` no Supabase uma vez. O Crimson Beams X lê a mesma tabela
`banned_users`, então o ban vale nos dois sites (em até 10 minutos para quem já
está logado). Banido também sai do "Enviar DM pra todos" e não consegue se verificar.
=======
No `/dashboard` há o botão **Banir** em cada membro e a seção **Banidos do site** (banir por ID do Discord e desbanir).
Rode `banned.sql` no Supabase uma vez. O Crimson Beams X lê a mesma tabela `banned_users`, então o ban vale nos dois sites
(em até 10 minutos para quem já está logado). Banido também sai do "Enviar DM pra todos" e não consegue se verificar.

## Verificação sem webhook + puxar membros para outro servidor

A verificação agora guarda a **autorização OAuth2** da pessoa (scopes `identify guilds.join`), criptografada
com `TOKEN_ENC_KEY`. A Zoe só manda uma DM avisando que ela foi verificada — não pede mais webhook.

**Configuração (uma vez):**
1. Rode `members_oauth.sql` no Supabase.
2. Adicione `TOKEN_ENC_KEY` e `DISCORD_BOT_TOKEN` na Vercel (veja `.env.example`) e faça Redeploy.
3. Quem verificou antes dessa mudança precisa verificar de novo uma vez para ter autorização salva.

**Para puxar:** no `/dashboard`, seção **Puxar membros para outro servidor** → cole o link de convite →
**Puxar membros verificados**. Antes: adicione a Zoe no servidor de destino com a permissão **Criar convite**.
O painel processa em lotes (~1 pessoa/segundo, limite do Discord) e dá pra parar e continuar; quem já entrou é pulado.
Como usa o token do bot direto na API do Discord, funciona mesmo com o processo do bot fora do ar.
Banidos do site são pulados, e quem revogou a autorização é ignorado.
>>>>>>> f67db13 (Atualização via ZIP)

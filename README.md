# Tickets

Tickets e uma interface Next.js para abertura e acompanhamento de conversas no Chatwoot com atualizacao em tempo real.

## Stack

- Next.js 16 (App Router) + TypeScript
- Better Auth (email/senha + Microsoft OAuth)
- Prisma ORM + PostgreSQL
- shadcn/ui
- Chatwoot Client API + WebSocket (`/cable`) + Webhook

## Funcionalidades

- Autenticacao com Better Auth
  - Login com e-mail e senha
  - Login com Microsoft (quando credenciais estiverem configuradas)
- Tela inicial com historico de conversas e status
- Formulario de abertura de conversa com:
  - titulo
  - descricao
  - complexidade
  - setor
  - para si mesmo ou para outra pessoa
- Interface de chat com:
  - envio/recebimento de mensagens
  - conexao WebSocket para eventos em tempo real
  - timeline de eventos via webhook (atribuicao, atualizacoes, resolucao/reabertura)

## Configuracao

1. Instale dependencias:

```bash
pnpm install
```

2. Ajuste o arquivo `.env`:

- `DATABASE_URL`
- `BETTER_AUTH_SECRET`
- `BETTER_AUTH_URL`
- `MICROSOFT_CLIENT_ID` e `MICROSOFT_CLIENT_SECRET` (opcional)
- `CHATWOOT_BASE_URL`
- `CHATWOOT_INBOX_IDENTIFIER`
- `CHATWOOT_WEBHOOK_TOKEN` (recomendado)

3. Gere o Prisma Client:

```bash
pnpm exec prisma generate
```

4. Rode as migrations:

```bash
pnpm exec prisma migrate dev --name init
```

5. Inicie o projeto:

```bash
pnpm dev
```

## Webhook do Chatwoot

Configure no Chatwoot a URL de webhook apontando para:

```text
http://localhost:3000/api/chatwoot/webhook?token=SEU_CHATWOOT_WEBHOOK_TOKEN
```

Assine pelo menos os eventos:

- `message_created`
- `conversation_updated`
- `conversation_status_changed`

## Estrutura principal

- `app/(auth)` -> telas de login/cadastro
- `app/(app)` -> dashboard, abertura de conversa e chat
- `app/api/conversations` -> CRUD de conversa/mensagem para o frontend
- `app/api/chatwoot/webhook` -> ingestao de eventos do Chatwoot
- `lib/chatwoot.ts` -> client API Chatwoot
- `lib/tickets.ts` -> normalizacao e persistencia de eventos/mensagens
- `prisma/schema.prisma` -> schema de auth + dominio de tickets

## Vinculo Better Auth x Chatwoot

O projeto cria e reaproveita um contato no Chatwoot por usuario autenticado no Better Auth (por `userId + inbox`), persistindo esse vinculo na tabela:

- `chatwoot_contact_link`

Com isso, cada nova conversa usa o mesmo contato do usuario no Chatwoot.

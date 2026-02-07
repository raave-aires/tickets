import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import type { Prisma } from "@/prisma/client/client";
import { db } from "@/lib/db";
import {
  applyConversationStatusFromWebhook,
  mapChatwootStatus,
  parseChatwootConversationId,
  persistChatwootMessage,
} from "@/lib/tickets";

export const dynamic = "force-dynamic";

function unauthorized() {
  return NextResponse.json(
    { error: "Webhook nao autorizado" },
    { status: 401 },
  );
}

export async function POST(request: Request) {
  const expectedToken = process.env.CHATWOOT_WEBHOOK_TOKEN;

  if (expectedToken) {
    const url = new URL(request.url);
    const queryToken = url.searchParams.get("token");
    const headerToken = request.headers.get("x-chatwoot-token");

    if (queryToken !== expectedToken && headerToken !== expectedToken) {
      return unauthorized();
    }
  }

  const raw = await request.text();

  if (!raw) {
    return NextResponse.json({ error: "Payload vazio" }, { status: 400 });
  }

  let payload: Record<string, unknown>;

  try {
    payload = JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Payload invalido" }, { status: 400 });
  }

  const event = typeof payload.event === "string" ? payload.event : "unknown";

  const chatwootConversationId = parseChatwootConversationId(payload);

  const conversation = chatwootConversationId
    ? await db.ticketConversation.findFirst({
        where: {
          chatwootConversationId,
        },
      })
    : null;

  await db.chatwootWebhookDelivery.create({
    data: {
      event,
      chatwootConversationId,
      ticketConversationId: conversation?.id,
      payload: payload as Prisma.InputJsonValue,
    },
  });

  if (!conversation) {
    return NextResponse.json({ received: true });
  }

  try {
    if (event === "message_created") {
      await persistChatwootMessage(conversation.id, payload);
    }

    if (
      event === "conversation_status_changed" ||
      event === "conversation_updated"
    ) {
      const status =
        mapChatwootStatus(payload.status) ??
        mapChatwootStatus(
          (payload.conversation as { status?: unknown } | undefined)?.status,
        ) ??
        conversation.status;

      await applyConversationStatusFromWebhook(conversation, status, payload);
    }

    if (event === "message_created") {
      await db.ticketEvent.create({
        data: {
          conversationId: conversation.id,
          event,
          title: "Nova mensagem no Chatwoot",
          description:
            typeof payload.content === "string" ? payload.content : null,
          payload: payload as Prisma.InputJsonValue,
        },
      });
    }

    revalidatePath("/");
    revalidatePath(`/conversations/${conversation.id}`);

    return NextResponse.json({ received: true });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Erro ao processar webhook",
      },
      { status: 500 },
    );
  }
}

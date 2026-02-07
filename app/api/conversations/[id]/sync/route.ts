import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  applyConversationStatusFromWebhook,
  mapChatwootStatus,
  persistChatwootMessage,
} from "@/lib/tickets";
import { websocketSyncSchema } from "@/lib/validators";

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    return NextResponse.json({ error: "Nao autenticado" }, { status: 401 });
  }

  const { id } = await context.params;
  const conversation = await db.ticketConversation.findFirst({
    where: {
      id,
      userId: session.user.id,
    },
  });

  if (!conversation) {
    return NextResponse.json(
      { error: "Conversa nao encontrada" },
      { status: 404 },
    );
  }

  const body = await request.json();
  const parsed = websocketSyncSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Payload invalido" }, { status: 400 });
  }

  const { event, data } = parsed.data;

  try {
    if (event === "message.created" && data) {
      await persistChatwootMessage(conversation.id, data);
    }

    if (
      event === "conversation.updated" ||
      event === "conversation.status_changed" ||
      event === "assignee.changed"
    ) {
      const payload = data ?? {};
      const status =
        mapChatwootStatus((payload as { status?: unknown }).status) ??
        mapChatwootStatus(
          (payload as { conversation?: { status?: unknown } }).conversation
            ?.status,
        ) ??
        conversation.status;

      await applyConversationStatusFromWebhook(conversation, status, payload);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Erro ao sincronizar",
      },
      { status: 500 },
    );
  }
}

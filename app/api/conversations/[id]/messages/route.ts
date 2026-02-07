import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { listMessages, sendMessage, toClientMessage } from "@/lib/chatwoot";
import { db } from "@/lib/db";
import { persistChatwootMessage } from "@/lib/tickets";
import { messageSchema } from "@/lib/validators";

export const dynamic = "force-dynamic";

async function getSession() {
  return auth.api.getSession({
    headers: await headers(),
  });
}

async function getConversationOrError(id: string, userId: string) {
  const conversation = await db.ticketConversation.findFirst({
    where: {
      id,
      userId,
    },
  });

  if (!conversation) {
    return {
      error: NextResponse.json(
        { error: "Conversa nao encontrada" },
        { status: 404 },
      ),
    };
  }

  if (!conversation.chatwootConversationId) {
    return {
      error: NextResponse.json(
        { error: "Conversa sem vinculacao no Chatwoot" },
        { status: 400 },
      ),
    };
  }

  return { conversation };
}

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const session = await getSession();

  if (!session) {
    return NextResponse.json({ error: "Nao autenticado" }, { status: 401 });
  }

  const { id } = await context.params;
  const result = await getConversationOrError(id, session.user.id);

  if (result.error) {
    return result.error;
  }

  const { conversation } = result;
  const chatwootConversationId = conversation.chatwootConversationId;

  if (chatwootConversationId === null) {
    return NextResponse.json(
      { error: "Conversa sem vinculacao no Chatwoot" },
      { status: 400 },
    );
  }

  try {
    const messages = await listMessages({
      contactIdentifier: conversation.chatwootContactId,
      conversationId: chatwootConversationId,
    });

    for (const message of messages) {
      await persistChatwootMessage(conversation.id, message);
    }

    return NextResponse.json({
      messages: messages.map((message) => toClientMessage(message)),
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Erro ao listar mensagens da conversa",
      },
      { status: 500 },
    );
  }
}

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const session = await getSession();

  if (!session) {
    return NextResponse.json({ error: "Nao autenticado" }, { status: 401 });
  }

  const { id } = await context.params;
  const result = await getConversationOrError(id, session.user.id);

  if (result.error) {
    return result.error;
  }

  const { conversation } = result;
  const chatwootConversationId = conversation.chatwootConversationId;

  if (chatwootConversationId === null) {
    return NextResponse.json(
      { error: "Conversa sem vinculacao no Chatwoot" },
      { status: 400 },
    );
  }

  const body = await request.json();
  const parsed = messageSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Mensagem invalida",
        issues: parsed.error.flatten(),
      },
      { status: 400 },
    );
  }

  try {
    const created = await sendMessage({
      contactIdentifier: conversation.chatwootContactId,
      conversationId: chatwootConversationId,
      content: parsed.data.content,
      echoId: `msg-${Date.now()}`,
    });

    await persistChatwootMessage(conversation.id, created);

    revalidatePath("/");
    revalidatePath(`/conversations/${conversation.id}`);

    return NextResponse.json({
      message: toClientMessage(created),
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Erro ao enviar mensagem para o Chatwoot",
      },
      { status: 500 },
    );
  }
}

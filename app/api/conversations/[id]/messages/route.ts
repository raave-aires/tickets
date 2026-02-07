import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { listMessages, sendMessage, toClientMessage } from "@/lib/chatwoot";
import { db } from "@/lib/db";
import { persistChatwootMessage } from "@/lib/tickets";
import { messageSchema } from "@/lib/validators";

export const dynamic = "force-dynamic";
const MAX_ATTACHMENTS = 5;
const MAX_FILE_SIZE_BYTES = 15 * 1024 * 1024;
const ALLOWED_MIME_TYPES = new Set(["application/pdf"]);

async function getSession() {
  return auth.api.getSession({
    headers: await headers(),
  });
}

function isAllowedAttachmentMimeType(mimeType: string) {
  if (ALLOWED_MIME_TYPES.has(mimeType)) {
    return true;
  }

  return mimeType.startsWith("image/");
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

  const contentType = request.headers.get("content-type")?.toLowerCase() ?? "";
  let content = "";
  let attachments: File[] = [];

  if (contentType.includes("multipart/form-data")) {
    const formData = await request.formData();
    const contentValue = formData.get("content");
    content = typeof contentValue === "string" ? contentValue.trim() : "";

    const uploadedFiles = [
      ...formData.getAll("attachments"),
      ...formData.getAll("attachments[]"),
    ].filter((value): value is File => value instanceof File);

    if (uploadedFiles.length > MAX_ATTACHMENTS) {
      return NextResponse.json(
        {
          error: `Voce pode enviar no maximo ${MAX_ATTACHMENTS} arquivos por mensagem.`,
        },
        { status: 400 },
      );
    }

    for (const file of uploadedFiles) {
      if (file.size === 0) {
        return NextResponse.json(
          { error: "Arquivo vazio nao e permitido." },
          { status: 400 },
        );
      }

      if (file.size > MAX_FILE_SIZE_BYTES) {
        return NextResponse.json(
          { error: `Cada arquivo deve ter no maximo 15 MB.` },
          { status: 400 },
        );
      }

      if (!isAllowedAttachmentMimeType(file.type)) {
        return NextResponse.json(
          {
            error:
              "Tipo de arquivo nao permitido. Envie apenas imagens ou documentos PDF.",
          },
          { status: 400 },
        );
      }
    }

    attachments = uploadedFiles;
  } else {
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

    content = parsed.data.content;
  }

  if (!content && attachments.length === 0) {
    return NextResponse.json(
      { error: "Informe uma mensagem ou anexe ao menos um arquivo." },
      { status: 400 },
    );
  }

  try {
    const created = await sendMessage({
      contactIdentifier: conversation.chatwootContactId,
      conversationId: chatwootConversationId,
      content: content || undefined,
      echoId: `msg-${Date.now()}`,
      attachments: attachments.length > 0 ? attachments : undefined,
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

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { NextResponse } from "next/server";
import type { Prisma } from "@/generated/prisma";
import { auth } from "@/lib/auth";
import {
  createConversation,
  getChatwootInboxIdentifier,
  getOrCreateContact,
  sendMessage,
} from "@/lib/chatwoot";
import { db } from "@/lib/db";
import { persistChatwootMessage } from "@/lib/tickets";
import {
  type ConversationCreateInput,
  conversationCreateSchema,
} from "@/lib/validators";

export const dynamic = "force-dynamic";

async function getSession() {
  return auth.api.getSession({
    headers: await headers(),
  });
}

function buildBetterAuthContactIdentifier(userId: string) {
  return `better-auth:${userId}`;
}

function buildContactAttributes(params: {
  userId: string;
  userEmail: string;
  userName: string;
  authAccounts: { providerId: string; accountId: string }[];
}) {
  const providers = Array.from(
    new Set(params.authAccounts.map((account) => account.providerId)),
  );

  return {
    application_user_id: params.userId,
    source: "tickets_nextjs",
    better_auth_user_id: params.userId,
    better_auth_user_email: params.userEmail,
    better_auth_user_name: params.userName,
    better_auth_providers: providers,
    better_auth_accounts: params.authAccounts.map(
      (account) => `${account.providerId}:${account.accountId}`,
    ),
  };
}

const complexityLabels: Record<ConversationCreateInput["complexity"], string> =
  {
    LOW: "Baixa",
    MEDIUM: "Media",
    HIGH: "Alta",
    CRITICAL: "Critica",
  };

function buildInitialContextMessage(input: ConversationCreateInput) {
  const lines = [
    "Ticket aberto via portal Tickets.",
    `Titulo: ${input.title}`,
    `Complexidade: ${complexityLabels[input.complexity]}`,
    `Setor: ${input.sector}`,
    `Solicitacao: ${
      input.requestTarget === "SELF" ? "Para mim" : "Para outra pessoa"
    }`,
  ];

  if (input.requestTarget === "OTHER") {
    lines.push(
      `Solicitante: ${input.requestForName?.trim() || "Nao informado"}`,
    );
    lines.push(
      `E-mail do solicitante: ${
        input.requestForEmail?.trim() || "Nao informado"
      }`,
    );
  }

  lines.push("");
  lines.push("Descricao:");
  lines.push(input.description);

  return lines.join("\n");
}

async function ensureLinkedChatwootContact(params: {
  userId: string;
  userName: string;
  userEmail: string;
}) {
  const inboxIdentifier = getChatwootInboxIdentifier();

  const [existingLink, authAccounts] = await Promise.all([
    db.chatwootContactLink.findUnique({
      where: {
        userId_inboxIdentifier: {
          userId: params.userId,
          inboxIdentifier,
        },
      },
    }),
    db.account.findMany({
      where: { userId: params.userId },
      select: {
        providerId: true,
        accountId: true,
      },
    }),
  ]);

  const identifier =
    existingLink?.contactIdentifier ??
    buildBetterAuthContactIdentifier(params.userId);

  const contact = await getOrCreateContact({
    identifier,
    name: params.userName,
    email: params.userEmail,
    customAttributes: buildContactAttributes({
      userId: params.userId,
      userEmail: params.userEmail,
      userName: params.userName,
      authAccounts,
    }),
  });

  if (existingLink) {
    await db.chatwootContactLink.update({
      where: {
        id: existingLink.id,
      },
      data: {
        contactIdentifier: contact.identifier,
        sourceId: contact.sourceId,
        pubsubToken: contact.pubsubToken,
      },
    });
  } else {
    await db.chatwootContactLink.create({
      data: {
        userId: params.userId,
        inboxIdentifier,
        contactIdentifier: contact.identifier,
        sourceId: contact.sourceId,
        pubsubToken: contact.pubsubToken,
      },
    });
  }

  return {
    contact,
    inboxIdentifier,
  };
}

export async function GET() {
  const session = await getSession();

  if (!session) {
    return NextResponse.json({ error: "Nao autenticado" }, { status: 401 });
  }

  const conversations = await db.ticketConversation.findMany({
    where: {
      userId: session.user.id,
    },
    include: {
      events: {
        orderBy: { occurredAt: "desc" },
        take: 1,
      },
      messages: {
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
    orderBy: {
      updatedAt: "desc",
    },
  });

  return NextResponse.json({ conversations });
}

export async function POST(request: Request) {
  const session = await getSession();

  if (!session) {
    return NextResponse.json({ error: "Nao autenticado" }, { status: 401 });
  }

  const body = await request.json();
  const parsed = conversationCreateSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Dados invalidos",
        issues: parsed.error.flatten(),
      },
      { status: 400 },
    );
  }

  const input = parsed.data;
  const requestForName = input.requestForName?.trim() || null;
  const requestForEmail = input.requestForEmail?.trim() || null;

  try {
    const { contact, inboxIdentifier } = await ensureLinkedChatwootContact({
      userId: session.user.id,
      userName: session.user.name,
      userEmail: session.user.email,
    });

    const chatwootConversation = await createConversation({
      contactIdentifier: contact.identifier,
      customAttributes: {
        title: input.title,
        complexity: input.complexity,
        sector: input.sector,
        request_target: input.requestTarget,
        request_for_name: requestForName,
        request_for_email: requestForEmail,
        opened_via: "tickets_nextjs",
      },
    });

    if (!chatwootConversation.id) {
      throw new Error("Chatwoot nao retornou o id da conversa");
    }

    const conversation = await db.ticketConversation.create({
      data: {
        userId: session.user.id,
        title: input.title,
        description: input.description,
        complexity: input.complexity,
        sector: input.sector,
        requestTarget: input.requestTarget,
        requestForName,
        requestForEmail,
        chatwootConversationId: chatwootConversation.id,
        chatwootContactId: contact.identifier,
        chatwootPubsubToken: contact.pubsubToken,
        chatwootSourceId: contact.sourceId,
        chatwootInboxIdentifier: inboxIdentifier,
        status: "OPEN",
        metadata: chatwootConversation as unknown as Prisma.InputJsonValue,
        events: {
          create: {
            event: "conversation.created",
            title: "Conversa aberta",
            description: "Conversa criada no Chatwoot",
            payload: chatwootConversation as unknown as Prisma.InputJsonValue,
          },
        },
      },
    });

    const initialMessage = await sendMessage({
      contactIdentifier: contact.identifier,
      conversationId: chatwootConversation.id,
      content: buildInitialContextMessage(input),
      echoId: `initial-${conversation.id}`,
    });

    await persistChatwootMessage(conversation.id, initialMessage);

    revalidatePath("/");

    return NextResponse.json({
      conversation,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Erro ao criar a conversa no Chatwoot",
      },
      { status: 500 },
    );
  }
}

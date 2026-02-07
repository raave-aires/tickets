import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
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
    include: {
      events: {
        orderBy: { occurredAt: "desc" },
        take: 15,
      },
    },
  });

  if (!conversation) {
    return NextResponse.json(
      { error: "Conversa nao encontrada" },
      { status: 404 },
    );
  }

  return NextResponse.json({
    conversation: {
      id: conversation.id,
      status: conversation.status,
      assignedAgentName: conversation.assignedAgentName,
      resolvedAt: conversation.resolvedAt,
      reopenedAt: conversation.reopenedAt,
    },
    events: conversation.events,
  });
}

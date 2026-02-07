import { notFound } from "next/navigation";
import { ChatInterface } from "@/components/tickets/chat-interface";
import { getChatwootWebSocketUrl } from "@/lib/chatwoot";
import { db } from "@/lib/db";
import { requireServerSession } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function ConversationPage(props: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireServerSession();
  const { id } = await props.params;

  const conversation = await db.ticketConversation.findFirst({
    where: {
      id,
      userId: session.user.id,
    },
  });

  if (!conversation) {
    notFound();
  }

  let webSocketUrl: string | null = null;

  try {
    webSocketUrl = getChatwootWebSocketUrl();
  } catch {
    webSocketUrl = null;
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Conversa #{conversation.chatwootConversationId ?? conversation.id}
      </p>

      <ChatInterface
        conversationId={conversation.id}
        conversationTitle={conversation.title}
        initialStatus={conversation.status}
        initialAssignedAgentName={conversation.assignedAgentName}
        chatwootPubsubToken={conversation.chatwootPubsubToken}
        chatwootWebSocketUrl={webSocketUrl}
      />
    </div>
  );
}

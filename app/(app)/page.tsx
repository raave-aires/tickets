import { ArrowRight, MessageSquareDashed } from "lucide-react";
import Link from "next/link";
import { ConversationCard } from "@/components/tickets/conversation-card";
import {
  HistoryStatusFilter,
  type HistoryStatusFilterValue,
} from "@/components/tickets/history-status-filter";
import { Button } from "@/components/ui/button";
import type { TicketStatus } from "@/generated/prisma";
import { db } from "@/lib/db";
import { requireServerSession } from "@/lib/session";

export const dynamic = "force-dynamic";

const statusLabels: Record<TicketStatus, string> = {
  OPEN: "Aberta",
  PENDING: "Pendente",
  RESOLVED: "Resolvida",
  SNOOZED: "Pausada",
};

function parseStatusFilter(status?: string): TicketStatus | null {
  if (!status) {
    return null;
  }

  if (Object.hasOwn(statusLabels, status)) {
    return status as TicketStatus;
  }

  return null;
}

export default async function DashboardPage(props: {
  searchParams: Promise<{ status?: string }>;
}) {
  const session = await requireServerSession();
  const { status } = await props.searchParams;
  const statusFilter = parseStatusFilter(status);
  const selectedFilter: HistoryStatusFilterValue = statusFilter ?? "ALL";

  const conversations = await db.ticketConversation.findMany({
    where: {
      userId: session.user.id,
      ...(statusFilter ? { status: statusFilter } : {}),
    },
    include: {
      events: {
        orderBy: {
          occurredAt: "desc",
        },
        take: 1,
      },
      messages: {
        orderBy: {
          createdAt: "desc",
        },
        take: 1,
      },
    },
    orderBy: {
      updatedAt: "desc",
    },
  });

  return (
    <div className="space-y-6">
      <section className="flex flex-col gap-4 rounded-lg border p-6 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight">
            Historico de tickets
          </h1>
          <p className="text-sm text-muted-foreground">
            Acompanhe suas conversas abertas no Chatwoot, com status e eventos
            sincronizados.
          </p>
        </div>
        <HistoryStatusFilter value={selectedFilter} />
      </section>

      {conversations.length === 0 ? (
        <section className="rounded-lg border border-dashed p-8 text-center">
          <MessageSquareDashed className="mx-auto mb-4 size-10 text-muted-foreground" />
          <h2 className="text-xl font-semibold">Nenhuma conversa encontrada</h2>
          <p className="mx-auto mt-2 max-w-lg text-sm text-muted-foreground">
            {statusFilter
              ? `Nao ha conversas com status ${statusLabels[
                  statusFilter
                ].toLowerCase()}.`
              : "Abra sua primeira conversa para iniciar um fluxo de atendimento em tempo real."}
          </p>
          <div className="mt-6 flex justify-center gap-2">
            {statusFilter ? (
              <Button asChild variant="outline">
                <Link href="/">Limpar filtro</Link>
              </Button>
            ) : null}
            <Button asChild>
              <Link href="/conversations/new">
                Abrir conversa
                <ArrowRight className="ml-2 size-4" />
              </Link>
            </Button>
          </div>
        </section>
      ) : (
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {conversations.map((conversation) => (
            <ConversationCard
              key={conversation.id}
              conversation={conversation}
            />
          ))}
        </section>
      )}
    </div>
  );
}

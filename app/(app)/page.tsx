import { ArrowRight, MessageSquareDashed } from "lucide-react";
import Link from "next/link";
import { ConversationCard } from "@/components/tickets/conversation-card";
import { Button } from "@/components/ui/button";
import { db } from "@/lib/db";
import { requireServerSession } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const session = await requireServerSession();

  const conversations = await db.ticketConversation.findMany({
    where: {
      userId: session.user.id,
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
      <section className="rounded-3xl border border-white/40 bg-white/75 p-6 shadow-[0_24px_70px_-45px_rgba(14,37,60,.55)] backdrop-blur-md dark:border-white/10 dark:bg-card/80 sm:p-8">
        <p className="text-xs uppercase tracking-[0.15em] text-muted-foreground">
          Painel de conversas
        </p>
        <h1 className="mt-2 font-display text-4xl leading-tight text-foreground sm:text-5xl">
          Historico de tickets
        </h1>
        <p className="mt-3 max-w-2xl text-sm text-muted-foreground sm:text-base">
          Acompanhe cada conversa aberta no Chatwoot, com status e eventos
          sincronizados.
        </p>
      </section>

      {conversations.length === 0 ? (
        <section className="rounded-3xl border border-dashed border-border bg-card/70 p-8 text-center">
          <MessageSquareDashed className="mx-auto mb-4 size-10 text-muted-foreground" />
          <h2 className="font-display text-2xl">Nenhuma conversa criada</h2>
          <p className="mx-auto mt-2 max-w-lg text-sm text-muted-foreground">
            Abra sua primeira conversa para iniciar um fluxo de atendimento em
            tempo real.
          </p>
          <Button asChild className="mt-6">
            <Link href="/conversations/new">
              Abrir primeira conversa
              <ArrowRight className="ml-2 size-4" />
            </Link>
          </Button>
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

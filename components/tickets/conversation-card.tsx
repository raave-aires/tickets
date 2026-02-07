import { ArrowUpRight, Building2, UserRound } from "lucide-react";
import Link from "next/link";
import { ComplexityBadge } from "@/components/tickets/complexity-badge";
import { StatusBadge } from "@/components/tickets/status-badge";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type {
  TicketConversation,
  TicketEvent,
  TicketMessage,
} from "@/generated/prisma";

type ConversationCardProps = {
  conversation: TicketConversation & {
    events: TicketEvent[];
    messages: TicketMessage[];
  };
};

const dateFormatter = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "short",
  timeStyle: "short",
});

export function ConversationCard({ conversation }: ConversationCardProps) {
  const lastEvent = conversation.events[0];
  const lastMessage = conversation.messages[0];

  return (
    <Link href={`/conversations/${conversation.id}`}>
      <Card className="group h-full transition-colors hover:border-primary/40">
        <CardHeader className="space-y-4">
          <div className="flex items-center justify-between gap-2">
            <StatusBadge status={conversation.status} />
            <ComplexityBadge complexity={conversation.complexity} />
          </div>
          <CardTitle className="line-clamp-2 text-lg leading-tight">
            {conversation.title}
          </CardTitle>
        </CardHeader>

        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p className="line-clamp-2">{conversation.description}</p>

          <div className="flex items-center gap-2">
            <Building2 className="size-4" />
            <span className="line-clamp-1">{conversation.sector}</span>
          </div>

          {conversation.assignedAgentName ? (
            <div className="flex items-center gap-2">
              <UserRound className="size-4" />
              <span className="line-clamp-1">
                Agente: {conversation.assignedAgentName}
              </span>
            </div>
          ) : null}

          {lastEvent ? (
            <p className="line-clamp-1 text-xs text-muted-foreground/90">
              {lastEvent.title}
            </p>
          ) : null}

          {lastMessage ? (
            <p className="line-clamp-1 text-xs text-muted-foreground/90">
              Ultima mensagem: {lastMessage.content}
            </p>
          ) : null}
        </CardContent>

        <CardFooter className="flex items-center justify-between text-xs text-muted-foreground">
          <span>
            Atualizada em {dateFormatter.format(conversation.updatedAt)}
          </span>
          <ArrowUpRight className="size-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
        </CardFooter>
      </Card>
    </Link>
  );
}

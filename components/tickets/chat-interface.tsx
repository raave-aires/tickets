"use client";

import {
  AlertCircle,
  CircleDotDashed,
  Loader2,
  SendHorizonal,
  Wifi,
  WifiOff,
} from "lucide-react";
import { type FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { StatusBadge } from "@/components/tickets/status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  type TicketEvent,
  TicketMessageType,
  type TicketStatus,
} from "@/generated/prisma";

type ChatInterfaceProps = {
  conversationId: string;
  conversationTitle: string;
  initialStatus: TicketStatus;
  initialAssignedAgentName: string | null;
  chatwootPubsubToken: string;
  chatwootWebSocketUrl: string | null;
};

type ChatMessage = {
  id: string | number;
  content: string;
  messageType: TicketMessageType;
  senderName: string | null;
  senderType: string | null;
  createdAt: string;
  isFromAgent: boolean;
};

type EventsApiResponse = {
  conversation: {
    status: TicketStatus;
    assignedAgentName: string | null;
  };
  events: TicketEvent[];
};

type MessagesApiResponse = {
  messages: ChatMessage[];
};

type ConnectionState = "connecting" | "connected" | "offline";

const timeFormatter = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "short",
  timeStyle: "short",
});

function normalizeWsMessage(data: Record<string, unknown>): ChatMessage {
  const messageTypeRaw = data.message_type;
  const messageType =
    messageTypeRaw === 1 || messageTypeRaw === "outgoing"
      ? TicketMessageType.OUTGOING
      : messageTypeRaw === 2 || messageTypeRaw === "activity"
        ? TicketMessageType.ACTIVITY
        : TicketMessageType.INCOMING;

  const sender =
    typeof data.sender === "object" && data.sender
      ? (data.sender as Record<string, unknown>)
      : {};

  const createdAtRaw = data.created_at;
  const createdAt = (() => {
    if (typeof createdAtRaw === "number") {
      return new Date(createdAtRaw * 1000).toISOString();
    }

    if (typeof createdAtRaw === "string") {
      const parsed = new Date(createdAtRaw);
      if (!Number.isNaN(parsed.getTime())) {
        return parsed.toISOString();
      }
    }

    return new Date().toISOString();
  })();

  const id =
    typeof data.id === "number" || typeof data.id === "string"
      ? data.id
      : `ws-${Date.now()}-${Math.random()}`;

  const senderType =
    typeof sender.type === "string" ? sender.type.toLowerCase() : null;

  return {
    id,
    content: typeof data.content === "string" ? data.content : "",
    messageType,
    senderName: typeof sender.name === "string" ? sender.name : null,
    senderType,
    createdAt,
    isFromAgent:
      messageType === TicketMessageType.OUTGOING || senderType === "user",
  };
}

function appendUniqueMessage(messages: ChatMessage[], message: ChatMessage) {
  if (messages.some((item) => String(item.id) === String(message.id))) {
    return messages;
  }

  return [...messages, message].sort((left, right) => {
    return (
      new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime()
    );
  });
}

function resolveWsAssignee(data: Record<string, unknown>) {
  const conversation =
    typeof data.conversation === "object" && data.conversation
      ? (data.conversation as Record<string, unknown>)
      : {};

  const meta =
    typeof data.meta === "object" && data.meta
      ? (data.meta as Record<string, unknown>)
      : {};

  const conversationMeta =
    typeof conversation.meta === "object" && conversation.meta
      ? (conversation.meta as Record<string, unknown>)
      : {};

  const assigneeCandidate =
    meta.assignee ??
    conversationMeta.assignee ??
    data.assignee ??
    conversation.assignee;

  if (assigneeCandidate === undefined) {
    return { hasAssignee: false, assignedAgentName: null as string | null };
  }

  if (typeof assigneeCandidate !== "object" || !assigneeCandidate) {
    return { hasAssignee: true, assignedAgentName: null as string | null };
  }

  const assignee = assigneeCandidate as Record<string, unknown>;

  return {
    hasAssignee: true,
    assignedAgentName:
      typeof assignee.name === "string"
        ? assignee.name
        : (null as string | null),
  };
}

export function ChatInterface({
  conversationId,
  conversationTitle,
  initialStatus,
  initialAssignedAgentName,
  chatwootPubsubToken,
  chatwootWebSocketUrl,
}: ChatInterfaceProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [events, setEvents] = useState<TicketEvent[]>([]);
  const [status, setStatus] = useState<TicketStatus>(initialStatus);
  const [assignedAgentName, setAssignedAgentName] = useState<string | null>(
    initialAssignedAgentName,
  );
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [connectionState, setConnectionState] = useState<ConnectionState>(
    chatwootWebSocketUrl ? "connecting" : "offline",
  );

  const scrollRef = useRef<HTMLDivElement | null>(null);
  const messageCount = messages.length;

  const connectionIndicator = useMemo(() => {
    if (connectionState === "connected") {
      return (
        <Badge
          variant="outline"
          className="border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
        >
          <Wifi className="mr-1 size-3" />
          Tempo real ativo
        </Badge>
      );
    }

    if (connectionState === "connecting") {
      return (
        <Badge
          variant="outline"
          className="border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300"
        >
          <CircleDotDashed className="mr-1 size-3 animate-spin" />
          Conectando…
        </Badge>
      );
    }

    return (
      <Badge
        variant="outline"
        className="border-muted-foreground/30 bg-muted/40 text-muted-foreground"
      >
        <WifiOff className="mr-1 size-3" />
        Tempo real indisponivel
      </Badge>
    );
  }, [connectionState]);

  useEffect(() => {
    void (async () => {
      try {
        setLoadingMessages(true);
        const response = await fetch(
          `/api/conversations/${conversationId}/messages`,
          {
            cache: "no-store",
          },
        );
        const payload = (await response.json()) as MessagesApiResponse & {
          error?: string;
        };

        if (!response.ok) {
          throw new Error(
            payload.error ?? "Nao foi possivel carregar mensagens.",
          );
        }

        setMessages(payload.messages ?? []);
      } catch (error) {
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Falha ao carregar mensagens.",
        );
      } finally {
        setLoadingMessages(false);
      }
    })();
  }, [conversationId]);

  useEffect(() => {
    let isMounted = true;

    async function loadEvents() {
      try {
        const response = await fetch(
          `/api/conversations/${conversationId}/events`,
          {
            cache: "no-store",
          },
        );

        if (!response.ok) {
          return;
        }

        const payload = (await response.json()) as EventsApiResponse;

        if (!isMounted) {
          return;
        }

        setEvents(payload.events ?? []);
        setStatus(payload.conversation.status);
        setAssignedAgentName(payload.conversation.assignedAgentName ?? null);
      } catch {
        // Keep UI responsive if events endpoint fails temporarily
      }
    }

    void loadEvents();

    const interval = setInterval(() => {
      void loadEvents();
    }, 8000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [conversationId]);

  useEffect(() => {
    if (!chatwootWebSocketUrl || !chatwootPubsubToken) {
      setConnectionState("offline");
      return;
    }

    const socket = new WebSocket(chatwootWebSocketUrl);

    socket.onopen = () => {
      setConnectionState("connected");
      socket.send(
        JSON.stringify({
          command: "subscribe",
          identifier: JSON.stringify({
            channel: "RoomChannel",
            pubsub_token: chatwootPubsubToken,
          }),
        }),
      );
    };

    socket.onerror = () => {
      setConnectionState("offline");
    };

    socket.onclose = () => {
      setConnectionState("offline");
    };

    socket.onmessage = (message) => {
      try {
        const payload = JSON.parse(message.data) as {
          type?: string;
          message?: {
            event?: string;
            data?: Record<string, unknown>;
          };
        };

        if (
          payload.type === "welcome" ||
          payload.type === "ping" ||
          payload.type === "confirm_subscription"
        ) {
          return;
        }

        if (!payload.message?.event || !payload.message.data) {
          return;
        }

        const { event, data } = payload.message;

        if (event === "message.created") {
          const normalized = normalizeWsMessage(data);
          if (normalized.content) {
            setMessages((current) => appendUniqueMessage(current, normalized));
          }
        }

        if (
          event === "conversation.updated" ||
          event === "conversation.status_changed" ||
          event === "assignee.changed"
        ) {
          if (typeof data.status === "string") {
            const mappedStatus = data.status.toUpperCase() as TicketStatus;
            setStatus(mappedStatus);
          }

          const { hasAssignee, assignedAgentName } = resolveWsAssignee(data);
          if (hasAssignee) {
            setAssignedAgentName(assignedAgentName);
          }
        }

        void fetch(`/api/conversations/${conversationId}/sync`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            event,
            data,
          }),
        });
      } catch {
        // Ignore malformed websocket payloads
      }
    };

    return () => {
      socket.close();
    };
  }, [chatwootPubsubToken, chatwootWebSocketUrl, conversationId]);

  useEffect(() => {
    if (!scrollRef.current) {
      return;
    }

    if (messageCount === 0) {
      return;
    }

    scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messageCount]);

  async function sendCurrentMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const content = draft.trim();
    if (!content) {
      return;
    }

    setErrorMessage(null);
    const optimisticMessage: ChatMessage = {
      id: `temp-${Date.now()}`,
      content,
      messageType: TicketMessageType.INCOMING,
      senderName: "Voce",
      senderType: "contact",
      createdAt: new Date().toISOString(),
      isFromAgent: false,
    };

    setMessages((current) => appendUniqueMessage(current, optimisticMessage));
    setDraft("");

    try {
      setSending(true);
      const response = await fetch(
        `/api/conversations/${conversationId}/messages`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ content }),
        },
      );

      const payload = (await response.json()) as {
        error?: string;
        message?: ChatMessage;
      };
      const confirmedMessage = payload.message;

      if (!response.ok || !confirmedMessage) {
        throw new Error(payload.error ?? "Nao foi possivel enviar a mensagem.");
      }

      setMessages((current) => {
        const withoutOptimistic = current.filter(
          (item) => String(item.id) !== String(optimisticMessage.id),
        );
        return appendUniqueMessage(withoutOptimistic, confirmedMessage);
      });
    } catch (error) {
      setMessages((current) =>
        current.filter(
          (item) => String(item.id) !== String(optimisticMessage.id),
        ),
      );
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Erro inesperado ao enviar mensagem.",
      );
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
      <Card>
        <CardHeader className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <CardTitle>{conversationTitle}</CardTitle>
              <CardDescription>
                {assignedAgentName
                  ? `Agente responsavel: ${assignedAgentName}`
                  : "Aguardando atribuicao de agente"}
              </CardDescription>
            </div>

            <div className="flex items-center gap-2">
              <StatusBadge status={status} />
              {connectionIndicator}
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {errorMessage ? (
            <output
              className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive"
              aria-live="polite"
            >
              <div className="flex items-center gap-2">
                <AlertCircle className="size-4" />
                <span>{errorMessage}</span>
              </div>
            </output>
          ) : null}

          <ScrollArea className="h-[54vh] rounded-md border p-4">
            <div ref={scrollRef} className="space-y-3">
              {loadingMessages ? (
                <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
                  <Loader2 className="mr-2 size-4 animate-spin" />
                  Carregando mensagens…
                </div>
              ) : null}

              {!loadingMessages && messages.length === 0 ? (
                <p className="py-12 text-center text-sm text-muted-foreground">
                  Nenhuma mensagem ainda. Envie sua primeira mensagem abaixo.
                </p>
              ) : null}

              {messages.map((message) => (
                <div
                  key={String(message.id)}
                  className={`flex ${
                    message.isFromAgent ? "justify-start" : "justify-end"
                  }`}
                >
                  <div
                    className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm shadow-sm ${
                      message.isFromAgent
                        ? "bg-secondary text-secondary-foreground"
                        : "bg-primary text-primary-foreground"
                    }`}
                  >
                    {message.senderName ? (
                      <p className="mb-1 text-xs opacity-80">
                        {message.senderName}
                      </p>
                    ) : null}
                    <p className="whitespace-pre-wrap break-words">
                      {message.content}
                    </p>
                    <p className="mt-2 text-[11px] opacity-75">
                      {timeFormatter.format(new Date(message.createdAt))}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>

          <form
            className="flex items-center gap-2"
            onSubmit={sendCurrentMessage}
          >
            <Input
              name="message"
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder="Digite sua mensagem…"
              disabled={sending}
              autoComplete="off"
              className="h-8 text-sm"
            />
            <Button
              type="submit"
              size="default"
              disabled={sending || !draft.trim()}
              aria-label="Enviar mensagem"
            >
              {sending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <SendHorizonal className="size-4" />
              )}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Eventos</CardTitle>
          <CardDescription>
            Atualizacoes via webhook do Chatwoot
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          {events.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nenhum evento processado ainda.
            </p>
          ) : null}

          {events.map((event, index) => (
            <div key={event.id} className="space-y-3">
              <div>
                <p className="text-sm font-medium">{event.title}</p>
                {event.description ? (
                  <p className="text-xs text-muted-foreground">
                    {event.description}
                  </p>
                ) : null}
                <p className="mt-1 text-[11px] text-muted-foreground">
                  {timeFormatter.format(new Date(event.occurredAt))}
                </p>
              </div>
              {index < events.length - 1 ? <Separator /> : null}
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

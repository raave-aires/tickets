"use client";

import {
  AlertCircle,
  CircleDotDashed,
  FileText,
  Loader2,
  Paperclip,
  SendHorizonal,
  Wifi,
  WifiOff,
  X,
} from "lucide-react";
import {
  type FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
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
} from "@/prisma/client/client";

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
  attachments: ChatAttachment[];
};

type ChatAttachment = {
  id: string | number;
  fileType: string | null;
  fileSize: number | null;
  extension: string | null;
  url: string | null;
  thumbUrl: string | null;
  title: string | null;
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

function extractFilenameFromUrl(url: string | null | undefined) {
  if (!url) {
    return null;
  }

  try {
    const parsed = new URL(url);
    const pathname = parsed.pathname.split("/").filter(Boolean);
    const lastSegment = pathname[pathname.length - 1];
    return lastSegment ? decodeURIComponent(lastSegment) : null;
  } catch {
    const withoutQuery = url.split("?")[0] ?? "";
    const pathname = withoutQuery.split("/").filter(Boolean);
    return pathname[pathname.length - 1] ?? null;
  }
}

function extractExtensionFromFilename(filename: string | null | undefined) {
  if (!filename) {
    return null;
  }

  const parts = filename.split(".");
  if (parts.length < 2) {
    return null;
  }

  const extension = parts.pop();
  return extension ? extension.toLowerCase() : null;
}

function normalizeAttachment(data: Record<string, unknown>): ChatAttachment {
  const id =
    typeof data.id === "number" || typeof data.id === "string"
      ? data.id
      : `att-${Math.random()}`;
  const url = typeof data.url === "string" ? data.url : null;
  const thumbUrl = typeof data.thumbUrl === "string" ? data.thumbUrl : null;
  const title =
    (typeof data.title === "string" ? data.title : null) ??
    extractFilenameFromUrl(url ?? thumbUrl);
  const extension =
    (typeof data.extension === "string" ? data.extension : null) ??
    extractExtensionFromFilename(title);

  return {
    id,
    fileType: typeof data.fileType === "string" ? data.fileType : null,
    fileSize: typeof data.fileSize === "number" ? data.fileSize : null,
    extension,
    url,
    thumbUrl,
    title,
  };
}

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
  const attachmentsRaw = Array.isArray(data.attachments)
    ? data.attachments
    : [];
  const attachments = attachmentsRaw
    .filter(
      (item): item is Record<string, unknown> =>
        typeof item === "object" && item !== null,
    )
    .map((item) =>
      normalizeAttachment({
        id: item.id,
        fileType: item.file_type,
        fileSize: item.file_size,
        extension: item.extension,
        url: item.data_url,
        thumbUrl: item.thumb_url,
        title: item.fallback_title,
      }),
    );

  return {
    id,
    content: typeof data.content === "string" ? data.content : "",
    messageType,
    senderName: typeof sender.name === "string" ? sender.name : null,
    senderType,
    createdAt,
    isFromAgent:
      messageType === TicketMessageType.OUTGOING || senderType === "user",
    attachments,
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

function isAgentNotificationMessage(message: ChatMessage) {
  if (!message.isFromAgent) {
    return false;
  }

  if (message.messageType === TicketMessageType.ACTIVITY) {
    return false;
  }

  return Boolean(message.content || message.attachments.length > 0);
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
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [sending, setSending] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [connectionState, setConnectionState] = useState<ConnectionState>(
    chatwootWebSocketUrl ? "connecting" : "offline",
  );

  const scrollRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const seenMessageIdsRef = useRef<Set<string>>(new Set());
  const messagesBootstrappedRef = useRef(false);
  const audioContextRef = useRef<AudioContext | null>(null);
  const messageCount = messages.length;

  const playIncomingSound = useCallback(() => {
    if (typeof window === "undefined") {
      return;
    }

    const browserWindow = window as Window & {
      webkitAudioContext?: typeof AudioContext;
    };
    const AudioContextCtor =
      globalThis.AudioContext ?? browserWindow.webkitAudioContext;

    if (!AudioContextCtor) {
      return;
    }

    if (!audioContextRef.current) {
      audioContextRef.current = new AudioContextCtor();
    }

    const context = audioContextRef.current;

    if (context.state === "suspended") {
      void context.resume();
    }

    const now = context.currentTime;
    const oscillator = context.createOscillator();
    const gain = context.createGain();

    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(880, now);
    oscillator.frequency.exponentialRampToValueAtTime(660, now + 0.18);

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.08, now + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.22);

    oscillator.connect(gain);
    gain.connect(context.destination);

    oscillator.start(now);
    oscillator.stop(now + 0.22);
    oscillator.onended = () => {
      oscillator.disconnect();
      gain.disconnect();
    };
  }, []);

  const showIncomingNotification = useCallback(
    (message: ChatMessage) => {
      if (typeof window === "undefined" || !("Notification" in window)) {
        return;
      }

      const sender = message.senderName ?? "Agente";
      const content = message.content.trim();
      const title = `Nova mensagem em ${conversationTitle}`;
      const body = content
        ? `${sender}: ${content}`
        : message.attachments.length === 1
          ? `${sender} enviou ${message.attachments[0]?.title ?? "um arquivo"}`
          : `${sender} enviou ${message.attachments.length} arquivos`;

      if (Notification.permission === "granted") {
        const notification = new Notification(title, {
          body,
          tag: `tickets:${conversationId}`,
        });

        notification.onclick = () => {
          window.focus();
        };

        setTimeout(() => notification.close(), 9000);
        return;
      }

      if (Notification.permission === "default") {
        void Notification.requestPermission();
      }
    },
    [conversationId, conversationTitle],
  );

  useEffect(() => {
    void conversationId;
    seenMessageIdsRef.current = new Set();
    messagesBootstrappedRef.current = false;
  }, [conversationId]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    function bootstrapRealtimeAlerts() {
      if ("Notification" in window && Notification.permission === "default") {
        void Notification.requestPermission();
      }

      if (audioContextRef.current?.state === "suspended") {
        void audioContextRef.current.resume();
      }
    }

    window.addEventListener("pointerdown", bootstrapRealtimeAlerts, {
      once: true,
    });
    window.addEventListener("keydown", bootstrapRealtimeAlerts, { once: true });

    return () => {
      window.removeEventListener("pointerdown", bootstrapRealtimeAlerts);
      window.removeEventListener("keydown", bootstrapRealtimeAlerts);
    };
  }, []);

  useEffect(() => {
    const seen = seenMessageIdsRef.current;

    if (!messagesBootstrappedRef.current) {
      for (const message of messages) {
        seen.add(String(message.id));
      }
      messagesBootstrappedRef.current = true;
      return;
    }

    const newMessages = messages.filter(
      (message) => !seen.has(String(message.id)),
    );

    if (newMessages.length === 0) {
      return;
    }

    for (const message of newMessages) {
      seen.add(String(message.id));
    }

    const notifiableMessages = newMessages.filter(isAgentNotificationMessage);
    if (notifiableMessages.length === 0) {
      return;
    }

    const latestMessage = notifiableMessages[notifiableMessages.length - 1];
    if (!latestMessage) {
      return;
    }

    playIncomingSound();
    showIncomingNotification(latestMessage);
  }, [messages, playIncomingSound, showIncomingNotification]);

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
          if (normalized.content || normalized.attachments.length > 0) {
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
    if (!content && selectedFiles.length === 0) {
      return;
    }

    setErrorMessage(null);
    const canUseOptimisticMessage = selectedFiles.length === 0;
    const optimisticMessage: ChatMessage | null = canUseOptimisticMessage
      ? {
          id: `temp-${Date.now()}`,
          content,
          messageType: TicketMessageType.INCOMING,
          senderName: "Voce",
          senderType: "contact",
          createdAt: new Date().toISOString(),
          isFromAgent: false,
          attachments: [],
        }
      : null;

    if (optimisticMessage) {
      setMessages((current) => appendUniqueMessage(current, optimisticMessage));
    }

    setDraft("");

    try {
      setSending(true);
      const hasAttachments = selectedFiles.length > 0;
      const body = hasAttachments
        ? (() => {
            const formData = new FormData();
            if (content) {
              formData.append("content", content);
            }

            for (const file of selectedFiles) {
              formData.append("attachments[]", file);
            }

            return formData;
          })()
        : JSON.stringify({ content });

      const response = await fetch(
        `/api/conversations/${conversationId}/messages`,
        {
          method: "POST",
          ...(hasAttachments
            ? {}
            : {
                headers: {
                  "Content-Type": "application/json",
                },
              }),
          body,
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

      if (optimisticMessage) {
        setMessages((current) => {
          const withoutOptimistic = current.filter(
            (item) => String(item.id) !== String(optimisticMessage.id),
          );
          return appendUniqueMessage(withoutOptimistic, confirmedMessage);
        });
      } else {
        setMessages((current) =>
          appendUniqueMessage(current, confirmedMessage),
        );
      }

      setSelectedFiles([]);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    } catch (error) {
      if (optimisticMessage) {
        setMessages((current) =>
          current.filter(
            (item) => String(item.id) !== String(optimisticMessage.id),
          ),
        );
      }

      setDraft(content);
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Erro inesperado ao enviar mensagem.",
      );
    } finally {
      setSending(false);
    }
  }

  function handleSelectFiles(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) {
      return;
    }

    const allowedFiles = Array.from(fileList).filter((file) => {
      return file.type.startsWith("image/") || file.type === "application/pdf";
    });

    if (allowedFiles.length !== fileList.length) {
      setErrorMessage(
        "Alguns arquivos foram ignorados. Envie apenas imagens ou PDF.",
      );
    } else {
      setErrorMessage(null);
    }

    setSelectedFiles((current) => {
      const merged = [...current, ...allowedFiles];
      return merged.slice(0, 5);
    });
  }

  function removeSelectedFile(index: number) {
    setSelectedFiles((current) => current.filter((_, i) => i !== index));
  }

  function triggerFilePicker() {
    fileInputRef.current?.click();
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
                    {message.content ? (
                      <p className="whitespace-pre-wrap wrap-break-word">
                        {message.content}
                      </p>
                    ) : null}

                    {message.attachments.length > 0 ? (
                      <div className="mt-2 space-y-2">
                        {message.attachments.map((attachment) => {
                          const fileUrl = attachment.url ?? attachment.thumbUrl;
                          const isImage =
                            attachment.fileType === "image" ||
                            attachment.fileType?.startsWith("image/") ||
                            [
                              "png",
                              "jpg",
                              "jpeg",
                              "gif",
                              "webp",
                              "bmp",
                              "svg",
                              "avif",
                              "heic",
                              "heif",
                            ].includes(
                              attachment.extension?.toLowerCase() ?? "",
                            );
                          const attachmentLabel =
                            attachment.title ??
                            (attachment.extension
                              ? `arquivo.${attachment.extension}`
                              : "Arquivo");

                          if (isImage && fileUrl) {
                            return (
                              <a
                                key={String(attachment.id)}
                                href={fileUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="block overflow-hidden rounded-md border border-white/20"
                              >
                                <img
                                  src={fileUrl}
                                  alt={attachmentLabel}
                                  className="max-h-64 w-full object-cover"
                                />
                              </a>
                            );
                          }

                          return (
                            <a
                              key={String(attachment.id)}
                              href={fileUrl ?? "#"}
                              target="_blank"
                              rel="noreferrer"
                              className="flex items-center gap-2 rounded-md border border-white/20 px-2 py-1 text-xs"
                            >
                              <FileText className="size-3.5" />
                              <span className="truncate">
                                {attachmentLabel}
                              </span>
                            </a>
                          );
                        })}
                      </div>
                    ) : null}
                    <p className="mt-2 text-[11px] opacity-75">
                      {timeFormatter.format(new Date(message.createdAt))}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>

          {selectedFiles.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {selectedFiles.map((file, index) => (
                <div
                  key={`${file.name}-${file.size}-${index}`}
                  className="inline-flex items-center gap-2 rounded-md border px-2 py-1 text-xs"
                >
                  <FileText className="size-3.5" />
                  <span className="max-w-40 truncate">{file.name}</span>
                  <button
                    type="button"
                    className="rounded p-0.5 hover:bg-muted"
                    onClick={() => removeSelectedFile(index)}
                    aria-label={`Remover ${file.name}`}
                  >
                    <X className="size-3" />
                  </button>
                </div>
              ))}
            </div>
          ) : null}

          <form
            className="flex items-center gap-2"
            onSubmit={sendCurrentMessage}
          >
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              accept="image/*,application/pdf"
              multiple
              onChange={(event) => {
                handleSelectFiles(event.target.files);
                event.currentTarget.value = "";
              }}
            />
            <Button
              type="button"
              size="icon-sm"
              variant="outline"
              onClick={triggerFilePicker}
              disabled={sending || selectedFiles.length >= 5}
              aria-label="Anexar arquivo"
            >
              <Paperclip className="size-4" />
            </Button>
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
              disabled={
                sending || (!draft.trim() && selectedFiles.length === 0)
              }
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

import { TicketMessageType } from "@/generated/prisma";
import {
  mapChatwootMessageType,
  parseChatwootTimestamp,
  toMessageViewModel,
} from "@/lib/tickets";

type ChatwootContactResponse = {
  source_id?: string;
  identifier?: string;
  pubsub_token?: string;
  contact?: {
    identifier?: string;
  };
};

type ChatwootMessage = {
  id?: number | string;
  content?: string;
  message_type?: number | string;
  sender?: {
    id?: number | string;
    name?: string;
    type?: string;
  };
  created_at?: number | string;
  echo_id?: string;
};

export type ChatwootConversationSummary = {
  id: number;
  status?: string;
  messages?: ChatwootMessage[];
};

function getChatwootConfig() {
  const rawBaseUrl = process.env.CHATWOOT_BASE_URL?.trim();
  const normalizedBaseUrl = rawBaseUrl
    ? rawBaseUrl.startsWith("http://") || rawBaseUrl.startsWith("https://")
      ? rawBaseUrl
      : `https://${rawBaseUrl}`
    : undefined;
  const baseUrl = normalizedBaseUrl?.replace(/\/$/, "");
  const inboxIdentifier = process.env.CHATWOOT_INBOX_IDENTIFIER;

  if (!baseUrl || !inboxIdentifier) {
    throw new Error(
      "CHATWOOT_BASE_URL e CHATWOOT_INBOX_IDENTIFIER precisam estar configurados.",
    );
  }

  return { baseUrl, inboxIdentifier };
}

async function chatwootRequest<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const { baseUrl } = getChatwootConfig();
  const url = `${baseUrl}${path}`;

  const response = await fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Chatwoot request failed (${response.status}): ${text}`);
  }

  return (await response.json()) as T;
}

function resolveContactIdentifier(
  payload: ChatwootContactResponse,
  fallbackIdentifier: string,
) {
  return (
    payload.source_id ??
    payload.identifier ??
    payload.contact?.identifier ??
    fallbackIdentifier
  );
}

export function getChatwootWebSocketUrl() {
  const { baseUrl } = getChatwootConfig();
  const cableUrl = new URL("/cable", baseUrl);
  cableUrl.protocol = cableUrl.protocol === "https:" ? "wss:" : "ws:";
  return cableUrl.toString();
}

export function getChatwootInboxIdentifier() {
  return getChatwootConfig().inboxIdentifier;
}

export async function getOrCreateContact(params: {
  identifier: string;
  name: string;
  email: string;
  customAttributes?: Record<string, unknown>;
}) {
  const { inboxIdentifier } = getChatwootConfig();

  const encodedIdentifier = encodeURIComponent(params.identifier);
  const contactPath = `/public/api/v1/inboxes/${inboxIdentifier}/contacts/${encodedIdentifier}`;

  try {
    const existing = await chatwootRequest<ChatwootContactResponse>(
      contactPath,
      {
        method: "GET",
      },
    );

    const resolvedIdentifier = resolveContactIdentifier(
      existing,
      params.identifier,
    );

    return {
      identifier: resolvedIdentifier,
      sourceId: existing.source_id ?? resolvedIdentifier,
      pubsubToken: existing.pubsub_token ?? "",
    };
  } catch {
    const created = await chatwootRequest<ChatwootContactResponse>(
      `/public/api/v1/inboxes/${inboxIdentifier}/contacts`,
      {
        method: "POST",
        body: JSON.stringify({
          identifier: params.identifier,
          name: params.name,
          email: params.email,
          custom_attributes: params.customAttributes ?? {},
        }),
      },
    );

    const resolvedIdentifier = resolveContactIdentifier(
      created,
      params.identifier,
    );

    return {
      identifier: resolvedIdentifier,
      sourceId: created.source_id ?? resolvedIdentifier,
      pubsubToken: created.pubsub_token ?? "",
    };
  }
}

export async function createConversation(params: {
  contactIdentifier: string;
  customAttributes?: Record<string, unknown>;
}) {
  const { inboxIdentifier } = getChatwootConfig();

  return chatwootRequest<ChatwootConversationSummary>(
    `/public/api/v1/inboxes/${inboxIdentifier}/contacts/${encodeURIComponent(
      params.contactIdentifier,
    )}/conversations`,
    {
      method: "POST",
      body: JSON.stringify({
        custom_attributes: params.customAttributes ?? {},
      }),
    },
  );
}

export async function sendMessage(params: {
  contactIdentifier: string;
  conversationId: number;
  content: string;
  echoId?: string;
}) {
  const { inboxIdentifier } = getChatwootConfig();

  return chatwootRequest<ChatwootMessage>(
    `/public/api/v1/inboxes/${inboxIdentifier}/contacts/${encodeURIComponent(
      params.contactIdentifier,
    )}/conversations/${params.conversationId}/messages`,
    {
      method: "POST",
      body: JSON.stringify({
        content: params.content,
        echo_id: params.echoId,
      }),
    },
  );
}

export async function listMessages(params: {
  contactIdentifier: string;
  conversationId: number;
}) {
  const { inboxIdentifier } = getChatwootConfig();

  const payload = await chatwootRequest<
    | ChatwootMessage[]
    | { payload?: ChatwootMessage[]; messages?: ChatwootMessage[] }
  >(
    `/public/api/v1/inboxes/${inboxIdentifier}/contacts/${encodeURIComponent(
      params.contactIdentifier,
    )}/conversations/${params.conversationId}/messages`,
    {
      method: "GET",
    },
  );

  if (Array.isArray(payload)) {
    return payload;
  }

  if (Array.isArray(payload.payload)) {
    return payload.payload;
  }

  if (Array.isArray(payload.messages)) {
    return payload.messages;
  }

  return [];
}

export function toClientMessage(message: ChatwootMessage) {
  const data = toMessageViewModel(message);

  return {
    id: data.id ?? `temp-${crypto.randomUUID()}`,
    content: data.content,
    messageType: mapChatwootMessageType(message.message_type),
    senderName: data.senderName,
    senderType: data.senderType,
    createdAt: data.externalCreatedAt.toISOString(),
    isFromAgent:
      mapChatwootMessageType(message.message_type) ===
        TicketMessageType.OUTGOING || data.senderType?.toLowerCase() === "user",
    rawMessageType: message.message_type,
    parsedDate:
      parseChatwootTimestamp(message.created_at)?.toISOString() ?? null,
  };
}

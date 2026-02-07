import {
  type Prisma,
  type TicketConversation,
  TicketMessageType,
  TicketStatus,
} from "@/generated/prisma";
import { db } from "@/lib/db";

type UnknownRecord = Record<string, unknown>;

type ChatwootSender = {
  id?: number | string;
  name?: string;
  type?: string;
};

type ChatwootMessagePayload = {
  id?: number | string;
  content?: string;
  message_type?: number | string;
  sender?: ChatwootSender;
  created_at?: number | string;
  echo_id?: string;
};

function asRecord(value: unknown): UnknownRecord {
  if (!value || typeof value !== "object") {
    return {};
  }

  return value as UnknownRecord;
}

export function parseChatwootConversationId(payload: unknown): number | null {
  const raw =
    asRecord(payload).id ??
    asRecord(asRecord(payload).conversation).id ??
    asRecord(payload).conversation_id;

  if (typeof raw === "number") {
    return raw;
  }

  if (typeof raw === "string" && Number.isFinite(Number(raw))) {
    return Number(raw);
  }

  return null;
}

export function parseChatwootTimestamp(value: unknown): Date | null {
  if (typeof value === "number") {
    return new Date(value * 1000);
  }

  if (typeof value === "string" && value.length > 0) {
    const parsed = Date.parse(value);
    if (!Number.isNaN(parsed)) {
      return new Date(parsed);
    }

    if (Number.isFinite(Number(value))) {
      return new Date(Number(value) * 1000);
    }
  }

  return null;
}

export function mapChatwootStatus(status: unknown): TicketStatus | null {
  if (typeof status !== "string") {
    return null;
  }

  const normalized = status.toLowerCase();

  if (normalized === "open") {
    return TicketStatus.OPEN;
  }

  if (normalized === "pending") {
    return TicketStatus.PENDING;
  }

  if (normalized === "resolved") {
    return TicketStatus.RESOLVED;
  }

  if (normalized === "snoozed") {
    return TicketStatus.SNOOZED;
  }

  return null;
}

export function mapChatwootMessageType(type: unknown): TicketMessageType {
  if (type === "incoming" || type === 0) {
    return TicketMessageType.INCOMING;
  }

  if (type === "outgoing" || type === 1) {
    return TicketMessageType.OUTGOING;
  }

  if (type === "activity" || type === 2) {
    return TicketMessageType.ACTIVITY;
  }

  return TicketMessageType.SYSTEM;
}

export function toMessageViewModel(
  message: ChatwootMessagePayload,
  fallbackCreatedAt?: Date,
) {
  const messageId =
    typeof message.id === "number"
      ? message.id
      : typeof message.id === "string" && Number.isFinite(Number(message.id))
        ? Number(message.id)
        : null;

  const messageType = mapChatwootMessageType(message.message_type);
  const createdAt =
    parseChatwootTimestamp(message.created_at) ??
    fallbackCreatedAt ??
    new Date();

  return {
    id: messageId,
    content: typeof message.content === "string" ? message.content : "",
    messageType,
    senderName: message.sender?.name ?? null,
    senderType: message.sender?.type ?? null,
    echoId: typeof message.echo_id === "string" ? message.echo_id : null,
    externalCreatedAt: createdAt,
  };
}

export async function persistChatwootMessage(
  conversationId: string,
  payload: unknown,
) {
  const message = payload as ChatwootMessagePayload;
  const normalized = toMessageViewModel(message);

  if (!normalized.content) {
    return null;
  }

  if (normalized.id) {
    return db.ticketMessage.upsert({
      where: {
        conversationId_chatwootMessageId: {
          conversationId,
          chatwootMessageId: normalized.id,
        },
      },
      update: {
        content: normalized.content,
        messageType: normalized.messageType,
        senderName: normalized.senderName,
        senderType: normalized.senderType,
        echoId: normalized.echoId,
        externalCreatedAt: normalized.externalCreatedAt,
        payload: payload as Prisma.InputJsonValue,
      },
      create: {
        conversationId,
        chatwootMessageId: normalized.id,
        content: normalized.content,
        messageType: normalized.messageType,
        senderName: normalized.senderName,
        senderType: normalized.senderType,
        echoId: normalized.echoId,
        externalCreatedAt: normalized.externalCreatedAt,
        payload: payload as Prisma.InputJsonValue,
      },
    });
  }

  return db.ticketMessage.create({
    data: {
      conversationId,
      content: normalized.content,
      messageType: normalized.messageType,
      senderName: normalized.senderName,
      senderType: normalized.senderType,
      echoId: normalized.echoId,
      externalCreatedAt: normalized.externalCreatedAt,
      payload: payload as Prisma.InputJsonValue,
    },
  });
}

function buildStatusEventText(status: TicketStatus) {
  if (status === TicketStatus.RESOLVED) {
    return "Conversa resolvida no Chatwoot";
  }

  if (status === TicketStatus.PENDING) {
    return "Conversa marcada como pendente";
  }

  if (status === TicketStatus.SNOOZED) {
    return "Conversa pausada (snoozed)";
  }

  return "Conversa reaberta";
}

export async function applyConversationStatusFromWebhook(
  conversation: TicketConversation,
  status: TicketStatus,
  payload: unknown,
) {
  const previousStatus = conversation.status;
  const changed = previousStatus !== status;

  const assignee =
    asRecord(asRecord(payload).meta).assignee ??
    asRecord(asRecord(asRecord(payload).conversation).meta).assignee;
  const assigneeRecord = asRecord(assignee);

  const assignedIdRaw = assigneeRecord.id;
  const assignedAgentId =
    typeof assignedIdRaw === "number"
      ? assignedIdRaw
      : typeof assignedIdRaw === "string" &&
          Number.isFinite(Number(assignedIdRaw))
        ? Number(assignedIdRaw)
        : null;
  const assignedAgentName =
    typeof assigneeRecord.name === "string" ? assigneeRecord.name : null;

  const now = new Date();

  await db.ticketConversation.update({
    where: { id: conversation.id },
    data: {
      status,
      assignedAgentId,
      assignedAgentName,
      assignedAt: assignedAgentName ? now : conversation.assignedAt,
      resolvedAt:
        status === TicketStatus.RESOLVED ? now : conversation.resolvedAt,
      reopenedAt:
        status === TicketStatus.OPEN && previousStatus === TicketStatus.RESOLVED
          ? now
          : conversation.reopenedAt,
      metadata: payload as Prisma.InputJsonValue,
    },
  });

  if (changed) {
    await db.ticketEvent.create({
      data: {
        conversationId: conversation.id,
        event: "conversation.status_changed",
        title: buildStatusEventText(status),
        description:
          assignedAgentName && status === TicketStatus.OPEN
            ? `Atribuida para ${assignedAgentName}`
            : null,
        payload: payload as Prisma.InputJsonValue,
      },
    });
  }
}

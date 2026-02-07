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
  attachments?: unknown[];
};

function asRecord(value: unknown): UnknownRecord {
  if (!value || typeof value !== "object") {
    return {};
  }

  return value as UnknownRecord;
}

function parseNumericId(value: unknown): number | null {
  if (typeof value === "number") {
    return value;
  }

  if (typeof value === "string" && Number.isFinite(Number(value))) {
    return Number(value);
  }

  return null;
}

function parseOptionalString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

export function parseChatwootConversationId(payload: unknown): number | null {
  const raw =
    asRecord(payload).id ??
    asRecord(asRecord(payload).conversation).id ??
    asRecord(payload).conversation_id;

  return parseNumericId(raw);
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
  const hasAttachments = Array.isArray(message.attachments)
    ? message.attachments.length > 0
    : false;

  if (!normalized.content && !hasAttachments) {
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

function resolveAssignee(payload: unknown) {
  const root = asRecord(payload);
  const conversation = asRecord(root.conversation);
  const meta = asRecord(root.meta);
  const conversationMeta = asRecord(conversation.meta);

  const assigneeRecord = asRecord(
    meta.assignee ??
      conversationMeta.assignee ??
      root.assignee ??
      conversation.assignee,
  );

  const assignedAgentId =
    parseNumericId(
      assigneeRecord.id ?? root.assignee_id ?? conversation.assignee_id,
    ) ?? null;

  const assignedAgentName =
    parseOptionalString(
      assigneeRecord.name ?? root.assignee_name ?? conversation.assignee_name,
    ) ?? null;

  return { assignedAgentId, assignedAgentName };
}

function resolveEventTimestamp(payload: unknown) {
  const root = asRecord(payload);
  const conversation = asRecord(root.conversation);

  return (
    parseChatwootTimestamp(root.timestamp) ??
    parseChatwootTimestamp(root.updated_at) ??
    parseChatwootTimestamp(conversation.updated_at) ??
    parseChatwootTimestamp(root.created_at) ??
    new Date()
  );
}

async function createTicketEventIfMissing(params: {
  conversationId: string;
  event: string;
  title: string;
  description: string | null;
  payload: unknown;
  occurredAt: Date;
}) {
  const duplicate = await db.ticketEvent.findFirst({
    where: {
      conversationId: params.conversationId,
      event: params.event,
      title: params.title,
      occurredAt: params.occurredAt,
    },
    select: { id: true },
  });

  if (duplicate) {
    return;
  }

  await db.ticketEvent.create({
    data: {
      conversationId: params.conversationId,
      event: params.event,
      title: params.title,
      description: params.description,
      occurredAt: params.occurredAt,
      payload: params.payload as Prisma.InputJsonValue,
    },
  });
}

function buildAssigneeEventText(params: {
  previousAssignedAgentName: string | null;
  previousAssignedAgentId: number | null;
  assignedAgentName: string | null;
  assignedAgentId: number | null;
}) {
  if (params.assignedAgentName) {
    if (params.previousAssignedAgentId || params.previousAssignedAgentName) {
      return `Atendimento transferido para ${params.assignedAgentName}`;
    }

    return `Conversa atribuida para ${params.assignedAgentName}`;
  }

  if (params.assignedAgentId !== null) {
    if (params.previousAssignedAgentId || params.previousAssignedAgentName) {
      return `Atendimento transferido para agente #${params.assignedAgentId}`;
    }

    return `Conversa atribuida para agente #${params.assignedAgentId}`;
  }

  return "Conversa sem agente atribuido";
}

export async function applyConversationStatusFromWebhook(
  conversation: TicketConversation,
  status: TicketStatus,
  payload: unknown,
) {
  const currentConversation = await db.ticketConversation.findUnique({
    where: { id: conversation.id },
  });

  if (!currentConversation) {
    return;
  }

  const previousStatus = currentConversation.status;
  const statusChanged = previousStatus !== status;
  const { assignedAgentId, assignedAgentName } = resolveAssignee(payload);
  const assigneeChanged =
    currentConversation.assignedAgentId !== assignedAgentId ||
    currentConversation.assignedAgentName !== assignedAgentName;

  const now = new Date();
  const occurredAt = resolveEventTimestamp(payload);

  await db.ticketConversation.update({
    where: { id: currentConversation.id },
    data: {
      status,
      assignedAgentId,
      assignedAgentName,
      assignedAt:
        assigneeChanged && assignedAgentId !== null
          ? now
          : currentConversation.assignedAt,
      resolvedAt:
        status === TicketStatus.RESOLVED &&
        previousStatus !== TicketStatus.RESOLVED
          ? now
          : currentConversation.resolvedAt,
      reopenedAt:
        status === TicketStatus.OPEN && previousStatus === TicketStatus.RESOLVED
          ? now
          : currentConversation.reopenedAt,
      metadata: payload as Prisma.InputJsonValue,
    },
  });

  if (statusChanged) {
    await createTicketEventIfMissing({
      conversationId: currentConversation.id,
      event: "conversation.status_changed",
      title: buildStatusEventText(status),
      description: null,
      payload,
      occurredAt,
    });
  }

  if (assigneeChanged) {
    await createTicketEventIfMissing({
      conversationId: currentConversation.id,
      event: "conversation.assignee_changed",
      title: buildAssigneeEventText({
        previousAssignedAgentName: currentConversation.assignedAgentName,
        previousAssignedAgentId: currentConversation.assignedAgentId,
        assignedAgentName,
        assignedAgentId,
      }),
      description: null,
      payload,
      occurredAt,
    });
  }
}

import { z } from "zod";

export const conversationCreateSchema = z
  .object({
    title: z
      .string()
      .trim()
      .min(4, "Informe um título com pelo menos 4 caracteres")
      .max(120, "Título muito longo"),
    description: z
      .string()
      .trim()
      .min(6, "Descreva melhor a solicitação")
      .max(4000, "Descrição muito longa"),
    complexity: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]),
    sector: z
      .string()
      .trim()
      .min(2, "Informe o setor")
      .max(80, "Setor muito longo"),
    requestTarget: z.enum(["SELF", "OTHER"]),
    requestForName: z.string().trim().max(120).optional(),
    requestForEmail: z
      .string()
      .trim()
      .max(255)
      .optional()
      .refine(
        (value) => {
          if (!value) {
            return true;
          }

          return z.email().safeParse(value).success;
        },
        { message: "E-mail invalido" },
      ),
  })
  .superRefine((value, ctx) => {
    if (value.requestTarget === "OTHER" && !value.requestForName?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["requestForName"],
        message: "Informe o nome da pessoa solicitante",
      });
    }

    if (value.requestTarget === "OTHER" && !value.requestForEmail?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["requestForEmail"],
        message: "Informe o e-mail da pessoa solicitante",
      });
    }
  });

export const messageSchema = z.object({
  content: z
    .string()
    .trim()
    .min(1, "A mensagem não pode ser vazia")
    .max(4000, "Mensagem muito longa"),
});

export const websocketSyncSchema = z.object({
  event: z.string().min(1),
  data: z.record(z.string(), z.unknown()).optional(),
});

export type ConversationCreateInput = z.infer<typeof conversationCreateSchema>;
export type MessageInput = z.infer<typeof messageSchema>;
export type WebsocketSyncInput = z.infer<typeof websocketSyncSchema>;

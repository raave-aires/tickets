"use client";

import { Loader2, SendHorizonal } from "lucide-react";
import { useRouter } from "next/navigation";
import { type FormEvent, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  type ConversationCreateInput,
  conversationCreateSchema,
} from "@/lib/validators";

const sectors = [
  "Tecnologia",
  "Financeiro",
  "RH",
  "Juridico",
  "Operacoes",
  "Atendimento",
  "Comercial",
  "Outro",
];

const complexityLabels: Record<ConversationCreateInput["complexity"], string> =
  {
    LOW: "Baixa",
    MEDIUM: "Media",
    HIGH: "Alta",
    CRITICAL: "Critica",
  };

export function NewConversationForm() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [formState, setFormState] = useState<ConversationCreateInput>({
    title: "",
    description: "",
    complexity: "MEDIUM",
    sector: "Tecnologia",
    requestTarget: "SELF",
    requestForName: "",
    requestForEmail: "",
  });

  const parsed = useMemo(
    () => conversationCreateSchema.safeParse(formState),
    [formState],
  );

  const fieldErrors = useMemo(() => {
    if (parsed.success) {
      return {} as Record<string, string>;
    }

    const issues = parsed.error.flatten().fieldErrors;
    return Object.fromEntries(
      Object.entries(issues)
        .map(([key, values]) => [key, values?.[0]])
        .filter((entry): entry is [string, string] => Boolean(entry[1])),
    );
  }, [parsed]);

  function updateField<Key extends keyof ConversationCreateInput>(
    field: Key,
    value: ConversationCreateInput[Key],
  ) {
    setFormState((current) => ({
      ...current,
      [field]: value,
    }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);

    const validation = conversationCreateSchema.safeParse(formState);

    if (!validation.success) {
      setErrorMessage("Preencha os campos obrigatorios para abrir a conversa.");
      return;
    }

    try {
      setPending(true);
      const response = await fetch("/api/conversations", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(validation.data),
      });

      const payload = (await response.json()) as {
        error?: string;
        conversation?: { id: string };
      };

      if (!response.ok || !payload.conversation) {
        throw new Error(payload.error ?? "Nao foi possivel abrir a conversa.");
      }

      router.push(`/conversations/${payload.conversation.id}`);
      router.refresh();
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Erro inesperado ao criar a conversa.",
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Abrir nova conversa</CardTitle>
        <CardDescription>
          Informe o contexto completo para o time receber seu ticket ja
          classificado.
        </CardDescription>
      </CardHeader>

      <CardContent>
        <form className="space-y-5" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <Label htmlFor="title">Titulo</Label>
            <Input
              id="title"
              name="title"
              autoComplete="off"
              placeholder="ex.: falha ao processar pagamento…"
              value={formState.title}
              onChange={(event) => updateField("title", event.target.value)}
            />
            {fieldErrors.title ? (
              <p className="text-xs text-destructive">{fieldErrors.title}</p>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Descricao</Label>
            <Textarea
              id="description"
              name="description"
              autoComplete="off"
              placeholder="Descreva o problema, impacto, horario e contexto…"
              rows={6}
              value={formState.description}
              onChange={(event) =>
                updateField("description", event.target.value)
              }
            />
            {fieldErrors.description ? (
              <p className="text-xs text-destructive">
                {fieldErrors.description}
              </p>
            ) : null}
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Complexidade</Label>
              <Select
                value={formState.complexity}
                onValueChange={(value) =>
                  updateField(
                    "complexity",
                    value as ConversationCreateInput["complexity"],
                  )
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {(
                    Object.keys(
                      complexityLabels,
                    ) as ConversationCreateInput["complexity"][]
                  ).map((item) => (
                    <SelectItem key={item} value={item}>
                      {complexityLabels[item]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Setor</Label>
              <Select
                value={formState.sector}
                onValueChange={(value) => updateField("sector", value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o setor" />
                </SelectTrigger>
                <SelectContent>
                  {sectors.map((sector) => (
                    <SelectItem key={sector} value={sector}>
                      {sector}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {fieldErrors.sector ? (
                <p className="text-xs text-destructive">{fieldErrors.sector}</p>
              ) : null}
            </div>
          </div>

          <div className="space-y-3">
            <Label>Solicitacao para</Label>
            <div className="grid grid-cols-2 gap-2">
              <Button
                type="button"
                variant={
                  formState.requestTarget === "SELF" ? "default" : "outline"
                }
                onClick={() =>
                  setFormState((current) => ({
                    ...current,
                    requestTarget: "SELF",
                    requestForName: "",
                    requestForEmail: "",
                  }))
                }
              >
                Para mim
              </Button>
              <Button
                type="button"
                variant={
                  formState.requestTarget === "OTHER" ? "default" : "outline"
                }
                onClick={() => updateField("requestTarget", "OTHER")}
              >
                Para outra pessoa
              </Button>
            </div>
          </div>

          {formState.requestTarget === "OTHER" ? (
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="requestForName">Nome da pessoa</Label>
                <Input
                  id="requestForName"
                  name="requestForName"
                  autoComplete="off"
                  value={formState.requestForName ?? ""}
                  onChange={(event) =>
                    updateField("requestForName", event.target.value)
                  }
                  placeholder="Digite o nome completo…"
                />
                {fieldErrors.requestForName ? (
                  <p className="text-xs text-destructive">
                    {fieldErrors.requestForName}
                  </p>
                ) : null}
              </div>

              <div className="space-y-2">
                <Label htmlFor="requestForEmail">E-mail da pessoa</Label>
                <Input
                  id="requestForEmail"
                  name="requestForEmail"
                  type="email"
                  autoComplete="off"
                  spellCheck={false}
                  value={formState.requestForEmail ?? ""}
                  onChange={(event) =>
                    updateField("requestForEmail", event.target.value)
                  }
                  placeholder="ex.: pessoa@empresa.com…"
                />
                {fieldErrors.requestForEmail ? (
                  <p className="text-xs text-destructive">
                    {fieldErrors.requestForEmail}
                  </p>
                ) : null}
              </div>
            </div>
          ) : null}

          {errorMessage ? (
            <p
              className="text-sm text-destructive"
              role="alert"
              aria-live="polite"
            >
              {errorMessage}
            </p>
          ) : null}

          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? (
              <>
                <Loader2 className="mr-2 size-4 animate-spin" />
                Abrindo conversa…
              </>
            ) : (
              <>
                <SendHorizonal className="mr-2 size-4" />
                Abrir conversa
              </>
            )}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

import { NewConversationForm } from "@/components/tickets/new-conversation-form";
import { requireServerSession } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function NewConversationPage() {
  await requireServerSession();

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Nova conversa</h1>
        <p className="text-sm text-muted-foreground">
          Preencha os campos para abrir seu ticket no Chatwoot.
        </p>
      </div>
      <NewConversationForm />
    </div>
  );
}

import { NewConversationForm } from "@/components/tickets/new-conversation-form";
import { requireServerSession } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function NewConversationPage() {
  await requireServerSession();

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <p className="text-xs uppercase tracking-[0.15em] text-muted-foreground">
        Novo ticket
      </p>
      <NewConversationForm />
    </div>
  );
}

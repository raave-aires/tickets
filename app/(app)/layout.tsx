import { Plus } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { SignOutButton } from "@/components/layout/sign-out-button";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { Button } from "@/components/ui/button";
import { requireServerSession } from "@/lib/session";

export default async function MainLayout({
  children,
}: {
  children: ReactNode;
}) {
  const session = await requireServerSession();

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-6">
          <div className="space-y-0.5">
            <Link href="/" className="text-lg font-semibold tracking-tight">
              Tickets
            </Link>
            <p className="text-xs text-muted-foreground">
              Conectado como {session.user.name}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Button asChild size="sm">
              <Link href="/conversations/new">
                <Plus className="mr-2 size-4" />
                Nova conversa
              </Link>
            </Button>
            <SignOutButton />
          </div>
        </div>
      </header>

      <main
        id="main-content"
        className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6"
      >
        {children}
      </main>
    </div>
  );
}

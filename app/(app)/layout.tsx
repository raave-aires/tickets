import { Plus } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { SignOutButton } from "@/components/layout/sign-out-button";
import { Button } from "@/components/ui/button";
import { requireServerSession } from "@/lib/session";

export default async function MainLayout({
  children,
}: {
  children: ReactNode;
}) {
  const session = await requireServerSession();

  return (
    <div className="relative min-h-screen overflow-hidden bg-[radial-gradient(circle_at_15%_10%,rgba(28,141,185,.18),transparent_35%),radial-gradient(circle_at_80%_10%,rgba(252,163,88,.18),transparent_35%),linear-gradient(180deg,#edf4fb_0%,#f8fbff_45%,#ffffff_100%)] text-foreground">
      <div className="pointer-events-none absolute inset-0 opacity-50 [background-image:linear-gradient(rgba(18,38,62,.08)_1px,transparent_1px),linear-gradient(90deg,rgba(18,38,62,.08)_1px,transparent_1px)] [background-size:42px_42px]" />

      <header className="sticky top-0 z-30 border-b border-slate-200/70 bg-[#0f233a]/90 text-white backdrop-blur-md">
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-6">
          <div>
            <Link
              href="/"
              className="font-display text-2xl leading-none tracking-tight"
            >
              Tickets
            </Link>
            <p className="text-xs text-slate-200/80">
              Conectado como {session.user.name}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              asChild
              size="sm"
              className="bg-[#f3a65a] text-[#1b2a3b] hover:bg-[#f7b675]"
            >
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
        className="relative z-10 mx-auto w-full max-w-6xl px-4 py-6 sm:px-6"
      >
        {children}
      </main>
    </div>
  );
}

import type { ReactNode } from "react";
import { ThemeToggle } from "@/components/layout/theme-toggle";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <main
      id="main-content"
      className="relative flex min-h-screen items-center justify-center p-4"
    >
      <div className="absolute right-4 top-4">
        <ThemeToggle />
      </div>

      <div className="w-full max-w-md space-y-4">
        <section className="space-y-2 text-center">
          <h1 className="text-2xl font-semibold tracking-tight">Tickets</h1>
          <p className="text-sm text-muted-foreground">
            Central de tickets integrada ao Chatwoot.
          </p>
        </section>

        <section>{children}</section>
      </div>
    </main>
  );
}

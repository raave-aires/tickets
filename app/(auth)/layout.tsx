import type { ReactNode } from "react";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <main
      id="main-content"
      className="relative grid min-h-screen overflow-hidden bg-[radial-gradient(circle_at_10%_20%,rgba(17,93,158,.24),transparent_35%),radial-gradient(circle_at_90%_5%,rgba(255,163,90,.25),transparent_32%),linear-gradient(160deg,#0d1727_0%,#12253f_42%,#18365c_100%)] px-4 py-14 text-white sm:px-8"
    >
      <div className="pointer-events-none absolute inset-0 opacity-20 [background-image:linear-gradient(rgba(255,255,255,.18)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.18)_1px,transparent_1px)] [background-size:48px_48px]" />

      <div className="relative mx-auto grid w-full max-w-6xl gap-8 lg:grid-cols-[1.15fr_0.85fr] lg:items-center">
        <section className="space-y-6 rounded-3xl border border-white/15 bg-white/5 p-8 backdrop-blur-md lg:p-10">
          <p className="inline-flex rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs uppercase tracking-[0.15em] text-white/80">
            Tickets + Chatwoot
          </p>

          <h1 className="font-display text-4xl leading-tight text-white sm:text-5xl">
            Central de tickets com conversa em tempo real.
          </h1>

          <p className="max-w-xl text-sm leading-relaxed text-slate-100/90 sm:text-base">
            Abra tickets, acompanhe atribuicao de agentes, resolucao e
            reabertura em uma interface conectada ao Chatwoot por WebSocket e
            Webhook.
          </p>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-2xl border border-white/20 bg-white/10 p-4">
              <p className="text-xs uppercase tracking-wide text-slate-200">
                Autenticacao
              </p>
              <p className="mt-1 text-sm font-medium">Better Auth</p>
            </div>
            <div className="rounded-2xl border border-white/20 bg-white/10 p-4">
              <p className="text-xs uppercase tracking-wide text-slate-200">
                Mensageria
              </p>
              <p className="mt-1 text-sm font-medium">Chatwoot Realtime</p>
            </div>
            <div className="rounded-2xl border border-white/20 bg-white/10 p-4">
              <p className="text-xs uppercase tracking-wide text-slate-200">
                Base de dados
              </p>
              <p className="mt-1 text-sm font-medium">Prisma + PostgreSQL</p>
            </div>
          </div>
        </section>

        <section>{children}</section>
      </div>
    </main>
  );
}

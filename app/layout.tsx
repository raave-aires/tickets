import type { Metadata } from "next";
import { Fraunces, IBM_Plex_Mono, Work_Sans } from "next/font/google";
import type { ReactNode } from "react";
import "./globals.css";

const workSans = Work_Sans({
  variable: "--font-work-sans",
  subsets: ["latin"],
});

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
});

const ibmPlexMono = IBM_Plex_Mono({
  variable: "--font-plex-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  title: "Tickets",
  description: "Interface de atendimento em tempo real conectada ao Chatwoot",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body
        className={`${workSans.variable} ${fraunces.variable} ${ibmPlexMono.variable} min-h-screen bg-background font-sans text-foreground antialiased`}
      >
        <a
          href="#main-content"
          className="sr-only z-50 rounded-md bg-primary px-3 py-2 font-medium text-primary-foreground focus:not-sr-only focus:absolute focus:left-3 focus:top-3"
        >
          Pular para o conteudo principal
        </a>
        {children}
      </body>
    </html>
  );
}

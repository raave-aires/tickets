"use client";

import { AlertCircle, Loader2, Mail, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
import { authClient } from "@/lib/auth-client";

type SignInFormProps = {
  microsoftEnabled: boolean;
};

export function SignInForm({ microsoftEnabled }: SignInFormProps) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pendingEmailSignIn, setPendingEmailSignIn] = useState(false);
  const [pendingMicrosoftSignIn, setPendingMicrosoftSignIn] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleEmailSignIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);

    try {
      setPendingEmailSignIn(true);
      const response = await authClient.signIn.email({
        email,
        password,
        callbackURL: "/",
      });

      if (response.error) {
        setErrorMessage(response.error.message ?? "Nao foi possivel entrar.");
        return;
      }

      router.push("/");
      router.refresh();
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Erro inesperado ao autenticar.",
      );
    } finally {
      setPendingEmailSignIn(false);
    }
  }

  async function handleMicrosoftSignIn() {
    try {
      setErrorMessage(null);
      setPendingMicrosoftSignIn(true);

      const response = await authClient.signIn.social({
        provider: "microsoft",
        callbackURL: "/",
      });

      if (response.error) {
        setErrorMessage(
          response.error.message ?? "Falha no login com Microsoft.",
        );
      }
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Falha no login com Microsoft.",
      );
      setPendingMicrosoftSignIn(false);
    }
  }

  return (
    <Card>
      <CardHeader className="space-y-2">
        <CardTitle>Entrar no Tickets</CardTitle>
        <CardDescription>
          Use e-mail e senha, ou autentique com Microsoft para acessar suas
          conversas.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        {errorMessage ? (
          <Alert variant="destructive" role="alert" aria-live="polite">
            <AlertCircle className="size-4" />
            <AlertTitle>Falha de autenticacao</AlertTitle>
            <AlertDescription>{errorMessage}</AlertDescription>
          </Alert>
        ) : null}

        <form className="space-y-4" onSubmit={handleEmailSignIn}>
          <div className="space-y-2">
            <Label htmlFor="email">E-mail</Label>
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              spellCheck={false}
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="ex.: voce@empresa.com…"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Senha</Label>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Digite sua senha…"
              required
            />
          </div>

          <Button
            type="submit"
            className="w-full"
            disabled={pendingEmailSignIn}
          >
            {pendingEmailSignIn ? (
              <>
                <Loader2 className="mr-2 size-4 animate-spin" />
                Entrando…
              </>
            ) : (
              <>
                <Mail className="mr-2 size-4" />
                Entrar com e-mail
              </>
            )}
          </Button>
        </form>

        <Button
          type="button"
          variant="outline"
          className="w-full"
          onClick={handleMicrosoftSignIn}
          disabled={!microsoftEnabled || pendingMicrosoftSignIn}
        >
          {pendingMicrosoftSignIn ? (
            <>
              <Loader2 className="mr-2 size-4 animate-spin" />
              Redirecionando…
            </>
          ) : (
            <>
              <ShieldCheck className="mr-2 size-4" />
              Entrar com Microsoft
            </>
          )}
        </Button>

        {!microsoftEnabled ? (
          <p className="text-xs text-muted-foreground">
            Configure `MICROSOFT_CLIENT_ID` e `MICROSOFT_CLIENT_SECRET` para
            habilitar o login Microsoft.
          </p>
        ) : null}

        <p className="text-sm text-muted-foreground">
          Nao tem conta?{" "}
          <Link
            href="/sign-up"
            className="font-medium text-primary hover:underline"
          >
            Criar agora
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}

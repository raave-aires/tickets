"use client";

import { AlertCircle, Loader2, UserPlus2 } from "lucide-react";
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

export function SignUpForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [pending, setPending] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);

    try {
      setPending(true);

      const response = await authClient.signUp.email({
        name,
        email,
        password,
        callbackURL: "/",
      });

      if (response.error) {
        setErrorMessage(
          response.error.message ?? "Nao foi possivel criar a conta.",
        );
        return;
      }

      router.push("/");
      router.refresh();
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Erro inesperado ao criar conta.",
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <Card className="border-white/20 bg-white/80 backdrop-blur-lg dark:border-white/10 dark:bg-card/85">
      <CardHeader className="space-y-2">
        <CardTitle className="font-display text-2xl">Criar conta</CardTitle>
        <CardDescription>
          Cadastre-se para abrir e acompanhar tickets em tempo real.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        {errorMessage ? (
          <Alert variant="destructive" role="alert" aria-live="polite">
            <AlertCircle className="size-4" />
            <AlertTitle>Falha no cadastro</AlertTitle>
            <AlertDescription>{errorMessage}</AlertDescription>
          </Alert>
        ) : null}

        <form className="space-y-4" onSubmit={handleSubmit}>
          <div className="space-y-2">
            <Label htmlFor="name">Nome</Label>
            <Input
              id="name"
              name="name"
              type="text"
              autoComplete="name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Digite seu nome completo…"
              required
            />
          </div>

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
              autoComplete="new-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Minimo de 8 caracteres…"
              minLength={8}
              required
            />
          </div>

          <Button type="submit" className="w-full" disabled={pending}>
            {pending ? (
              <>
                <Loader2 className="mr-2 size-4 animate-spin" />
                Criando…
              </>
            ) : (
              <>
                <UserPlus2 className="mr-2 size-4" />
                Criar conta
              </>
            )}
          </Button>
        </form>

        <p className="text-sm text-muted-foreground">
          Ja possui conta?{" "}
          <Link
            href="/sign-in"
            className="font-medium text-primary hover:underline"
          >
            Entrar
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}

"use client";

import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";

export function SignOutButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function handleSignOut() {
    try {
      setPending(true);
      await authClient.signOut();
      router.push("/sign-in");
      router.refresh();
    } finally {
      setPending(false);
    }
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleSignOut}
      disabled={pending}
      className="border-white/30 bg-white/10 text-white hover:bg-white/20"
    >
      <LogOut className="mr-2 size-4" />
      {pending ? "Saindo…" : "Sair"}
    </Button>
  );
}

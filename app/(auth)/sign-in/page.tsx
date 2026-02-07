import { redirect } from "next/navigation";
import { SignInForm } from "@/components/auth/sign-in-form";
import { microsoftOAuthEnabled } from "@/lib/auth";
import { getServerSession } from "@/lib/session";

export default async function SignInPage() {
  const session = await getServerSession();

  if (session) {
    redirect("/");
  }

  return <SignInForm microsoftEnabled={microsoftOAuthEnabled} />;
}

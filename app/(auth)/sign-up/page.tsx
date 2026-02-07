import { redirect } from "next/navigation";
import { SignUpForm } from "@/components/auth/sign-up-form";
import { getServerSession } from "@/lib/session";

export default async function SignUpPage() {
  const session = await getServerSession();

  if (session) {
    redirect("/");
  }

  return <SignUpForm />;
}

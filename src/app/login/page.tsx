import { redirect } from "next/navigation";
import { LoginForm } from "@/components/login-form";
import { currentActor, homeFor } from "@/lib/current";

export default async function LoginPage() {
  const actor = await currentActor();
  if (actor) redirect(homeFor(actor.role));
  return <LoginForm />;
}

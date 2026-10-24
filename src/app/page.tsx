import { redirect } from "next/navigation";
import { currentActor, homeFor } from "@/lib/current";

export default async function HomePage() {
  const actor = await currentActor();
  redirect(actor ? homeFor(actor.role) : "/login");
}

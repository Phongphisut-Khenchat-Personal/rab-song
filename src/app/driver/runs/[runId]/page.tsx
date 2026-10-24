import { notFound } from "next/navigation";
import { RunBoard } from "@/components/run-board";
import { Shell } from "@/components/shell";
import { requirePageActor } from "@/lib/current";
import { DomainError } from "@/server/errors";
import { getRunDetail } from "@/server/runs";

export default async function RunPage({ params }: { params: Promise<{ runId: string }> }) {
  const actor = await requirePageActor(["OWNER", "DRIVER"]);
  const { runId } = await params;
  try {
    const run = await getRunDetail(actor, runId);
    return (
      <Shell actor={actor}>
        <RunBoard run={run} />
      </Shell>
    );
  } catch (error) {
    if (error instanceof DomainError && error.status === 404) notFound();
    throw error;
  }
}

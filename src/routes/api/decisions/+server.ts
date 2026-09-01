import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import {
  decideCompletion,
  pendingReports,
} from "$lib/server/modules/tasks/service";

export const GET: RequestHandler = async ({ locals }) => {
  if (!locals.member)
    return json({ error: "unauthenticated" }, { status: 401 });
  if (locals.member.role !== "adult") {
    return json({ error: "forbidden" }, { status: 403 });
  }
  return json({ reports: await pendingReports(locals.member.householdId) });
};

export const POST: RequestHandler = async ({ locals, request }) => {
  if (!locals.member)
    return json({ error: "unauthenticated" }, { status: 401 });
  if (locals.member.role !== "adult") {
    return json({ error: "forbidden" }, { status: 403 });
  }
  const body = (await request.json()) as {
    action: string;
    reportId?: string;
    decision?: "confirmed" | "rejected";
    reason?: string;
  };

  if (body.action === "decide" && body.reportId && body.decision) {
    const result = await decideCompletion(
      locals.member.id,
      body.reportId,
      body.decision,
      body.reason,
    );
    return json(result, { status: result.status === "ok" ? 200 : 400 });
  }
  return json({ error: "invalid action" }, { status: 400 });
};

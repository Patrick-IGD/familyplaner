import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import {
  householdTasks,
  reportCompletion,
} from "$lib/server/modules/tasks/service";

export const GET: RequestHandler = async ({ locals }) => {
  if (!locals.member)
    return json({ error: "unauthenticated" }, { status: 401 });
  return json({ tasks: await householdTasks(locals.member.householdId) });
};

export const POST: RequestHandler = async ({ locals, request }) => {
  if (!locals.member)
    return json({ error: "unauthenticated" }, { status: 401 });
  const body = (await request.json()) as {
    action: string;
    occurrenceId?: string;
  };

  if (body.action === "report" && body.occurrenceId) {
    const result = await reportCompletion(body.occurrenceId, locals.member.id);
    return json(result, { status: result.status === "ok" ? 200 : 400 });
  }
  return json({ error: "invalid action" }, { status: 400 });
};

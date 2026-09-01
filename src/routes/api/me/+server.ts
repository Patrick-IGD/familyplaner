import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";

export const GET: RequestHandler = async ({ locals }) => {
  if (!locals.member)
    return json({ error: "unauthenticated" }, { status: 401 });
  return json({ member: locals.member });
};

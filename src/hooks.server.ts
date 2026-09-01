import type { Handle } from "@sveltejs/kit";
import { memberForSession } from "$lib/server/modules/identity/service";

// Session via HttpOnly-Cookie; jede Mutation prüft die Identität serverseitig.

export const handle: Handle = async ({ event, resolve }) => {
  const token = event.cookies.get("fp_session") ?? "";
  event.locals.member = token ? await memberForSession(token) : null;
  return resolve(event);
};

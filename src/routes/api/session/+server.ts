import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import {
  listMembers,
  loginWithPin,
  logout,
} from "$lib/server/modules/identity/service";

export const GET: RequestHandler = async ({ locals, url }) => {
  // Mitgliederliste für den Avatar-Login (nur Namen, Rollen und Farben).
  const householdId = url.searchParams.get("householdId");
  if (!householdId) {
    return json({ error: "householdId required" }, { status: 400 });
  }
  if (!locals.member) {
    return json({ error: "unauthenticated" }, { status: 401 });
  }
  return json({ members: await listMembers(householdId) });
};

export const POST: RequestHandler = async ({ request, cookies, url }) => {
  const body = (await request.json()) as {
    action: string;
    memberId?: string;
    pin?: string;
  };

  if (body.action === "login" && body.memberId && body.pin) {
    const result = await loginWithPin(body.memberId, body.pin);
    if (result.status === "ok") {
      cookies.set("fp_session", result.token, {
        httpOnly: true,
        sameSite: "lax",
        secure: url.protocol === "https:",
        path: "/",
        maxAge: 8 * 3600,
      });
      return json({ status: "ok", member: result.member });
    }
    return json(result, { status: result.status === "locked" ? 423 : 401 });
  }

  if (body.action === "logout") {
    const token = cookies.get("fp_session") ?? "";
    await logout(token);
    cookies.delete("fp_session", { path: "/" });
    return json({ status: "ok" });
  }

  return json({ error: "invalid action" }, { status: 400 });
};

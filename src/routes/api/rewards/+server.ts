import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import {
  getBalance,
  listLedger,
  listRewards,
  reserveForRedemption,
} from "$lib/server/modules/motivation/service";

export const GET: RequestHandler = async ({ locals }) => {
  if (!locals.member)
    return json({ error: "unauthenticated" }, { status: 401 });
  const [balance, rewards, ledger] = await Promise.all([
    getBalance(locals.member.id),
    listRewards(locals.member.householdId),
    listLedger(locals.member.id),
  ]);
  return json({ balance, rewards, ledger });
};

export const POST: RequestHandler = async ({ locals, request }) => {
  if (!locals.member)
    return json({ error: "unauthenticated" }, { status: 401 });
  const body = (await request.json()) as { action: string; rewardId?: string };

  if (body.action === "redeem" && body.rewardId) {
    const result = await reserveForRedemption(
      locals.member.householdId,
      locals.member.id,
      body.rewardId,
    );
    return json(result, { status: result.status === "reserved" ? 200 : 400 });
  }
  return json({ error: "invalid action" }, { status: 400 });
};

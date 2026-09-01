import { json } from "@sveltejs/kit";
import type { RequestHandler } from "./$types";
import { getPool } from "$lib/server/db";

export const GET: RequestHandler = async () => {
  try {
    const pool = getPool();
    await pool.query("select 1");
    return json({ status: "ok", database: "up" });
  } catch {
    return json({ status: "degraded", database: "down" }, { status: 503 });
  }
};

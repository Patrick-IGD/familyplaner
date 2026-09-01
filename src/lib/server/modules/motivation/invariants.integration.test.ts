import { Pool } from "pg";
import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";
import { drizzle } from "drizzle-orm/node-postgres";
import { and, eq } from "drizzle-orm";
import * as schema from "$lib/server/db/schema";
import { getDb, setPoolForTesting } from "$lib/server/db";
import {
  correctPoints,
  fulfillRedemption,
  getBalance,
  grantPointsForOccurrenceOnce,
  reserveForRedemption,
  decideRedemption,
} from "$lib/server/modules/motivation/service";

const databaseUrl = process.env.TEST_DATABASE_URL;
if (!databaseUrl)
  throw new Error("TEST_DATABASE_URL is required for integration tests");

const pool = new Pool({ connectionString: databaseUrl, max: 3 });
setPoolForTesting(pool);

let householdId: string;
let childId: string;
let secondChildId: string;
let rewardId: string;

beforeEach(async () => {
  const db = getDb();
  // sauberer Zustand pro Test
  await db.delete(schema.pointLedgerEntry);
  await db.delete(schema.pointBalanceProjection);
  await db.delete(schema.redemptionRequest);
  await db.delete(schema.reward);
  await db.delete(schema.household); // kaskadiert member etc.

  const [household] = await db
    .insert(schema.household)
    .values({ name: "test" })
    .returning();
  householdId = household.id;
  const [child] = await db
    .insert(schema.member)
    .values({ householdId, displayName: "Kind A", role: "child" })
    .returning();
  childId = child.id;
  const [secondChild] = await db
    .insert(schema.member)
    .values({ householdId, displayName: "Kind B", role: "child" })
    .returning();
  secondChildId = secondChild.id;
  const [reward] = await db
    .insert(schema.reward)
    .values({ householdId, title: "Testbelohnung", pointCost: 5 })
    .returning();
  rewardId = reward.id;
});

afterAll(async () => {
  await pool.end();
});

describe("Punkte-Ledger-Invarianten (PLAN.md Abschnitt 7)", () => {
  it("Invariante 1: Grant pro Vorkommen und Mitglied genau einmal", async () => {
    const first = await grantPointsForOccurrenceOnce(
      householdId,
      childId,
      3,
      "occ-1",
    );
    const second = await grantPointsForOccurrenceOnce(
      householdId,
      childId,
      3,
      "occ-1",
    );

    expect(first.granted).toBe(true);
    expect(second.granted).toBe(false);

    const balance = await getBalance(childId);
    expect(balance.balance).toBe(3);
  });

  it("Invariante 6/7: Reservierung nur aus verfügbaren Punkten, verfügbar bleibt nie negativ", async () => {
    await grantPointsForOccurrenceOnce(householdId, childId, 3, "occ-1");
    const tooExpensive = await reserveForRedemption(
      householdId,
      childId,
      rewardId,
    );
    expect(tooExpensive.status).toBe("insufficient");

    const balance = await getBalance(childId);
    expect(balance.available).toBe(3);

    await grantPointsForOccurrenceOnce(householdId, childId, 3, "occ-2");
    const ok = await reserveForRedemption(householdId, childId, rewardId);
    expect(ok.status).toBe("reserved");

    const afterReserve = await getBalance(childId);
    expect(afterReserve.balance).toBe(6);
    expect(afterReserve.reserved).toBe(5);
    expect(afterReserve.available).toBe(1);

    // zweite Reservierung desselben Kindes über verfügbare Punkte scheitert
    const secondTry = await reserveForRedemption(
      householdId,
      childId,
      rewardId,
    );
    expect(secondTry.status).toBe("insufficient");
  });

  it("Invariante 8: Belohnung verbraucht Punkte erst bei Erfüllung; Ablehnung hebt Reservierung auf", async () => {
    await grantPointsForOccurrenceOnce(householdId, childId, 10, "occ-1");
    const reserved = await reserveForRedemption(householdId, childId, rewardId);
    expect(reserved.status).toBe("reserved");

    const [request] = await getDb()
      .select()
      .from(schema.redemptionRequest)
      .where(eq(schema.redemptionRequest.requestedBy, childId));

    await decideRedemption(householdId, request.id, "rejected");
    let balance = await getBalance(childId);
    expect(balance.reserved).toBe(0);
    expect(balance.available).toBe(10);

    const again = await reserveForRedemption(householdId, childId, rewardId);
    expect(again.status).toBe("reserved");
    const [request2] = await getDb()
      .select()
      .from(schema.redemptionRequest)
      .where(
        and(
          eq(schema.redemptionRequest.requestedBy, childId),
          eq(schema.redemptionRequest.status, "pending"),
        ),
      );
    await decideRedemption(householdId, request2.id, "approved");
    await fulfillRedemption(householdId, request2.id);

    balance = await getBalance(childId);
    expect(balance.balance).toBe(5);
    expect(balance.reserved).toBe(0);
    expect(balance.available).toBe(5);
  });

  it("Invariante 5/7: Korrektur als neuer Eintrag, disponible Punkte nie negativ", async () => {
    await grantPointsForOccurrenceOnce(householdId, childId, 4, "occ-1");
    const negative = await correctPoints(
      householdId,
      childId,
      -5,
      "zu viel korrigiert",
    );
    expect(negative.status).toBe("negative");

    const ok = await correctPoints(
      householdId,
      childId,
      -3,
      "versehentliche Doppelbestätigung",
    );
    expect(ok.status).toBe("ok");

    const balance = await getBalance(childId);
    expect(balance.balance).toBe(1);

    const entries = await getDb()
      .select()
      .from(schema.pointLedgerEntry)
      .where(eq(schema.pointLedgerEntry.memberId, childId));
    expect(entries.length).toBe(2); // Grant + Korrektur, nichts überschrieben
    expect(entries.some((e) => e.kind === "correction")).toBe(true);
  });

  it("Invariante 2: unabhängige Kinder erhalten unabhängige Ledger", async () => {
    await grantPointsForOccurrenceOnce(householdId, childId, 3, "occ-shared");
    await grantPointsForOccurrenceOnce(
      householdId,
      secondChildId,
      3,
      "occ-shared",
    );

    expect((await getBalance(childId)).balance).toBe(3);
    expect((await getBalance(secondChildId)).balance).toBe(3);
  });
});

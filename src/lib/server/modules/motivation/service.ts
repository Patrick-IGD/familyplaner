import { and, eq, sql } from "drizzle-orm";
import { getDb } from "$lib/server/db";
import {
  pointBalanceProjection,
  pointLedgerEntry,
  redemptionRequest,
  reward,
  auditEvent,
} from "$lib/server/db/schema";

// Motivation: Append-only Punkte-Ledger, Reservierungen, Belohnungen.
// Unverhandelbare Invarianten (PLAN.md Abschnitt 7):
//  1. Bestätigte Aufgabe schreibt einem Kind nur einmal Punkte gut.
//  2. Gemeinsame Aufgaben: jedes zugeordnete Kind erhält den vollen Punktwert.
//  3. Erwachsene erhalten keine Beitragspunkte.
//  4. Punkte werden nicht als Strafe entzogen.
//  5. Korrekturen als neue Ledger-Einträge.
//  6. Reservierte Punkte können nicht gleichzeitig erneut eingelöst werden.
//  7. Verfügbare Punktestand nie negativ.
//  8. Belohnung verbraucht Punkte erst bei Erfüllung.

export type LedgerKind =
  "grant" | "reserve" | "release" | "spend" | "correction";

async function ensureProjection(
  db: ReturnType<typeof getDb>,
  memberId: string,
) {
  await db
    .insert(pointBalanceProjection)
    .values({ memberId, balance: 0, reserved: 0 })
    .onConflictDoNothing();
}

async function appendEntry(
  db: ReturnType<typeof getDb>,
  entry: {
    householdId: string;
    memberId: string;
    kind: LedgerKind;
    amount: number;
    referenceType: string;
    referenceId: string;
    reason?: string;
  },
) {
  await ensureProjection(db, entry.memberId);
  await db.insert(pointLedgerEntry).values(entry);
  // Projektions-Semantik:
  //   grant/correction: balance ±amount (Korrektur trägt das Vorzeichen selbst)
  //   reserve:  reserved +amount (Punkte werden gesperrt, balance unverändert)
  //   release:  reserved -amount (Reservierung aufgehoben)
  //   spend:    balance -amount UND reserved -amount (Punkte endgültig ausgegeben)
  await db
    .update(pointBalanceProjection)
    .set({
      balance: sql`${pointBalanceProjection.balance} + ${entry.kind === "grant" || entry.kind === "correction" ? entry.amount : entry.kind === "spend" ? -entry.amount : 0}`,
      reserved: sql`${pointBalanceProjection.reserved} + ${entry.kind === "reserve" ? entry.amount : entry.kind === "release" || entry.kind === "spend" ? -entry.amount : 0}`,
      updatedAt: new Date(),
    })
    .where(eq(pointBalanceProjection.memberId, entry.memberId));
}

// Invariante 1: Grant pro task_occurrence und Mitglied nur einmal.
export async function grantPointsForOccurrenceOnce(
  householdId: string,
  memberId: string,
  pointValue: number,
  occurrenceId: string,
): Promise<{ granted: boolean }> {
  const db = getDb();
  const existing = await db
    .select({ id: pointLedgerEntry.id })
    .from(pointLedgerEntry)
    .where(
      and(
        eq(pointLedgerEntry.memberId, memberId),
        eq(pointLedgerEntry.referenceType, "task_occurrence"),
        eq(pointLedgerEntry.referenceId, occurrenceId),
        eq(pointLedgerEntry.kind, "grant"),
      ),
    );
  if (existing.length > 0) return { granted: false };

  await appendEntry(db, {
    householdId,
    memberId,
    kind: "grant",
    amount: pointValue,
    referenceType: "task_occurrence",
    referenceId: occurrenceId,
  });
  return { granted: true };
}

export async function getBalance(memberId: string): Promise<{
  balance: number;
  reserved: number;
  available: number;
}> {
  const db = getDb();
  await ensureProjection(db, memberId);
  const [row] = await db
    .select()
    .from(pointBalanceProjection)
    .where(eq(pointBalanceProjection.memberId, memberId));
  const balance = row?.balance ?? 0;
  const reserved = row?.reserved ?? 0;
  return { balance, reserved, available: balance - reserved };
}

// Invariante 6/7/8: Reservierung nur aus verfügbaren Punkten, atomar.
export async function reserveForRedemption(
  householdId: string,
  memberId: string,
  rewardId: string,
): Promise<
  { status: "reserved" } | { status: "insufficient" } | { status: "invalid" }
> {
  const db = getDb();
  const [rewardRow] = await db
    .select()
    .from(reward)
    .where(and(eq(reward.id, rewardId), eq(reward.archived, false)));
  if (!rewardRow) return { status: "invalid" };

  const balance = await getBalance(memberId);
  if (balance.available < rewardRow.pointCost)
    return { status: "insufficient" };

  const [request] = await db
    .insert(redemptionRequest)
    .values({ rewardId, requestedBy: memberId, status: "pending" })
    .returning();

  await appendEntry(db, {
    householdId,
    memberId,
    kind: "reserve",
    amount: rewardRow.pointCost,
    referenceType: "redemption_request",
    referenceId: request.id,
  });
  return { status: "reserved" };
}

export async function decideRedemption(
  householdId: string,
  requestId: string,
  decision: "approved" | "rejected",
): Promise<{ status: "ok" } | { status: "invalid" }> {
  const db = getDb();
  const [request] = await db
    .select()
    .from(redemptionRequest)
    .where(
      and(
        eq(redemptionRequest.id, requestId),
        eq(redemptionRequest.status, "pending"),
      ),
    );
  if (!request) return { status: "invalid" };

  const [entry] = await db
    .select()
    .from(pointLedgerEntry)
    .where(
      and(
        eq(pointLedgerEntry.referenceType, "redemption_request"),
        eq(pointLedgerEntry.referenceId, requestId),
        eq(pointLedgerEntry.kind, "reserve"),
      ),
    );
  if (!entry) return { status: "invalid" };

  if (decision === "rejected") {
    await appendEntry(db, {
      householdId,
      memberId: entry.memberId,
      kind: "release",
      amount: entry.amount,
      referenceType: "redemption_request",
      referenceId: requestId,
    });
  }
  await db
    .update(redemptionRequest)
    .set({ status: decision })
    .where(eq(redemptionRequest.id, requestId));
  return { status: "ok" };
}

// Invariante 8: Punkte werden erst bei tatsächlicher Erfüllung ausgegeben.
export async function fulfillRedemption(
  householdId: string,
  requestId: string,
): Promise<{ status: "ok" } | { status: "invalid" }> {
  const db = getDb();
  const [request] = await db
    .select()
    .from(redemptionRequest)
    .where(
      and(
        eq(redemptionRequest.id, requestId),
        eq(redemptionRequest.status, "approved"),
      ),
    );
  if (!request) return { status: "invalid" };

  const [entry] = await db
    .select()
    .from(pointLedgerEntry)
    .where(
      and(
        eq(pointLedgerEntry.referenceType, "redemption_request"),
        eq(pointLedgerEntry.referenceId, requestId),
        eq(pointLedgerEntry.kind, "reserve"),
      ),
    );
  if (!entry) return { status: "invalid" };

  await appendEntry(db, {
    householdId,
    memberId: entry.memberId,
    kind: "spend",
    amount: entry.amount,
    referenceType: "redemption_request",
    referenceId: requestId,
  });
  await db
    .update(redemptionRequest)
    .set({ status: "fulfilled" })
    .where(eq(redemptionRequest.id, requestId));
  return { status: "ok" };
}

// Invariante 5: Korrektur als neuer Eintrag, sichtbar in der Historie.
export async function correctPoints(
  householdId: string,
  memberId: string,
  amount: number,
  reason: string,
): Promise<{ status: "ok" } | { status: "negative" }> {
  const db = getDb();
  const balance = await getBalance(memberId);
  if (balance.available + amount < 0) return { status: "negative" };

  await appendEntry(db, {
    householdId,
    memberId,
    kind: "correction",
    amount,
    referenceType: "correction",
    referenceId: crypto.randomUUID(),
    reason,
  });
  await db.insert(auditEvent).values({
    householdId,
    actorId: memberId,
    action: "point_correction",
    reason,
  });
  return { status: "ok" };
}

export async function listRewards(householdId: string) {
  const db = getDb();
  return db
    .select()
    .from(reward)
    .where(
      and(eq(reward.householdId, householdId), eq(reward.archived, false)),
    );
}

export async function listLedger(memberId: string) {
  const db = getDb();
  return db
    .select()
    .from(pointLedgerEntry)
    .where(eq(pointLedgerEntry.memberId, memberId));
}

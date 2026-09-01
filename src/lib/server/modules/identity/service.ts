import { and, eq, gt } from "drizzle-orm";
import { getDb } from "$lib/server/db";
import { childCredential, deviceSession, member } from "$lib/server/db/schema";
import {
  hashPin,
  hashToken,
  isValidPin,
  newSessionToken,
  verifyPin,
} from "./crypto";

const MAX_FAILED_ATTEMPTS = 3;
const LOCK_MINUTES = 5;
const SESSION_HOURS = 8;

export type Member = {
  id: string;
  householdId: string;
  displayName: string;
  role: "adult" | "child";
  avatarColor: string;
};

export type LoginResult =
  | { status: "ok"; token: string; member: Member }
  | { status: "invalid" }
  | { status: "locked"; retryAfterSeconds: number };

export async function loginWithPin(
  memberId: string,
  pin: string,
): Promise<LoginResult> {
  if (!isValidPin(pin)) return { status: "invalid" };
  const db = getDb();

  const [cred] = await db
    .select()
    .from(childCredential)
    .where(eq(childCredential.memberId, memberId));
  if (!cred) return { status: "invalid" };

  if (cred.lockedUntil && cred.lockedUntil > new Date()) {
    return {
      status: "locked",
      retryAfterSeconds: Math.ceil(
        (cred.lockedUntil.getTime() - Date.now()) / 1000,
      ),
    };
  }

  const [row] = await db
    .select()
    .from(member)
    .where(and(eq(member.id, memberId), eq(member.archived, false)));
  if (!row) return { status: "invalid" };

  if (!verifyPin(pin, cred.pinHash)) {
    const failed = cred.failedAttempts + 1;
    const lockedUntil =
      failed >= MAX_FAILED_ATTEMPTS
        ? new Date(Date.now() + LOCK_MINUTES * 60_000)
        : null;
    await db
      .update(childCredential)
      .set({ failedAttempts: failed, lockedUntil })
      .where(eq(childCredential.memberId, memberId));
    return lockedUntil
      ? { status: "locked", retryAfterSeconds: LOCK_MINUTES * 60 }
      : { status: "invalid" };
  }

  await db
    .update(childCredential)
    .set({ failedAttempts: 0, lockedUntil: null })
    .where(eq(childCredential.memberId, memberId));

  const token = newSessionToken();
  await db.insert(deviceSession).values({
    memberId,
    tokenHash: hashToken(token),
    expiresAt: new Date(Date.now() + SESSION_HOURS * 3_600_000),
  });

  return {
    status: "ok",
    token,
    member: {
      id: row.id,
      householdId: row.householdId,
      displayName: row.displayName,
      role: row.role as "adult" | "child",
      avatarColor: row.avatarColor,
    },
  };
}

export async function memberForSession(token: string): Promise<Member | null> {
  if (!token) return null;
  const db = getDb();
  const [session] = await db
    .select()
    .from(deviceSession)
    .where(
      and(
        eq(deviceSession.tokenHash, hashToken(token)),
        gt(deviceSession.expiresAt, new Date()),
      ),
    );
  if (!session) return null;
  const [row] = await db
    .select()
    .from(member)
    .where(and(eq(member.id, session.memberId), eq(member.archived, false)));
  if (!row) return null;
  return {
    id: row.id,
    householdId: row.householdId,
    displayName: row.displayName,
    role: row.role as "adult" | "child",
    avatarColor: row.avatarColor,
  };
}

export async function logout(token: string): Promise<void> {
  const db = getDb();
  await db
    .delete(deviceSession)
    .where(eq(deviceSession.tokenHash, hashToken(token)));
}

export async function setPin(memberId: string, pin: string): Promise<void> {
  if (!isValidPin(pin)) {
    throw new Error("Invalid pin format");
  }
  const db = getDb();
  await db
    .insert(childCredential)
    .values({ memberId, pinHash: hashPin(pin) })
    .onConflictDoUpdate({
      target: childCredential.memberId,
      set: { pinHash: hashPin(pin), failedAttempts: 0, lockedUntil: null },
    });
}

export async function listMembers(householdId: string): Promise<Member[]> {
  const db = getDb();
  const rows = await db
    .select()
    .from(member)
    .where(
      and(eq(member.householdId, householdId), eq(member.archived, false)),
    );
  return rows.map((row) => ({
    id: row.id,
    householdId: row.householdId,
    displayName: row.displayName,
    role: row.role as "adult" | "child",
    avatarColor: row.avatarColor,
  }));
}

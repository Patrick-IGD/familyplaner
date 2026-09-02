import { and, eq, inArray } from "drizzle-orm";
import { getDb } from "$lib/server/db";
import {
  completionDecision,
  completionReport,
  member,
  taskAssignment,
  taskOccurrence,
  taskTemplate,
  auditEvent,
} from "$lib/server/db/schema";
import { grantPointsForOccurrenceOnce } from "../motivation/service";

// Aufgaben: Erledigungsmeldung, Bestätigung, begründete Ablehnung.
// Fachliche Regeln aus CONTEXT.md:
//  - Meldung bleibt bis zur Erwachsenenentscheidung ausstehend.
//  - Bestätigung schreibt Punkte transaktional gut (Invariante 1/2).
//  - Ablehnung am Fälligkeitstag öffnet die Aufgabe erneut.
//  - Ablehnung nach dem Fälligkeitstag: Vorkommen gilt als verpasst.

export type TaskView = {
  occurrenceId: string;
  title: string;
  pointValue: number;
  rewarded: boolean;
  dueDate: Date;
  status: string;
  poolTask?: boolean;
  assignedMemberIds: string[];
};

function startOfDay(date: Date): Date {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function endOfDay(date: Date): Date {
  const copy = new Date(date);
  copy.setHours(23, 59, 59, 999);
  return copy;
}

export async function reportCompletion(
  occurrenceId: string,
  reportedByMemberId: string,
): Promise<
  { status: "ok" } | { status: "not_assigned" } | { status: "not_open" }
> {
  const db = getDb();
  const [occurrence] = await db
    .select()
    .from(taskOccurrence)
    .where(
      and(
        eq(taskOccurrence.id, occurrenceId),
        eq(taskOccurrence.status, "open"),
      ),
    );
  if (!occurrence) return { status: "not_open" };

  const assignments = await db
    .select()
    .from(taskAssignment)
    .where(eq(taskAssignment.occurrenceId, occurrenceId));
  if (!assignments.some((a) => a.memberId === reportedByMemberId)) {
    return { status: "not_assigned" };
  }

  await db.insert(completionReport).values({
    occurrenceId,
    reportedBy: reportedByMemberId,
  });
  await db
    .update(taskOccurrence)
    .set({ status: "reported" })
    .where(eq(taskOccurrence.id, occurrenceId));
  return { status: "ok" };
}

export async function decideCompletion(
  decidedByMemberId: string,
  reportId: string,
  decision: "confirmed" | "rejected",
  reason?: string,
): Promise<{ status: "ok" } | { status: "not_adult" } | { status: "invalid" }> {
  const db = getDb();
  const [decider] = await db
    .select()
    .from(member)
    .where(and(eq(member.id, decidedByMemberId), eq(member.role, "adult")));
  if (!decider) return { status: "not_adult" };

  const [report] = await db
    .select()
    .from(completionReport)
    .where(and(eq(completionReport.id, reportId)));
  if (!report) return { status: "invalid" };

  const [occurrence] = await db
    .select()
    .from(taskOccurrence)
    .where(eq(taskOccurrence.id, report.occurrenceId));
  if (!occurrence || occurrence.status !== "reported")
    return { status: "invalid" };

  const [template] = await db
    .select()
    .from(taskTemplate)
    .where(eq(taskTemplate.id, occurrence.templateId));
  if (!template) return { status: "invalid" };

  const assignments = await db
    .select()
    .from(taskAssignment)
    .where(eq(taskAssignment.occurrenceId, occurrence.id));
  const assignedMemberIds = assignments.map((a) => a.memberId);

  const isDueDay =
    new Date() <= endOfDay(occurrence.dueDate) &&
    new Date() >= startOfDay(occurrence.dueDate);

  await db.insert(completionDecision).values({
    reportId,
    decidedBy: decidedByMemberId,
    decision,
    reason: reason ?? null,
  });

  if (decision === "confirmed") {
    await db
      .update(taskOccurrence)
      .set({ status: "confirmed" })
      .where(eq(taskOccurrence.id, occurrence.id));
    // Invariante 2: jedem zugeordneten Kind den vollen Punktwert;
    // Erwachsene erhalten keine Punkte (Invariante 3).
    if (template.rewarded && template.pointValue > 0) {
      const children = await db
        .select()
        .from(member)
        .where(
          and(inArray(member.id, assignedMemberIds), eq(member.role, "child")),
        );
      for (const child of children) {
        await grantPointsForOccurrenceOnce(
          decider.householdId,
          child.id,
          template.pointValue,
          occurrence.id,
        );
      }
    }
    await db.insert(auditEvent).values({
      householdId: decider.householdId,
      actorId: decidedByMemberId,
      action: "task_confirmed",
      reason: reason ?? null,
    });
  } else {
    const newStatus = isDueDay ? "open" : "missed";
    await db
      .update(taskOccurrence)
      .set({ status: newStatus })
      .where(eq(taskOccurrence.id, occurrence.id));
    await db.insert(auditEvent).values({
      householdId: decider.householdId,
      actorId: decidedByMemberId,
      action: "task_rejected",
      reason: reason ?? null,
    });
  }
  return { status: "ok" };
}

export async function tasksForMember(
  memberId: string,
  householdId: string,
): Promise<TaskView[]> {
  const db = getDb();
  const rows = await db
    .select({
      occurrence: taskOccurrence,
      template: taskTemplate,
    })
    .from(taskOccurrence)
    .innerJoin(taskTemplate, eq(taskTemplate.id, taskOccurrence.templateId))
    .innerJoin(
      taskAssignment,
      eq(taskAssignment.occurrenceId, taskOccurrence.id),
    )
    .where(
      and(
        eq(taskAssignment.memberId, memberId),
        eq(taskTemplate.householdId, householdId),
      ),
    );

  return rows.map((row) => ({
    occurrenceId: row.occurrence.id,
    title: row.template.title,
    pointValue: row.template.pointValue,
    rewarded: row.template.rewarded,
    dueDate: row.occurrence.dueDate,
    status: row.occurrence.status,
    poolTask: row.template.poolTask,
    assignedMemberIds: [],
  }));
}

export async function householdTasks(householdId: string): Promise<TaskView[]> {
  const db = getDb();
  const rows = await db
    .select({
      occurrence: taskOccurrence,
      template: taskTemplate,
    })
    .from(taskOccurrence)
    .innerJoin(taskTemplate, eq(taskTemplate.id, taskOccurrence.templateId))
    .where(
      and(
        eq(taskTemplate.householdId, householdId),
        eq(taskTemplate.personal, false),
        eq(taskTemplate.archived, false),
      ),
    );

  const occurrenceIds = rows.map((row) => row.occurrence.id);
  const assignments =
    occurrenceIds.length > 0
      ? await db
          .select()
          .from(taskAssignment)
          .where(inArray(taskAssignment.occurrenceId, occurrenceIds))
      : [];

  return rows.map((row) => ({
    occurrenceId: row.occurrence.id,
    title: row.template.title,
    pointValue: row.template.pointValue,
    rewarded: row.template.rewarded,
    dueDate: row.occurrence.dueDate,
    status: row.occurrence.status,
    poolTask: row.template.poolTask,
    assignedMemberIds: assignments
      .filter((a) => a.occurrenceId === row.occurrence.id)
      .map((a) => a.memberId),
  }));
}

// Aufgabenpool: offene Pool-Vorkommen ohne Zuweisung.
export async function poolTasks(householdId: string): Promise<TaskView[]> {
  const all = await householdTasks(householdId);
  return all.filter(
    (task) =>
      task.poolTask && task.assignedMemberIds.length === 0 && task.status === 'open',
  );
}

// Übernahme aus dem Aufgabenpool macht aus dem offenen Haushaltsbeitrag
// eine zugewiesene Aufgabe (CONTEXT.md: Aufgabenpool).
export async function claimPoolTask(
  occurrenceId: string,
  memberId: string,
  householdId: string,
): Promise<{ status: 'ok' } | { status: 'invalid' }> {
  const db = getDb();
  const [occurrence] = await db
    .select()
    .from(taskOccurrence)
    .where(and(eq(taskOccurrence.id, occurrenceId), eq(taskOccurrence.status, 'open')));
  if (!occurrence) return { status: 'invalid' };

  const [template] = await db
    .select()
    .from(taskTemplate)
    .where(eq(taskTemplate.id, occurrence.templateId));
  if (!template || template.householdId !== householdId || !template.poolTask) {
    return { status: 'invalid' };
  }

  const existing = await db
    .select()
    .from(taskAssignment)
    .where(eq(taskAssignment.occurrenceId, occurrenceId));
  if (existing.length > 0) return { status: 'invalid' };

  await db.insert(taskAssignment).values({ occurrenceId, memberId });
  return { status: 'ok' };
}

export async function pendingReports(householdId: string) {
  const db = getDb();
  const rows = await db
    .select({
      report: completionReport,
      occurrence: taskOccurrence,
      template: taskTemplate,
    })
    .from(completionReport)
    .innerJoin(
      taskOccurrence,
      eq(taskOccurrence.id, completionReport.occurrenceId),
    )
    .innerJoin(taskTemplate, eq(taskTemplate.id, taskOccurrence.templateId))
    .where(
      and(
        eq(taskTemplate.householdId, householdId),
        eq(taskOccurrence.status, "reported"),
      ),
    );
  return rows;
}

import { and, eq, gte, inArray, lte } from 'drizzle-orm';
import { getDb } from '$lib/server/db';
import {
  member,
  taskAssignment,
  taskOccurrence,
  taskTemplate
} from '$lib/server/db/schema';

// Aufgaben-Verwaltung (nur Erwachsene, siehe PLAN.md: belohnte
// Haushaltsbeiträge, Punktwerte und Belohnungen werden ausschließlich
// von Erwachsenen verwaltet).

export type TemplateView = {
  id: string;
  title: string;
  pointValue: number;
  rewarded: boolean;
  recurrence: string;
  poolTask: boolean;
  assigneeIds: string[];
};

export async function listTemplates(householdId: string): Promise<TemplateView[]> {
  const db = getDb();
  const templates = await db
    .select()
    .from(taskTemplate)
    .where(
      and(eq(taskTemplate.householdId, householdId), eq(taskTemplate.archived, false))
    );

  const result: TemplateView[] = [];
  for (const template of templates) {
    // Zuweisungen liegen an den Vorkommen; die aktuelle Zuweisung ergibt
    // sich aus dem neuesten offenen Vorkommen.
    const occurrences = await db
      .select({ id: taskOccurrence.id })
      .from(taskOccurrence)
      .where(eq(taskOccurrence.templateId, template.id));
    const occurrenceIds = occurrences.map((o) => o.id);
    const assignments =
      occurrenceIds.length > 0
        ? await db
            .select()
            .from(taskAssignment)
            .where(inArray(taskAssignment.occurrenceId, occurrenceIds))
        : [];
    const latestOccurrenceId = occurrenceIds[occurrenceIds.length - 1];
    result.push({
      id: template.id,
      title: template.title,
      pointValue: template.pointValue,
      rewarded: template.rewarded,
      recurrence: template.recurrence,
      poolTask: template.poolTask,
      assigneeIds: latestOccurrenceId
        ? assignments
            .filter((a) => a.occurrenceId === latestOccurrenceId)
            .map((a) => a.memberId)
        : []
    });
  }
  return result;
}

export async function createTemplate(
  householdId: string,
  input: {
    title: string;
    pointValue: number;
    recurrence: string;
    poolTask: boolean;
    assigneeIds: string[];
  }
): Promise<{ status: 'ok'; templateId: string } | { status: 'invalid' }> {
  const db = getDb();
  const title = input.title?.trim();
  if (!title || title.length > 120) return { status: 'invalid' };
  if (![0, 1, 3, 5].includes(input.pointValue)) return { status: 'invalid' };
  if (!['once', 'daily', 'weekly'].includes(input.recurrence)) return { status: 'invalid' };
  if (!input.poolTask && input.assigneeIds.length === 0) return { status: 'invalid' };

  // Nur Mitglieder des Haushalts zuweisbar
  const members = await db
    .select({ id: member.id })
    .from(member)
    .where(eq(member.householdId, householdId));
  const memberIds = new Set(members.map((m) => m.id));
  if (!input.assigneeIds.every((id) => memberIds.has(id))) return { status: 'invalid' };

  const [template] = await db
    .insert(taskTemplate)
    .values({
      householdId,
      title,
      pointValue: input.pointValue,
      rewarded: input.pointValue > 0,
      recurrence: input.recurrence,
      poolTask: input.poolTask
    })
    .returning();

  await createOccurrenceForToday(template.id, input.assigneeIds);
  return { status: 'ok', templateId: template.id };
}

export async function archiveTemplate(householdId: string, templateId: string) {
  const db = getDb();
  await db
    .update(taskTemplate)
    .set({ archived: true })
    .where(
      and(
        eq(taskTemplate.id, templateId),
        eq(taskTemplate.householdId, householdId)
      )
    );
}

// --- Vorkommen ---

export async function createOccurrenceForToday(
  templateId: string,
  assigneeIds: string[]
): Promise<string> {
  const db = getDb();
  const today = new Date();
  today.setHours(12, 0, 0, 0);
  const [occurrence] = await db
    .insert(taskOccurrence)
    .values({ templateId, dueDate: today })
    .returning();
  for (const memberId of assigneeIds) {
    await db
      .insert(taskAssignment)
      .values({ occurrenceId: occurrence.id, memberId });
  }
  return occurrence.id;
}

// Stellt sicher, dass für alle aktiven wiederkehrenden Vorlagen ein
// Vorkommen heute existiert (einfacher Tagesjob bis pg-boss kommt).
export async function ensureTodaysOccurrences(householdId: string): Promise<number> {
  const db = getDb();
  const templates = await db
    .select()
    .from(taskTemplate)
    .where(
      and(
        eq(taskTemplate.householdId, householdId),
        eq(taskTemplate.archived, false),
        inArray(taskTemplate.recurrence, ['daily', 'weekly'])
      )
    );

  let created = 0;
  const now = new Date();
  const dayStart = new Date(now);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(now);
  dayEnd.setHours(23, 59, 59, 999);

  for (const template of templates) {
    // Wochentyp: nur an passendem Wochentag erzeugen (Montag als Referenz)
    if (template.recurrence === 'weekly' && now.getDay() !== 1) continue;

    const existing = await db
      .select({ id: taskOccurrence.id })
      .from(taskOccurrence)
      .where(
        and(
          eq(taskOccurrence.templateId, template.id),
          gte(taskOccurrence.dueDate, dayStart),
          lte(taskOccurrence.dueDate, dayEnd)
        )
      );
    if (existing.length > 0) continue;

    // Zuweisungen vom letzten Vorkommen übernehmen (feste Aufgaben);
    // Pool-Aufgaben bleiben ohne Zuweisung.
    let assigneeIds: string[] = [];
    if (!template.poolTask) {
      const last = await db
        .select({ id: taskOccurrence.id })
        .from(taskOccurrence)
        .where(eq(taskOccurrence.templateId, template.id));
      if (last.length > 0) {
        const lastAssignments = await db
          .select()
          .from(taskAssignment)
          .where(
            inArray(
              taskAssignment.occurrenceId,
              last.map((o) => o.id)
            )
          );
        assigneeIds = [...new Set(lastAssignments.map((a) => a.memberId))];
      }
    }

    await createOccurrenceForToday(template.id, assigneeIds);
    created += 1;
  }
  return created;
}

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { and, eq } from 'drizzle-orm';
import { getDb } from '$lib/server/db';
import { reward } from '$lib/server/db/schema';
import { archiveTemplate, createTemplate, listTemplates } from '$lib/server/modules/tasks/admin';

// Aufgaben-Verwaltung: ausschließlich Erwachsene (PLAN.md).

export const GET: RequestHandler = async ({ locals }) => {
  if (!locals.member) return json({ error: 'unauthenticated' }, { status: 401 });
  if (locals.member.role !== 'adult') {
    return json({ error: 'forbidden' }, { status: 403 });
  }
  return json({ templates: await listTemplates(locals.member.householdId) });
};

export const POST: RequestHandler = async ({ locals, request }) => {
  if (!locals.member) return json({ error: 'unauthenticated' }, { status: 401 });
  if (locals.member.role !== 'adult') {
    return json({ error: 'forbidden' }, { status: 403 });
  }
  const body = (await request.json()) as {
    action: string;
    title?: string;
    pointValue?: number;
    recurrence?: string;
    poolTask?: boolean;
    assigneeIds?: string[];
    templateId?: string;
    rewardTitle?: string;
    rewardCost?: number;
    rewardId?: string;
  };

  const db = getDb();

  if (body.action === 'createTask' && body.title && body.recurrence) {
    const result = await createTemplate(locals.member.householdId, {
      title: body.title,
      pointValue: body.pointValue ?? 0,
      recurrence: body.recurrence,
      poolTask: body.poolTask ?? false,
      assigneeIds: body.assigneeIds ?? []
    });
    return json(result, { status: result.status === 'ok' ? 200 : 400 });
  }

  if (body.action === 'archiveTask' && body.templateId) {
    await archiveTemplate(locals.member.householdId, body.templateId);
    return json({ status: 'ok' });
  }

  if (body.action === 'createReward' && body.rewardTitle && body.rewardCost) {
    await db.insert(reward).values({
      householdId: locals.member.householdId,
      title: body.rewardTitle,
      pointCost: body.rewardCost
    });
    return json({ status: 'ok' });
  }

  if (body.action === 'archiveReward' && body.rewardId) {
    await db
      .update(reward)
      .set({ archived: true })
      .where(
        and(eq(reward.id, body.rewardId), eq(reward.householdId, locals.member.householdId))
      );
    return json({ status: 'ok' });
  }

  return json({ error: 'invalid action' }, { status: 400 });
};

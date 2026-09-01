import { createHealthService } from '$lib/server/health';
import { probeDatabase } from '$lib/server/runtime';
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

const health = createHealthService(probeDatabase);

export const GET: RequestHandler = async () => {
  const result = await health.live();
  return json(result.body, { status: result.status });
};

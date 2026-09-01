import { PgBoss } from 'pg-boss';
import { z } from 'zod';
import { loadRuntimeConfig } from './lib/server/config.js';

const argumentsSchema = z.tuple([
  z.string().min(1).max(128),
  z.coerce.number().int().min(1).max(20).default(1)
]);

async function main(): Promise<void> {
  const config = loadRuntimeConfig(process.env);
  const parsed = argumentsSchema.safeParse([process.argv[2], process.argv[3] ?? 1]);
  if (!parsed.success) throw new Error('Invalid probe arguments');

  const [businessKey, count] = parsed.data;
  const boss = new PgBoss({ connectionString: config.databaseUrl, max: 1 });
  try {
    await boss.start();
    await boss.createQueue('probe-effect', {
      retryLimit: 3,
      retryDelay: 1,
      retryBackoff: true,
      expireInSeconds: 30,
      deleteAfterSeconds: 3600
    });
    for (let index = 0; index < count; index += 1) {
      await boss.send('probe-effect', { businessKey });
    }
    console.log(JSON.stringify({ event: 'probe_jobs_sent', count }));
  } finally {
    await boss.stop({ graceful: true, timeout: 5_000 });
  }
}

main().catch(() => {
  console.error(JSON.stringify({ event: 'probe_send_failed', status: 'failed' }));
  process.exitCode = 1;
});

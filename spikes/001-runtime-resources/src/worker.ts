import { PgBoss } from 'pg-boss';
import { Pool } from 'pg';
import { loadRuntimeConfig } from './lib/server/config.js';
import { attachNeutralPoolErrorHandler } from './lib/server/database-pool.js';
import { createProbeEffectRepository } from './lib/server/probe-effect-repository.js';
import { createProbeJobHandler } from './lib/server/probe-job.js';
import { shouldCrashAfterEffect } from './lib/server/worker-fault-injection.js';

const queueName = 'probe-effect';

async function main(): Promise<void> {
  const config = loadRuntimeConfig(process.env);
  if (config.role !== 'worker') {
    throw new Error('Worker role required');
  }

  const pool = new Pool({ connectionString: config.databaseUrl, max: 2 });
  attachNeutralPoolErrorHandler(pool, () => {
    console.error(JSON.stringify({ event: 'database_pool_error', status: 'unavailable' }));
  });
  const boss = new PgBoss({ connectionString: config.databaseUrl, max: 2 });
  boss.on('error', () => {
    console.error(JSON.stringify({ event: 'queue_error', status: 'failed' }));
  });

  await boss.start();
  await boss.createQueue(queueName, {
    retryLimit: 3,
    retryDelay: 1,
    retryBackoff: true,
    expireInSeconds: 30,
    deleteAfterSeconds: 3600
  });

  const handler = createProbeJobHandler(createProbeEffectRepository(pool), {
    async afterEffect(businessKey, attemptCount) {
      if (
        shouldCrashAfterEffect(process.env.SPIKE_CRASH_AFTER_EFFECT_KEY, businessKey, attemptCount)
      ) {
        console.error(JSON.stringify({ event: 'injected_worker_crash', status: 'triggered' }));
        process.exit(86);
      }
    }
  });
  await boss.work<{ businessKey: string }>(
    queueName,
    { batchSize: 1, localConcurrency: 1, pollingIntervalSeconds: 1 },
    async (jobs) => {
      await handler(jobs.map((job) => ({ data: job.data })));
      console.log(JSON.stringify({ event: 'probe_job_complete', count: jobs.length }));
    }
  );

  console.log(JSON.stringify({ event: 'worker_ready', status: 'ok' }));

  let stopping = false;
  const stop = async () => {
    if (stopping) return;
    stopping = true;
    await boss.stop({ graceful: true, timeout: 10_000 });
    await pool.end();
    process.exit(0);
  };
  process.once('SIGTERM', stop);
  process.once('SIGINT', stop);
}

main().catch(() => {
  console.error(JSON.stringify({ event: 'worker_start_failed', status: 'failed' }));
  process.exitCode = 1;
});

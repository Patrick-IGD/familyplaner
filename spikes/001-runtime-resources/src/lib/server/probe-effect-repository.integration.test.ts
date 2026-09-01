import { Pool } from 'pg';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createProbeEffectRepository } from './probe-effect-repository';

const databaseUrl = process.env.TEST_DATABASE_URL;
if (!databaseUrl) throw new Error('TEST_DATABASE_URL is required for integration tests');

const pool = new Pool({ connectionString: databaseUrl, max: 2 });

describe('PostgreSQL probe effect repository', () => {
  beforeAll(async () => {
    await pool.query(`
      create table if not exists probe_effect (
        business_key text primary key,
        effect_count smallint not null default 1 check (effect_count = 1),
        attempt_count integer not null default 1 check (attempt_count > 0),
        completed_at timestamptz not null default now(),
        updated_at timestamptz not null default now()
      )
    `);
  });

  beforeEach(async () => {
    await pool.query('truncate table probe_effect');
  });

  afterAll(async () => {
    await pool.end();
  });

  it('records one effect while counting repeated attempts', async () => {
    const repository = createProbeEffectRepository(pool);

    const firstAttempt = await repository.apply('calendar-sync:demo-1');
    const secondAttempt = await repository.apply('calendar-sync:demo-1');

    expect(firstAttempt).toBe(1);
    expect(secondAttempt).toBe(2);

    const result = await pool.query(
      'select effect_count, attempt_count from probe_effect where business_key = $1',
      ['calendar-sync:demo-1']
    );
    expect(result.rows).toEqual([{ effect_count: 1, attempt_count: 2 }]);
  });
});

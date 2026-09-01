import type { Pool } from 'pg';

export function createProbeEffectRepository(pool: Pool) {
  return {
    async apply(businessKey: string): Promise<number> {
      const result = await pool.query<{ attempt_count: number }>(
        `insert into probe_effect (business_key)
         values ($1)
         on conflict (business_key) do update
           set attempt_count = probe_effect.attempt_count + 1,
               updated_at = now()
         returning attempt_count`,
        [businessKey]
      );
      const attemptCount = result.rows[0]?.attempt_count;
      if (!Number.isInteger(attemptCount) || attemptCount < 1) {
        throw new Error('Probe effect persistence failed');
      }
      return attemptCount;
    }
  };
}

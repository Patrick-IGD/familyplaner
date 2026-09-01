import { describe, expect, it } from 'vitest';
import { createProbeJobHandler } from './probe-job';

describe('createProbeJobHandler', () => {
  it('applies a valid job through the repository', async () => {
    const applied: string[] = [];
    const handler = createProbeJobHandler({
      async apply(businessKey) {
        applied.push(businessKey);
        return 1;
      }
    });

    await handler([{ data: { businessKey: 'calendar-sync:demo-1' } }]);

    expect(applied).toEqual(['calendar-sync:demo-1']);
  });

  it('runs the post-effect hook after the repository returns the persisted attempt', async () => {
    const events: string[] = [];
    const handler = createProbeJobHandler(
      {
        async apply() {
          events.push('effect');
          return 1;
        }
      },
      {
        async afterEffect(businessKey, attemptCount) {
          events.push(`after:${businessKey}:${attemptCount}`);
        }
      }
    );

    await handler([{ data: { businessKey: 'runtime-smoke:crash-boundary' } }]);

    expect(events).toEqual(['effect', 'after:runtime-smoke:crash-boundary:1']);
  });

  it('rejects malformed job data before applying an effect', async () => {
    let applications = 0;
    const handler = createProbeJobHandler({
      async apply() {
        applications += 1;
        return 1;
      }
    });

    await expect(handler([{ data: { businessKey: '' } }])).rejects.toThrowError(
      'Invalid probe job payload'
    );
    expect(applications).toBe(0);
  });
});

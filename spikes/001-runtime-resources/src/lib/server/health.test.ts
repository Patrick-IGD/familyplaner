import { describe, expect, it } from 'vitest';
import { createHealthService } from './health';

describe('createHealthService', () => {
  it('reports liveness without consulting the database', async () => {
    let probes = 0;
    const health = createHealthService(async () => {
      probes += 1;
    });

    await expect(health.live()).resolves.toEqual({ status: 200, body: { status: 'ok' } });
    expect(probes).toBe(0);
  });

  it('reports readiness after a successful database probe', async () => {
    let probes = 0;
    const health = createHealthService(async () => {
      probes += 1;
    });

    await expect(health.ready()).resolves.toEqual({ status: 200, body: { status: 'ok' } });
    expect(probes).toBe(1);
  });

  it('reports dependency failure without leaking the database error', async () => {
    const marker = 'must-not-appear';
    const health = createHealthService(async () => {
      throw new Error(marker);
    });

    const result = await health.ready();

    expect(result).toEqual({ status: 503, body: { status: 'unavailable' } });
    expect(JSON.stringify(result)).not.toContain(marker);
  });
});

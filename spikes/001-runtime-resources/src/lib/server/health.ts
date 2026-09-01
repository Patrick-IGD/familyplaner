type HealthResult = {
  status: number;
  body: { status: 'ok' | 'unavailable' };
};

export function createHealthService(databaseProbe: () => Promise<void>) {
  return {
    async live(): Promise<HealthResult> {
      return { status: 200, body: { status: 'ok' } };
    },
    async ready(): Promise<HealthResult> {
      try {
        await databaseProbe();
        return { status: 200, body: { status: 'ok' } };
      } catch {
        return { status: 503, body: { status: 'unavailable' } };
      }
    }
  };
}

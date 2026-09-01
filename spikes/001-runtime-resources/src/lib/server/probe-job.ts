import { z } from 'zod';

const probeJobSchema = z.strictObject({
  businessKey: z.string().min(1).max(128)
});

type ProbeJob = {
  data: unknown;
};

type ProbeEffectRepository = {
  apply(businessKey: string): Promise<number>;
};

type ProbeJobHandlerOptions = {
  afterEffect?(businessKey: string, attemptCount: number): Promise<void>;
};

export function createProbeJobHandler(
  repository: ProbeEffectRepository,
  options: ProbeJobHandlerOptions = {}
) {
  return async (jobs: ProbeJob[]): Promise<void> => {
    for (const job of jobs) {
      const result = probeJobSchema.safeParse(job.data);
      if (!result.success) {
        throw new Error('Invalid probe job payload');
      }
      const attemptCount = await repository.apply(result.data.businessKey);
      await options.afterEffect?.(result.data.businessKey, attemptCount);
    }
  };
}

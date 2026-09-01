import { describe, expect, it } from 'vitest';
import { shouldCrashAfterEffect } from './worker-fault-injection';

describe('shouldCrashAfterEffect', () => {
  it('requests an injected crash only after the first effect attempt for the exact key', () => {
    expect(shouldCrashAfterEffect('runtime-smoke:run-1', 'runtime-smoke:run-1', 1)).toBe(true);
    expect(shouldCrashAfterEffect('runtime-smoke:run-1', 'runtime-smoke:run-1', 2)).toBe(false);
    expect(shouldCrashAfterEffect('runtime-smoke:run-1', 'runtime-smoke:other', 1)).toBe(false);
    expect(shouldCrashAfterEffect(undefined, 'runtime-smoke:run-1', 1)).toBe(false);
  });
});

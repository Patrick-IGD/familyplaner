export function shouldCrashAfterEffect(
  configuredBusinessKey: string | undefined,
  appliedBusinessKey: string,
  attemptCount: number
): boolean {
  return configuredBusinessKey === appliedBusinessKey && attemptCount === 1;
}

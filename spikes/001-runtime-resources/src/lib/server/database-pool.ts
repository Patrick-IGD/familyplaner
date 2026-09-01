type ErrorEmitter = {
  on(event: 'error', listener: (error: Error) => void): unknown;
};

export function attachNeutralPoolErrorHandler(pool: ErrorEmitter, report: () => void): void {
  pool.on('error', () => report());
}

import { EventEmitter } from 'node:events';
import { describe, expect, it } from 'vitest';
import { attachNeutralPoolErrorHandler } from './database-pool';

describe('attachNeutralPoolErrorHandler', () => {
  it('handles an idle database error without exposing its details', () => {
    const pool = new EventEmitter();
    const reports: string[] = [];

    attachNeutralPoolErrorHandler(pool, () => reports.push('database_pool_error'));
    pool.emit('error', new Error('must-not-appear'));

    expect(reports).toEqual(['database_pool_error']);
    expect(JSON.stringify(reports)).not.toContain('must-not-appear');
  });
});

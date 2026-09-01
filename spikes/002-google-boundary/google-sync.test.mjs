import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createInMemoryGoogleCalendar,
  createLocalProjection,
  fullSync,
  deltaSync,
  enqueueOutboxOperation,
  processOutbox,
  sendWriteOperationTwice,
  projectionConverged
} from './google-sync.mjs';

// AC-011: Alle Proben laufen ausschließlich mit synthetischen Testdaten.

const syntheticEvents = [
  { id: 'evt-1', summary: 'synthetic-a', start: '2026-09-01T08:00:00Z' },
  { id: 'evt-2', summary: 'synthetic-b', start: '2026-09-02T09:00:00Z' }
];

test('full sync converges the local projection and stores the sync token', async () => {
  const client = createInMemoryGoogleCalendar(syntheticEvents);
  const projection = createLocalProjection();

  const result = await fullSync(client, projection);

  assert.equal(projectionConverged(projection, ['evt-1', 'evt-2']), true);
  assert.equal(typeof projection.syncToken, 'string');
  assert.deepEqual(result.collectedIds.sort(), ['evt-1', 'evt-2']);
});

test('delta sync applies only changes since the stored sync token', async () => {
  const client = createInMemoryGoogleCalendar(syntheticEvents);
  const projection = createLocalProjection();
  await fullSync(client, projection);

  await client._simulateExternalChange({
    id: 'evt-3',
    summary: 'synthetic-c',
    start: '2026-09-03T10:00:00Z'
  });

  const delta = await deltaSync(client, projection);

  assert.equal(delta.mode, 'delta');
  assert.deepEqual(delta.appliedIds, ['evt-3']);
  assert.equal(projectionConverged(projection, ['evt-1', 'evt-2', 'evt-3']), true);
});

test('delta sync without a stored token falls back to a full sync', async () => {
  const client = createInMemoryGoogleCalendar(syntheticEvents);
  const projection = createLocalProjection();

  const result = await deltaSync(client, projection);

  assert.equal(result.mode, 'full');
  assert.equal(projectionConverged(projection, ['evt-1', 'evt-2']), true);
});

test('delta sync respects cancellations from the external calendar', async () => {
  const client = createInMemoryGoogleCalendar(syntheticEvents);
  const projection = createLocalProjection();
  await fullSync(client, projection);

  await client.cancelEvent({ id: 'evt-1' });

  const delta = await deltaSync(client, projection);
  assert.deepEqual(delta.appliedIds, ['evt-1']);
  assert.equal(projectionConverged(projection, ['evt-2']), true);
});

test('an invalid sync token fails closed before any projection change', async () => {
  const client = createInMemoryGoogleCalendar(syntheticEvents);
  const projection = createLocalProjection();
  projection.syncToken = '999999';

  await assert.rejects(() => deltaSync(client, projection), /GOOGLE_SYNC_TOKEN/);
});

test('outbox delivers a local change exactly once to the external calendar', async () => {
  const client = createInMemoryGoogleCalendar([]);
  const projection = createLocalProjection();

  const enqueue = enqueueOutboxOperation(projection, {
    operationId: 'op-1',
    type: 'create',
    event: { id: 'local-1', summary: 'synthetic-local', start: '2026-09-04T08:00:00Z' }
  });
  assert.equal(enqueue.status, 'enqueued');

  const results = await processOutbox(client, projection);
  assert.equal(results.length, 1);
  assert.equal(results[0].deduped, false);
  assert.equal(client._eventCount(), 1);
  assert.equal(projection.pendingOutbox.length, 0);
});

test('double write with the same operation id creates at most one external event', async () => {
  const client = createInMemoryGoogleCalendar([]);
  const projection = createLocalProjection();
  const event = { id: 'local-1', summary: 'synthetic-local', start: '2026-09-04T08:00:00Z' };

  const { firstEnqueue, secondEnqueue, processed } = await sendWriteOperationTwice(
    client,
    projection,
    { operationId: 'op-dup', event }
  );

  assert.equal(firstEnqueue.status, 'enqueued');
  assert.equal(secondEnqueue.status, 'duplicate-ignored');
  assert.equal(processed.length, 1);
  assert.equal(client._eventCount(), 1);
});

test('retry of an already applied operation id does not create a second event', async () => {
  const client = createInMemoryGoogleCalendar([]);
  const projection = createLocalProjection();

  enqueueOutboxOperation(projection, {
    operationId: 'op-retry',
    type: 'create',
    event: { id: 'local-1', summary: 'synthetic-retry', start: '2026-09-05T08:00:00Z' }
  });
  await processOutbox(client, projection);

  // Zweiter Zustellungsversuch derselben Operations-ID (Worker-Restart-Szenario).
  const reEnqueue = enqueueOutboxOperation(projection, {
    operationId: 'op-retry',
    type: 'create',
    event: { id: 'local-1', summary: 'synthetic-retry', start: '2026-09-05T08:00:00Z' }
  });
  assert.equal(reEnqueue.status, 'duplicate-ignored');
  const reprocessed = await processOutbox(client, projection);
  assert.equal(reprocessed.length, 0);
  assert.equal(client._eventCount(), 1);
});

test('projection and external calendar converge after full cycle', async () => {
  const client = createInMemoryGoogleCalendar(syntheticEvents);
  const projection = createLocalProjection();

  await fullSync(client, projection);
  const delta = await deltaSync(client, projection);
  assert.equal(delta.mode, 'delta');
  assert.deepEqual(delta.appliedIds, []);

  enqueueOutboxOperation(projection, {
    operationId: 'op-conv',
    type: 'create',
    event: { id: 'local-conv', summary: 'synthetic-converge', start: '2026-09-06T08:00:00Z' }
  });
  await processOutbox(client, projection);

  const finalDelta = await deltaSync(client, projection);
  assert.ok(finalDelta.appliedIds.includes('local-conv'));
  assert.equal(
    projectionConverged(projection, ['evt-1', 'evt-2', 'local-conv']),
    true
  );
  assert.equal(client._eventCount(), 3);
});

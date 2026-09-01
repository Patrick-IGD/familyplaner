// REQ-012 / AC-011: Google-Sync-Adapter mit synthetischen Testdaten.
//
// Vollabgleich, inkrementeller Abgleich (syncToken), simulierte Outbox und
// Doppelversuch-Dedupe. Der Adapter spricht ausschließlich über den
// injizierten Kalender-Client; Tests nutzen den synthetischen In-Memory-
// Kalender, es findet kein Netzwerkzugriff statt.

export function neutralError(field) {
  return new Error(`Invalid Google sync configuration: ${field}`);
}

export function createInMemoryGoogleCalendar(initialEvents = []) {
  const events = new Map();
  const deletedAt = new Map(); // eventId -> Revision der Löschung
  const idempotencyKeys = new Map(); // operationId -> eventId
  const revisions = new Map(); // eventId -> letzte Änderungsrevision
  let revision = 0;
  let deletedRevisions = new Map();

  for (const event of initialEvents) {
    revision += 1;
    events.set(event.id, { ...event });
    revisions.set(event.id, revision);
  }

  const api = {
    async listEvents({ syncToken } = {}) {
      if (syncToken !== undefined) {
        const seen = Number(syncToken);
        if (!Number.isInteger(seen) || seen > revision) {
          throw neutralError('GOOGLE_SYNC_TOKEN');
        }
        const items = [];
        for (const [id, event] of events) {
          if ((revisions.get(id) ?? 0) > seen) {
            items.push({ ...event });
          }
        }
        for (const [id, delRev] of deletedRevisions) {
          if (delRev > seen) {
            items.push({ id, status: 'cancelled' });
          }
        }
        return { items, nextSyncToken: String(revision) };
      }
      const items = [...events.values()].map((event) => ({ ...event }));
      return { items, nextSyncToken: String(revision) };
    },
    async createEvent({ idempotencyKey, event }) {
      if (idempotencyKey !== undefined && idempotencyKeys.has(idempotencyKey)) {
        const existingId = idempotencyKeys.get(idempotencyKey);
        const existing = events.get(existingId);
        return { ...existing, _deduped: true };
      }
      if (event.id !== undefined && events.has(event.id)) {
        throw neutralError('GOOGLE_EVENT_ID_CONFLICT');
      }
      revision += 1;
      const id = event.id ?? `synthetic-${revision}`;
      events.set(id, { ...event, id });
      revisions.set(id, revision);
      if (idempotencyKey !== undefined) {
        idempotencyKeys.set(idempotencyKey, id);
      }
      return { ...events.get(id), _deduped: false };
    },
    async cancelEvent({ id }) {
      if (!events.has(id)) {
        throw neutralError('GOOGLE_EVENT_NOT_FOUND');
      }
      revision += 1;
      events.delete(id);
      deletedAt.set(id, revision);
      deletedRevisions.set(id, revision);
    },
    // Test-Hooks (kein Produktvertrag): syntheische Änderung von außen.
    async _simulateExternalChange(event) {
      revision += 1;
      events.set(event.id, { ...event });
      revisions.set(event.id, revision);
    },
    _eventCount: () => events.size,
    _revision: () => revision
  };
  return api;
}

// --- lokale Projektion ---

export function createLocalProjection() {
  return {
    events: new Map(),
    syncToken: undefined,
    lastFullSyncAt: undefined,
    pendingOutbox: [],
    appliedOperationIds: new Set()
  };
}

// --- Vollabgleich ( REQ-012: Projiziert alle Items, speichert nextSyncToken ) ---

export async function fullSync(client, projection) {
  projection.events.clear();
  projection.syncToken = undefined;
  const page = await client.listEvents({});
  for (const event of page.items ?? []) {
    if (event.status === 'cancelled') {
      projection.events.delete(event.id);
    } else {
      projection.events.set(event.id, { ...event });
    }
  }
  projection.syncToken = page.nextSyncToken;
  projection.lastFullSyncAt = new Date().toISOString();
  return { collectedIds: [...projection.events.keys()] };
}

// --- inkrementeller Abgleich ---

export async function deltaSync(client, projection) {
  if (projection.syncToken === undefined) {
    const result = await fullSync(client, projection);
    return { ...result, mode: 'full' };
  }
  const page = await client.listEvents({ syncToken: projection.syncToken });
  const appliedIds = [];
  for (const event of page.items ?? []) {
    if (event.status === 'cancelled') {
      projection.events.delete(event.id);
    } else {
      projection.events.set(event.id, { ...event });
    }
    appliedIds.push(event.id);
  }
  projection.syncToken = page.nextSyncToken;
  return { appliedIds, mode: 'delta' };
}

// --- simulierte Outbox ( REQ-012: Idempotenz über Operations-ID ) ---

export function enqueueOutboxOperation(projection, { operationId, type, event }) {
  if (typeof operationId !== 'string' || operationId.length === 0) {
    throw neutralError('GOOGLE_OPERATION_ID');
  }
  if (projection.appliedOperationIds.has(operationId)) {
    return { status: 'duplicate-ignored' };
  }
  if (projection.pendingOutbox.some((op) => op.operationId === operationId)) {
    return { status: 'duplicate-ignored' };
  }
  projection.pendingOutbox.push({ operationId, type, event: { ...event } });
  return { status: 'enqueued' };
}

export async function processOutbox(client, projection) {
  const results = [];
  while (projection.pendingOutbox.length > 0) {
    const operation = projection.pendingOutbox[0];
    const created = await client.createEvent({
      idempotencyKey: operation.operationId,
      event: operation.event
    });
    projection.pendingOutbox.shift();
    projection.appliedOperationIds.add(operation.operationId);
    results.push({
      operationId: operation.operationId,
      externalId: created.id,
      deduped: created._deduped === true
    });
  }
  return results;
}

// --- Doppelversuch-Probe: gleiche Operations-ID zweimal anlegen/sendet ---
// Erwartung (AC-011): höchstens ein externer Termin entsteht.

export async function sendWriteOperationTwice(client, projection, { operationId, event }) {
  const firstEnqueue = enqueueOutboxOperation(projection, { operationId, type: 'create', event });
  const secondEnqueue = enqueueOutboxOperation(projection, {
    operationId,
    type: 'create',
    event
  });
  const processed = await processOutbox(client, projection);
  return { firstEnqueue, secondEnqueue, processed };
}

// --- Konvergenzprüfung ---

export function projectionConverged(projection, expectedEventIds) {
  const current = new Set([...projection.events.keys()]);
  const expected = new Set(expectedEventIds);
  if (current.size !== expected.size) return false;
  for (const id of expected) {
    if (!current.has(id)) return false;
  }
  return true;
}

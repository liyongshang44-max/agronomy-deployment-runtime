import { cloneCanonicalValue, deepFreeze, semanticHash } from '../../canonicalization/src/index.mjs';
import { assertAuthorityRef } from '../../contracts/src/authority.mjs';

export class AuditEventError extends TypeError {
  constructor(code, message) {
    super(message);
    this.name = 'AuditEventError';
    this.code = code;
  }
}

function requiredText(value, name) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new AuditEventError('INVALID_AUDIT_EVENT', `${name} must be a non-empty string`);
  }
  return value.trim();
}

function normalizeTime(value) {
  const text = requiredText(value, 'occurredAt');
  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) {
    throw new AuditEventError('INVALID_AUDIT_TIME', 'occurredAt must be a valid timestamp');
  }
  return parsed.toISOString();
}

function normalizeActor(actor) {
  if (!actor || typeof actor !== 'object' || Array.isArray(actor)) {
    throw new AuditEventError('INVALID_AUDIT_ACTOR', 'actor must be an object');
  }
  return deepFreeze({
    type: requiredText(actor.type, 'actor.type'),
    id: requiredText(actor.id, 'actor.id')
  });
}

export function createAuditEvent({
  eventId,
  occurredAt,
  actor,
  action,
  objectRef,
  inputRefs = [],
  details = {}
}) {
  const normalizedObjectRef = assertAuthorityRef(objectRef);
  const normalizedInputRefs = inputRefs.map((ref) => assertAuthorityRef(ref));
  const payload = {
    eventId: requiredText(eventId, 'eventId'),
    occurredAt: normalizeTime(occurredAt),
    actor: normalizeActor(actor),
    action: requiredText(action, 'action'),
    objectRef: normalizedObjectRef,
    inputRefs: normalizedInputRefs,
    details: cloneCanonicalValue(details)
  };
  return deepFreeze({
    ...payload,
    eventHash: semanticHash('AuditEvent', payload)
  });
}

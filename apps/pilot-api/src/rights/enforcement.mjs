import { randomUUID } from 'node:crypto';
import {
  RightsAuthorityError,
  assertRightsAllowed,
  publishRightsDecision,
  publishRightsGrant,
  publishRightsPolicy
} from '../../../../packages/rights-authority/src/index.mjs';

export const PILOT_RIGHTS_ENFORCEMENT_VERSION = 'adr.pilot.rights-enforcement.v1';

function requiredText(value, name) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new RightsAuthorityError('INVALID_RIGHTS_INPUT', `${name} must be a non-empty string`);
  }
  return value.trim();
}

function ownershipFromSubject(record) {
  if (record.ref.kind === 'Source') return record.semanticPayload.ownership;
  if (record.ref.kind === 'SourceArtifact') return record.semanticPayload.ownership;
  throw new RightsAuthorityError('INVALID_RIGHTS_SUBJECT', 'pilot rights enforcement requires Source or SourceArtifact');
}

function sameScope(left, right) {
  return left?.organizationId === right?.organizationId
    && (left?.tenantId ?? null) === (right?.tenantId ?? null);
}

function principal(principalId, type, ownership) {
  return {
    principalId: requiredText(principalId, 'principalId'),
    type,
    organizationId: ownership.organizationId,
    ...(ownership.tenantId ? { tenantId: ownership.tenantId } : {})
  };
}

function audit(eventId, actor, occurredAt, inputRefs = [], details = {}) {
  return {
    eventId,
    occurredAt,
    actor: { type: actor.type, id: actor.principalId },
    inputRefs,
    details: { channel: 'pilot-api-rights-enforcement', ...details }
  };
}

export class PilotRightsEnforcementService {
  #ledger;
  #operatorId;
  #evaluatorId;

  constructor({ ledger, operatorId, evaluatorId = 'pilot-rights-engine' }) {
    if (!ledger || typeof ledger.resolve !== 'function' || typeof ledger.publish !== 'function') {
      throw new RightsAuthorityError('INVALID_LEDGER', 'pilot rights enforcement requires AuthorityLedger');
    }
    this.#ledger = ledger;
    this.#operatorId = requiredText(operatorId, 'operatorId');
    this.#evaluatorId = requiredText(evaluatorId, 'evaluatorId');
  }

  provision({
    subjectRef,
    basisClass,
    evidenceRefs = [],
    rules,
    validFrom,
    validUntil,
    version = `grant-${new Date().toISOString()}-${randomUUID()}`
  }) {
    const subject = this.#ledger.resolve(subjectRef);
    const ownership = ownershipFromSubject(subject);
    const owner = principal(this.#operatorId, 'USER', ownership);
    const safeVersion = requiredText(version, 'version');
    const now = new Date().toISOString();
    const suffix = subject.ref.semanticHash.replace(/^sha256:/, '').slice(0, 20);
    const policy = publishRightsPolicy({
      ledger: this.#ledger,
      logicalId: `rights.policy.pilot.${suffix}`,
      version: safeVersion,
      ownership,
      ownerPrincipal: owner,
      basis: { class: requiredText(basisClass, 'basisClass'), evidenceRefs },
      audit: audit(`evt-rights-policy:${suffix}:${safeVersion}`, owner, now, evidenceRefs, {
        authorityBoundary: 'RECORDED_RIGHTS_BASIS_NOT_LEGAL_OPINION'
      })
    });
    const grant = publishRightsGrant({
      ledger: this.#ledger,
      logicalId: `rights.grant.pilot.${suffix}`,
      version: safeVersion,
      rightsPolicyRef: policy.ref,
      subjectRef: subject.ref,
      grantee: {
        organizationId: ownership.organizationId,
        ...(ownership.tenantId ? { tenantId: ownership.tenantId } : {})
      },
      rules,
      validFrom,
      validUntil,
      grantorPrincipal: owner,
      audit: audit(`evt-rights-grant:${suffix}:${safeVersion}`, owner, now, [policy.ref, subject.ref], {
        authorityBoundary: 'EXACT_SUBJECT_ONLY_NO_RIGHTS_INHERITANCE'
      })
    });
    return {
      version: PILOT_RIGHTS_ENFORCEMENT_VERSION,
      subjectRef: subject.ref,
      rightsPolicyRef: policy.ref,
      rightsGrantRef: grant.ref,
      authorityClaim: 'RIGHTS_PROVISIONING_ONLY_NOT_SCIENTIFIC_AUTHORITY'
    };
  }

  decide({
    rightsPolicyRef,
    subjectRef,
    actorId,
    actorType = 'SERVICE_ACCOUNT',
    operation,
    purpose,
    jurisdiction,
    evaluatedAt = new Date().toISOString(),
    version = `decision-${new Date().toISOString()}-${randomUUID()}`
  }) {
    const subject = this.#ledger.resolve(subjectRef);
    const ownership = ownershipFromSubject(subject);
    const actor = principal(actorId, actorType, ownership);
    const evaluator = principal(this.#evaluatorId, 'SERVICE_ACCOUNT', ownership);
    const at = new Date(evaluatedAt).toISOString();
    return publishRightsDecision({
      ledger: this.#ledger,
      logicalId: `rights.decision.pilot.${subject.ref.semanticHash.replace(/^sha256:/, '').slice(0, 20)}.${requiredText(operation, 'operation').toLowerCase()}`,
      version: requiredText(version, 'version'),
      rightsPolicyRef,
      subjectRef: subject.ref,
      actor,
      evaluatorPrincipal: evaluator,
      operation,
      purpose,
      jurisdiction,
      evaluatedAt: at,
      audit: audit(`evt-rights-decision:${randomUUID()}`, evaluator, at, [rightsPolicyRef, subject.ref], {
        operation,
        purpose,
        jurisdiction
      })
    });
  }

  assertAllowed({
    rightsDecisionRef,
    subjectRef,
    actorId,
    actorType = 'SERVICE_ACCOUNT',
    operation,
    purpose,
    jurisdiction,
    requiredAt,
    enforceableObligations = []
  }) {
    const subject = this.#ledger.resolve(subjectRef);
    const ownership = ownershipFromSubject(subject);
    const actor = principal(actorId, actorType, ownership);
    return assertRightsAllowed({
      ledger: this.#ledger,
      rightsDecisionRef,
      subjectRef: subject.ref,
      actor,
      operation,
      purpose,
      jurisdiction,
      requiredAt,
      enforceableObligations
    });
  }

  async execute({
    rightsPolicyRef,
    subjectRef,
    actorId,
    actorType = 'SERVICE_ACCOUNT',
    operation,
    purpose,
    jurisdiction,
    enforceableObligations = [],
    sideEffect
  }) {
    if (typeof sideEffect !== 'function') {
      throw new RightsAuthorityError('RIGHTS_SIDE_EFFECT_REQUIRED', 'pilot rights enforcement requires an explicit sideEffect callback');
    }
    const at = new Date().toISOString();
    const decision = this.decide({
      rightsPolicyRef,
      subjectRef,
      actorId,
      actorType,
      operation,
      purpose,
      jurisdiction,
      evaluatedAt: at
    });
    this.assertAllowed({
      rightsDecisionRef: decision.ref,
      subjectRef,
      actorId,
      actorType,
      operation,
      purpose,
      jurisdiction,
      requiredAt: at,
      enforceableObligations
    });
    const result = await sideEffect({ rightsDecisionRef: decision.ref, obligations: decision.semanticPayload.obligations });
    return {
      version: PILOT_RIGHTS_ENFORCEMENT_VERSION,
      rightsDecisionRef: decision.ref,
      outcome: decision.semanticPayload.outcome,
      obligations: decision.semanticPayload.obligations,
      result,
      authorityClaim: 'SIDE_EFFECT_EXECUTED_ONLY_AFTER_EXACT_RIGHTS_ALLOW'
    };
  }
}

export function assertProvisioningScope({ ledger, subjectRef, ownership }) {
  const subject = ledger.resolve(subjectRef);
  const subjectOwnership = ownershipFromSubject(subject);
  if (!sameScope(subjectOwnership, ownership)) {
    throw new RightsAuthorityError('RIGHTS_PROVISIONING_SCOPE_MISMATCH', 'requested rights provisioning scope differs from exact subject ownership');
  }
  return subject;
}

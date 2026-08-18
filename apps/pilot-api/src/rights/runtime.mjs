import { deepFreeze } from '../../../../packages/canonicalization/src/index.mjs';
import { sameAuthorityRef } from '../../../../packages/contracts/src/authority.mjs';
import {
  publishRightsGrant,
  validateRightsPolicy
} from '../../../../packages/rights-authority/src/index.mjs';
import {
  RightsEffectGate,
  RightsEnforcementError,
  RightsGovernedExternalExtraction,
  RightsGovernedPilotSourceIngestion
} from '../../../../packages/rights-enforcement/src/index.mjs';

export const PILOT_RIGHTS_RUNTIME_VERSION = 'adr.pilot.rights-runtime.v1';
export const PILOT_RIGHTS_EVALUATOR_ID = 'pilot-rights-effect-gate';

function requiredText(value, name) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new RightsEnforcementError('INVALID_RIGHTS_ENFORCEMENT_INPUT', `${name} must be a non-empty string`);
  }
  return value.trim();
}

function scopeOf(upload) {
  const scope = upload?.scope;
  if (!scope || typeof scope !== 'object' || Array.isArray(scope)) {
    throw new RightsEnforcementError('INVALID_RIGHTS_ENFORCEMENT_SCOPE', 'governed upload scope is required');
  }
  return {
    organizationId: requiredText(scope.organizationId, 'scope.organizationId'),
    ...(scope.tenantId ? { tenantId: requiredText(scope.tenantId, 'scope.tenantId') } : {})
  };
}

function principal(scope, id, type) {
  return deepFreeze({
    principalId: requiredText(id, 'principalId'),
    type,
    ...scope
  });
}

function audit(eventId, actor, occurredAt, channel) {
  return {
    eventId,
    occurredAt,
    actor: { type: actor.type, id: actor.principalId },
    details: { channel }
  };
}

function decisionUse({ uploadId, governance, upload, operatorId, operation, purpose, jurisdiction, at, subjectRef, obligations = [] }) {
  const scope = scopeOf(upload);
  const actor = principal(scope, operatorId, 'USER');
  const evaluator = principal(scope, PILOT_RIGHTS_EVALUATOR_ID, 'SERVICE_ACCOUNT');
  const token = `${operation.toLowerCase()}.${at.replace(/[^0-9]/g, '')}`;
  return {
    logicalId: `rights.decision.pilot.${uploadId}.${token}`,
    version: '1',
    rightsPolicyRef: governance.rightsPolicyRef,
    subjectRef,
    actor,
    evaluatorPrincipal: evaluator,
    operation,
    purpose,
    jurisdiction: requiredText(jurisdiction, 'rightsJurisdiction'),
    evaluatedAt: at,
    enforceableObligations: obligations,
    audit: audit(`evt-rights-decision:${uploadId}:${token}`, evaluator, at, 'pilot-rights-effect-gate')
  };
}

export class PilotRightsRuntime {
  #ledger;
  #sourceRegistry;
  #ingestion;
  #operatorId;
  #gate;
  #governedIngestion;
  #externalExtraction;

  constructor({ ledger, sourceRegistry, ingestion, operatorId, snapshot = null }) {
    if (!ledger || typeof ledger.resolve !== 'function') throw new RightsEnforcementError('INVALID_RIGHTS_LEDGER', 'pilot rights runtime requires AuthorityLedger');
    this.#ledger = ledger;
    this.#sourceRegistry = sourceRegistry;
    this.#ingestion = ingestion;
    this.#operatorId = requiredText(operatorId, 'operatorId');
    this.#gate = new RightsEffectGate({ ledger });
    this.#governedIngestion = new RightsGovernedPilotSourceIngestion({
      ledger,
      sourceRegistry,
      ingestion,
      gate: this.#gate,
      snapshot
    });
    this.#externalExtraction = new RightsGovernedExternalExtraction({ sourceRegistry, gate: this.#gate });
  }

  exportSnapshot() { return this.#governedIngestion.exportSnapshot(); }

  getGovernedUpload(uploadId) { return this.#governedIngestion.getUpload(uploadId); }

  createUpload(body, sourceAudit) {
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      throw new RightsEnforcementError('INVALID_RIGHTS_ENFORCEMENT_INPUT', 'upload body must be an object');
    }
    if (!body.rightsPolicyRef) {
      throw new RightsEnforcementError(
        'RIGHTS_POLICY_REQUIRED_FOR_NEW_UPLOAD',
        'new governed upload requires exact rightsPolicyRef; Source rights metadata is not authority'
      );
    }
    validateRightsPolicy({ ledger: this.#ledger, rightsPolicyRef: body.rightsPolicyRef });
    return this.#governedIngestion.createUpload({
      scope: body.scope,
      filename: body.filename,
      declaredMediaType: body.declaredMediaType ?? 'application/pdf',
      source: body.source,
      artifact: body.artifact,
      rightsPolicyRef: body.rightsPolicyRef,
      sourceAudit
    });
  }

  publishGrant({ uploadId, subject, rules, validFrom, validUntil, grantAudit }) {
    const governed = this.#governedIngestion.getUpload(uploadId);
    const upload = governed.upload;
    const scope = scopeOf(upload);
    const policy = validateRightsPolicy({ ledger: this.#ledger, rightsPolicyRef: governed.governance.rightsPolicyRef });
    const owner = principal(scope, this.#operatorId, 'USER');
    if (policy.ownerPrincipal.principalId !== owner.principalId
      || policy.ownerPrincipal.type !== owner.type
      || policy.ownerPrincipal.organizationId !== owner.organizationId
      || (policy.ownerPrincipal.tenantId ?? null) !== (owner.tenantId ?? null)) {
      throw new RightsEnforcementError(
        'PILOT_OPERATOR_NOT_RIGHTS_POLICY_OWNER',
        'pilot operator may provision a grant only when it is the exact RightsPolicy owner'
      );
    }
    let subjectRef;
    const normalizedSubject = requiredText(subject, 'subject');
    if (normalizedSubject === 'SOURCE') subjectRef = governed.governance.sourceRef;
    else if (normalizedSubject === 'SOURCE_ARTIFACT') {
      if (!upload.sourceArtifactRef) {
        throw new RightsEnforcementError('SOURCE_ARTIFACT_REQUIRED', 'SOURCE_ARTIFACT grant requires materialized SourceArtifact');
      }
      subjectRef = upload.sourceArtifactRef;
    } else {
      throw new RightsEnforcementError('INVALID_RIGHTS_GRANT_SUBJECT', 'subject must be SOURCE or SOURCE_ARTIFACT');
    }
    const issuedAt = requiredText(grantAudit?.occurredAt, 'grantAudit.occurredAt');
    const grant = publishRightsGrant({
      ledger: this.#ledger,
      logicalId: `rights.grant.pilot.${uploadId}.${normalizedSubject.toLowerCase()}.${issuedAt.replace(/[^0-9]/g, '')}`,
      version: '1',
      rightsPolicyRef: governed.governance.rightsPolicyRef,
      subjectRef,
      grantee: {
        organizationId: scope.organizationId,
        ...(scope.tenantId ? { tenantId: scope.tenantId } : {}),
        principalId: owner.principalId,
        principalType: owner.type
      },
      rules,
      validFrom: validFrom ?? issuedAt,
      validUntil,
      grantorPrincipal: owner,
      audit: grantAudit
    });
    return deepFreeze({ grant, subjectRef, rightsPolicyRef: governed.governance.rightsPolicyRef });
  }

  async uploadPdf({ uploadId, readable, jurisdiction, at }) {
    const governed = this.#governedIngestion.getUpload(uploadId);
    const use = decisionUse({
      uploadId,
      governance: governed.governance,
      upload: governed.upload,
      operatorId: this.#operatorId,
      operation: 'RETAIN_FULLTEXT',
      purpose: 'SOURCE_RETENTION',
      jurisdiction,
      at,
      subjectRef: governed.governance.sourceRef
    });
    return this.#governedIngestion.uploadPdf({ uploadId, readable, rightsUse: use });
  }

  finalizeUpload({ uploadId, artifactAudit }) {
    return this.#governedIngestion.finalizeUpload({ uploadId, artifactAudit });
  }

  async extractExternal({ uploadId, jurisdiction, at, provider, enforceableObligations = [] }) {
    const governed = this.#governedIngestion.getUpload(uploadId);
    const artifactRef = governed.upload.sourceArtifactRef;
    if (!artifactRef) throw new RightsEnforcementError('SOURCE_ARTIFACT_REQUIRED', 'external extraction requires materialized SourceArtifact');
    const readUse = decisionUse({
      uploadId,
      governance: governed.governance,
      upload: governed.upload,
      operatorId: this.#operatorId,
      operation: 'READ_FOR_EXTRACTION',
      purpose: 'SCIENTIFIC_CLAIM_EXTRACTION',
      jurisdiction,
      at,
      subjectRef: artifactRef,
      obligations: enforceableObligations
    });
    const egressUse = decisionUse({
      uploadId,
      governance: governed.governance,
      upload: governed.upload,
      operatorId: this.#operatorId,
      operation: 'MODEL_EGRESS',
      purpose: 'SCIENTIFIC_CLAIM_EXTRACTION',
      jurisdiction,
      at,
      subjectRef: artifactRef,
      obligations: enforceableObligations
    });
    if (!sameAuthorityRef(readUse.subjectRef, egressUse.subjectRef)) {
      throw new RightsEnforcementError('RIGHTS_EXTRACTION_SUBJECT_MISMATCH', 'pilot extraction use subjects differ');
    }
    return this.#externalExtraction.extract({
      artifactRef,
      readUse,
      modelEgressUse: egressUse,
      provider
    });
  }
}

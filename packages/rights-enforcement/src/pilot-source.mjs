import { deepFreeze } from '../../canonicalization/src/index.mjs';
import { assertAuthorityRef, sameAuthorityRef } from '../../contracts/src/authority.mjs';
import { validateRightsDecision, validateRightsPolicy } from '../../rights-authority/src/index.mjs';
import { RightsEnforcementError } from './errors.mjs';

export const RIGHTS_GOVERNED_SOURCE_INGESTION_VERSION = 'adr.rights.governed-source-ingestion.v1';

function requiredText(value, name) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new RightsEnforcementError('INVALID_RIGHTS_ENFORCEMENT_INPUT', `${name} must be a non-empty string`);
  }
  return value.trim();
}

function validAudit(value, name) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new RightsEnforcementError('RIGHTS_ENFORCEMENT_AUDIT_REQUIRED', `${name} is required`);
  }
  return structuredClone(value);
}

function normalizedScope(scope) {
  if (!scope || typeof scope !== 'object' || Array.isArray(scope)) {
    throw new RightsEnforcementError('INVALID_RIGHTS_ENFORCEMENT_SCOPE', 'scope must be an object');
  }
  return {
    organizationId: requiredText(scope.organizationId, 'scope.organizationId'),
    ...(scope.tenantId ? { tenantId: requiredText(scope.tenantId, 'scope.tenantId') } : {})
  };
}

function sameScope(left, right) {
  return left.organizationId === right.organizationId && (left.tenantId ?? null) === (right.tenantId ?? null);
}

function publicGovernance(record) {
  return deepFreeze({
    uploadId: record.uploadId,
    sourceRef: record.sourceRef,
    rightsPolicyRef: record.rightsPolicyRef,
    ...(record.retentionRightsDecisionRef ? { retentionRightsDecisionRef: record.retentionRightsDecisionRef } : {}),
    version: RIGHTS_GOVERNED_SOURCE_INGESTION_VERSION
  });
}

export class RightsGovernedPilotSourceIngestion {
  #ledger;
  #sourceRegistry;
  #ingestion;
  #gate;
  #records = new Map();

  constructor({ ledger, sourceRegistry, ingestion, gate, snapshot = null }) {
    if (!ledger || typeof ledger.resolve !== 'function') {
      throw new RightsEnforcementError('INVALID_RIGHTS_LEDGER', 'governed source ingestion requires AuthorityLedger');
    }
    if (!sourceRegistry || typeof sourceRegistry.registerSource !== 'function' || typeof sourceRegistry.resolveSource !== 'function') {
      throw new RightsEnforcementError('INVALID_SOURCE_REGISTRY', 'governed source ingestion requires SourceRegistry');
    }
    if (!ingestion || typeof ingestion.createUpload !== 'function' || typeof ingestion.uploadPdf !== 'function'
      || typeof ingestion.finalizeUpload !== 'function' || typeof ingestion.getUpload !== 'function') {
      throw new RightsEnforcementError('INVALID_SOURCE_INGESTION_SERVICE', 'governed source ingestion requires pilot ingestion implementation');
    }
    if (!gate || typeof gate.execute !== 'function') {
      throw new RightsEnforcementError('INVALID_RIGHTS_EFFECT_GATE', 'governed source ingestion requires RightsEffectGate');
    }
    this.#ledger = ledger;
    this.#sourceRegistry = sourceRegistry;
    this.#ingestion = ingestion;
    this.#gate = gate;
    if (snapshot) this.restoreSnapshot(snapshot);
  }

  createUpload({ scope, filename, declaredMediaType = 'application/pdf', source, artifact, rightsPolicyRef, sourceAudit }) {
    const exactScope = normalizedScope(scope);
    const policy = validateRightsPolicy({ ledger: this.#ledger, rightsPolicyRef });
    if (!sameScope(policy.ownership, exactScope)) {
      throw new RightsEnforcementError(
        'RIGHTS_POLICY_SOURCE_SCOPE_MISMATCH',
        'RightsPolicy ownership must equal upload Source ownership before any upload session or Source authority is created'
      );
    }
    const exactSourceAudit = validAudit(sourceAudit, 'sourceAudit');
    const upload = this.#ingestion.createUpload({ scope: exactScope, filename, declaredMediaType, source, artifact });
    const exactSource = this.#sourceRegistry.registerSource({
      ...source,
      ownership: exactScope,
      audit: exactSourceAudit
    });
    const record = {
      uploadId: upload.uploadId,
      sourceRef: exactSource.ref,
      rightsPolicyRef: policy.record.ref,
      sourceAudit: exactSourceAudit
    };
    this.#records.set(upload.uploadId, record);
    return deepFreeze({ upload, governance: publicGovernance(record), source: exactSource });
  }

  getUpload(uploadId) {
    const id = requiredText(uploadId, 'uploadId');
    const record = this.#records.get(id);
    if (!record) throw new RightsEnforcementError('RIGHTS_GOVERNED_UPLOAD_NOT_FOUND', 'governed upload record does not exist');
    return deepFreeze({ upload: this.#ingestion.getUpload(id), governance: publicGovernance(record) });
  }

  async uploadPdf({ uploadId, readable, rightsUse }) {
    const id = requiredText(uploadId, 'uploadId');
    const record = this.#records.get(id);
    if (!record) throw new RightsEnforcementError('RIGHTS_GOVERNED_UPLOAD_NOT_FOUND', 'governed upload record does not exist');
    if (!rightsUse || typeof rightsUse !== 'object' || Array.isArray(rightsUse)) {
      throw new RightsEnforcementError('RIGHTS_USE_REQUIRED', 'RETAIN_FULLTEXT rights use is required before upload');
    }
    if (rightsUse.operation !== 'RETAIN_FULLTEXT') {
      throw new RightsEnforcementError('RIGHTS_OPERATION_MISMATCH', 'governed PDF retention requires RETAIN_FULLTEXT');
    }
    if (!sameAuthorityRef(rightsUse.rightsPolicyRef, record.rightsPolicyRef)
      || !sameAuthorityRef(rightsUse.subjectRef, record.sourceRef)) {
      throw new RightsEnforcementError(
        'RIGHTS_RETENTION_SUBJECT_MISMATCH',
        'retention rights use must bind exact upload RightsPolicy and pre-retention Source'
      );
    }
    const executed = await this.#gate.execute({
      uses: [rightsUse],
      effect: async ({ rightsDecisionRefs }) => {
        const upload = await this.#ingestion.uploadPdf({ uploadId: id, readable });
        return { upload, rightsDecisionRef: rightsDecisionRefs[0] };
      }
    });
    record.retentionRightsDecisionRef = executed.rightsDecisionRefs[0];
    return deepFreeze({
      upload: executed.value.upload,
      governance: publicGovernance(record)
    });
  }

  finalizeUpload({ uploadId, artifactAudit }) {
    const id = requiredText(uploadId, 'uploadId');
    const record = this.#records.get(id);
    if (!record) throw new RightsEnforcementError('RIGHTS_GOVERNED_UPLOAD_NOT_FOUND', 'governed upload record does not exist');
    if (!record.retentionRightsDecisionRef) {
      throw new RightsEnforcementError(
        'RETENTION_RIGHTS_DECISION_REQUIRED',
        'SourceArtifact cannot materialize without exact successful RETAIN_FULLTEXT RightsDecision'
      );
    }
    const retentionDecision = validateRightsDecision({
      ledger: this.#ledger,
      rightsDecisionRef: record.retentionRightsDecisionRef
    });
    if (retentionDecision.semanticPayload.outcome !== 'ALLOW'
      || retentionDecision.semanticPayload.operation !== 'RETAIN_FULLTEXT'
      || !sameAuthorityRef(retentionDecision.semanticPayload.subjectRef, record.sourceRef)) {
      throw new RightsEnforcementError(
        'RETENTION_RIGHTS_DECISION_INVALID',
        'stored retention RightsDecision no longer validates exact Source retention use'
      );
    }
    const inputAudit = validAudit(artifactAudit, 'artifactAudit');
    const finalized = this.#ingestion.finalizeUpload({
      uploadId: id,
      sourceAudit: record.sourceAudit,
      artifactAudit: {
        ...inputAudit,
        inputRefs: [record.retentionRightsDecisionRef, ...(inputAudit.inputRefs ?? [])]
      }
    });
    if (!sameAuthorityRef(finalized.source.ref, record.sourceRef)) {
      throw new RightsEnforcementError(
        'SOURCE_IDENTITY_DRIFT',
        'finalized Source differs from exact pre-retention Source authority'
      );
    }
    return deepFreeze({
      ...finalized,
      governance: publicGovernance(record)
    });
  }

  exportSnapshot() {
    return deepFreeze({
      version: RIGHTS_GOVERNED_SOURCE_INGESTION_VERSION,
      records: [...this.#records.values()].map((record) => structuredClone(record))
    });
  }

  restoreSnapshot(snapshot) {
    if (this.#records.size !== 0) {
      throw new RightsEnforcementError('RIGHTS_GOVERNED_UPLOADS_NOT_EMPTY', 'restore requires empty governed upload state');
    }
    if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)
      || snapshot.version !== RIGHTS_GOVERNED_SOURCE_INGESTION_VERSION || !Array.isArray(snapshot.records)) {
      throw new RightsEnforcementError('INVALID_RIGHTS_GOVERNED_UPLOAD_SNAPSHOT', 'invalid governed upload snapshot');
    }
    const staged = new Map();
    for (const input of snapshot.records) {
      const uploadId = requiredText(input.uploadId, 'snapshot.uploadId');
      this.#ingestion.getUpload(uploadId);
      const sourceRef = assertAuthorityRef(input.sourceRef);
      const rightsPolicyRef = assertAuthorityRef(input.rightsPolicyRef);
      const source = this.#sourceRegistry.resolveSource(sourceRef);
      const policy = validateRightsPolicy({ ledger: this.#ledger, rightsPolicyRef });
      if (!sameScope(policy.ownership, source.semanticPayload.ownership)) {
        throw new RightsEnforcementError(
          'INVALID_RIGHTS_GOVERNED_UPLOAD_SNAPSHOT',
          'restored RightsPolicy scope differs from pre-retention Source ownership'
        );
      }
      const record = {
        uploadId,
        sourceRef,
        rightsPolicyRef,
        sourceAudit: validAudit(input.sourceAudit, 'snapshot.sourceAudit')
      };
      if (input.retentionRightsDecisionRef) {
        const ref = assertAuthorityRef(input.retentionRightsDecisionRef);
        const decision = validateRightsDecision({ ledger: this.#ledger, rightsDecisionRef: ref });
        if (decision.semanticPayload.outcome !== 'ALLOW'
          || decision.semanticPayload.operation !== 'RETAIN_FULLTEXT'
          || !sameAuthorityRef(decision.semanticPayload.subjectRef, sourceRef)) {
          throw new RightsEnforcementError(
            'INVALID_RIGHTS_GOVERNED_UPLOAD_SNAPSHOT',
            'restored retention RightsDecision does not authorize exact Source'
          );
        }
        record.retentionRightsDecisionRef = ref;
      }
      if (staged.has(uploadId)) {
        throw new RightsEnforcementError('RIGHTS_GOVERNED_UPLOAD_COLLISION', `duplicate governed upload ${uploadId}`);
      }
      staged.set(uploadId, record);
    }
    this.#records = staged;
    return this;
  }
}

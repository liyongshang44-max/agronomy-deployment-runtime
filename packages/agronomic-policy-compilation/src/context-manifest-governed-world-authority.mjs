import { deepFreeze } from '../../canonicalization/src/index.mjs';
import { sameAuthorityRef } from '../../contracts/src/authority.mjs';
import {
  publishContextManifest,
  validateContextManifestAuthority
} from '../../context-manifest/src/index.mjs';
import {
  validateAgronomicContextDatumAssemblyPublicationAuthority
} from './context-datum-assembly-authority.mjs';
import {
  validateAgronomicDecisionProblemFarmTargetPublicationAuthority
} from './decision-problem-farm-target-binding-authority.mjs';
import {
  validateAgronomicContextTargetRefFarmInstanceProjectionCompilationAuthority
} from './context-target-ref-farm-instance-projection-authority.mjs';

export class AgronomicContextManifestGovernedWorldError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'AgronomicContextManifestGovernedWorldError';
    this.code = code;
  }
}

const PUBLISH_KEYS = new Set([
  'ledger',
  'sourceRegistry',
  'timezoneRuleEvidence',
  'decisionProblemRef',
  'contextDatumRef',
  'evidenceCutoff',
  'logicalId',
  'version',
  'principal',
  'authorizationDecisionAuditRef',
  'audit'
]);

function exactInputObject(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new AgronomicContextManifestGovernedWorldError(
      'INVALID_AGRONOMIC_CONTEXT_MANIFEST_GOVERNED_WORLD_INPUT',
      'DEC-0033 publication input must be an object'
    );
  }
  for (const key of Object.keys(value)) {
    if (!PUBLISH_KEYS.has(key)) {
      throw new AgronomicContextManifestGovernedWorldError(
        'INVALID_AGRONOMIC_CONTEXT_MANIFEST_GOVERNED_WORLD_FIELD',
        key + ' is not part of the DEC-0033 publication bridge'
      );
    }
  }
}

function requireLedger(ledger) {
  if (!ledger || typeof ledger.resolve !== 'function'
    || typeof ledger.publish !== 'function'
    || typeof ledger.auditFor !== 'function') {
    throw new AgronomicContextManifestGovernedWorldError(
      'AGRONOMIC_CONTEXT_MANIFEST_GOVERNED_WORLD_LEDGER_REQUIRED',
      'DEC-0033 requires a replayable AuthorityLedger'
    );
  }
}

function requiredText(value, name, code = 'INVALID_AGRONOMIC_CONTEXT_MANIFEST_GOVERNED_WORLD_INPUT') {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new AgronomicContextManifestGovernedWorldError(
      code,
      name + ' must be a non-empty string'
    );
  }
  return value.trim();
}

function sameScope(left, right) {
  return left?.organizationId === right?.organizationId
    && (left?.tenantId ?? null) === (right?.tenantId ?? null);
}

function requireExactRef(actual, expected, code, message) {
  if (!actual || !expected || !sameAuthorityRef(actual, expected)) {
    throw new AgronomicContextManifestGovernedWorldError(code, message);
  }
}

function validateGovernedWorld({
  ledger,
  sourceRegistry,
  timezoneRuleEvidence,
  decisionProblemRef,
  contextDatumRef
}) {
  requireLedger(ledger);

  const datum =
    validateAgronomicContextDatumAssemblyPublicationAuthority({
      ledger,
      sourceRegistry,
      contextDatumRef,
      timezoneRuleEvidence
    });

  const decision =
    validateAgronomicDecisionProblemFarmTargetPublicationAuthority({
      ledger,
      sourceRegistry,
      decisionProblemRef
    });

  const bindingPayload = decision.bindingCompilation?.semanticPayload?.binding;
  const parentProjectionRef =
    bindingPayload?.parentTargetRefFarmInstanceProjectionCompilationRef;
  if (!parentProjectionRef) {
    throw new AgronomicContextManifestGovernedWorldError(
      'AGRONOMIC_CONTEXT_MANIFEST_DEC0032_PARENT_PROJECTION_REQUIRED',
      'DEC-0032 publication authority must expose its exact DEC-0027 parent projection'
    );
  }

  const projection =
    validateAgronomicContextTargetRefFarmInstanceProjectionCompilationAuthority({
      ledger,
      sourceRegistry,
      compilationRef: parentProjectionRef
    });

  const datumSpatialRef =
    datum.assembly?.predecessorRefs?.spatialSupportClassificationCompilationRef;
  const projectionSpatialRef =
    projection.semanticPayload?.projection
      ?.parentContextSpatialSupportClassificationCompilationRef;

  requireExactRef(
    datumSpatialRef,
    projectionSpatialRef,
    'AGRONOMIC_CONTEXT_MANIFEST_FARM_LINEAGE_MISMATCH',
    'DEC-0031 ContextDatum and DEC-0032 DecisionProblem must converge on the exact same DEC-0023 FARM authority ref'
  );

  if (datum.semanticPayload?.spatialSupport?.type !== 'FARM') {
    throw new AgronomicContextManifestGovernedWorldError(
      'AGRONOMIC_CONTEXT_MANIFEST_DATUM_FARM_SUPPORT_REQUIRED',
      'DEC-0033 first world requires DEC-0031 ContextDatum spatialSupport.type = FARM'
    );
  }

  const sourceBackedTargetId =
    projection.semanticPayload?.projection?.sourceBackedTargetIdentity?.targetId;
  const projectedFarmId =
    projection.semanticPayload?.projection?.targetRefProjection?.value;

  if (!sourceBackedTargetId
    || sourceBackedTargetId !== projectedFarmId
    || sourceBackedTargetId !== decision.sourceBackedFarmId
    || decision.semanticPayload?.targetRef?.farmId !== sourceBackedTargetId) {
    throw new AgronomicContextManifestGovernedWorldError(
      'AGRONOMIC_CONTEXT_MANIFEST_SOURCE_BACKED_FARM_ID_MISMATCH',
      'DEC-0033 requires exact DEC-0027 target identity, targetRef projection and DEC-0032 farmId convergence'
    );
  }

  const datumScope =
    datum.writeAuthorization?.semanticPayload?.request?.authorizationScope;
  const decisionScope = decision.deploymentScope;

  if (!sameScope(datumScope, decisionScope)) {
    throw new AgronomicContextManifestGovernedWorldError(
      'AGRONOMIC_CONTEXT_MANIFEST_DEPLOYMENT_SCOPE_MISMATCH',
      'DEC-0031 ContextDatum and DEC-0032 DecisionProblem organization/tenant scopes must match exactly'
    );
  }

  return deepFreeze({
    datum,
    decision,
    projection,
    sharedSpatialSupportClassificationCompilationRef: datumSpatialRef,
    sourceBackedFarmId: sourceBackedTargetId,
    deploymentScope: deepFreeze({
      organizationId: decisionScope.organizationId,
      ...(decisionScope.tenantId ? { tenantId: decisionScope.tenantId } : {})
    })
  });
}

export function publishAgronomicContextManifestFromGovernedWorld(input) {
  exactInputObject(input);
  const {
    ledger,
    sourceRegistry,
    timezoneRuleEvidence,
    decisionProblemRef,
    contextDatumRef,
    evidenceCutoff,
    logicalId,
    version,
    principal,
    authorizationDecisionAuditRef,
    audit
  } = input;

  requiredText(
    evidenceCutoff,
    'evidenceCutoff',
    'AGRONOMIC_CONTEXT_MANIFEST_EVIDENCE_CUTOFF_REQUIRED'
  );

  const world = validateGovernedWorld({
    ledger,
    sourceRegistry,
    timezoneRuleEvidence,
    decisionProblemRef,
    contextDatumRef
  });

  return publishContextManifest({
    ledger,
    logicalId,
    version,
    decisionProblemRef: world.decision.decisionProblem.ref,
    evidenceCutoff,
    datumRefs: [world.datum.contextDatum.ref],
    resolvedReferenceReceiptRefs: [],
    principal,
    authorizationDecisionAuditRef,
    audit
  });
}

export function validateAgronomicContextManifestGovernedWorldAuthority({
  ledger,
  sourceRegistry,
  timezoneRuleEvidence,
  contextManifestRef,
  snapshotStore
}) {
  requireLedger(ledger);

  const manifest = validateContextManifestAuthority({
    ledger,
    contextManifestRef,
    snapshotStore
  });
  const payload = manifest.semanticPayload;

  if (!Array.isArray(payload.datumRefs)
    || payload.datumRefs.length !== 1
    || !Array.isArray(payload.resolvedReferenceReceiptRefs)
    || payload.resolvedReferenceReceiptRefs.length !== 0) {
    throw new AgronomicContextManifestGovernedWorldError(
      'AGRONOMIC_CONTEXT_MANIFEST_FIRST_WORLD_MEMBERSHIP_INVALID',
      'DEC-0033 first world requires exactly one ContextDatum and zero resolved receipts'
    );
  }

  const world = validateGovernedWorld({
    ledger,
    sourceRegistry,
    timezoneRuleEvidence,
    decisionProblemRef: payload.decisionProblemRef,
    contextDatumRef: payload.datumRefs[0]
  });

  requireExactRef(
    payload.decisionProblemRef,
    world.decision.decisionProblem.ref,
    'AGRONOMIC_CONTEXT_MANIFEST_DECISION_PROBLEM_REF_MISMATCH',
    'ContextManifest must freeze the exact DEC-0032 DecisionProblem ref'
  );
  requireExactRef(
    payload.datumRefs[0],
    world.datum.contextDatum.ref,
    'AGRONOMIC_CONTEXT_MANIFEST_CONTEXT_DATUM_REF_MISMATCH',
    'ContextManifest must freeze the exact DEC-0031 ContextDatum ref'
  );

  if (!sameScope(world.deploymentScope, payload.targetRef)) {
    throw new AgronomicContextManifestGovernedWorldError(
      'AGRONOMIC_CONTEXT_MANIFEST_TARGET_SCOPE_MISMATCH',
      'ContextManifest target organization/tenant must equal the exact governed deployment scope'
    );
  }
  if (payload.targetRef?.farmId !== world.sourceBackedFarmId) {
    throw new AgronomicContextManifestGovernedWorldError(
      'AGRONOMIC_CONTEXT_MANIFEST_TARGET_FARM_ID_MISMATCH',
      'ContextManifest target farmId must equal the exact DEC-0027 source-backed target id'
    );
  }

  return deepFreeze({
    manifest,
    contextDatum: world.datum.contextDatum,
    decisionProblem: world.decision.decisionProblem,
    targetRefFarmInstanceProjection: world.projection.record,
    sharedSpatialSupportClassificationCompilationRef:
      world.sharedSpatialSupportClassificationCompilationRef,
    sourceBackedFarmId: world.sourceBackedFarmId,
    deploymentScope: world.deploymentScope,
    evidenceCutoff: payload.evidenceCutoff,
    classification: 'RETROSPECTIVE_MACHINE_ACCEPTANCE_CONTEXT_WORLD'
  });
}

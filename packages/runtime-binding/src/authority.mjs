import {
  canonicalizeSemanticJson,
  deepFreeze,
  semanticHash
} from '../../canonicalization/src/index.mjs';
import { assertAuthorityRef, sameAuthorityRef } from '../../contracts/src/authority.mjs';
import {
  normalizeRuntimeEligibility,
  validateRuntimeEligibility
} from '../../runtime-eligibility/src/index.mjs';
import {
  RUNTIME_BINDING_AUTHORITY_CLASS,
  RUNTIME_BINDING_CONTRACT_VERSION,
  RuntimeBindingError,
  normalizeRuntimeBinding,
  runtimeBindingExactRefs,
  text
} from './contract.mjs';

const PUBLISH_KEYS = new Set([
  'ledger', 'logicalId', 'version', 'runtimeEligibilityRef',
  'selectedAlternativePathId', 'snapshotStore', 'audit'
]);

function assertPublishInput(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new RuntimeBindingError('INVALID_RUNTIME_BINDING_INPUT', 'RuntimeBinding publication input must be an object');
  }
  for (const key of Object.keys(input)) {
    if (!PUBLISH_KEYS.has(key)) {
      throw new RuntimeBindingError(
        'INVALID_RUNTIME_BINDING_PUBLICATION_FIELD',
        `${key} is not a legal D01 publication input; callers cannot override frozen authority refs or embed downstream outputs`
      );
    }
  }
}

function refKey(ref) {
  return canonicalizeSemanticJson(assertAuthorityRef(ref));
}

function canonicalRefs(values) {
  const map = new Map();
  for (const ref of values) {
    const normalized = assertAuthorityRef(ref);
    map.set(refKey(normalized), normalized);
  }
  return deepFreeze([...map.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([, ref]) => ref));
}

function sameRefSet(left, right) {
  if (!Array.isArray(left) || !Array.isArray(right)) return false;
  const a = canonicalRefs(left).map(refKey);
  const b = canonicalRefs(right).map(refKey);
  return a.length === b.length && a.every((value, index) => value === b[index]);
}

function assertRecordHash(record, code) {
  if (semanticHash(record.ref.kind, record.semanticPayload) !== record.ref.semanticHash) {
    throw new RuntimeBindingError(code, `${record.ref.kind} stored payload does not reproduce exact semantic hash`);
  }
}

function selectedLegalAlternative(eligibility, selectedAlternativePathId) {
  const pathId = text(selectedAlternativePathId, 'selectedAlternativePathId');
  const selected = eligibility.semanticPayload.alternativeEvaluations.find((item) => item.pathId === pathId);
  if (!selected) {
    throw new RuntimeBindingError(
      'RUNTIME_BINDING_SELECTED_PATH_NOT_FOUND',
      'selectedAlternativePathId must identify one exact alternative in the bound RuntimeEligibility'
    );
  }
  if (!['LEGAL', 'LEGAL_WITH_LIMITATIONS'].includes(selected.disposition)) {
    throw new RuntimeBindingError(
      'RUNTIME_BINDING_SELECTED_PATH_NOT_LEGAL',
      `selected alternative ${pathId} has disposition ${selected.disposition}; RuntimeBinding requires a fully adjudicated legal world`
    );
  }
  if (selected.informationRequirements.length !== 0 || selected.reasonCodes.length !== 0 || selected.reasonDetails.length !== 0) {
    throw new RuntimeBindingError(
      'RUNTIME_BINDING_SELECTED_PATH_UNRESOLVED',
      'selected legal RuntimeBinding path cannot retain InformationRequirements or hard-blocker reason state'
    );
  }
  return selected;
}

function exactRuntimePlanPath(eligibility, selected) {
  const planPath = eligibility.runtimePlan.alternativePaths.find((item) => item.pathId === selected.pathId);
  if (!planPath
    || !sameAuthorityRef(planPath.knowledgeRef, selected.knowledgeRef)
    || !sameAuthorityRef(planPath.applicabilityAssessmentRef, selected.applicabilityAssessmentRef)) {
    throw new RuntimeBindingError(
      'RUNTIME_BINDING_PLAN_PATH_MISMATCH',
      'selected RuntimeEligibility alternative must exactly reproduce one RuntimePlan candidate path'
    );
  }
  return planPath;
}

function bindingPayload({ eligibility, selected, manifest }) {
  return {
    contractVersion: RUNTIME_BINDING_CONTRACT_VERSION,
    authorityClass: RUNTIME_BINDING_AUTHORITY_CLASS,
    runtimeEligibilityRef: eligibility.record.ref,
    runtimePlanRef: eligibility.semanticPayload.planRef,
    selectedAlternativePathId: selected.pathId,
    decisionProblemRef: eligibility.semanticPayload.decisionProblemRef,
    deploymentRef: eligibility.semanticPayload.deploymentRef,
    runtimeProfileRef: eligibility.semanticPayload.runtimeProfileRef,
    knowledgeReleaseRef: eligibility.retrievalAuthority.semanticPayload.knowledgeReleaseRef,
    contextManifestRef: eligibility.semanticPayload.contextManifestRef,
    knowledgeBindings: [{
      knowledgeRef: selected.knowledgeRef,
      applicabilityAssessmentRef: selected.applicabilityAssessmentRef
    }],
    transformationBindings: [],
    modelBindings: [],
    policyBindings: [],
    implementationBindings: [],
    calibrationBindings: [],
    logicalTime: manifest.semanticPayload.logicalTime,
    evidenceCutoff: manifest.semanticPayload.evidenceCutoff,
    limitations: selected.limitations,
    assumptions: [],
    correctnessClaim: 'NONE_BINDING_PROVES_WHAT_WAS_USED_NOT_SCIENTIFIC_CORRECTNESS',
    unresolvedAlternativeCount: 0
  };
}

function buildCurrentBindingWorld({ ledger, runtimeEligibilityRef, selectedAlternativePathId, snapshotStore }) {
  const eligibility = validateRuntimeEligibility({
    ledger,
    runtimeEligibilityRef,
    snapshotStore
  });
  if (!['RUNTIME_ELIGIBLE', 'RUNTIME_ELIGIBLE_WITH_LIMITATIONS'].includes(eligibility.semanticPayload.runtimeEligibility)) {
    throw new RuntimeBindingError(
      'RUNTIME_BINDING_RUNTIME_NOT_ELIGIBLE',
      `RuntimeBinding cannot be created from ${eligibility.semanticPayload.runtimeEligibility}`
    );
  }
  const selected = selectedLegalAlternative(eligibility, selectedAlternativePathId);
  exactRuntimePlanPath(eligibility, selected);
  const manifest = ledger.resolve(eligibility.semanticPayload.contextManifestRef);
  if (manifest.ref.kind !== 'ContextManifest') {
    throw new RuntimeBindingError('RUNTIME_BINDING_CONTEXT_MANIFEST_REQUIRED', 'exact RuntimeEligibility context must resolve to ContextManifest');
  }
  assertRecordHash(manifest, 'RUNTIME_BINDING_CONTEXT_MANIFEST_HASH_MISMATCH');
  const payload = normalizeRuntimeBinding(bindingPayload({ eligibility, selected, manifest }));
  return deepFreeze({ eligibility, selected, manifest, payload });
}

function expectedEligibilityAuditInputs(payload, runtimeAuthorizationRef) {
  return canonicalRefs([
    payload.decisionProblemRef,
    payload.deploymentRef,
    payload.runtimeProfileRef,
    payload.contextManifestRef,
    payload.knowledgeRetrievalResultRef,
    ...payload.applicabilityAssessmentRefs,
    runtimeAuthorizationRef
  ]);
}

function eligibilityHistoricalAuthorization(ledger, eligibilityRecord, eligibilityPayload) {
  const candidates = ledger.auditFor(eligibilityRecord.ref).filter((event) =>
    sameAuthorityRef(event.objectRef, eligibilityRecord.ref)
      && event.action === 'PUBLISH_RUNTIME_ELIGIBILITY'
      && event.details?.runtimeEligibilityPrincipal
      && event.details?.runtimeAuthorizationDecisionAuditRef);

  for (const event of candidates) {
    try {
      const principal = event.details.runtimeEligibilityPrincipal;
      if (!principal
        || event.actor?.id !== principal.principalId
        || event.actor?.type !== principal.type
        || canonicalizeSemanticJson(event.details?.planRef) !== canonicalizeSemanticJson(eligibilityPayload.planRef)
        || event.details?.runtimeEligibility !== eligibilityPayload.runtimeEligibility) {
        continue;
      }
      const runtimeAuthorizationRef = assertAuthorityRef(event.details.runtimeAuthorizationDecisionAuditRef);
      if (runtimeAuthorizationRef.kind !== 'AuthorizationDecisionAudit') continue;
      const runtimeAuthorizationRecord = ledger.resolve(runtimeAuthorizationRef);
      assertRecordHash(runtimeAuthorizationRecord, 'RUNTIME_BINDING_RUNTIME_AUTHORIZATION_HASH_MISMATCH');
      const expectedInputs = expectedEligibilityAuditInputs(eligibilityPayload, runtimeAuthorizationRef);
      if (!sameRefSet(event.inputRefs, expectedInputs)) continue;
      return deepFreeze({ principal, runtimeAuthorizationRef });
    } catch {
      continue;
    }
  }

  throw new RuntimeBindingError(
    'RUNTIME_BINDING_ELIGIBILITY_AUDIT_REQUIRED',
    'historical RuntimeBinding replay requires an exact RuntimeEligibility publication audit over its frozen plan world and runtime authorization'
  );
}

function expectedAuditInputs(payload, runtimeAuthorizationRef) {
  return canonicalRefs([
    ...runtimeBindingExactRefs(payload),
    runtimeAuthorizationRef
  ]);
}

export function publishRuntimeBinding(input) {
  assertPublishInput(input);
  const {
    ledger,
    logicalId,
    version,
    runtimeEligibilityRef,
    selectedAlternativePathId,
    snapshotStore,
    audit
  } = input;
  if (!ledger || typeof ledger.publish !== 'function' || typeof ledger.resolve !== 'function' || typeof ledger.auditFor !== 'function') {
    throw new RuntimeBindingError('INVALID_LEDGER', 'D01 publication requires a replayable AuthorityLedger');
  }
  const world = buildCurrentBindingWorld({
    ledger,
    runtimeEligibilityRef,
    selectedAlternativePathId,
    snapshotStore
  });
  const actor = world.eligibility.runtimeEligibilityPrincipal;
  if (!audit || audit.actor?.id !== actor.principalId || audit.actor?.type !== actor.type) {
    throw new RuntimeBindingError(
      'RUNTIME_BINDING_AUDIT_ACTOR_MISMATCH',
      'RuntimeBinding publication actor must equal the exact runtime principal that published RuntimeEligibility'
    );
  }
  const runtimeAuthorizationRef = world.eligibility.retrievalAuthority.runtimeAuthorization.ref;
  const inputRefs = expectedAuditInputs(world.payload, runtimeAuthorizationRef);
  return ledger.publish({
    kind: 'RuntimeBinding',
    logicalId: text(logicalId, 'logicalId'),
    version: text(version, 'version'),
    semanticPayload: world.payload,
    audit: {
      ...audit,
      action: 'PUBLISH_RUNTIME_BINDING',
      inputRefs,
      details: {
        ...(audit.details ?? {}),
        runtimeBindingPrincipal: actor,
        runtimeAuthorizationDecisionAuditRef: runtimeAuthorizationRef,
        runtimeEligibilityRef: world.eligibility.record.ref,
        selectedAlternativePathId: world.selected.pathId,
        selectionAuthorityClass: 'RUNTIME_COMPOSITION_SELECTION_NOT_DECISION',
        correctnessClaim: world.payload.correctnessClaim
      }
    }
  });
}

export function validateRuntimeBinding({ ledger, runtimeBindingRef }) {
  if (!ledger || typeof ledger.resolve !== 'function' || typeof ledger.auditFor !== 'function') {
    throw new RuntimeBindingError('INVALID_LEDGER', 'D01 validation requires a replayable AuthorityLedger');
  }
  const ref = assertAuthorityRef(runtimeBindingRef);
  const record = ledger.resolve(ref);
  if (record.ref.kind !== 'RuntimeBinding') {
    throw new RuntimeBindingError('RUNTIME_BINDING_REQUIRED', 'expected exact RuntimeBinding authority ref');
  }
  const payload = normalizeRuntimeBinding(record.semanticPayload);
  if (semanticHash('RuntimeBinding', payload) !== record.ref.semanticHash) {
    throw new RuntimeBindingError('RUNTIME_BINDING_SEMANTIC_HASH_MISMATCH', 'stored RuntimeBinding does not reproduce its semantic identity');
  }

  const eligibilityRecord = ledger.resolve(payload.runtimeEligibilityRef);
  if (eligibilityRecord.ref.kind !== 'RuntimeEligibility') {
    throw new RuntimeBindingError('RUNTIME_BINDING_ELIGIBILITY_REQUIRED', 'frozen runtimeEligibilityRef must resolve exactly');
  }
  const eligibilityPayload = normalizeRuntimeEligibility(eligibilityRecord.semanticPayload);
  if (semanticHash('RuntimeEligibility', eligibilityPayload) !== eligibilityRecord.ref.semanticHash) {
    throw new RuntimeBindingError('RUNTIME_BINDING_ELIGIBILITY_HASH_MISMATCH', 'frozen RuntimeEligibility does not reproduce its exact historical hash');
  }
  if (canonicalizeSemanticJson(eligibilityPayload.planRef) !== canonicalizeSemanticJson(payload.runtimePlanRef)
    || !sameAuthorityRef(eligibilityPayload.decisionProblemRef, payload.decisionProblemRef)
    || !sameAuthorityRef(eligibilityPayload.deploymentRef, payload.deploymentRef)
    || !sameAuthorityRef(eligibilityPayload.runtimeProfileRef, payload.runtimeProfileRef)
    || !sameAuthorityRef(eligibilityPayload.contextManifestRef, payload.contextManifestRef)) {
    throw new RuntimeBindingError('RUNTIME_BINDING_ELIGIBILITY_WORLD_MISMATCH', 'frozen RuntimeBinding control/context refs must equal exact historical RuntimeEligibility world');
  }
  const selected = eligibilityPayload.alternativeEvaluations.find((item) => item.pathId === payload.selectedAlternativePathId);
  if (!selected || !['LEGAL', 'LEGAL_WITH_LIMITATIONS'].includes(selected.disposition)) {
    throw new RuntimeBindingError('RUNTIME_BINDING_HISTORICAL_PATH_NOT_LEGAL', 'frozen selected path must have been legal in exact historical RuntimeEligibility');
  }
  const knowledgeBinding = payload.knowledgeBindings[0];
  if (!sameAuthorityRef(selected.knowledgeRef, knowledgeBinding.knowledgeRef)
    || !sameAuthorityRef(selected.applicabilityAssessmentRef, knowledgeBinding.applicabilityAssessmentRef)
    || canonicalizeSemanticJson(selected.limitations) !== canonicalizeSemanticJson(payload.limitations)) {
    throw new RuntimeBindingError('RUNTIME_BINDING_HISTORICAL_SELECTION_MISMATCH', 'frozen knowledge/applicability/limitations must exactly match selected historical path');
  }

  const retrievalRecord = ledger.resolve(eligibilityPayload.knowledgeRetrievalResultRef);
  if (retrievalRecord.ref.kind !== 'KnowledgeRetrievalResult') {
    throw new RuntimeBindingError('RUNTIME_BINDING_RETRIEVAL_REQUIRED', 'historical RuntimeEligibility retrieval ref must resolve exactly');
  }
  assertRecordHash(retrievalRecord, 'RUNTIME_BINDING_RETRIEVAL_HASH_MISMATCH');
  if (!sameAuthorityRef(retrievalRecord.semanticPayload.knowledgeReleaseRef, payload.knowledgeReleaseRef)) {
    throw new RuntimeBindingError('RUNTIME_BINDING_RELEASE_MISMATCH', 'RuntimeBinding KnowledgeRelease must equal exact historical retrieval release');
  }

  const manifestRecord = ledger.resolve(payload.contextManifestRef);
  assertRecordHash(manifestRecord, 'RUNTIME_BINDING_CONTEXT_MANIFEST_HASH_MISMATCH');
  if (manifestRecord.ref.kind !== 'ContextManifest'
    || manifestRecord.semanticPayload.logicalTime !== payload.logicalTime
    || manifestRecord.semanticPayload.evidenceCutoff !== payload.evidenceCutoff) {
    throw new RuntimeBindingError('RUNTIME_BINDING_TIME_CONTEXT_MISMATCH', 'logicalTime/evidenceCutoff must equal exact frozen ContextManifest');
  }

  for (const exactRef of runtimeBindingExactRefs(payload)) {
    const exactRecord = ledger.resolve(exactRef);
    assertRecordHash(exactRecord, 'RUNTIME_BINDING_FROZEN_REF_HASH_MISMATCH');
  }

  const historicalAuthorization = eligibilityHistoricalAuthorization(ledger, eligibilityRecord, eligibilityPayload);
  const expectedInputs = expectedAuditInputs(payload, historicalAuthorization.runtimeAuthorizationRef);
  const validAudit = ledger.auditFor(record.ref).some((event) =>
    sameAuthorityRef(event.objectRef, record.ref)
      && event.action === 'PUBLISH_RUNTIME_BINDING'
      && event.actor?.id === historicalAuthorization.principal.principalId
      && event.actor?.type === historicalAuthorization.principal.type
      && event.details?.runtimeBindingPrincipal?.principalId === historicalAuthorization.principal.principalId
      && event.details?.runtimeBindingPrincipal?.type === historicalAuthorization.principal.type
      && event.details?.runtimeAuthorizationDecisionAuditRef
      && sameAuthorityRef(event.details.runtimeAuthorizationDecisionAuditRef, historicalAuthorization.runtimeAuthorizationRef)
      && event.details?.runtimeEligibilityRef
      && sameAuthorityRef(event.details.runtimeEligibilityRef, payload.runtimeEligibilityRef)
      && event.details?.selectedAlternativePathId === payload.selectedAlternativePathId
      && event.details?.selectionAuthorityClass === 'RUNTIME_COMPOSITION_SELECTION_NOT_DECISION'
      && event.details?.correctnessClaim === payload.correctnessClaim
      && sameRefSet(event.inputRefs, expectedInputs));
  if (!validAudit) {
    throw new RuntimeBindingError(
      'RUNTIME_BINDING_PUBLICATION_AUTHORITY_INVALID',
      'RuntimeBinding lacks exact historical runtime-principal audit closure over frozen material authorities'
    );
  }

  return deepFreeze({
    record,
    semanticPayload: payload,
    historicalRuntimeEligibility: eligibilityRecord,
    selectedHistoricalAlternative: selected,
    runtimeBindingPrincipal: historicalAuthorization.principal,
    runtimeAuthorizationDecisionAuditRef: historicalAuthorization.runtimeAuthorizationRef,
    replayMode: 'EXACT_FROZEN_HISTORICAL_AUTHORITIES_NO_LATEST_LOOKUP'
  });
}

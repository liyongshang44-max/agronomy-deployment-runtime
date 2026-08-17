import {
  canonicalizeSemanticJson,
  cloneCanonicalValue,
  deepFreeze,
  semanticHash
} from '../../canonicalization/src/index.mjs';
import { assertAuthorityRef, sameAuthorityRef } from '../../contracts/src/authority.mjs';
import { normalizeRuntimeEligibility } from '../../runtime-eligibility/src/index.mjs';
import { validateRuntimeBinding } from '../../runtime-binding/src/index.mjs';
import {
  RUNTIME_ALTERNATIVE_SET_AUTHORITY_CLASS,
  RUNTIME_ALTERNATIVE_SET_CONTRACT_VERSION,
  RuntimeAlternativeSetError,
  materialUncertaintyDimensionId,
  normalizeRuntimeAlternativeSet,
  runtimeAlternativeSetExactRefs
} from './contract.mjs';

const PUBLISH_KEYS = new Set([
  'ledger', 'logicalId', 'version', 'runtimeEligibilityRef', 'includedRuntimeBindingRefs', 'audit'
]);
const LEGAL_DISPOSITIONS = new Set(['LEGAL', 'LEGAL_WITH_LIMITATIONS']);

function text(value, name) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new RuntimeAlternativeSetError('INVALID_RUNTIME_ALTERNATIVE_SET_INPUT', `${name} must be a non-empty string`);
  }
  return value.trim();
}

function exactPublishInput(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new RuntimeAlternativeSetError('INVALID_RUNTIME_ALTERNATIVE_SET_INPUT', 'publication input must be an object');
  }
  for (const key of Object.keys(input)) {
    if (!PUBLISH_KEYS.has(key)) {
      throw new RuntimeAlternativeSetError(
        'INVALID_RUNTIME_ALTERNATIVE_SET_PUBLICATION_FIELD',
        `${key} is not a legal D04 publication input; callers cannot self-author completeness, probability or coverage claims`
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

function canonicalBindingRefs(values) {
  if (!Array.isArray(values)) {
    throw new RuntimeAlternativeSetError(
      'INVALID_RUNTIME_ALTERNATIVE_SET_BINDING_REFS',
      'includedRuntimeBindingRefs must be an array'
    );
  }
  const refs = values.map((value, index) => {
    const ref = assertAuthorityRef(value);
    if (ref.kind !== 'RuntimeBinding') {
      throw new RuntimeAlternativeSetError(
        'INVALID_RUNTIME_ALTERNATIVE_SET_BINDING_REF',
        `includedRuntimeBindingRefs[${index}] must be exact RuntimeBinding authority`
      );
    }
    return ref;
  });
  const keys = refs.map(refKey);
  if (new Set(keys).size !== keys.length) {
    throw new RuntimeAlternativeSetError(
      'DUPLICATE_RUNTIME_ALTERNATIVE_BINDING_REF',
      'includedRuntimeBindingRefs cannot contain duplicate exact refs'
    );
  }
  return deepFreeze([...refs].sort((left, right) => refKey(left).localeCompare(refKey(right))));
}

function assertRecordHash(record, code) {
  if (semanticHash(record.ref.kind, record.semanticPayload) !== record.ref.semanticHash) {
    throw new RuntimeAlternativeSetError(code, `${record.ref.kind} stored payload does not reproduce exact semantic hash`);
  }
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

function historicalEligibilityAuthorization(ledger, record, payload) {
  const candidates = ledger.auditFor(record.ref).filter((event) =>
    sameAuthorityRef(event.objectRef, record.ref)
      && event.action === 'PUBLISH_RUNTIME_ELIGIBILITY'
      && event.details?.runtimeEligibilityPrincipal
      && event.details?.runtimeAuthorizationDecisionAuditRef);
  for (const event of candidates) {
    try {
      const principal = event.details.runtimeEligibilityPrincipal;
      if (!principal
        || event.actor?.id !== principal.principalId
        || event.actor?.type !== principal.type
        || canonicalizeSemanticJson(event.details?.planRef) !== canonicalizeSemanticJson(payload.planRef)
        || event.details?.runtimeEligibility !== payload.runtimeEligibility) {
        continue;
      }
      const runtimeAuthorizationRef = assertAuthorityRef(event.details.runtimeAuthorizationDecisionAuditRef);
      if (runtimeAuthorizationRef.kind !== 'AuthorizationDecisionAudit') continue;
      const runtimeAuthorizationRecord = ledger.resolve(runtimeAuthorizationRef);
      assertRecordHash(runtimeAuthorizationRecord, 'RUNTIME_ALTERNATIVE_SET_RUNTIME_AUTHORIZATION_HASH_MISMATCH');
      if (!sameRefSet(event.inputRefs, expectedEligibilityAuditInputs(payload, runtimeAuthorizationRef))) continue;
      return deepFreeze({ principal: cloneCanonicalValue(principal), runtimeAuthorizationRef });
    } catch {
      continue;
    }
  }
  throw new RuntimeAlternativeSetError(
    'RUNTIME_ALTERNATIVE_SET_ELIGIBILITY_AUDIT_REQUIRED',
    'D04 requires exact historical RuntimeEligibility publication authority over the frozen path universe'
  );
}

function historicalEligibilityWorld(ledger, runtimeEligibilityRef) {
  const ref = assertAuthorityRef(runtimeEligibilityRef);
  const record = ledger.resolve(ref);
  if (record.ref.kind !== 'RuntimeEligibility') {
    throw new RuntimeAlternativeSetError(
      'RUNTIME_ALTERNATIVE_SET_ELIGIBILITY_REQUIRED',
      'runtimeEligibilityRef must resolve to exact RuntimeEligibility authority'
    );
  }
  const payload = normalizeRuntimeEligibility(record.semanticPayload);
  if (semanticHash('RuntimeEligibility', payload) !== record.ref.semanticHash) {
    throw new RuntimeAlternativeSetError(
      'RUNTIME_ALTERNATIVE_SET_ELIGIBILITY_HASH_MISMATCH',
      'historical RuntimeEligibility payload does not reproduce its exact authority ref'
    );
  }
  const authorization = historicalEligibilityAuthorization(ledger, record, payload);
  return deepFreeze({ record, payload, authorization });
}

function makeDimension(core) {
  return deepFreeze({ dimensionId: materialUncertaintyDimensionId(core), ...core });
}

function materialDimensions(ledger, eligibility) {
  const dimensions = [];
  const pathIds = eligibility.payload.alternativeEvaluations.map((item) => item.pathId).sort();
  if (pathIds.length > 1) {
    dimensions.push(makeDimension({
      dimensionType: 'RUNTIME_PLAN_ALTERNATIVE',
      pathIds: deepFreeze(pathIds)
    }));
  }
  for (const alternative of eligibility.payload.alternativeEvaluations) {
    const assessment = ledger.resolve(alternative.applicabilityAssessmentRef);
    if (assessment.ref.kind !== 'ApplicabilityAssessment') {
      throw new RuntimeAlternativeSetError(
        'RUNTIME_ALTERNATIVE_SET_APPLICABILITY_REQUIRED',
        'each RuntimeEligibility alternative must retain exact ApplicabilityAssessment authority'
      );
    }
    assertRecordHash(assessment, 'RUNTIME_ALTERNATIVE_SET_APPLICABILITY_HASH_MISMATCH');
    const conflicts = assessment.semanticPayload.conflicts ?? [];
    if (!Array.isArray(conflicts)) {
      throw new RuntimeAlternativeSetError(
        'RUNTIME_ALTERNATIVE_SET_APPLICABILITY_CONFLICTS_INVALID',
        'ApplicabilityAssessment conflicts must remain an array'
      );
    }
    for (const conflict of conflicts) {
      dimensions.push(makeDimension({
        dimensionType: 'APPLICABILITY_CONFLICT',
        pathIds: deepFreeze([alternative.pathId]),
        sourceApplicabilityAssessmentRef: alternative.applicabilityAssessmentRef,
        detail: cloneCanonicalValue(conflict)
      }));
    }
  }
  const keyed = dimensions.map((dimension) => [dimension.dimensionId, dimension]);
  return deepFreeze([...new Map(keyed).entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([, dimension]) => dimension));
}

function includedBindingsForWorld({ ledger, eligibility, includedRuntimeBindingRefs }) {
  const refs = canonicalBindingRefs(includedRuntimeBindingRefs);
  const byPath = new Map();
  const included = [];
  for (const ref of refs) {
    const binding = validateRuntimeBinding({ ledger, runtimeBindingRef: ref });
    const payload = binding.semanticPayload;
    if (!sameAuthorityRef(payload.runtimeEligibilityRef, eligibility.record.ref)) {
      throw new RuntimeAlternativeSetError(
        'RUNTIME_ALTERNATIVE_SET_BINDING_ELIGIBILITY_MISMATCH',
        'every included RuntimeBinding must originate from the exact frozen RuntimeEligibility universe'
      );
    }
    if (canonicalizeSemanticJson(payload.runtimePlanRef) !== canonicalizeSemanticJson(eligibility.payload.planRef)
      || !sameAuthorityRef(payload.decisionProblemRef, eligibility.payload.decisionProblemRef)
      || !sameAuthorityRef(payload.deploymentRef, eligibility.payload.deploymentRef)
      || !sameAuthorityRef(payload.runtimeProfileRef, eligibility.payload.runtimeProfileRef)
      || !sameAuthorityRef(payload.contextManifestRef, eligibility.payload.contextManifestRef)) {
      throw new RuntimeAlternativeSetError(
        'RUNTIME_ALTERNATIVE_SET_BINDING_WORLD_MISMATCH',
        'included RuntimeBinding control/context/plan world must equal exact RuntimeEligibility world'
      );
    }
    const pathId = payload.selectedAlternativePathId;
    if (byPath.has(pathId)) {
      throw new RuntimeAlternativeSetError(
        'DUPLICATE_RUNTIME_ALTERNATIVE_PATH_BINDING',
        'D04 v1 bounded semantic-path domain admits one exact RuntimeBinding per RuntimePlan path; implementation variance requires a separate governed dimension'
      );
    }
    const alternative = eligibility.payload.alternativeEvaluations.find((item) => item.pathId === pathId);
    if (!alternative || !LEGAL_DISPOSITIONS.has(alternative.disposition)) {
      throw new RuntimeAlternativeSetError(
        'RUNTIME_ALTERNATIVE_SET_INCLUDED_PATH_NOT_LEGAL',
        'included RuntimeBinding must select one exact historically legal RuntimeEligibility path'
      );
    }
    const knowledgeBinding = payload.knowledgeBindings[0];
    if (!sameAuthorityRef(knowledgeBinding.knowledgeRef, alternative.knowledgeRef)
      || !sameAuthorityRef(knowledgeBinding.applicabilityAssessmentRef, alternative.applicabilityAssessmentRef)) {
      throw new RuntimeAlternativeSetError(
        'RUNTIME_ALTERNATIVE_SET_BINDING_PATH_LINEAGE_MISMATCH',
        'included RuntimeBinding knowledge/applicability lineage must equal the exact RuntimeEligibility path'
      );
    }
    byPath.set(pathId, binding);
    included.push(deepFreeze({
      pathId,
      runtimeBindingRef: binding.record.ref,
      knowledgeRef: alternative.knowledgeRef,
      applicabilityAssessmentRef: alternative.applicabilityAssessmentRef
    }));
  }
  return deepFreeze({
    byPath,
    bindings: deepFreeze([...byPath.values()]),
    included: deepFreeze(included.sort((left, right) => left.pathId.localeCompare(right.pathId)))
  });
}

function excludedCandidates(eligibility, includedByPath) {
  return deepFreeze(eligibility.payload.alternativeEvaluations
    .filter((alternative) => !includedByPath.has(alternative.pathId))
    .map((alternative) => {
      const exclusionReasonCodes = LEGAL_DISPOSITIONS.has(alternative.disposition)
        ? ['LEGAL_PATH_BINDING_NOT_INCLUDED']
        : alternative.disposition === 'INFORMATION_REQUIRED'
          ? ['INFORMATION_REQUIRED']
          : ['NO_LEGAL_RUNTIME'];
      return deepFreeze({
        pathId: alternative.pathId,
        knowledgeRef: alternative.knowledgeRef,
        applicabilityAssessmentRef: alternative.applicabilityAssessmentRef,
        pathDisposition: alternative.disposition,
        exclusionReasonCodes: deepFreeze(exclusionReasonCodes),
        sourceReasonCodes: deepFreeze([...(alternative.reasonCodes ?? [])].sort())
      });
    })
    .sort((left, right) => left.pathId.localeCompare(right.pathId)));
}

function coverageLedger(eligibility, included, excluded) {
  const candidatePathIds = eligibility.payload.alternativeEvaluations.map((item) => item.pathId).sort();
  const legalPathIds = eligibility.payload.alternativeEvaluations
    .filter((item) => LEGAL_DISPOSITIONS.has(item.disposition))
    .map((item) => item.pathId)
    .sort();
  const includedPathIds = included.map((item) => item.pathId).sort();
  const uncoveredLegalPathIds = excluded
    .filter((item) => LEGAL_DISPOSITIONS.has(item.pathDisposition))
    .map((item) => item.pathId)
    .sort();
  return deepFreeze({
    candidatePathIds: deepFreeze(candidatePathIds),
    legalPathIds: deepFreeze(legalPathIds),
    includedPathIds: deepFreeze(includedPathIds),
    uncoveredLegalPathIds: deepFreeze(uncoveredLegalPathIds)
  });
}

function buildHistoricalCoverageWorld({ ledger, runtimeEligibilityRef, includedRuntimeBindingRefs }) {
  if (!ledger || typeof ledger.resolve !== 'function' || typeof ledger.auditFor !== 'function') {
    throw new RuntimeAlternativeSetError('INVALID_LEDGER', 'D04 requires a replayable AuthorityLedger');
  }
  const eligibility = historicalEligibilityWorld(ledger, runtimeEligibilityRef);
  const includedWorld = includedBindingsForWorld({ ledger, eligibility, includedRuntimeBindingRefs });
  const excluded = excludedCandidates(eligibility, includedWorld.byPath);
  const coverage = coverageLedger(eligibility, includedWorld.included, excluded);
  const completenessClass = coverage.uncoveredLegalPathIds.length === 0
    ? 'EXHAUSTIVE_ENUMERATION'
    : 'INCOMPLETE';
  const payload = normalizeRuntimeAlternativeSet({
    contractVersion: RUNTIME_ALTERNATIVE_SET_CONTRACT_VERSION,
    authorityClass: RUNTIME_ALTERNATIVE_SET_AUTHORITY_CLASS,
    decisionProblemRef: eligibility.payload.decisionProblemRef,
    deploymentRef: eligibility.payload.deploymentRef,
    runtimeProfileRef: eligibility.payload.runtimeProfileRef,
    contextManifestRef: eligibility.payload.contextManifestRef,
    runtimePlanRef: eligibility.payload.planRef,
    runtimeEligibilityRef: eligibility.record.ref,
    generationMethod: {
      methodId: 'ADR_RUNTIME_ALTERNATIVE_ENUMERATOR',
      methodVersion: '1',
      runtimePlanCompilerVersion: eligibility.payload.planRef.compilerVersion,
      universeBasis: 'EXACT_RUNTIME_PLAN_PATHS_ADJUDICATED_BY_RUNTIME_ELIGIBILITY',
      implementationVarianceSemantics: 'OUTSIDE_D04_V1_COVERAGE_DOMAIN_REQUIRES_SEPARATE_GOVERNED_DIMENSION'
    },
    materialUncertaintyDimensions: materialDimensions(ledger, eligibility),
    includedBindings: includedWorld.included,
    excludedCandidates: excluded,
    coverage,
    completenessClass,
    robustnessClaim: 'NONE_COVERAGE_AUTHORITY_IS_NOT_DECISION_ROBUSTNESS'
  });
  return deepFreeze({ eligibility, includedWorld, payload });
}

function expectedAuditInputs(payload, runtimeAuthorizationRef) {
  return canonicalRefs([
    ...runtimeAlternativeSetExactRefs(payload),
    runtimeAuthorizationRef
  ]);
}

export function publishRuntimeAlternativeSet(input) {
  exactPublishInput(input);
  const {
    ledger,
    logicalId,
    version,
    runtimeEligibilityRef,
    includedRuntimeBindingRefs = [],
    audit
  } = input;
  if (!ledger || typeof ledger.publish !== 'function') {
    throw new RuntimeAlternativeSetError('INVALID_LEDGER', 'D04 publication requires AuthorityLedger.publish');
  }
  const world = buildHistoricalCoverageWorld({ ledger, runtimeEligibilityRef, includedRuntimeBindingRefs });
  const actor = world.eligibility.authorization.principal;
  if (!audit || audit.actor?.id !== actor.principalId || audit.actor?.type !== actor.type) {
    throw new RuntimeAlternativeSetError(
      'RUNTIME_ALTERNATIVE_SET_AUDIT_ACTOR_MISMATCH',
      'RuntimeAlternativeSet publisher must equal the exact runtime principal that froze RuntimeEligibility'
    );
  }
  const runtimeAuthorizationRef = world.eligibility.authorization.runtimeAuthorizationRef;
  return ledger.publish({
    kind: 'RuntimeAlternativeSet',
    logicalId: text(logicalId, 'logicalId'),
    version: text(version, 'version'),
    semanticPayload: world.payload,
    audit: {
      ...audit,
      action: 'PUBLISH_RUNTIME_ALTERNATIVE_SET',
      inputRefs: expectedAuditInputs(world.payload, runtimeAuthorizationRef),
      details: {
        ...(audit.details ?? {}),
        runtimeAlternativeSetPrincipal: actor,
        runtimeAuthorizationDecisionAuditRef: runtimeAuthorizationRef,
        runtimeEligibilityRef: world.eligibility.record.ref,
        runtimePlanRef: world.payload.runtimePlanRef,
        completenessClass: world.payload.completenessClass,
        includedPathCount: world.payload.coverage.includedPathIds.length,
        uncoveredLegalPathCount: world.payload.coverage.uncoveredLegalPathIds.length,
        coverageAuthorityClass: RUNTIME_ALTERNATIVE_SET_AUTHORITY_CLASS,
        robustnessClaim: world.payload.robustnessClaim
      }
    }
  });
}

export function validateRuntimeAlternativeSet({ ledger, runtimeAlternativeSetRef }) {
  if (!ledger || typeof ledger.resolve !== 'function' || typeof ledger.auditFor !== 'function') {
    throw new RuntimeAlternativeSetError('INVALID_LEDGER', 'D04 validation requires replayable AuthorityLedger');
  }
  const ref = assertAuthorityRef(runtimeAlternativeSetRef);
  const record = ledger.resolve(ref);
  if (record.ref.kind !== 'RuntimeAlternativeSet') {
    throw new RuntimeAlternativeSetError(
      'RUNTIME_ALTERNATIVE_SET_REQUIRED',
      'expected exact RuntimeAlternativeSet authority ref'
    );
  }
  const stored = normalizeRuntimeAlternativeSet(record.semanticPayload);
  if (semanticHash('RuntimeAlternativeSet', stored) !== record.ref.semanticHash) {
    throw new RuntimeAlternativeSetError(
      'RUNTIME_ALTERNATIVE_SET_SEMANTIC_HASH_MISMATCH',
      'stored RuntimeAlternativeSet does not reproduce its exact semantic authority identity'
    );
  }
  const world = buildHistoricalCoverageWorld({
    ledger,
    runtimeEligibilityRef: stored.runtimeEligibilityRef,
    includedRuntimeBindingRefs: stored.includedBindings.map((item) => item.runtimeBindingRef)
  });
  if (semanticHash('RuntimeAlternativeSet', world.payload) !== record.ref.semanticHash) {
    throw new RuntimeAlternativeSetError(
      'RUNTIME_ALTERNATIVE_SET_REPLAY_MISMATCH',
      'exact historical RuntimeEligibility and included RuntimeBindings do not reproduce frozen coverage semantics'
    );
  }
  const actor = world.eligibility.authorization.principal;
  const runtimeAuthorizationRef = world.eligibility.authorization.runtimeAuthorizationRef;
  const expectedInputs = expectedAuditInputs(stored, runtimeAuthorizationRef);
  const validAudit = ledger.auditFor(record.ref).some((event) =>
    sameAuthorityRef(event.objectRef, record.ref)
      && event.action === 'PUBLISH_RUNTIME_ALTERNATIVE_SET'
      && event.actor?.id === actor.principalId
      && event.actor?.type === actor.type
      && event.details?.runtimeAlternativeSetPrincipal?.principalId === actor.principalId
      && event.details?.runtimeAlternativeSetPrincipal?.type === actor.type
      && event.details?.runtimeAuthorizationDecisionAuditRef
      && sameAuthorityRef(event.details.runtimeAuthorizationDecisionAuditRef, runtimeAuthorizationRef)
      && event.details?.runtimeEligibilityRef
      && sameAuthorityRef(event.details.runtimeEligibilityRef, stored.runtimeEligibilityRef)
      && canonicalizeSemanticJson(event.details?.runtimePlanRef) === canonicalizeSemanticJson(stored.runtimePlanRef)
      && event.details?.completenessClass === stored.completenessClass
      && event.details?.includedPathCount === stored.coverage.includedPathIds.length
      && event.details?.uncoveredLegalPathCount === stored.coverage.uncoveredLegalPathIds.length
      && event.details?.coverageAuthorityClass === RUNTIME_ALTERNATIVE_SET_AUTHORITY_CLASS
      && event.details?.robustnessClaim === stored.robustnessClaim
      && sameRefSet(event.inputRefs, expectedInputs));
  if (!validAudit) {
    throw new RuntimeAlternativeSetError(
      'RUNTIME_ALTERNATIVE_SET_PUBLICATION_AUTHORITY_INVALID',
      'RuntimeAlternativeSet lacks exact historical runtime-principal audit closure over the frozen coverage universe'
    );
  }
  return deepFreeze({
    record,
    semanticPayload: stored,
    historicalRuntimeEligibility: world.eligibility.record,
    includedRuntimeBindings: deepFreeze(world.includedWorld.bindings.map((binding) => binding.record)),
    runtimeAlternativeSetPrincipal: actor,
    runtimeAuthorizationDecisionAuditRef: runtimeAuthorizationRef,
    replayMode: 'EXACT_FROZEN_HISTORICAL_COVERAGE_NO_LATEST_LOOKUP'
  });
}

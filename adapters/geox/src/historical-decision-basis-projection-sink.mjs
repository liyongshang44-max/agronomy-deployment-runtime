import { createHash } from 'node:crypto';

import {
  GENERIC_RESULT_EVENT_VERSION,
  createResultSinkEvent
} from '../../../sdks/typescript/src/index.mjs';

export const GEOX_HISTORICAL_DECISION_BASIS_PROJECTION_SINK_VERSION = 'adr.geox-historical-decision-basis-projection-sink.v1';
export const GEOX_HISTORICAL_DECISION_BASIS_PROJECTION_VERSION = 'adr.geox-historical-decision-basis-projection.v1';
export const GEOX_HISTORICAL_DECISION_BASIS_PROJECTION_EVENT_TYPE = 'HISTORICAL_DECISION_BASIS_PROJECTED';
export const GEOX_HISTORICAL_DECISION_BASIS_PROJECTION_CONSUMER_DISPOSITION = 'HISTORICAL_AUDIT_DISPLAY_ONLY_NON_ACTIONABLE';
export const GEOX_HISTORICAL_DECISION_BASIS_PROJECTION_AUTHORITY_CLAIM = 'NONE_HISTORICAL_DECISION_BASIS_IS_NON_AUTHORITY_REPRODUCIBILITY_PROJECTION';

const EXPECTED_READ_MODEL_VERSION = 'adr.historical-decision-basis.read-model.v1';
const EXPECTED_READ_MODEL_AUTHORITY_CLASS = 'NONE_NON_AUTHORITY_RECONSTRUCTION_READ_MODEL';
const EXPECTED_BASIS_DIGEST_AUTHORITY = 'NONE_DIGEST_IS_REPRODUCIBILITY_EVIDENCE_NOT_AUTHORITY_REF';
const EXPECTED_GRAPH_CLASS = 'NONE_NON_AUTHORITY_EXACT_REF_GRAPH_PROJECTION';
const EXPECTED_DECISION_SEMANTICS_CLASS = 'NONE_NON_AUTHORITY_EXACT_DECISION_RESULT_SEMANTICS_PROJECTION';
const EXPECTED_RUNTIME_ALTERNATIVE_PROVENANCE_CLASS = 'NONE_NON_AUTHORITY_EXACT_RUNTIME_ALTERNATIVE_PROVENANCE_PROJECTION';
const EXPECTED_DECISION_RESULT_CONTRACT_VERSION = 'adr.decision-result.v1';
const EXPECTED_DECISION_RESULT_AUTHORITY_CLASS = 'STRUCTURED_DECISION_AUTHORITY';
const EXPECTED_DECISION_RESULT_HUMAN_APPROVAL_AUTHORITY = 'NONE_DECISION_RESULT_IS_NOT_HUMAN_APPROVAL_AUTHORITY';
const EXPECTED_DECISION_RESULT_MACHINE_EXECUTION_AUTHORITY = 'NONE_DECISION_RESULT_IS_NOT_MACHINE_EXECUTION_AUTHORITY';
const EXPECTED_RUNTIME_ALTERNATIVE_SET_CONTRACT_VERSION = 'adr.runtime-alternative-set.v1';
const EXPECTED_RUNTIME_ALTERNATIVE_SET_AUTHORITY_CLASS = 'RUNTIME_ROBUSTNESS_COVERAGE_AUTHORITY';
const EXPECTED_RUNTIME_ELIGIBILITY_CONTRACT_VERSION = 'adr.runtime-eligibility.v1';
const EXPECTED_RUNTIME_ELIGIBILITY_AUTHORITY_CLASS = 'RUNTIME_LEGALITY_AUTHORITY';
const EXPECTED_RUNTIME_ALTERNATIVE_SET_REPLAY_MODE = 'EXACT_FROZEN_HISTORICAL_COVERAGE_NO_LATEST_LOOKUP';
const EXPECTED_DECISION_RESULT_KEYS = Object.freeze([
  'contractVersion',
  'authorityClass',
  'decisionProblemRef',
  'decisionAuthority',
  'decisionDisposition',
  'structuredAction',
  'waitSemantics',
  'informationRequirementRefs',
  'abstentionReasonAuthority',
  'humanGate',
  'policyResultRefs',
  'decisionRobustnessRef',
  'runtimeAlternativeSetRef',
  'runtimeBindingRefs',
  'decidedAt',
  'humanApprovalAuthority',
  'machineExecutionAuthority'
]);
const EXPECTED_NONCLAIMS = Object.freeze([
  'humanApprovalAuthority',
  'dispatchAuthority',
  'machineExecutionAuthority',
  'executionReceiptAuthority',
  'outcomeAuthority',
  'causalAttributionAuthority'
]);
const EXPECTED_RUNTIME_PROVENANCE_KEYS = Object.freeze([
  'projectionClass',
  'runtimeAlternativeSetRef',
  'runtimeAlternativeSetSemanticPayload',
  'runtimeEligibilityRef',
  'runtimeEligibilitySemanticPayload',
  'runtimePlanCompilerVersion',
  'runtimeAlternativeSetReplayMode',
  'pathWorlds'
]);
const EXPECTED_RUNTIME_PATH_KEYS = Object.freeze([
  'pathId',
  'pathClass',
  'pathDisposition',
  'runtimeBindingRef',
  'knowledgeRef',
  'applicabilityAssessmentRef',
  'exclusionReasonCodes',
  'sourceReasonCodes'
]);

export class GeoxHistoricalDecisionBasisProjectionSinkError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'GeoxHistoricalDecisionBasisProjectionSinkError';
    this.code = code;
  }
}

function fail(code, message) {
  throw new GeoxHistoricalDecisionBasisProjectionSinkError(code, message);
}

function object(value, name) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    fail('INVALID_GEOX_HISTORICAL_BASIS_INPUT', `${name} must be an object`);
  }
  return value;
}

function text(value, name) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    fail('INVALID_GEOX_HISTORICAL_BASIS_INPUT', `${name} must be a non-empty string`);
  }
  return value.trim();
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function exactKeys(value, name, allowed) {
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) {
      fail('GEOX_HISTORICAL_BASIS_FIELD_FORBIDDEN', `${name}.${key} is not part of the v1 projection transport contract`);
    }
  }
}

function exactFieldSet(value, name, expected, missingCode = 'GEOX_HISTORICAL_BASIS_DECISION_SEMANTICS_INVALID') {
  const allowed = new Set(expected);
  exactKeys(value, name, allowed);
  for (const key of expected) {
    if (!(key in value)) {
      fail(missingCode, `${name}.${key} is required by the projection contract`);
    }
  }
}

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])]));
  }
  return value;
}

function canonicalJson(value) {
  return JSON.stringify(canonical(value));
}

function sameCanonical(left, right) {
  return canonicalJson(left) === canonicalJson(right);
}

function sha256Json(value) {
  return `sha256:${createHash('sha256').update(Buffer.from(canonicalJson(value), 'utf8')).digest('hex')}`;
}

function adrSemanticHash(kind, value) {
  const preimage = `adr-semantic-hash-v1\nkind:${kind}\n${canonicalJson(value)}`;
  return `sha256:${createHash('sha256').update(preimage, 'utf8').digest('hex')}`;
}

function canonicalSha256(value, name) {
  const hash = text(value, name);
  if (!/^sha256:[a-f0-9]{64}$/.test(hash)) {
    fail('INVALID_GEOX_HISTORICAL_BASIS_HASH', `${name} must be canonical sha256:<64 lowercase hex>`);
  }
  return hash;
}

function nativeAuthorityRef(value, name) {
  const ref = object(value, name);
  exactKeys(ref, name, new Set(['kind', 'logicalId', 'version', 'semanticHash']));
  return Object.freeze({
    kind: text(ref.kind, `${name}.kind`),
    logicalId: text(ref.logicalId, `${name}.logicalId`),
    version: text(ref.version, `${name}.version`),
    semanticHash: canonicalSha256(ref.semanticHash, `${name}.semanticHash`)
  });
}

function sameNativeRef(left, right) {
  return left.kind === right.kind
    && left.logicalId === right.logicalId
    && left.version === right.version
    && left.semanticHash === right.semanticHash;
}

function nativeRefKey(ref) {
  return canonicalJson(ref);
}

function nativeRefSet(values, name) {
  if (!Array.isArray(values)) fail('INVALID_GEOX_HISTORICAL_BASIS_INPUT', `${name} must be an array`);
  return values.map((value, index) => nativeAuthorityRef(value, `${name}[${index}]`))
    .sort((left, right) => nativeRefKey(left).localeCompare(nativeRefKey(right)));
}

function sameNativeRefSet(left, right) {
  return left.length === right.length && left.every((ref, index) => sameNativeRef(ref, right[index]));
}

function normalizeConsumerScope(value) {
  const scope = object(value, 'consumerScope');
  exactKeys(scope, 'consumerScope', new Set(['tenantId', 'projectId', 'groupId']));
  return Object.freeze({
    tenant_id: text(scope.tenantId, 'consumerScope.tenantId'),
    project_id: text(scope.projectId, 'consumerScope.projectId'),
    group_id: text(scope.groupId, 'consumerScope.groupId')
  });
}

function normalizeDecisionSemantics(basis, decisionResultRef) {
  const decisionSemantics = object(basis.decisionSemantics, 'historicalBasis.decisionSemantics');
  exactFieldSet(
    decisionSemantics,
    'historicalBasis.decisionSemantics',
    ['projectionClass', 'decisionResultRef', 'semanticPayload']
  );
  if (decisionSemantics.projectionClass !== EXPECTED_DECISION_SEMANTICS_CLASS) {
    fail(
      'GEOX_HISTORICAL_BASIS_DECISION_SEMANTICS_CLASS_REQUIRED',
      'decisionSemantics must remain a non-authority exact DecisionResult semantics projection'
    );
  }
  const semanticRef = nativeAuthorityRef(
    decisionSemantics.decisionResultRef,
    'historicalBasis.decisionSemantics.decisionResultRef'
  );
  if (!sameNativeRef(semanticRef, decisionResultRef)) {
    fail(
      'GEOX_HISTORICAL_BASIS_DECISION_SEMANTICS_REF_MISMATCH',
      'decisionSemantics must bind the same exact DecisionResult entry ref'
    );
  }

  const semanticPayload = object(
    decisionSemantics.semanticPayload,
    'historicalBasis.decisionSemantics.semanticPayload'
  );
  exactFieldSet(
    semanticPayload,
    'historicalBasis.decisionSemantics.semanticPayload',
    EXPECTED_DECISION_RESULT_KEYS
  );
  if (semanticPayload.contractVersion !== EXPECTED_DECISION_RESULT_CONTRACT_VERSION
    || semanticPayload.authorityClass !== EXPECTED_DECISION_RESULT_AUTHORITY_CLASS) {
    fail(
      'GEOX_HISTORICAL_BASIS_DECISION_SEMANTICS_INVALID',
      'decisionSemantics must carry the exact frozen D06 DecisionResult contract and authority class'
    );
  }
  if (semanticPayload.humanApprovalAuthority !== EXPECTED_DECISION_RESULT_HUMAN_APPROVAL_AUTHORITY
    || semanticPayload.machineExecutionAuthority !== EXPECTED_DECISION_RESULT_MACHINE_EXECUTION_AUTHORITY) {
    fail(
      'GEOX_HISTORICAL_BASIS_AUTHORITY_PROMOTION_FORBIDDEN',
      'DecisionResult semantics may not create human approval or machine execution authority'
    );
  }
  if (adrSemanticHash('DecisionResult', semanticPayload) !== decisionResultRef.semanticHash) {
    fail(
      'GEOX_HISTORICAL_BASIS_DECISION_SEMANTIC_HASH_MISMATCH',
      'exact DecisionResult ref semanticHash does not bind the transported D06 semantic payload'
    );
  }

  const semanticDecisionProblemRef = nativeAuthorityRef(
    semanticPayload.decisionProblemRef,
    'historicalBasis.decisionSemantics.semanticPayload.decisionProblemRef'
  );
  const basisDecisionProblemRef = nativeAuthorityRef(
    basis.decisionProblemRef,
    'historicalBasis.decisionProblemRef'
  );
  if (!sameNativeRef(semanticDecisionProblemRef, basisDecisionProblemRef)
    || !sameCanonical(semanticPayload.decisionAuthority, basis.decisionAuthority)
    || semanticPayload.decisionDisposition !== basis.decisionDisposition
    || !sameCanonical(semanticPayload.structuredAction, basis.structuredAction)
    || semanticPayload.decidedAt !== basis.decidedAt
    || semanticPayload.humanApprovalAuthority !== basis.humanApprovalAuthority
    || semanticPayload.machineExecutionAuthority !== basis.machineExecutionAuthority) {
    fail(
      'GEOX_HISTORICAL_BASIS_DECISION_SEMANTICS_MISMATCH',
      'transported exact D06 semantics conflict with the legacy v1 historical basis summary fields'
    );
  }

  return Object.freeze(clone(decisionSemantics));
}

function normalizeRuntimeAlternativeProvenance(basis, decisionSemanticPayload) {
  const provenance = object(basis.runtimeAlternativeProvenance, 'historicalBasis.runtimeAlternativeProvenance');
  exactFieldSet(
    provenance,
    'historicalBasis.runtimeAlternativeProvenance',
    EXPECTED_RUNTIME_PROVENANCE_KEYS,
    'GEOX_HISTORICAL_BASIS_RUNTIME_PROVENANCE_INVALID'
  );
  if (provenance.projectionClass !== EXPECTED_RUNTIME_ALTERNATIVE_PROVENANCE_CLASS) {
    fail(
      'GEOX_HISTORICAL_BASIS_RUNTIME_PROVENANCE_CLASS_REQUIRED',
      'runtimeAlternativeProvenance must remain a non-authority exact D04/R03 projection'
    );
  }

  const d04Ref = nativeAuthorityRef(provenance.runtimeAlternativeSetRef, 'historicalBasis.runtimeAlternativeProvenance.runtimeAlternativeSetRef');
  if (d04Ref.kind !== 'RuntimeAlternativeSet') {
    fail('GEOX_HISTORICAL_BASIS_RUNTIME_PROVENANCE_INVALID', 'runtimeAlternativeSetRef must be exact RuntimeAlternativeSet authority');
  }
  const basisD04Ref = nativeAuthorityRef(basis.runtimeAlternativeSetRef, 'historicalBasis.runtimeAlternativeSetRef');
  const d06D04Ref = nativeAuthorityRef(decisionSemanticPayload.runtimeAlternativeSetRef, 'historicalBasis.decisionSemantics.semanticPayload.runtimeAlternativeSetRef');
  if (!sameNativeRef(d04Ref, basisD04Ref) || !sameNativeRef(d04Ref, d06D04Ref)) {
    fail('GEOX_HISTORICAL_BASIS_RUNTIME_PROVENANCE_REF_MISMATCH', 'D04 provenance must bind the same exact RuntimeAlternativeSet as basis and D06');
  }

  const d04Payload = object(provenance.runtimeAlternativeSetSemanticPayload, 'historicalBasis.runtimeAlternativeProvenance.runtimeAlternativeSetSemanticPayload');
  if (d04Payload.contractVersion !== EXPECTED_RUNTIME_ALTERNATIVE_SET_CONTRACT_VERSION
    || d04Payload.authorityClass !== EXPECTED_RUNTIME_ALTERNATIVE_SET_AUTHORITY_CLASS) {
    fail('GEOX_HISTORICAL_BASIS_RUNTIME_PROVENANCE_INVALID', 'D04 semantic payload contract or authority class mismatch');
  }
  if (adrSemanticHash('RuntimeAlternativeSet', d04Payload) !== d04Ref.semanticHash) {
    fail('GEOX_HISTORICAL_BASIS_RUNTIME_ALTERNATIVE_SET_HASH_MISMATCH', 'exact RuntimeAlternativeSet ref does not bind transported D04 semantic payload');
  }

  const r03Ref = nativeAuthorityRef(provenance.runtimeEligibilityRef, 'historicalBasis.runtimeAlternativeProvenance.runtimeEligibilityRef');
  if (r03Ref.kind !== 'RuntimeEligibility') {
    fail('GEOX_HISTORICAL_BASIS_RUNTIME_PROVENANCE_INVALID', 'runtimeEligibilityRef must be exact RuntimeEligibility authority');
  }
  const d04R03Ref = nativeAuthorityRef(d04Payload.runtimeEligibilityRef, 'historicalBasis.runtimeAlternativeProvenance.runtimeAlternativeSetSemanticPayload.runtimeEligibilityRef');
  if (!sameNativeRef(r03Ref, d04R03Ref)) {
    fail('GEOX_HISTORICAL_BASIS_RUNTIME_PROVENANCE_REF_MISMATCH', 'D04 must bind the transported exact R03 authority');
  }

  const r03Payload = object(provenance.runtimeEligibilitySemanticPayload, 'historicalBasis.runtimeAlternativeProvenance.runtimeEligibilitySemanticPayload');
  if (r03Payload.contractVersion !== EXPECTED_RUNTIME_ELIGIBILITY_CONTRACT_VERSION
    || r03Payload.authorityClass !== EXPECTED_RUNTIME_ELIGIBILITY_AUTHORITY_CLASS) {
    fail('GEOX_HISTORICAL_BASIS_RUNTIME_PROVENANCE_INVALID', 'R03 semantic payload contract or authority class mismatch');
  }
  if (adrSemanticHash('RuntimeEligibility', r03Payload) !== r03Ref.semanticHash) {
    fail('GEOX_HISTORICAL_BASIS_RUNTIME_ELIGIBILITY_HASH_MISMATCH', 'exact RuntimeEligibility ref does not bind transported R03 semantic payload');
  }

  const decisionProblemRef = nativeAuthorityRef(decisionSemanticPayload.decisionProblemRef, 'historicalBasis.decisionSemantics.semanticPayload.decisionProblemRef');
  for (const [name, d04Value, r03Value] of [
    ['decisionProblemRef', d04Payload.decisionProblemRef, r03Payload.decisionProblemRef],
    ['deploymentRef', d04Payload.deploymentRef, r03Payload.deploymentRef],
    ['runtimeProfileRef', d04Payload.runtimeProfileRef, r03Payload.runtimeProfileRef],
    ['contextManifestRef', d04Payload.contextManifestRef, r03Payload.contextManifestRef]
  ]) {
    const d04ValueRef = nativeAuthorityRef(d04Value, `historicalBasis.runtimeAlternativeProvenance.runtimeAlternativeSetSemanticPayload.${name}`);
    const r03ValueRef = nativeAuthorityRef(r03Value, `historicalBasis.runtimeAlternativeProvenance.runtimeEligibilitySemanticPayload.${name}`);
    if (!sameNativeRef(d04ValueRef, r03ValueRef)) {
      fail('GEOX_HISTORICAL_BASIS_RUNTIME_PROVENANCE_REF_MISMATCH', `D04 and R03 ${name} must match exactly`);
    }
    if (name === 'decisionProblemRef' && !sameNativeRef(d04ValueRef, decisionProblemRef)) {
      fail('GEOX_HISTORICAL_BASIS_RUNTIME_PROVENANCE_REF_MISMATCH', 'D04/R03 and D06 DecisionProblem must match exactly');
    }
  }
  if (!sameCanonical(d04Payload.runtimePlanRef, r03Payload.planRef)) {
    fail('GEOX_HISTORICAL_BASIS_RUNTIME_PLAN_MISMATCH', 'D04 runtimePlanRef must equal exact R03 planRef');
  }
  const compilerVersion = text(provenance.runtimePlanCompilerVersion, 'historicalBasis.runtimeAlternativeProvenance.runtimePlanCompilerVersion');
  if (compilerVersion !== d04Payload.generationMethod?.runtimePlanCompilerVersion
    || compilerVersion !== r03Payload.planRef?.compilerVersion) {
    fail('GEOX_HISTORICAL_BASIS_RUNTIME_PLAN_COMPILER_MISMATCH', 'transported compiler version must equal frozen D04 and R03 RuntimePlan identity');
  }
  if (provenance.runtimeAlternativeSetReplayMode !== EXPECTED_RUNTIME_ALTERNATIVE_SET_REPLAY_MODE) {
    fail('GEOX_HISTORICAL_BASIS_RUNTIME_PROVENANCE_INVALID', 'D04 replay mode must remain exact historical coverage with no latest lookup');
  }

  const d04IncludedRefs = nativeRefSet(d04Payload.includedBindings.map((item) => item.runtimeBindingRef), 'historicalBasis.runtimeAlternativeProvenance.d04IncludedRuntimeBindingRefs');
  const d06BindingRefs = nativeRefSet(decisionSemanticPayload.runtimeBindingRefs, 'historicalBasis.decisionSemantics.semanticPayload.runtimeBindingRefs');
  const basisBindingRefs = nativeRefSet(basis.runtimeBindingRefs, 'historicalBasis.runtimeBindingRefs');
  if (!sameNativeRefSet(d04IncludedRefs, d06BindingRefs) || !sameNativeRefSet(d04IncludedRefs, basisBindingRefs)) {
    fail('GEOX_HISTORICAL_BASIS_RUNTIME_BINDING_SET_MISMATCH', 'D04 included RuntimeBindings must equal exact D06 and legacy basis RuntimeBinding sets');
  }

  if (!Array.isArray(provenance.pathWorlds)) {
    fail('GEOX_HISTORICAL_BASIS_RUNTIME_PROVENANCE_INVALID', 'runtimeAlternativeProvenance.pathWorlds must be an array');
  }
  const d04Candidates = [
    ...d04Payload.includedBindings.map((item) => ({
      pathId: item.pathId,
      pathClass: 'INCLUDED_RUNTIME_BINDING',
      runtimeBindingRef: item.runtimeBindingRef,
      knowledgeRef: item.knowledgeRef,
      applicabilityAssessmentRef: item.applicabilityAssessmentRef,
      exclusionReasonCodes: null,
      sourceReasonCodes: null
    })),
    ...d04Payload.excludedCandidates.map((item) => ({
      pathId: item.pathId,
      pathClass: 'EXCLUDED_RUNTIME_PATH',
      runtimeBindingRef: null,
      knowledgeRef: item.knowledgeRef,
      applicabilityAssessmentRef: item.applicabilityAssessmentRef,
      exclusionReasonCodes: item.exclusionReasonCodes,
      sourceReasonCodes: item.sourceReasonCodes
    }))
  ];
  if (provenance.pathWorlds.length !== d04Candidates.length) {
    fail('GEOX_HISTORICAL_BASIS_RUNTIME_PATH_ACCOUNTING_MISMATCH', 'runtime path projection must cover every D04 included or excluded path exactly once');
  }
  const seen = new Set();
  for (let index = 0; index < provenance.pathWorlds.length; index += 1) {
    const path = object(provenance.pathWorlds[index], `historicalBasis.runtimeAlternativeProvenance.pathWorlds[${index}]`);
    exactFieldSet(
      path,
      `historicalBasis.runtimeAlternativeProvenance.pathWorlds[${index}]`,
      EXPECTED_RUNTIME_PATH_KEYS,
      'GEOX_HISTORICAL_BASIS_RUNTIME_PROVENANCE_INVALID'
    );
    const pathId = text(path.pathId, `historicalBasis.runtimeAlternativeProvenance.pathWorlds[${index}].pathId`);
    if (seen.has(pathId)) fail('GEOX_HISTORICAL_BASIS_RUNTIME_PATH_ACCOUNTING_MISMATCH', `duplicate runtime path ${pathId}`);
    seen.add(pathId);
    const candidate = d04Candidates.find((item) => item.pathId === pathId);
    const evaluation = r03Payload.alternativeEvaluations.find((item) => item.pathId === pathId);
    if (!candidate || !evaluation) {
      fail('GEOX_HISTORICAL_BASIS_RUNTIME_PATH_ACCOUNTING_MISMATCH', `path ${pathId} must exist in exact D04 and R03 worlds`);
    }
    if (path.pathClass !== candidate.pathClass || path.pathDisposition !== evaluation.disposition) {
      fail('GEOX_HISTORICAL_BASIS_RUNTIME_PATH_ACCOUNTING_MISMATCH', `path ${pathId} class/disposition mismatch`);
    }
    const pathKnowledgeRef = nativeAuthorityRef(path.knowledgeRef, `historicalBasis.runtimeAlternativeProvenance.pathWorlds[${index}].knowledgeRef`);
    const candidateKnowledgeRef = nativeAuthorityRef(candidate.knowledgeRef, `historicalBasis.runtimeAlternativeProvenance.d04Candidates.${pathId}.knowledgeRef`);
    const evaluationKnowledgeRef = nativeAuthorityRef(evaluation.knowledgeRef, `historicalBasis.runtimeAlternativeProvenance.r03AlternativeEvaluations.${pathId}.knowledgeRef`);
    const pathApplicabilityRef = nativeAuthorityRef(path.applicabilityAssessmentRef, `historicalBasis.runtimeAlternativeProvenance.pathWorlds[${index}].applicabilityAssessmentRef`);
    const candidateApplicabilityRef = nativeAuthorityRef(candidate.applicabilityAssessmentRef, `historicalBasis.runtimeAlternativeProvenance.d04Candidates.${pathId}.applicabilityAssessmentRef`);
    const evaluationApplicabilityRef = nativeAuthorityRef(evaluation.applicabilityAssessmentRef, `historicalBasis.runtimeAlternativeProvenance.r03AlternativeEvaluations.${pathId}.applicabilityAssessmentRef`);
    if (!sameNativeRef(pathKnowledgeRef, candidateKnowledgeRef)
      || !sameNativeRef(pathKnowledgeRef, evaluationKnowledgeRef)
      || !sameNativeRef(pathApplicabilityRef, candidateApplicabilityRef)
      || !sameNativeRef(pathApplicabilityRef, evaluationApplicabilityRef)) {
      fail('GEOX_HISTORICAL_BASIS_RUNTIME_PATH_ACCOUNTING_MISMATCH', `path ${pathId} knowledge/applicability lineage mismatch`);
    }
    if (candidate.pathClass === 'INCLUDED_RUNTIME_BINDING') {
      const pathBindingRef = nativeAuthorityRef(path.runtimeBindingRef, `historicalBasis.runtimeAlternativeProvenance.pathWorlds[${index}].runtimeBindingRef`);
      const candidateBindingRef = nativeAuthorityRef(candidate.runtimeBindingRef, `historicalBasis.runtimeAlternativeProvenance.d04Candidates.${pathId}.runtimeBindingRef`);
      if (!sameNativeRef(pathBindingRef, candidateBindingRef)
        || !sameCanonical(path.exclusionReasonCodes, [])
        || !sameCanonical(path.sourceReasonCodes, evaluation.reasonCodes ?? [])) {
        fail('GEOX_HISTORICAL_BASIS_RUNTIME_PATH_ACCOUNTING_MISMATCH', `included path ${pathId} semantics mismatch`);
      }
    } else if (path.runtimeBindingRef !== null
      || !sameCanonical(path.exclusionReasonCodes, candidate.exclusionReasonCodes)
      || !sameCanonical(path.sourceReasonCodes, candidate.sourceReasonCodes)) {
      fail('GEOX_HISTORICAL_BASIS_RUNTIME_PATH_ACCOUNTING_MISMATCH', `excluded path ${pathId} semantics mismatch`);
    }
  }

  const graphRequiredRefs = nativeRefSet([
    d04Ref,
    r03Ref,
    d04Payload.decisionProblemRef,
    d04Payload.deploymentRef,
    d04Payload.runtimeProfileRef,
    d04Payload.contextManifestRef,
    r03Payload.knowledgeRetrievalResultRef,
    ...d04Payload.includedBindings.map((item) => item.runtimeBindingRef),
    ...d04Candidates.flatMap((item) => [item.knowledgeRef, item.applicabilityAssessmentRef])
  ], 'historicalBasis.runtimeAlternativeProvenance.graphRequiredRefs');

  return Object.freeze({
    projection: clone(provenance),
    graphRequiredRefs
  });
}

function normalizeHistoricalBasis(value) {
  const basis = object(value, 'historicalBasis');
  if (basis.readModelVersion !== EXPECTED_READ_MODEL_VERSION) {
    fail('GEOX_HISTORICAL_BASIS_VERSION_UNSUPPORTED', `expected ${EXPECTED_READ_MODEL_VERSION}`);
  }
  if (basis.authorityClass !== EXPECTED_READ_MODEL_AUTHORITY_CLASS) {
    fail('GEOX_HISTORICAL_BASIS_AUTHORITY_PROMOTION_FORBIDDEN', 'historical basis must remain a non-authority reconstruction read model');
  }
  canonicalSha256(basis.basisDigest, 'historicalBasis.basisDigest');
  if (basis.basisDigestAuthority !== EXPECTED_BASIS_DIGEST_AUTHORITY) {
    fail('GEOX_HISTORICAL_BASIS_AUTHORITY_PROMOTION_FORBIDDEN', 'basisDigest may be used only as reproducibility evidence, never as an AuthorityRef');
  }

  const decisionResultRef = nativeAuthorityRef(basis.decisionResultRef, 'historicalBasis.decisionResultRef');
  if (decisionResultRef.kind !== 'DecisionResult') {
    fail('GEOX_HISTORICAL_BASIS_ENTRY_REF_REQUIRED', 'historical basis entry ref must be DecisionResult');
  }
  const decisionSemantics = normalizeDecisionSemantics(basis, decisionResultRef);
  const runtimeProvenance = normalizeRuntimeAlternativeProvenance(basis, decisionSemantics.semanticPayload);

  const nonclaims = object(basis.nonclaims, 'historicalBasis.nonclaims');
  exactKeys(nonclaims, 'historicalBasis.nonclaims', new Set(EXPECTED_NONCLAIMS));
  for (const name of EXPECTED_NONCLAIMS) {
    if (nonclaims[name] !== false) {
      fail('GEOX_HISTORICAL_BASIS_AUTHORITY_PROMOTION_FORBIDDEN', `historicalBasis.nonclaims.${name} must remain false`);
    }
  }

  const graph = object(basis.authorityGraph, 'historicalBasis.authorityGraph');
  if (graph.projectionClass !== EXPECTED_GRAPH_CLASS) {
    fail('GEOX_HISTORICAL_BASIS_GRAPH_CLASS_REQUIRED', 'authorityGraph must remain a non-authority exact-ref inspection projection');
  }
  const graphEntryRef = nativeAuthorityRef(graph.entryRef, 'historicalBasis.authorityGraph.entryRef');
  if (!sameNativeRef(graphEntryRef, decisionResultRef)) {
    fail('GEOX_HISTORICAL_BASIS_ENTRY_REF_MISMATCH', 'authorityGraph entryRef must equal historicalBasis decisionResultRef');
  }
  if (!Array.isArray(graph.allAuthorityRefs) || graph.allAuthorityRefs.length === 0) {
    fail('GEOX_HISTORICAL_BASIS_GRAPH_REQUIRED', 'authorityGraph.allAuthorityRefs must be non-empty');
  }
  const graphRefs = nativeRefSet(graph.allAuthorityRefs, 'historicalBasis.authorityGraph.allAuthorityRefs');
  if (!graphRefs.some((ref) => sameNativeRef(ref, decisionResultRef))) {
    fail('GEOX_HISTORICAL_BASIS_ENTRY_REF_MISMATCH', 'authorityGraph must retain the exact DecisionResult entry ref');
  }
  for (const requiredRef of runtimeProvenance.graphRequiredRefs) {
    if (!graphRefs.some((ref) => sameNativeRef(ref, requiredRef))) {
      fail('GEOX_HISTORICAL_BASIS_RUNTIME_PROVENANCE_GRAPH_INCOMPLETE', 'authorityGraph must retain every exact D04/R03 runtime-alternative provenance authority ref');
    }
  }

  return Object.freeze(clone(basis));
}

function projectionPayload(historicalBasis) {
  return Object.freeze({
    projection_version: GEOX_HISTORICAL_DECISION_BASIS_PROJECTION_VERSION,
    historical_basis: normalizeHistoricalBasis(historicalBasis),
    authority_claim: GEOX_HISTORICAL_DECISION_BASIS_PROJECTION_AUTHORITY_CLAIM
  });
}

export function createAdrHistoricalDecisionBasisProjectionEventForGeox({ eventId, historicalBasis }) {
  const payload = projectionPayload(historicalBasis);
  return createResultSinkEvent({
    eventId,
    eventType: GEOX_HISTORICAL_DECISION_BASIS_PROJECTION_EVENT_TYPE,
    projectionHash: sha256Json(payload),
    payload
  });
}

export function consumeAdrHistoricalDecisionBasisProjectionForGeox({ event, consumerScope }) {
  const input = object(event, 'event');
  exactKeys(input, 'event', new Set(['contract_version', 'event_id', 'event_type', 'projection_hash', 'payload']));
  if (input.contract_version !== GENERIC_RESULT_EVENT_VERSION
    || input.event_type !== GEOX_HISTORICAL_DECISION_BASIS_PROJECTION_EVENT_TYPE) {
    fail(
      'INVALID_GEOX_HISTORICAL_BASIS_EVENT',
      `expected ${GENERIC_RESULT_EVENT_VERSION} ${GEOX_HISTORICAL_DECISION_BASIS_PROJECTION_EVENT_TYPE}`
    );
  }
  text(input.event_id, 'event.event_id');
  const projectionHash = canonicalSha256(input.projection_hash, 'event.projection_hash');

  const payload = object(input.payload, 'event.payload');
  exactKeys(payload, 'event.payload', new Set(['projection_version', 'historical_basis', 'authority_claim']));
  if (payload.projection_version !== GEOX_HISTORICAL_DECISION_BASIS_PROJECTION_VERSION) {
    fail('GEOX_HISTORICAL_BASIS_PROJECTION_VERSION_UNSUPPORTED', `expected ${GEOX_HISTORICAL_DECISION_BASIS_PROJECTION_VERSION}`);
  }
  if (payload.authority_claim !== GEOX_HISTORICAL_DECISION_BASIS_PROJECTION_AUTHORITY_CLAIM) {
    fail('GEOX_HISTORICAL_BASIS_AUTHORITY_PROMOTION_FORBIDDEN', 'projection payload may not claim ADR, GEOX, approval, dispatch, execution, outcome, or causal authority');
  }
  const historicalBasis = normalizeHistoricalBasis(payload.historical_basis);
  const expectedProjectionHash = sha256Json({
    projection_version: payload.projection_version,
    historical_basis: historicalBasis,
    authority_claim: payload.authority_claim
  });
  if (projectionHash !== expectedProjectionHash) {
    fail('GEOX_HISTORICAL_BASIS_PROJECTION_HASH_MISMATCH', 'projection_hash does not match the canonical historical basis projection payload');
  }

  return Object.freeze({
    contract_version: GEOX_HISTORICAL_DECISION_BASIS_PROJECTION_SINK_VERSION,
    routing_scope: normalizeConsumerScope(consumerScope),
    projection_hash: projectionHash,
    historical_basis: historicalBasis,
    entry_decision_result_ref: nativeAuthorityRef(historicalBasis.decisionResultRef, 'historicalBasis.decisionResultRef'),
    basis_digest: historicalBasis.basisDigest,
    consumer_disposition: GEOX_HISTORICAL_DECISION_BASIS_PROJECTION_CONSUMER_DISPOSITION,
    field_actionable: false,
    dispatch_authorized: false,
    decision_result_semantic_hash_verified: true,
    runtime_alternative_provenance_verified: true,
    transport_verification: 'PROJECTION_HASH_INTEGRITY_ONLY_UPSTREAM_AUTHORITY_REPLAY_NOT_REPERFORMED',
    authority_claim: GEOX_HISTORICAL_DECISION_BASIS_PROJECTION_AUTHORITY_CLAIM
  });
}

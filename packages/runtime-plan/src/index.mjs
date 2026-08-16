import { createHash } from 'node:crypto';
import { cloneCanonicalValue, deepFreeze } from '../../canonicalization/src/index.mjs';
import { assertAuthorityRef, sameAuthorityRef } from '../../contracts/src/authority.mjs';
import { validateKnowledgeRetrievalResult } from '../../knowledge-retrieval/src/index.mjs';
import { validateApplicabilityAssessment } from '../../applicability/src/index.mjs';
import { validateContextManifestAuthority } from '../../context-manifest/src/index.mjs';

export const RUNTIME_CANDIDATES_CONTRACT_VERSION = 'adr.runtime-candidates.v1';
export const RUNTIME_PLAN_CONTRACT_VERSION = 'adr.runtime-plan.v1';
export const RUNTIME_PLAN_COMPILER_VERSION = 'ADR_RUNTIME_PLAN_COMPILER@1';
export const RUNTIME_PLAN_AUTHORITY_CLASS = 'RUNTIME_COMPILER_IR_NON_AUTHORITY';
export const RUNTIME_PLAN_NODE_TYPES = deepFreeze([
  'CONTEXT',
  'APPLICABILITY',
  'TRANSFORMATION',
  'MODEL',
  'POLICY',
  'INFORMATION',
  'RESULT'
]);

const NODE_TYPE_SET = new Set(RUNTIME_PLAN_NODE_TYPES);

export class RuntimePlanError extends Error {
  constructor(code, message) {
    super(message);
    this.name = 'RuntimePlanError';
    this.code = code;
  }
}

function text(value, name) {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new RuntimePlanError('INVALID_RUNTIME_PLAN_INPUT', `${name} must be a non-empty string`);
  }
  return value.trim();
}

function refKey(ref) {
  const r = assertAuthorityRef(ref);
  return JSON.stringify([r.kind, r.logicalId, r.version, r.semanticHash]);
}

function canonicalRefs(values, name, { kinds = null, nonEmpty = false } = {}) {
  if (!Array.isArray(values) || (nonEmpty && values.length === 0)) {
    throw new RuntimePlanError('INVALID_RUNTIME_PLAN_REFS', `${name} must be ${nonEmpty ? 'a non-empty' : 'an'} array`);
  }
  const refs = values.map((value, index) => {
    const ref = assertAuthorityRef(value);
    if (kinds && !kinds.includes(ref.kind)) {
      throw new RuntimePlanError('INVALID_RUNTIME_PLAN_REF', `${name}[${index}] has unsupported kind ${ref.kind}`);
    }
    return ref;
  });
  const keys = refs.map(refKey);
  if (new Set(keys).size !== keys.length) {
    throw new RuntimePlanError('DUPLICATE_RUNTIME_PLAN_REF', `${name} cannot contain duplicate exact refs`);
  }
  return deepFreeze([...refs].sort((a, b) => refKey(a).localeCompare(refKey(b))));
}

function canonicalStrings(values, name) {
  if (!Array.isArray(values)) throw new RuntimePlanError('INVALID_RUNTIME_PLAN_INPUT', `${name} must be an array`);
  const strings = values.map((value, index) => text(value, `${name}[${index}]`));
  if (new Set(strings).size !== strings.length) {
    throw new RuntimePlanError('DUPLICATE_RUNTIME_PLAN_VALUE', `${name} cannot contain duplicates`);
  }
  return deepFreeze([...strings].sort());
}

function hash(value) {
  return `sha256:${createHash('sha256').update(JSON.stringify(cloneCanonicalValue(value)), 'utf8').digest('hex')}`;
}

function shortHash(value) {
  return hash(value).slice('sha256:'.length, 'sha256:'.length + 16);
}

function sameRefSet(left, right) {
  if (!Array.isArray(left) || !Array.isArray(right)) return false;
  const a = canonicalRefs(left, 'left').map(refKey);
  const b = canonicalRefs(right, 'right').map(refKey);
  return a.length === b.length && a.every((key, index) => key === b[index]);
}

function exactRefIn(refs, expected) {
  return refs.some((ref) => sameAuthorityRef(ref, expected));
}

function contextSemanticIds(ledger, manifest) {
  const ids = [];
  for (const ref of manifest.semanticPayload.datumRefs) {
    const datum = ledger.resolve(ref);
    if (datum.ref.kind !== 'ContextDatum') {
      throw new RuntimePlanError('RUNTIME_PLAN_CONTEXT_DATUM_REQUIRED', 'ContextManifest datumRefs must resolve to ContextDatum for plan semantic I/O');
    }
    ids.push(text(datum.semanticPayload.semanticId, 'ContextDatum.semanticId'));
  }
  return canonicalStrings([...new Set(ids)], 'contextSemanticIds');
}

function assessmentOpenRequirements(assessment) {
  const p = assessment.semanticPayload;
  if (p.requiredTransformationRefs.length > 0) {
    throw new RuntimePlanError(
      'RUNTIME_PLAN_SPEC_AUTHORITY_REQUIRED',
      'R01 minimal compiler cannot represent governed TransformationSpec paths before conditional S01 authority is implemented'
    );
  }
  const requirements = [];
  for (const semanticId of p.missingContextSemanticIds) {
    requirements.push({
      requirementType: 'MISSING_CONTEXT',
      code: 'MISSING_CONTEXT_SEMANTIC_ID',
      semanticId,
      sourceApplicabilityAssessmentRef: assessment.record.ref
    });
  }
  for (const code of p.requiredCalibrationCodes) {
    requirements.push({
      requirementType: 'CALIBRATION_REQUIRED',
      code,
      sourceApplicabilityAssessmentRef: assessment.record.ref
    });
  }
  for (const code of p.unsupportedConstraintCodes) {
    requirements.push({
      requirementType: 'UNSUPPORTED_CONSTRAINT',
      code,
      sourceApplicabilityAssessmentRef: assessment.record.ref
    });
  }
  p.conflicts.forEach((conflict, index) => {
    requirements.push({
      requirementType: 'APPLICABILITY_CONFLICT',
      code: `CONFLICT_${index + 1}`,
      conflict: cloneCanonicalValue(conflict),
      sourceApplicabilityAssessmentRef: assessment.record.ref
    });
  });
  if (p.scientificUseStatus !== 'QUALIFIED') {
    requirements.push({
      requirementType: 'SCIENTIFIC_USE',
      code: p.scientificUseStatus,
      sourceApplicabilityAssessmentRef: assessment.record.ref
    });
  }
  if (p.decisionRelevance === 'NOT_RELEVANT') {
    requirements.push({
      requirementType: 'DECISION_RELEVANCE',
      code: 'NOT_RELEVANT',
      sourceApplicabilityAssessmentRef: assessment.record.ref
    });
  }
  if (p.runtimeUse !== 'ALLOWED') {
    requirements.push({
      requirementType: 'APPLICABILITY_RUNTIME_DISPOSITION',
      code: p.runtimeUse,
      sourceApplicabilityAssessmentRef: assessment.record.ref
    });
  }
  return requirements;
}

function requirementKey(value) {
  return JSON.stringify(cloneCanonicalValue(value));
}

function candidateState(assessment, openRequirements) {
  const p = assessment.semanticPayload;
  if (p.runtimeUse === 'BLOCKED' || p.scientificUseStatus !== 'QUALIFIED' || p.decisionRelevance === 'NOT_RELEVANT') {
    return 'BLOCKED_BY_APPLICABILITY';
  }
  return openRequirements.length === 0 ? 'STRUCTURALLY_COMPLETE' : 'OPEN_REQUIREMENTS';
}

function validateWorld({
  ledger,
  decisionProblemRef,
  deploymentRef,
  runtimeProfileRef,
  contextManifestRef,
  knowledgeRetrievalResultRef,
  applicabilityAssessmentRefs,
  snapshotStore
}) {
  if (!ledger || typeof ledger.resolve !== 'function' || typeof ledger.auditFor !== 'function') {
    throw new RuntimePlanError('INVALID_LEDGER', 'R01 RuntimePlan compiler requires a replayable AuthorityLedger');
  }
  const requestedDecision = assertAuthorityRef(decisionProblemRef);
  const requestedDeployment = assertAuthorityRef(deploymentRef);
  const requestedProfile = assertAuthorityRef(runtimeProfileRef);
  const requestedManifest = assertAuthorityRef(contextManifestRef);
  const requestedRetrieval = assertAuthorityRef(knowledgeRetrievalResultRef);
  if (requestedDecision.kind !== 'DecisionProblem'
    || requestedDeployment.kind !== 'Deployment'
    || requestedProfile.kind !== 'RuntimeProfile'
    || requestedManifest.kind !== 'ContextManifest'
    || requestedRetrieval.kind !== 'KnowledgeRetrievalResult') {
    throw new RuntimePlanError('INVALID_RUNTIME_PLAN_WORLD_REF', 'R01 exact world refs have wrong authority kind');
  }

  const retrieval = validateKnowledgeRetrievalResult({ ledger, knowledgeRetrievalResultRef: requestedRetrieval });
  if (!sameAuthorityRef(retrieval.semanticPayload.decisionProblemRef, requestedDecision)) {
    throw new RuntimePlanError('RUNTIME_PLAN_DECISION_MISMATCH', 'RuntimePlan DecisionProblem must equal exact retrieval DecisionProblem');
  }
  if (!sameAuthorityRef(retrieval.semanticPayload.deploymentRef, requestedDeployment)) {
    throw new RuntimePlanError('RUNTIME_PLAN_DEPLOYMENT_MISMATCH', 'RuntimePlan Deployment must equal exact retrieval Deployment');
  }
  if (!sameAuthorityRef(retrieval.semanticPayload.runtimeProfileRef, requestedProfile)) {
    throw new RuntimePlanError('RUNTIME_PLAN_PROFILE_MISMATCH', 'RuntimePlan RuntimeProfile must equal exact retrieval RuntimeProfile');
  }

  const manifest = validateContextManifestAuthority({ ledger, contextManifestRef: requestedManifest, snapshotStore });
  if (!sameAuthorityRef(manifest.semanticPayload.decisionProblemRef, requestedDecision)) {
    throw new RuntimePlanError('RUNTIME_PLAN_CONTEXT_DECISION_MISMATCH', 'ContextManifest must bind the exact RuntimePlan DecisionProblem');
  }

  const assessmentRefs = canonicalRefs(applicabilityAssessmentRefs, 'applicabilityAssessmentRefs', {
    kinds: ['ApplicabilityAssessment'], nonEmpty: true
  });
  const assessments = assessmentRefs.map((ref) => validateApplicabilityAssessment({
    ledger,
    applicabilityAssessmentRef: ref,
    snapshotStore
  }));

  const byKnowledge = new Map();
  for (const assessment of assessments) {
    const p = assessment.semanticPayload;
    if (!sameAuthorityRef(p.knowledgeRetrievalResultRef, requestedRetrieval)) {
      throw new RuntimePlanError('RUNTIME_PLAN_RETRIEVAL_ASSESSMENT_MISMATCH', 'every applicability assessment must bind the exact RuntimePlan retrieval result');
    }
    if (!sameAuthorityRef(p.contextManifestRef, requestedManifest)) {
      throw new RuntimePlanError('RUNTIME_PLAN_CONTEXT_ASSESSMENT_MISMATCH', 'every applicability assessment must bind the exact RuntimePlan ContextManifest');
    }
    if (!sameAuthorityRef(p.decisionProblemRef, requestedDecision)) {
      throw new RuntimePlanError('RUNTIME_PLAN_DECISION_ASSESSMENT_MISMATCH', 'every applicability assessment must bind the exact RuntimePlan DecisionProblem');
    }
    if (!exactRefIn(retrieval.semanticPayload.candidateRefs, p.knowledgeRef)) {
      throw new RuntimePlanError('RUNTIME_PLAN_ASSESSMENT_NOT_RETRIEVED', 'assessment knowledgeRef must be an exact retrieval candidate');
    }
    const key = refKey(p.knowledgeRef);
    if (byKnowledge.has(key)) {
      throw new RuntimePlanError('RUNTIME_PLAN_DUPLICATE_CANDIDATE_ASSESSMENT', 'each retrieval candidate must have exactly one applicability assessment');
    }
    byKnowledge.set(key, assessment);
  }
  const retrievedKeys = new Set(retrieval.semanticPayload.candidateRefs.map(refKey));
  if (retrievedKeys.size !== byKnowledge.size || [...retrievedKeys].some((key) => !byKnowledge.has(key))) {
    throw new RuntimePlanError(
      'RUNTIME_PLAN_INCOMPLETE_APPLICABILITY_COVERAGE',
      'RuntimePlan compilation requires exactly one applicability assessment for every retrieval candidate; candidates cannot be silently omitted'
    );
  }

  return deepFreeze({ retrieval, manifest, assessments, assessmentRefs });
}

export function buildRuntimeCandidates(input) {
  const world = validateWorld(input);
  const candidates = world.retrieval.semanticPayload.candidateRefs.map((knowledgeRef) => {
    const assessment = world.assessments.find((item) => sameAuthorityRef(item.semanticPayload.knowledgeRef, knowledgeRef));
    const openRequirements = assessmentOpenRequirements(assessment);
    return deepFreeze({
      candidateId: `candidate:${shortHash([knowledgeRef, assessment.record.ref])}`,
      knowledgeRef,
      applicabilityAssessmentRef: assessment.record.ref,
      transportStatus: assessment.semanticPayload.transportStatus,
      scientificUseStatus: assessment.semanticPayload.scientificUseStatus,
      decisionRelevance: assessment.semanticPayload.decisionRelevance,
      applicabilityRuntimeUse: assessment.semanticPayload.runtimeUse,
      compilerState: candidateState(assessment, openRequirements),
      openRequirements: deepFreeze([...openRequirements].sort((a, b) => requirementKey(a).localeCompare(requirementKey(b))))
    });
  });
  return deepFreeze({
    contractVersion: RUNTIME_CANDIDATES_CONTRACT_VERSION,
    authorityClass: RUNTIME_PLAN_AUTHORITY_CLASS,
    decisionProblemRef: world.retrieval.semanticPayload.decisionProblemRef,
    deploymentRef: world.retrieval.semanticPayload.deploymentRef,
    runtimeProfileRef: world.retrieval.semanticPayload.runtimeProfileRef,
    contextManifestRef: world.manifest.record.ref,
    knowledgeRetrievalResultRef: world.retrieval.record.ref,
    applicabilityAssessmentRefs: world.assessmentRefs,
    candidates: deepFreeze(candidates)
  });
}

function makeNode({ nodeId, nodeType, authorityRefs = [], semanticInputs = [], semanticOutputs = [], dependencyNodes = [], openRequirementRefs = [] }) {
  if (!NODE_TYPE_SET.has(nodeType)) throw new RuntimePlanError('INVALID_RUNTIME_PLAN_NODE_TYPE', `unsupported nodeType ${nodeType}`);
  return deepFreeze({
    nodeId: text(nodeId, 'nodeId'),
    nodeType,
    authorityRefs: canonicalRefs(authorityRefs, `${nodeId}.authorityRefs`),
    semanticInputs: canonicalStrings(semanticInputs, `${nodeId}.semanticInputs`),
    semanticOutputs: canonicalStrings(semanticOutputs, `${nodeId}.semanticOutputs`),
    dependencyNodes: canonicalStrings(dependencyNodes, `${nodeId}.dependencyNodes`),
    openRequirementRefs: canonicalStrings(openRequirementRefs, `${nodeId}.openRequirementRefs`)
  });
}

export function compileRuntimePlan(input) {
  const world = validateWorld(input);
  const runtimeCandidates = buildRuntimeCandidates(input);
  const contextIds = contextSemanticIds(input.ledger, world.manifest);
  const contextNodeId = `context:${shortHash(world.manifest.record.ref)}`;
  const nodes = [makeNode({
    nodeId: contextNodeId,
    nodeType: 'CONTEXT',
    authorityRefs: [world.manifest.record.ref],
    semanticOutputs: contextIds
  })];
  const openRequirements = [];
  const alternativePaths = [];

  for (const candidate of runtimeCandidates.candidates) {
    const assessment = world.assessments.find((item) => sameAuthorityRef(item.record.ref, candidate.applicabilityAssessmentRef));
    const applicabilityNodeId = `applicability:${shortHash(candidate.applicabilityAssessmentRef)}`;
    nodes.push(makeNode({
      nodeId: applicabilityNodeId,
      nodeType: 'APPLICABILITY',
      authorityRefs: [candidate.knowledgeRef, candidate.applicabilityAssessmentRef],
      semanticInputs: contextIds,
      semanticOutputs: ['adr.applicability.assessment'],
      dependencyNodes: [contextNodeId]
    }));

    const requirementIds = [];
    candidate.openRequirements.forEach((requirement) => {
      const requirementId = `requirement:${shortHash(requirement)}`;
      requirementIds.push(requirementId);
      openRequirements.push(deepFreeze({ requirementId, ...cloneCanonicalValue(requirement) }));
      nodes.push(makeNode({
        nodeId: `information:${shortHash(requirementId)}`,
        nodeType: 'INFORMATION',
        authorityRefs: [assessment.record.ref],
        semanticInputs: requirement.semanticId ? [requirement.semanticId] : [],
        semanticOutputs: [],
        dependencyNodes: [applicabilityNodeId],
        openRequirementRefs: [requirementId]
      }));
    });

    const resultNodeId = `result:${shortHash([candidate.knowledgeRef, candidate.applicabilityAssessmentRef])}`;
    nodes.push(makeNode({
      nodeId: resultNodeId,
      nodeType: 'RESULT',
      authorityRefs: [candidate.knowledgeRef, candidate.applicabilityAssessmentRef],
      semanticInputs: ['adr.applicability.assessment'],
      semanticOutputs: ['adr.runtime.candidate.path'],
      dependencyNodes: [applicabilityNodeId, ...requirementIds.map((id) => `information:${shortHash(id)}`)],
      openRequirementRefs: requirementIds
    }));

    alternativePaths.push(deepFreeze({
      pathId: `path:${shortHash(candidate.candidateId)}`,
      candidateId: candidate.candidateId,
      knowledgeRef: candidate.knowledgeRef,
      applicabilityAssessmentRef: candidate.applicabilityAssessmentRef,
      nodeIds: canonicalStrings([contextNodeId, applicabilityNodeId, ...requirementIds.map((id) => `information:${shortHash(id)}`), resultNodeId], 'alternativePath.nodeIds'),
      compilerState: candidate.compilerState,
      executionAuthority: 'NOT_EVALUATED_BY_RUNTIME_PLAN'
    }));
  }

  const normalizedNodes = deepFreeze([...nodes].sort((a, b) => a.nodeId.localeCompare(b.nodeId)));
  const normalizedRequirements = deepFreeze([...openRequirements].sort((a, b) => a.requirementId.localeCompare(b.requirementId)));
  const normalizedPaths = deepFreeze([...alternativePaths].sort((a, b) => a.pathId.localeCompare(b.pathId)));
  const semanticPlan = deepFreeze({
    contractVersion: RUNTIME_PLAN_CONTRACT_VERSION,
    authorityClass: RUNTIME_PLAN_AUTHORITY_CLASS,
    decisionProblemRef: runtimeCandidates.decisionProblemRef,
    deploymentRef: runtimeCandidates.deploymentRef,
    runtimeProfileRef: runtimeCandidates.runtimeProfileRef,
    contextManifestRef: runtimeCandidates.contextManifestRef,
    knowledgeRetrievalResultRef: runtimeCandidates.knowledgeRetrievalResultRef,
    applicabilityAssessmentRefs: runtimeCandidates.applicabilityAssessmentRefs,
    nodes: normalizedNodes,
    openRequirements: normalizedRequirements,
    alternativePaths: normalizedPaths,
    compilerVersion: RUNTIME_PLAN_COMPILER_VERSION,
    executionAuthority: 'NONE_RUNTIME_PLAN_IS_NOT_ELIGIBILITY_OR_BINDING'
  });
  return deepFreeze({
    ...semanticPlan,
    planId: `plan:${shortHash(semanticPlan)}`,
    planHash: hash(semanticPlan)
  });
}

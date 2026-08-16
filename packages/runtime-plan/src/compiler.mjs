import {
  cloneCanonicalValue,
  deepFreeze,
  semanticHash
} from '../../canonicalization/src/index.mjs';
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
const COMPILER_INPUT_KEYS = new Set([
  'ledger',
  'decisionProblemRef',
  'deploymentRef',
  'runtimeProfileRef',
  'contextManifestRef',
  'knowledgeRetrievalResultRef',
  'applicabilityAssessmentRefs',
  'snapshotStore'
]);
const REPLAY_RANK = new Map([
  ['EXACT', 0],
  ['CONTENT_ADDRESSED_EXTERNAL', 1],
  ['PROVIDER_DEPENDENT', 2],
  ['NON_REPLAYABLE', 3]
]);

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

function assertCompilerInputShape(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new RuntimePlanError('INVALID_RUNTIME_PLAN_INPUT', 'RuntimePlan compiler input must be an object');
  }
  const prototype = Object.getPrototypeOf(input);
  if (prototype !== Object.prototype && prototype !== null) {
    throw new RuntimePlanError('INVALID_RUNTIME_PLAN_INPUT', 'RuntimePlan compiler input must be a plain object');
  }
  for (const key of Object.keys(input)) {
    if (!COMPILER_INPUT_KEYS.has(key)) {
      throw new RuntimePlanError(
        'INVALID_RUNTIME_PLAN_INPUT_FIELD',
        `${key} is not a legal R01 compiler predecessor; RuntimeBinding/Eligibility/Decision outputs cannot feed the current RuntimePlan`
      );
    }
  }
}

function refKey(ref) {
  const value = assertAuthorityRef(ref);
  return JSON.stringify([value.kind, value.logicalId, value.version, value.semanticHash]);
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
  return deepFreeze([...refs].sort((left, right) => refKey(left).localeCompare(refKey(right))));
}

function canonicalStrings(values, name) {
  if (!Array.isArray(values)) {
    throw new RuntimePlanError('INVALID_RUNTIME_PLAN_INPUT', `${name} must be an array`);
  }
  const strings = values.map((value, index) => text(value, `${name}[${index}]`));
  if (new Set(strings).size !== strings.length) {
    throw new RuntimePlanError('DUPLICATE_RUNTIME_PLAN_VALUE', `${name} cannot contain duplicates`);
  }
  return deepFreeze([...strings].sort());
}

function shortHash(kind, value) {
  return semanticHash(kind, cloneCanonicalValue(value)).slice('sha256:'.length, 'sha256:'.length + 16);
}

function exactRefIn(refs, expected) {
  return refs.some((ref) => sameAuthorityRef(ref, expected));
}

function manifestContextFacts(ledger, manifest) {
  const bySemantic = new Map();
  for (const ref of manifest.semanticPayload.datumRefs) {
    const datum = ledger.resolve(ref);
    if (datum.ref.kind !== 'ContextDatum') {
      throw new RuntimePlanError(
        'RUNTIME_PLAN_CONTEXT_DATUM_REQUIRED',
        'ContextManifest datumRefs must resolve to ContextDatum for RuntimePlan semantic I/O'
      );
    }
    const semanticId = text(datum.semanticPayload.semanticId, 'ContextDatum.semanticId');
    const epistemicClass = text(datum.semanticPayload.epistemicClass, 'ContextDatum.epistemicClass');
    const list = bySemantic.get(semanticId) ?? [];
    list.push(deepFreeze({ ref: datum.ref, epistemicClass }));
    bySemantic.set(semanticId, list);
  }
  return deepFreeze({
    semanticIds: canonicalStrings([...bySemantic.keys()], 'contextSemanticIds'),
    bySemantic
  });
}

function assessmentOpenRequirements(assessment) {
  const payload = assessment.semanticPayload;
  if (payload.requiredTransformationRefs.length > 0) {
    throw new RuntimePlanError(
      'RUNTIME_PLAN_SPEC_AUTHORITY_REQUIRED',
      'R01 minimal compiler cannot represent governed Transformation paths before the conditional specification authority is implemented'
    );
  }
  const requirements = [];
  for (const semanticId of payload.missingContextSemanticIds) {
    requirements.push({
      requirementType: 'MISSING_CONTEXT',
      code: 'MISSING_CONTEXT_SEMANTIC_ID',
      semanticId,
      sourceApplicabilityAssessmentRef: assessment.record.ref
    });
  }
  for (const code of payload.requiredCalibrationCodes) {
    requirements.push({
      requirementType: 'CALIBRATION_REQUIRED',
      code,
      sourceApplicabilityAssessmentRef: assessment.record.ref
    });
  }
  for (const code of payload.unsupportedConstraintCodes) {
    requirements.push({
      requirementType: 'UNSUPPORTED_CONSTRAINT',
      code,
      sourceApplicabilityAssessmentRef: assessment.record.ref
    });
  }
  payload.conflicts.forEach((conflict, index) => {
    requirements.push({
      requirementType: 'APPLICABILITY_CONFLICT',
      code: `CONFLICT_${index + 1}`,
      conflict: cloneCanonicalValue(conflict),
      sourceApplicabilityAssessmentRef: assessment.record.ref
    });
  });
  if (payload.scientificUseStatus !== 'QUALIFIED') {
    requirements.push({
      requirementType: 'SCIENTIFIC_USE',
      code: payload.scientificUseStatus,
      sourceApplicabilityAssessmentRef: assessment.record.ref
    });
  }
  if (payload.decisionRelevance === 'NOT_RELEVANT') {
    requirements.push({
      requirementType: 'DECISION_RELEVANCE',
      code: 'NOT_RELEVANT',
      sourceApplicabilityAssessmentRef: assessment.record.ref
    });
  }
  if (payload.runtimeUse !== 'ALLOWED') {
    requirements.push({
      requirementType: 'APPLICABILITY_RUNTIME_DISPOSITION',
      code: payload.runtimeUse,
      sourceApplicabilityAssessmentRef: assessment.record.ref
    });
  }
  return requirements;
}

function runtimeProfileOpenRequirements(world, contextFacts) {
  const profileAuthority = world.retrieval.deploymentAuthority.profileAuthority;
  if (!profileAuthority || !sameAuthorityRef(profileAuthority.record.ref, world.requestedProfile)) {
    throw new RuntimePlanError(
      'RUNTIME_PLAN_PROFILE_AUTHORITY_MISMATCH',
      'validated Deployment/KnowledgeRetrieval authority does not close the exact requested RuntimeProfile'
    );
  }
  const profile = profileAuthority.semanticPayload;
  const requirements = [];
  for (const semanticId of profile.contextRequirements.requiredSemanticIds) {
    const facts = contextFacts.bySemantic.get(semanticId) ?? [];
    if (facts.length === 0) {
      requirements.push({
        requirementType: 'RUNTIME_PROFILE_CONTEXT',
        code: 'REQUIRED_SEMANTIC_MISSING',
        semanticId,
        sourceRuntimeProfileRef: profileAuthority.record.ref,
        sourceContextManifestRef: world.manifest.record.ref
      });
      continue;
    }
    const acceptable = profile.contextRequirements.epistemicConstraints[semanticId] ?? [];
    if (acceptable.length > 0 && !facts.some((fact) => acceptable.includes(fact.epistemicClass))) {
      requirements.push({
        requirementType: 'RUNTIME_PROFILE_CONTEXT',
        code: 'EPISTEMIC_CLASS_UNSATISFIED',
        semanticId,
        acceptableEpistemicClasses: canonicalStrings(acceptable, `${semanticId}.acceptableEpistemicClasses`),
        observedEpistemicClasses: canonicalStrings(
          [...new Set(facts.map((fact) => fact.epistemicClass))],
          `${semanticId}.observedEpistemicClasses`
        ),
        sourceRuntimeProfileRef: profileAuthority.record.ref,
        sourceContextManifestRef: world.manifest.record.ref
      });
    }
  }

  const minimumReplay = profile.replayRequirement.minimum;
  const actualReplay = world.manifest.semanticPayload.replayClass;
  const minimumRank = REPLAY_RANK.get(minimumReplay);
  const actualRank = REPLAY_RANK.get(actualReplay);
  if (minimumRank === undefined || actualRank === undefined) {
    throw new RuntimePlanError('INVALID_RUNTIME_PLAN_REPLAY_CLASS', 'RuntimeProfile/ContextManifest replay class is outside the frozen vocabulary');
  }
  if (actualRank > minimumRank) {
    requirements.push({
      requirementType: 'REPLAY_REQUIREMENT',
      code: 'REPLAY_REQUIREMENT_UNSATISFIED',
      minimumReplayClass: minimumReplay,
      actualReplayClass: actualReplay,
      sourceRuntimeProfileRef: profileAuthority.record.ref,
      sourceContextManifestRef: world.manifest.record.ref
    });
  }
  return requirements;
}

function requirementKey(requirement) {
  return semanticHash('RuntimePlanOpenRequirement', requirement);
}

function canonicalRequirements(values) {
  const map = new Map();
  for (const value of values) {
    const normalized = deepFreeze(cloneCanonicalValue(value));
    map.set(requirementKey(normalized), normalized);
  }
  return deepFreeze([...map.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([, value]) => value));
}

function candidateState(assessment, candidateRequirements, sharedRequirements) {
  const payload = assessment.semanticPayload;
  if (payload.runtimeUse === 'BLOCKED'
    || payload.scientificUseStatus !== 'QUALIFIED'
    || payload.decisionRelevance === 'NOT_RELEVANT') {
    return 'BLOCKED_BY_APPLICABILITY';
  }
  return candidateRequirements.length + sharedRequirements.length === 0
    ? 'STRUCTURALLY_COMPLETE'
    : 'OPEN_REQUIREMENTS';
}

function validateWorld(input) {
  assertCompilerInputShape(input);
  const {
    ledger,
    decisionProblemRef,
    deploymentRef,
    runtimeProfileRef,
    contextManifestRef,
    knowledgeRetrievalResultRef,
    applicabilityAssessmentRefs,
    snapshotStore
  } = input;
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

  const retrieval = validateKnowledgeRetrievalResult({
    ledger,
    knowledgeRetrievalResultRef: requestedRetrieval
  });
  if (!sameAuthorityRef(retrieval.semanticPayload.decisionProblemRef, requestedDecision)) {
    throw new RuntimePlanError('RUNTIME_PLAN_DECISION_MISMATCH', 'RuntimePlan DecisionProblem must equal exact retrieval DecisionProblem');
  }
  if (!sameAuthorityRef(retrieval.semanticPayload.deploymentRef, requestedDeployment)) {
    throw new RuntimePlanError('RUNTIME_PLAN_DEPLOYMENT_MISMATCH', 'RuntimePlan Deployment must equal exact retrieval Deployment');
  }
  if (!sameAuthorityRef(retrieval.semanticPayload.runtimeProfileRef, requestedProfile)) {
    throw new RuntimePlanError('RUNTIME_PLAN_PROFILE_MISMATCH', 'RuntimePlan RuntimeProfile must equal exact retrieval RuntimeProfile');
  }

  const manifest = validateContextManifestAuthority({
    ledger,
    contextManifestRef: requestedManifest,
    snapshotStore
  });
  if (!sameAuthorityRef(manifest.semanticPayload.decisionProblemRef, requestedDecision)) {
    throw new RuntimePlanError('RUNTIME_PLAN_CONTEXT_DECISION_MISMATCH', 'ContextManifest must bind the exact RuntimePlan DecisionProblem');
  }

  const assessmentRefs = canonicalRefs(applicabilityAssessmentRefs, 'applicabilityAssessmentRefs', {
    kinds: ['ApplicabilityAssessment'],
    nonEmpty: true
  });
  const assessments = assessmentRefs.map((ref) => validateApplicabilityAssessment({
    ledger,
    applicabilityAssessmentRef: ref,
    snapshotStore
  }));

  const byKnowledge = new Map();
  for (const assessment of assessments) {
    const payload = assessment.semanticPayload;
    if (!sameAuthorityRef(payload.knowledgeRetrievalResultRef, requestedRetrieval)) {
      throw new RuntimePlanError('RUNTIME_PLAN_RETRIEVAL_ASSESSMENT_MISMATCH', 'every applicability assessment must bind the exact RuntimePlan retrieval result');
    }
    if (!sameAuthorityRef(payload.contextManifestRef, requestedManifest)) {
      throw new RuntimePlanError('RUNTIME_PLAN_CONTEXT_ASSESSMENT_MISMATCH', 'every applicability assessment must bind the exact RuntimePlan ContextManifest');
    }
    if (!sameAuthorityRef(payload.decisionProblemRef, requestedDecision)) {
      throw new RuntimePlanError('RUNTIME_PLAN_DECISION_ASSESSMENT_MISMATCH', 'every applicability assessment must bind the exact RuntimePlan DecisionProblem');
    }
    if (!exactRefIn(retrieval.semanticPayload.candidateRefs, payload.knowledgeRef)) {
      throw new RuntimePlanError('RUNTIME_PLAN_ASSESSMENT_NOT_RETRIEVED', 'assessment knowledgeRef must be an exact retrieval candidate');
    }
    const key = refKey(payload.knowledgeRef);
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

  const contextFacts = manifestContextFacts(ledger, manifest);
  const world = {
    retrieval,
    manifest,
    assessments,
    assessmentRefs,
    requestedProfile,
    contextFacts
  };
  return deepFreeze({
    ...world,
    sharedOpenRequirements: canonicalRequirements(runtimeProfileOpenRequirements(world, contextFacts))
  });
}

function buildRuntimeCandidatesFromWorld(world) {
  const candidates = world.retrieval.semanticPayload.candidateRefs.map((knowledgeRef) => {
    const assessment = world.assessments.find((item) =>
      sameAuthorityRef(item.semanticPayload.knowledgeRef, knowledgeRef));
    const openRequirements = canonicalRequirements(assessmentOpenRequirements(assessment));
    return deepFreeze({
      candidateId: `candidate:${shortHash('RuntimePlanCandidateIdentity', [knowledgeRef, assessment.record.ref])}`,
      knowledgeRef,
      applicabilityAssessmentRef: assessment.record.ref,
      transportStatus: assessment.semanticPayload.transportStatus,
      scientificUseStatus: assessment.semanticPayload.scientificUseStatus,
      decisionRelevance: assessment.semanticPayload.decisionRelevance,
      applicabilityRuntimeUse: assessment.semanticPayload.runtimeUse,
      compilerState: candidateState(assessment, openRequirements, world.sharedOpenRequirements),
      openRequirements
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
    sharedOpenRequirements: world.sharedOpenRequirements,
    candidates: deepFreeze(candidates)
  });
}

export function buildRuntimeCandidates(input) {
  return buildRuntimeCandidatesFromWorld(validateWorld(input));
}

function makeNode({
  nodeId,
  nodeType,
  authorityRefs = [],
  semanticInputs = [],
  semanticOutputs = [],
  dependencyNodes = [],
  openRequirementRefs = []
}) {
  if (!NODE_TYPE_SET.has(nodeType)) {
    throw new RuntimePlanError('INVALID_RUNTIME_PLAN_NODE_TYPE', `unsupported nodeType ${nodeType}`);
  }
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

export function validateRuntimePlanDag(nodes) {
  if (!Array.isArray(nodes) || nodes.length === 0) {
    throw new RuntimePlanError('INVALID_RUNTIME_PLAN_DAG', 'RuntimePlan DAG must contain at least one node');
  }
  const byId = new Map();
  for (const node of nodes) {
    if (!node || typeof node !== 'object' || Array.isArray(node)) {
      throw new RuntimePlanError('INVALID_RUNTIME_PLAN_DAG', 'RuntimePlan DAG nodes must be objects');
    }
    const id = text(node.nodeId, 'RuntimePlan.nodeId');
    if (byId.has(id)) {
      throw new RuntimePlanError('DUPLICATE_RUNTIME_PLAN_NODE', `duplicate RuntimePlan node ${id}`);
    }
    if (!Array.isArray(node.dependencyNodes)) {
      throw new RuntimePlanError('INVALID_RUNTIME_PLAN_DAG', `${id}.dependencyNodes must be an array`);
    }
    byId.set(id, node);
  }
  for (const [id, node] of byId) {
    for (const dependency of node.dependencyNodes) {
      if (!byId.has(dependency)) {
        throw new RuntimePlanError('RUNTIME_PLAN_UNKNOWN_DEPENDENCY', `${id} depends on unknown node ${dependency}`);
      }
    }
  }

  const state = new Map();
  function visit(id) {
    const current = state.get(id) ?? 0;
    if (current === 1) {
      throw new RuntimePlanError('RUNTIME_PLAN_DEPENDENCY_CYCLE', `RuntimePlan dependency cycle includes ${id}`);
    }
    if (current === 2) return;
    state.set(id, 1);
    for (const dependency of byId.get(id).dependencyNodes) visit(dependency);
    state.set(id, 2);
  }
  for (const id of byId.keys()) visit(id);
  return true;
}

function addRequirementNode({
  requirement,
  dependencyNodeId,
  authorityRefs,
  nodesById,
  requirementsById
}) {
  const requirementId = `requirement:${shortHash('RuntimePlanRequirementIdentity', requirement)}`;
  if (!requirementsById.has(requirementId)) {
    requirementsById.set(requirementId, deepFreeze({
      requirementId,
      ...cloneCanonicalValue(requirement)
    }));
  }
  const informationNodeId = `information:${shortHash('RuntimePlanInformationNodeIdentity', requirementId)}`;
  if (!nodesById.has(informationNodeId)) {
    nodesById.set(informationNodeId, makeNode({
      nodeId: informationNodeId,
      nodeType: 'INFORMATION',
      authorityRefs,
      semanticInputs: requirement.semanticId ? [requirement.semanticId] : [],
      semanticOutputs: [],
      dependencyNodes: [dependencyNodeId],
      openRequirementRefs: [requirementId]
    }));
  }
  return { requirementId, informationNodeId };
}

export function compileRuntimePlan(input) {
  const world = validateWorld(input);
  const runtimeCandidates = buildRuntimeCandidatesFromWorld(world);
  const contextNodeId = `context:${shortHash('RuntimePlanContextNodeIdentity', world.manifest.record.ref)}`;
  const nodesById = new Map();
  nodesById.set(contextNodeId, makeNode({
    nodeId: contextNodeId,
    nodeType: 'CONTEXT',
    authorityRefs: [world.manifest.record.ref],
    semanticOutputs: world.contextFacts.semanticIds
  }));
  const requirementsById = new Map();
  const sharedInfoNodeIds = [];

  for (const requirement of runtimeCandidates.sharedOpenRequirements) {
    const added = addRequirementNode({
      requirement,
      dependencyNodeId: contextNodeId,
      authorityRefs: [runtimeCandidates.runtimeProfileRef, runtimeCandidates.contextManifestRef],
      nodesById,
      requirementsById
    });
    sharedInfoNodeIds.push(added.informationNodeId);
  }

  const alternativePaths = [];
  for (const candidate of runtimeCandidates.candidates) {
    const assessment = world.assessments.find((item) =>
      sameAuthorityRef(item.record.ref, candidate.applicabilityAssessmentRef));
    const applicabilityNodeId = `applicability:${shortHash('RuntimePlanApplicabilityNodeIdentity', candidate.applicabilityAssessmentRef)}`;
    nodesById.set(applicabilityNodeId, makeNode({
      nodeId: applicabilityNodeId,
      nodeType: 'APPLICABILITY',
      authorityRefs: [candidate.knowledgeRef, candidate.applicabilityAssessmentRef],
      semanticInputs: world.contextFacts.semanticIds,
      semanticOutputs: ['adr.applicability.assessment'],
      dependencyNodes: [contextNodeId]
    }));

    const candidateInfoNodeIds = [];
    const candidateRequirementIds = [];
    for (const requirement of candidate.openRequirements) {
      const added = addRequirementNode({
        requirement,
        dependencyNodeId: applicabilityNodeId,
        authorityRefs: [assessment.record.ref],
        nodesById,
        requirementsById
      });
      candidateInfoNodeIds.push(added.informationNodeId);
      candidateRequirementIds.push(added.requirementId);
    }
    const sharedRequirementIds = sharedInfoNodeIds.flatMap((nodeId) =>
      nodesById.get(nodeId).openRequirementRefs);
    const allRequirementIds = canonicalStrings(
      [...sharedRequirementIds, ...candidateRequirementIds],
      `${candidate.candidateId}.requirementIds`
    );
    const resultNodeId = `result:${shortHash('RuntimePlanResultNodeIdentity', [candidate.knowledgeRef, candidate.applicabilityAssessmentRef])}`;
    nodesById.set(resultNodeId, makeNode({
      nodeId: resultNodeId,
      nodeType: 'RESULT',
      authorityRefs: [candidate.knowledgeRef, candidate.applicabilityAssessmentRef],
      semanticInputs: ['adr.applicability.assessment'],
      semanticOutputs: ['adr.runtime.candidate.path'],
      dependencyNodes: [applicabilityNodeId, ...sharedInfoNodeIds, ...candidateInfoNodeIds],
      openRequirementRefs: allRequirementIds
    }));

    alternativePaths.push(deepFreeze({
      pathId: `path:${shortHash('RuntimePlanAlternativePathIdentity', candidate.candidateId)}`,
      candidateId: candidate.candidateId,
      knowledgeRef: candidate.knowledgeRef,
      applicabilityAssessmentRef: candidate.applicabilityAssessmentRef,
      nodeIds: canonicalStrings(
        [contextNodeId, applicabilityNodeId, ...sharedInfoNodeIds, ...candidateInfoNodeIds, resultNodeId],
        `${candidate.candidateId}.nodeIds`
      ),
      compilerState: candidate.compilerState,
      executionAuthority: 'NOT_EVALUATED_BY_RUNTIME_PLAN'
    }));
  }

  const nodes = deepFreeze([...nodesById.values()].sort((left, right) => left.nodeId.localeCompare(right.nodeId)));
  validateRuntimePlanDag(nodes);
  const openRequirements = deepFreeze([...requirementsById.values()]
    .sort((left, right) => left.requirementId.localeCompare(right.requirementId)));
  const paths = deepFreeze([...alternativePaths]
    .sort((left, right) => refKey(left.knowledgeRef).localeCompare(refKey(right.knowledgeRef))));
  const semanticPlan = deepFreeze({
    contractVersion: RUNTIME_PLAN_CONTRACT_VERSION,
    authorityClass: RUNTIME_PLAN_AUTHORITY_CLASS,
    decisionProblemRef: runtimeCandidates.decisionProblemRef,
    deploymentRef: runtimeCandidates.deploymentRef,
    runtimeProfileRef: runtimeCandidates.runtimeProfileRef,
    contextManifestRef: runtimeCandidates.contextManifestRef,
    knowledgeRetrievalResultRef: runtimeCandidates.knowledgeRetrievalResultRef,
    applicabilityAssessmentRefs: runtimeCandidates.applicabilityAssessmentRefs,
    nodes,
    openRequirements,
    alternativePaths: paths,
    compilerVersion: RUNTIME_PLAN_COMPILER_VERSION,
    executionAuthority: 'NONE_RUNTIME_PLAN_IS_NOT_ELIGIBILITY_OR_BINDING'
  });
  const planHash = semanticHash('RuntimePlan', semanticPlan);
  return deepFreeze({
    ...semanticPlan,
    planId: `plan:${planHash.slice('sha256:'.length, 'sha256:'.length + 16)}`,
    planHash
  });
}

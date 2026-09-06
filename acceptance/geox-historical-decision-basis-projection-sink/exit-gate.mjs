import assert from 'node:assert/strict';

import {
  canonicalizeSemanticJson,
  semanticHash
} from '../../packages/canonicalization/src/index.mjs';
import {
  HISTORICAL_DECISION_BASIS_EXIT_GATE_CLASS,
  reconstructHistoricalDecisionBasisExitGate
} from '../../packages/historical-decision-basis/src/exit-gate.mjs';

function refKey(ref) {
  return canonicalizeSemanticJson(ref);
}

function containsRef(refs, expected) {
  const key = refKey(expected);
  return refs.some((ref) => refKey(ref) === key);
}

function isAuthorityRef(value) {
  return value
    && typeof value === 'object'
    && !Array.isArray(value)
    && typeof value.kind === 'string'
    && typeof value.logicalId === 'string'
    && typeof value.version === 'string'
    && typeof value.semanticHash === 'string';
}

function collectAuthorityRefs(value, output = []) {
  if (isAuthorityRef(value)) {
    output.push(value);
    return output;
  }
  if (Array.isArray(value)) {
    value.forEach((item) => collectAuthorityRefs(item, output));
    return output;
  }
  if (value && typeof value === 'object') {
    Object.values(value).forEach((item) => collectAuthorityRefs(item, output));
  }
  return output;
}

const { plantingRuntimeWorld } = await import('../real-kbs-soybean-planting-population-target/run-runtime-composition-v1.mjs');
await import('../real-kbs-soybean-planting-population-target/run-decision-result-v1.mjs');

const { ledger, snapshotStore } = plantingRuntimeWorld;
const decisionResults = ledger.exportSnapshot().records.filter((record) => record.ref.kind === 'DecisionResult');
assert.equal(decisionResults.length, 1, 'World P must contain exactly one historical DecisionResult');

const before = ledger.exportSnapshot().records.length;
const reconstructed = reconstructHistoricalDecisionBasisExitGate({
  ledger,
  snapshotStore,
  decisionResultRef: decisionResults[0].ref
});
assert.equal(ledger.exportSnapshot().records.length, before, 'ADR-2 exit-gate reconstruction must remain read-only');
assert.equal(reconstructed.exitGateClosure.projectionClass, HISTORICAL_DECISION_BASIS_EXIT_GATE_CLASS);
assert.equal(
  reconstructed.exitGateClosure.authorityClaim,
  'NONE_EXIT_GATE_PROJECTION_IS_INSPECTION_EVIDENCE_NOT_AUTHORITY'
);
assert.equal(
  reconstructed.exitGateClosure.reconstructionClassification,
  'EXACT_FROZEN_AUTHORITY_WORLD_WITH_CONTEXT_REPLAY_CLASS_PRESERVED_NO_LATEST_LOOKUP'
);

const closure = reconstructed.exitGateClosure;
const d06 = reconstructed.decisionSemantics.semanticPayload;
const a01 = closure.decisionProblemWorld;
assert.deepEqual(a01.decisionProblemRef, reconstructed.decisionProblemRef);
assert.equal(semanticHash('DecisionProblem', a01.semanticPayload), a01.decisionProblemRef.semanticHash);
assert.deepEqual(a01.semanticPayload.targetRef, closure.contextEvidenceWorlds[0].semanticPayload.targetRef);
assert.equal(a01.semanticPayload.logicalTime, closure.contextEvidenceWorlds[0].semanticPayload.logicalTime);
assert.equal(a01.semanticPayload.decisionAuthorityMode, d06.decisionAuthority.mode);
assert.ok(Date.parse(a01.semanticPayload.decisionDeadline) >= Date.parse(d06.decidedAt));
assert.equal(a01.creationAuthorizationDecisionAuditRef.kind, 'AuthorizationDecisionAudit');
assert.equal(a01.creationAuthorizationDecisionSemanticPayload.allowed, true);

assert.ok(closure.contextEvidenceWorlds.length > 0, 'exact ContextManifest world required');
let exactDatumCount = 0;
let exactReceiptCount = 0;
for (const world of closure.contextEvidenceWorlds) {
  assert.equal(semanticHash('ContextManifest', world.semanticPayload), world.contextManifestRef.semanticHash);
  assert.deepEqual(world.semanticPayload.decisionProblemRef, reconstructed.decisionProblemRef);
  assert.ok(world.datumWorlds.length > 0, 'ContextManifest must expose exact ContextDatum membership');
  exactDatumCount += world.datumWorlds.length;
  exactReceiptCount += world.receiptWorlds.length;
  for (const datum of world.datumWorlds) {
    assert.equal(semanticHash('ContextDatum', datum.semanticPayload), datum.contextDatumRef.semanticHash);
    assert.ok(world.semanticPayload.datumRefs.some((ref) => refKey(ref) === refKey(datum.contextDatumRef)));
  }
  for (const receipt of world.receiptWorlds) {
    assert.equal(
      semanticHash('ResolvedContextDatumReceipt', receipt.receiptSemanticPayload),
      receipt.resolvedReferenceReceiptRef.semanticHash
    );
    assert.equal(
      semanticHash('AuthorizedContextReference', receipt.authorizedContextReferenceSemanticPayload),
      receipt.authorizedContextReferenceRef.semanticHash
    );
    assert.equal(
      semanticHash('ContextDatum', receipt.resolvedContextDatumSemanticPayload),
      receipt.resolvedContextDatumRef.semanticHash
    );
  }
}

assert.ok(closure.knowledgeReleaseWorlds.length > 0, 'exact KnowledgeRelease world required');
assert.ok(closure.knowledgeRetrievalWorlds.length > 0, 'exact KnowledgeRetrievalResult world required');
assert.ok(closure.knowledgeWorlds.length > 0, 'release/selected knowledge provenance required');
assert.ok(closure.applicabilityAssessmentWorlds.length > 0, 'exact ApplicabilityAssessment world required');

let releaseMemberCount = 0;
for (const release of closure.knowledgeReleaseWorlds) {
  assert.equal(semanticHash('KnowledgeRelease', release.semanticPayload), release.knowledgeReleaseRef.semanticHash);
  assert.deepEqual(release.semanticPayload.memberRefs, release.memberRefs);
  assert.equal(release.publicationDecisionRef.kind, 'KnowledgeReleasePublicationDecision');
  releaseMemberCount += release.memberRefs.length;
  for (const memberRef of release.memberRefs) {
    assert.ok(
      closure.knowledgeWorlds.some((world) => refKey(world.knowledgeRef) === refKey(memberRef)),
      'every exact KnowledgeRelease member must carry its historical knowledge provenance world'
    );
  }
}
assert.ok(releaseMemberCount > 0);

for (const retrieval of closure.knowledgeRetrievalWorlds) {
  assert.equal(
    semanticHash('KnowledgeRetrievalResult', retrieval.semanticPayload),
    retrieval.knowledgeRetrievalResultRef.semanticHash
  );
  assert.deepEqual(retrieval.semanticPayload.decisionProblemRef, reconstructed.decisionProblemRef);
  assert.equal(retrieval.runtimeAuthorizationDecisionAuditRef.kind, 'AuthorizationDecisionAudit');
  assert.equal(retrieval.runtimeAuthorizationDecisionSemanticPayload.allowed, true);
}

let qualificationDecisionCount = 0;
for (const world of closure.knowledgeWorlds) {
  assert.equal(semanticHash(world.knowledgeKind, world.semanticPayload), world.knowledgeRef.semanticHash);
  if (world.knowledgeKind === 'QualifiedKnowledge') {
    assert.equal(semanticHash('Claim', world.claimSemanticPayload), world.claimRef.semanticHash);
    assert.equal(semanticHash('SourceContext', world.sourceContextSemanticPayload), world.sourceContextRef.semanticHash);
    assert.equal(semanticHash('Source', world.sourceSemanticPayload), world.sourceRef.semanticHash);
    assert.equal(
      semanticHash('SourceFaithfulReviewDecision', world.sourceFaithfulReviewSemanticPayload),
      world.sourceFaithfulReviewRef.semanticHash
    );
    assert.ok(world.scientificQualificationDecisionWorlds.length > 0);
    qualificationDecisionCount += world.scientificQualificationDecisionWorlds.length;
    for (const decision of world.scientificQualificationDecisionWorlds) {
      assert.equal(semanticHash('ScientificQualificationDecision', decision.semanticPayload), decision.ref.semanticHash);
    }
  } else {
    assert.equal(world.knowledgeKind, 'DerivedKnowledge');
    assert.equal(
      semanticHash('DerivedKnowledgeContext', world.derivedKnowledgeContextSemanticPayload),
      world.derivedKnowledgeContextRef.semanticHash
    );
    assert.equal(
      semanticHash('DerivationMethod', world.derivationMethodSemanticPayload),
      world.derivationMethodRef.semanticHash
    );
    assert.ok(world.inputQualifiedKnowledgeWorlds.length > 0);
  }
}
assert.ok(qualificationDecisionCount > 0, 'scientific qualification authority must be inspectable');

for (const applicability of closure.applicabilityAssessmentWorlds) {
  assert.equal(
    semanticHash('ApplicabilityAssessment', applicability.semanticPayload),
    applicability.applicabilityAssessmentRef.semanticHash
  );
  assert.deepEqual(applicability.semanticPayload.decisionProblemRef, reconstructed.decisionProblemRef);
  assert.ok(
    closure.knowledgeRetrievalWorlds.some((world) =>
      refKey(world.knowledgeRetrievalResultRef) === refKey(applicability.semanticPayload.knowledgeRetrievalResultRef))
  );
}

assert.equal(closure.runtimeProfileWorld.runtimeProfileRef.kind, 'RuntimeProfile');
assert.equal(
  semanticHash('RuntimeProfile', closure.runtimeProfileWorld.semanticPayload),
  closure.runtimeProfileWorld.runtimeProfileRef.semanticHash
);

assert.ok(closure.runtimeBindingWorlds.length > 0, 'World P ACT decision must expose exact RuntimeBinding world');
let explicitEmptyBindingClassCount = 0;
for (const binding of closure.runtimeBindingWorlds) {
  assert.equal(semanticHash('RuntimeBinding', binding.semanticPayload), binding.runtimeBindingRef.semanticHash);
  assert.deepEqual(binding.semanticPayload.runtimeProfileRef, closure.runtimeProfileWorld.runtimeProfileRef);
  for (const field of [
    'knowledgeBindings',
    'transformationBindings',
    'modelBindings',
    'policyBindings',
    'implementationBindings',
    'calibrationBindings'
  ]) {
    assert.ok(Array.isArray(binding.semanticPayload[field]), `D01 ${field} must be explicitly inspectable`);
    if (binding.semanticPayload[field].length === 0) explicitEmptyBindingClassCount += 1;
  }
  assert.deepEqual(binding.semanticPayload.decisionProblemRef, reconstructed.decisionProblemRef);
}
assert.ok(explicitEmptyBindingClassCount > 0, 'unused D01 binding classes must remain explicitly empty');

const d05 = closure.decisionRobustnessWorld;
assert.deepEqual(d05.decisionRobustnessRef, reconstructed.decisionRobustnessRef);
assert.equal(semanticHash('DecisionRobustness', d05.semanticPayload), d05.decisionRobustnessRef.semanticHash);
assert.deepEqual(d05.semanticPayload.runtimeAlternativeSetRef, reconstructed.runtimeAlternativeSetRef);
assert.deepEqual(d05.semanticPayload.runtimeProfileRef, closure.runtimeProfileWorld.runtimeProfileRef);
assert.ok(Array.isArray(d05.semanticPayload.actionEvaluations));
assert.ok(Array.isArray(d05.semanticPayload.signatureGroups));
assert.ok(Array.isArray(d05.semanticPayload.actionChangingDiagnostics));
assert.ok(typeof d05.semanticPayload.robustnessClass === 'string');

if (closure.policyWorld) {
  assert.equal(closure.policyWorld.policyRef.kind, 'Policy');
  assert.equal(semanticHash('Policy', closure.policyWorld.semanticPayload), closure.policyWorld.policyRef.semanticHash);
  assert.deepEqual(d06.decisionAuthority.authorityRef, closure.policyWorld.policyRef);
}

assert.ok(closure.executionArtifactWorlds.length > 0, 'material World P execution specification/implementation world required');
for (const execution of closure.executionArtifactWorlds) {
  assert.equal(
    semanticHash('ImplementationConformance', execution.implementationConformanceSemanticPayload),
    execution.implementationConformanceRef.semanticHash
  );
  assert.equal(
    semanticHash(execution.specificationRef.kind, execution.specificationSemanticPayload),
    execution.specificationRef.semanticHash
  );
  assert.equal(
    semanticHash('Implementation', execution.implementationSemanticPayload),
    execution.implementationRef.semanticHash
  );
}

const projectedRefs = collectAuthorityRefs(closure);
for (const ref of projectedRefs) {
  assert.ok(
    containsRef(reconstructed.authorityGraph.allAuthorityRefs, ref),
    `authorityGraph must retain exact exit-gate ref ${ref.kind}/${ref.logicalId}`
  );
}

const {
  basisDigest,
  basisDigestAuthority: _basisDigestAuthority,
  decisionSemantics: _decisionSemantics,
  runtimeAlternativeProvenance: _runtimeAlternativeProvenance,
  authorityGraph: _authorityGraph,
  publicationAuditClosure: _publicationAuditClosure,
  exitGateClosure: _exitGateClosure,
  ...digestBasis
} = reconstructed;
assert.equal(basisDigest, semanticHash('HistoricalDecisionBasisReadModel', digestBasis));
assert.equal(
  basisDigest,
  'sha256:103e0136fa7d0d3ad3ef8ff0e2746369a3b294a428d68e54b741dbeec8c50d45',
  'World P frozen v1 basisDigest must not change'
);

console.log(JSON.stringify({
  ok: true,
  milestone: 'ADR_BLUEPRINT_ADR2_EXIT_GATE_AUTHORITY_WORLD_V1',
  decisionProblemSemanticsProjected: true,
  targetScopeLogicalTimeDeadlineProjected: true,
  exactContextManifestWorldCount: closure.contextEvidenceWorlds.length,
  exactContextDatumWorldCount: exactDatumCount,
  exactResolvedReceiptWorldCount: exactReceiptCount,
  exactKnowledgeReleaseWorldCount: closure.knowledgeReleaseWorlds.length,
  exactKnowledgeReleaseMemberCount: releaseMemberCount,
  completeKnowledgeReleaseMemberProvenanceProjected: true,
  exactKnowledgeRetrievalWorldCount: closure.knowledgeRetrievalWorlds.length,
  exactKnowledgeWorldCount: closure.knowledgeWorlds.length,
  scientificQualificationDecisionCount: qualificationDecisionCount,
  exactApplicabilityWorldCount: closure.applicabilityAssessmentWorlds.length,
  runtimeProfileSemanticsProjected: true,
  exactRuntimeBindingWorldCount: closure.runtimeBindingWorlds.length,
  explicitEmptyD01BindingClassCount: explicitEmptyBindingClassCount,
  exactExecutionArtifactWorldCount: closure.executionArtifactWorlds.length,
  decisionRobustnessSemanticsProjected: true,
  policySemanticsProjectedWhenMaterial: closure.policyWorld !== null,
  authorityGraphClosesOverExitGateRefs: true,
  basisDigestSemanticsChanged: false,
  historicalReconstructionAuthorityWrites: 0,
  latestLookupUsed: false,
  newAuthorityKindCreated: false,
  newArchitectureDecisionRequired: false
}, null, 2));
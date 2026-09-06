import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

import {
  GEOX_HISTORICAL_DECISION_BASIS_PROJECTION_AUTHORITY_CLAIM,
  GEOX_HISTORICAL_DECISION_BASIS_PROJECTION_CONSUMER_DISPOSITION,
  consumeAdrHistoricalDecisionBasisProjectionForGeox
} from '@adr/geox-adapter/historical-decision-basis-projection-sink';

const event = JSON.parse(readFileSync('governed-historical-decision-basis-event.json', 'utf8'));
const receipt = JSON.parse(readFileSync('qualification-receipt.json', 'utf8'));

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

function adrSemanticHash(kind, value) {
  return `sha256:${createHash('sha256')
    .update(Buffer.from(`adr-semantic-hash-v1\nkind:${kind}\n${canonicalJson(value)}`, 'utf8'))
    .digest('hex')}`;
}

function refKey(ref) {
  return canonicalJson(ref);
}

function canonicalRefs(values) {
  const map = new Map(values.map((ref) => [refKey(ref), ref]));
  return [...map.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([, ref]) => ref);
}

function decisionResultExactRefs(payload) {
  const refs = [
    payload.decisionProblemRef,
    payload.decisionAuthority.authorityRef,
    payload.decisionRobustnessRef,
    payload.runtimeAlternativeSetRef,
    ...payload.runtimeBindingRefs,
    ...payload.policyResultRefs.flatMap((item) => [item.runtimeBindingRef, item.policyRef])
  ];
  if (payload.humanGate) refs.push(payload.humanGate.policyRef);
  if (payload.waitSemantics) refs.push(payload.waitSemantics.policyRef, payload.waitSemantics.decisionRobustnessRef);
  if (payload.abstentionReasonAuthority) {
    refs.push(payload.abstentionReasonAuthority.decisionRobustnessRef);
    if (payload.abstentionReasonAuthority.policyRef) refs.push(payload.abstentionReasonAuthority.policyRef);
  }
  return canonicalRefs(refs);
}

function verifyPublicationAuditClosure(historicalBasis) {
  const closure = historicalBasis.publicationAuditClosure;
  assert.equal(
    closure.projectionClass,
    'NONE_NON_AUTHORITY_EXACT_DECISION_RESULT_PUBLICATION_AUDIT_PROJECTION'
  );
  assert.equal(canonicalJson(closure.decisionResultRef), canonicalJson(historicalBasis.decisionResultRef));
  const audit = closure.auditEvent;
  const { eventHash, ...auditPayload } = audit;
  assert.match(eventHash, /^sha256:[a-f0-9]{64}$/);
  assert.equal(eventHash, adrSemanticHash('AuditEvent', auditPayload));
  assert.equal(canonicalJson(audit.objectRef), canonicalJson(historicalBasis.decisionResultRef));
  assert.equal(audit.action, 'PUBLISH_DECISION_RESULT');
  assert.equal(audit.actor.id, audit.details.decisionResultPrincipal.principalId);
  assert.equal(audit.actor.type, audit.details.decisionResultPrincipal.type);

  const d06 = historicalBasis.decisionSemantics.semanticPayload;
  assert.equal(canonicalJson(canonicalRefs(audit.inputRefs)), canonicalJson(decisionResultExactRefs(d06)));
  assert.equal(canonicalJson(audit.details.decisionRobustnessRef), canonicalJson(d06.decisionRobustnessRef));
  assert.equal(canonicalJson(audit.details.runtimeAlternativeSetRef), canonicalJson(d06.runtimeAlternativeSetRef));
  assert.equal(audit.details.decisionDisposition, d06.decisionDisposition);
  assert.equal(canonicalJson(audit.details.decisionAuthority), canonicalJson(d06.decisionAuthority));
  assert.equal(
    canonicalJson(audit.details.informationRequirementRefs ?? []),
    canonicalJson(d06.informationRequirementRefs)
  );
  assert.equal(
    canonicalJson(audit.details.policyResultHashes ?? []),
    canonicalJson(d06.policyResultRefs.map((item) => item.policyResultHash))
  );
  assert.equal(audit.details.humanApprovalAuthority, d06.humanApprovalAuthority);
  assert.equal(audit.details.machineExecutionAuthority, d06.machineExecutionAuthority);
  return eventHash;
}

assert.equal('authority_ref' in event, false, 'historical basis projection transport must not masquerade as an AuthorityRef event');
const projection = consumeAdrHistoricalDecisionBasisProjectionForGeox({
  event,
  consumerScope: receipt.consumerScope
});

assert.equal(projection.projection_hash, receipt.expectedProjectionHash);
assert.equal(projection.basis_digest, receipt.expectedBasisDigest);
assert.deepEqual(projection.entry_decision_result_ref, receipt.expectedDecisionResultRef);
assert.equal(projection.consumer_disposition, GEOX_HISTORICAL_DECISION_BASIS_PROJECTION_CONSUMER_DISPOSITION);
assert.equal(projection.field_actionable, false);
assert.equal(projection.dispatch_authorized, false);
assert.equal(projection.decision_result_semantic_hash_verified, true);
assert.equal(projection.runtime_alternative_provenance_verified, true);
assert.equal(projection.authority_claim, GEOX_HISTORICAL_DECISION_BASIS_PROJECTION_AUTHORITY_CLAIM);
assert.equal(
  projection.transport_verification,
  'PROJECTION_HASH_INTEGRITY_ONLY_UPSTREAM_AUTHORITY_REPLAY_NOT_REPERFORMED'
);
assert.deepEqual(projection.historical_basis.nonclaims, {
  humanApprovalAuthority: false,
  dispatchAuthority: false,
  machineExecutionAuthority: false,
  executionReceiptAuthority: false,
  outcomeAuthority: false,
  causalAttributionAuthority: false
});
assert.equal(
  projection.historical_basis.runtimeAlternativeProvenance.projectionClass,
  'NONE_NON_AUTHORITY_EXACT_RUNTIME_ALTERNATIVE_PROVENANCE_PROJECTION'
);
const publicationAuditEventHash = verifyPublicationAuditClosure(projection.historical_basis);
assert.equal(publicationAuditEventHash, receipt.expectedPublicationAuditEventHash);

console.log(JSON.stringify({
  ok: true,
  sourceCommit: receipt.sourceCommit,
  bundleEvidenceHash: receipt.bundleEvidenceHash,
  projectionHash: projection.projection_hash,
  basisDigest: projection.basis_digest,
  entryDecisionResultRef: projection.entry_decision_result_ref,
  authorityGraphRefCount: projection.historical_basis.authorityGraph.allAuthorityRefs.length,
  runtimeAlternativePathCount: projection.historical_basis.runtimeAlternativeProvenance.pathWorlds.length,
  runtimePlanCompilerVersion: projection.historical_basis.runtimeAlternativeProvenance.runtimePlanCompilerVersion,
  decisionResultSemanticHashVerified: projection.decision_result_semantic_hash_verified,
  runtimeAlternativeProvenanceVerified: projection.runtime_alternative_provenance_verified,
  publicationAuditEventHash,
  publicationAuditHashVerified: true,
  publicationAuditD06RefClosureVerified: true,
  consumerDisposition: projection.consumer_disposition,
  fieldActionable: projection.field_actionable,
  dispatchAuthorized: projection.dispatch_authorized,
  transportVerification: projection.transport_verification,
  authorityClaim: projection.authority_claim
}, null, 2));

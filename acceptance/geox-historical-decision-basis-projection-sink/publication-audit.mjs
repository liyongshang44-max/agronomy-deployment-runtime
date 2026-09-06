import assert from 'node:assert/strict';

import {
  canonicalizeSemanticJson,
  semanticHash
} from '../../packages/canonicalization/src/index.mjs';
import { decisionResultExactRefs } from '../../packages/decision-result/src/contract.mjs';
import { ExactContextSnapshotStore } from '../../packages/reference-resolution/src/index.mjs';
import {
  HISTORICAL_DECISION_BASIS_PUBLICATION_AUDIT_CLASS,
  reconstructHistoricalDecisionBasisWithPublicationAudit
} from '../../packages/historical-decision-basis/src/publication-audit.mjs';
import {
  informationDecisionWorld,
  policyDecisionWorld,
  publishResult,
  publishRobustness
} from '../decision-result/fixture.mjs';
import { makePolicyActionOutput } from '../decision-robustness/fixture.mjs';

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function refKey(ref) {
  return canonicalizeSemanticJson(ref);
}

function canonicalRefs(values) {
  const map = new Map(values.map((ref) => [refKey(ref), ref]));
  return [...map.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([, ref]) => ref);
}

function auditPayload(event) {
  const { eventHash: _eventHash, ...payload } = event;
  return payload;
}

function proveWorld({ label, world, result, expectedDisposition }) {
  const ledger = world.env.ledger;
  const snapshotStore = new ExactContextSnapshotStore();
  const before = ledger.exportSnapshot().records.length;
  const basis = reconstructHistoricalDecisionBasisWithPublicationAudit({
    ledger,
    snapshotStore,
    decisionResultRef: result.ref
  });
  assert.equal(ledger.exportSnapshot().records.length, before, `${label} reconstruction must remain read-only`);

  const closure = basis.publicationAuditClosure;
  const event = closure.auditEvent;
  const d06 = basis.decisionSemantics.semanticPayload;
  assert.equal(closure.projectionClass, HISTORICAL_DECISION_BASIS_PUBLICATION_AUDIT_CLASS);
  assert.deepEqual(closure.decisionResultRef, result.ref);
  assert.deepEqual(event.objectRef, result.ref);
  assert.equal(event.action, 'PUBLISH_DECISION_RESULT');
  assert.equal(event.details.decisionDisposition, expectedDisposition);
  assert.equal(
    event.eventHash,
    semanticHash('AuditEvent', auditPayload(event)),
    `${label} projected publication AuditEvent must reproduce its canonical eventHash`
  );
  assert.deepEqual(
    canonicalRefs(event.inputRefs),
    canonicalRefs(decisionResultExactRefs(d06)),
    `${label} publication audit must close over the exact D06 predecessor ref set`
  );
  assert.deepEqual(event.details.decisionRobustnessRef, d06.decisionRobustnessRef);
  assert.deepEqual(event.details.runtimeAlternativeSetRef, d06.runtimeAlternativeSetRef);
  assert.equal(canonicalizeSemanticJson(event.details.decisionAuthority), canonicalizeSemanticJson(d06.decisionAuthority));
  assert.equal(
    canonicalizeSemanticJson(event.details.informationRequirementRefs ?? []),
    canonicalizeSemanticJson(d06.informationRequirementRefs)
  );
  assert.deepEqual(event.details.policyResultHashes ?? [], d06.policyResultRefs.map((item) => item.policyResultHash));
  assert.equal(event.details.humanApprovalAuthority, d06.humanApprovalAuthority);
  assert.equal(event.details.machineExecutionAuthority, d06.machineExecutionAuthority);

  const {
    basisDigest,
    basisDigestAuthority: _basisDigestAuthority,
    decisionSemantics: _decisionSemantics,
    runtimeAlternativeProvenance: _runtimeAlternativeProvenance,
    authorityGraph: _authorityGraph,
    publicationAuditClosure: _publicationAuditClosure,
    ...digestBasis
  } = basis;
  assert.equal(
    basisDigest,
    semanticHash('HistoricalDecisionBasisReadModel', digestBasis),
    'publication audit closure must remain outside the frozen v1 basisDigest'
  );

  const tampered = clone(closure);
  tampered.auditEvent.details.decisionDisposition = expectedDisposition === 'ACT' ? 'WAIT' : 'ACT';
  assert.notEqual(
    semanticHash('AuditEvent', auditPayload(tampered.auditEvent)),
    tampered.auditEvent.eventHash,
    `${label} altered publication evidence must no longer reproduce the frozen AuditEvent hash`
  );

  return basis;
}

const actWorld = policyDecisionWorld('adr2-publication-audit-act');
const actRobustness = publishRobustness(actWorld, {
  actionOutput: makePolicyActionOutput({ amount: '10', startTime: '2026-08-20T11:00:00Z' }),
  label: 'adr2-publication-audit-act'
});
const act = proveWorld({
  label: 'act',
  world: actWorld,
  result: publishResult(actWorld, actRobustness, 'adr2-publication-audit-act'),
  expectedDisposition: 'ACT'
});

const waitWorld = policyDecisionWorld('adr2-publication-audit-wait', {
  policyOverrides: { fallback: { disposition: 'WAIT' } }
});
const waitRobustness = publishRobustness(waitWorld, {
  includeExecution: false,
  label: 'adr2-publication-audit-wait'
});
const wait = proveWorld({
  label: 'wait',
  world: waitWorld,
  result: publishResult(waitWorld, waitRobustness, 'adr2-publication-audit-wait'),
  expectedDisposition: 'WAIT'
});

const askWorld = informationDecisionWorld('adr2-publication-audit-ask');
const ask = proveWorld({
  label: 'ask',
  world: askWorld,
  result: publishResult(askWorld, askWorld.robustness, 'adr2-publication-audit-ask'),
  expectedDisposition: 'ASK'
});

const abstainWorld = policyDecisionWorld('adr2-publication-audit-abstain');
const abstainRobustness = publishRobustness(abstainWorld, {
  executionStatus: 'FAILED',
  label: 'adr2-publication-audit-abstain'
});
const abstain = proveWorld({
  label: 'abstain',
  world: abstainWorld,
  result: publishResult(abstainWorld, abstainRobustness, 'adr2-publication-audit-abstain'),
  expectedDisposition: 'ABSTAIN'
});

console.log(JSON.stringify({
  ok: true,
  milestone: 'ADR_BLUEPRINT_ADR2_DECISION_RESULT_PUBLICATION_AUDIT_CLOSURE_V1',
  dispositionsProved: [
    act.decisionDisposition,
    wait.decisionDisposition,
    ask.decisionDisposition,
    abstain.decisionDisposition
  ],
  exactPublicationAuditEventProjected: true,
  auditEventSemanticHashVerified: true,
  exactD06InputRefClosureVerified: true,
  auditActorAndDecisionSemanticsVerified: true,
  tamperedAuditEvidenceRejectedByHash: true,
  basisDigestSemanticsChanged: false,
  historicalReconstructionAuthorityWrites: 0,
  newAuthorityKindCreated: false,
  newArchitectureDecisionRequired: false
}, null, 2));

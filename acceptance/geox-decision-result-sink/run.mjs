import assert from 'node:assert/strict';

import { createResultSinkEvent } from '../../sdks/typescript/src/index.mjs';
import {
  GEOX_DECISION_RESULT_AUTHORITY_BOUNDARY,
  GEOX_DECISION_RESULT_CONSUMER_DISPOSITION,
  GEOX_DECISION_RESULT_SINK_VERSION,
  GEOX_DECISION_RESULT_TARGET_BINDING_MODE,
  consumeAdrDecisionResultForGeox
} from '../../adapters/geox/src/decision-result-sink.mjs';

const consumerScope = Object.freeze({
  tenantId: 'tenant-a',
  projectId: 'project-a',
  groupId: 'group-a'
});

function toWireRef(ref) {
  return Object.freeze({
    kind: ref.kind,
    logical_id: ref.logicalId,
    version: ref.version,
    semantic_hash: ref.semanticHash
  });
}

const captured = [];
const originalLog = console.log;
console.log = (...args) => {
  if (args.length === 1 && typeof args[0] === 'string') captured.push(args[0]);
};
try {
  await import('../real-kbs-soybean-planting-population-target/run-decision-result-v1.mjs');
} finally {
  console.log = originalLog;
}

const emittedWorlds = captured.flatMap((entry) => {
  try { return [JSON.parse(entry)]; }
  catch { return []; }
});
const planting = emittedWorlds.find((entry) =>
  entry?.milestone === 'REAL_WORLD_HETEROGENEITY_PLANTING_D02_D04_D05_D06_STRICT_POSITIVE');
assert.ok(planting, 'real planting D06 world output must be emitted by the frozen acceptance runner');
assert.equal(planting.ok, true);
assert.equal(planting.alternativeCoverage.completenessClass, 'EXHAUSTIVE_ENUMERATION');
assert.equal(planting.decisionRobustness.robustnessClass, 'ROBUST');
assert.equal(planting.decisionResult.disposition, 'ACT');
assert.equal(planting.decisionResult.structuredAction.actionCode, 'SET_SOYBEAN_SEEDING_RATE');
assert.equal(planting.decisionResult.structuredAction.materialParameters.length, 1);
assert.equal(
  planting.decisionResult.structuredAction.materialParameters[0].value.decimal,
  '150000'
);
assert.equal(
  planting.decisionResult.humanApprovalAuthority,
  GEOX_DECISION_RESULT_AUTHORITY_BOUNDARY.humanApprovalAuthority
);
assert.equal(
  planting.decisionResult.machineExecutionAuthority,
  GEOX_DECISION_RESULT_AUTHORITY_BOUNDARY.machineExecutionAuthority
);
assert.equal(planting.frozenWorld.historicalOperationPopulationPromotedToDecisionInput, false);
assert.equal(planting.nonclaims.executionReceiptCreated, false);
assert.equal(planting.nonclaims.outcomeCreated, false);

const event = createResultSinkEvent({
  eventId: 'geox-real-planting-decision-result-1',
  eventType: 'DECISION_RESULT_PUBLISHED',
  authorityRef: toWireRef(planting.decisionResult.decisionResultRef),
  payload: {
    decision_disposition: planting.decisionResult.disposition,
    structured_action: planting.decisionResult.structuredAction,
    human_approval_authority: planting.decisionResult.humanApprovalAuthority,
    machine_execution_authority: planting.decisionResult.machineExecutionAuthority,
    target_binding: {
      mode: GEOX_DECISION_RESULT_TARGET_BINDING_MODE,
      reason_code: 'REAL_PLANTING_WORLD_HAS_NO_GOVERNED_GEOX_FIELD_BINDING'
    }
  }
});

const projection = consumeAdrDecisionResultForGeox({ event, consumerScope });
assert.equal(projection.contract_version, GEOX_DECISION_RESULT_SINK_VERSION);
assert.deepEqual(projection.routing_scope, {
  tenant_id: 'tenant-a',
  project_id: 'project-a',
  group_id: 'group-a'
});
assert.deepEqual(
  projection.adr_decision_result_ref,
  toWireRef(planting.decisionResult.decisionResultRef)
);
assert.equal(projection.decision_disposition, 'ACT');
assert.equal(projection.adr_structured_action.actionCode, 'SET_SOYBEAN_SEEDING_RATE');
assert.equal(projection.adr_structured_action.materialParameters[0].value.decimal, '150000');
assert.equal(projection.target_binding.status, 'UNRESOLVED');
assert.equal(projection.target_binding.source_mode, GEOX_DECISION_RESULT_TARGET_BINDING_MODE);
assert.equal(projection.consumer_disposition, GEOX_DECISION_RESULT_CONSUMER_DISPOSITION);
assert.equal(projection.dispatch_authorized, false);
assert.equal(projection.field_actionable, false);
assert.deepEqual(projection.upstream_authority_boundary, {
  human_approval_authority: GEOX_DECISION_RESULT_AUTHORITY_BOUNDARY.humanApprovalAuthority,
  machine_execution_authority: GEOX_DECISION_RESULT_AUTHORITY_BOUNDARY.machineExecutionAuthority
});
assert.equal(projection.authority_claim, 'NONE_GEOX_ADAPTER_RESULT_PROJECTION_ONLY');
assert.equal('field_id' in projection.routing_scope, false);
assert.equal('geometry_ref' in projection.routing_scope, false);

originalLog(JSON.stringify({
  ok: true,
  milestone: 'PRODUCTIZATION_GEOX_DECISION_RESULT_SINK_V1',
  sourceWorld: planting.milestone,
  decisionResultRef: planting.decisionResult.decisionResultRef,
  action: planting.decisionResult.structuredAction,
  consumerProjection: projection,
  productBoundary: {
    targetIdentityBoundToGeoxField: false,
    displayOnly: true,
    dispatchAuthorized: false,
    fieldActionable: false,
    executionReceiptCreated: false,
    outcomeCreated: false
  },
  genericSdkContractModified: false,
  adrCoreModified: false
}, null, 2));

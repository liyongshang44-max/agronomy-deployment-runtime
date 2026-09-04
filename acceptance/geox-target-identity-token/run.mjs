import assert from 'node:assert/strict';

import { createIntegrationMessage } from '../../sdks/typescript/src/index.mjs';
import {
  GEOX_TARGET_IDENTITY_AUTHORITY_CLAIM,
  GEOX_TARGET_IDENTITY_MAPPING_STATUS,
  GEOX_TARGET_IDENTITY_MESSAGE_TYPE,
  GEOX_TARGET_IDENTITY_TOKEN_VERSION,
  consumeAdrTargetIdentityTokenForGeox
} from '../../adapters/geox/src/target-identity-token.mjs';

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
  await import('../gold-recorded-operation-decision-problem-farm-target-binding-sustainable-corn/run.mjs');
} finally {
  console.log = originalLog;
}

const goldOutputs = captured.flatMap((entry) => {
  try { return [JSON.parse(entry)]; }
  catch { return []; }
});
const gold = goldOutputs.find((entry) =>
  entry?.authority === 'AgronomicDecisionProblemFarmTargetBindingPublication');
assert.ok(gold, 'DEC-0032 Sustainable Corn Gold must emit its authority-backed target world');
assert.equal(gold.ok, true);
assert.equal(gold.goldKind, 'PUBLIC_REAL_SOURCE_TARGET_PLUS_DETERMINISTIC_A01_FIXTURE');
assert.equal(gold.farmIdAuthorityClassification, 'EXACT_DEC_0027_SOURCE_BACKED');
assert.match(gold.sourceBackedFarmId, /^target_src_[0-9a-f]{64}$/);
assert.equal(gold.targetRef.farmId, gold.sourceBackedFarmId);
assert.equal(gold.targetRef.organizationId, 'org-a');
assert.equal(gold.targetRef.tenantId, 'tenant-a');
assert.equal(gold.fieldSeasonZoneAuthorityCreated, false);
assert.equal(gold.geometryAuthorityCreated, false);
assert.equal(gold.contextManifestCreated, false);
assert.equal(gold.forbiddenDownstreamAuthorityRecordsCreated, 0);

const message = createIntegrationMessage({
  role: 'RESULT_SINK',
  messageType: GEOX_TARGET_IDENTITY_MESSAGE_TYPE,
  messageId: 'geox-sustainable-corn-farm-target-token-1',
  authorityRefs: [
    toWireRef(gold.decisionProblemRef),
    toWireRef(gold.bindingCompilationRef),
    toWireRef(gold.parentTargetRefFarmInstanceProjection)
  ],
  payload: {
    adr_target_ref: {
      organization_id: gold.targetRef.organizationId,
      tenant_id: gold.targetRef.tenantId,
      farm_id: gold.targetRef.farmId
    },
    farm_id_authority_classification: gold.farmIdAuthorityClassification
  }
});

const projection = consumeAdrTargetIdentityTokenForGeox({ message, consumerScope });
assert.equal(projection.contract_version, GEOX_TARGET_IDENTITY_TOKEN_VERSION);
assert.deepEqual(projection.routing_scope, {
  tenant_id: 'tenant-a',
  project_id: 'project-a',
  group_id: 'group-a'
});
assert.equal(projection.adr_target_identity.granularity, 'FARM');
assert.equal(
  projection.adr_target_identity.target_ref.farm_id,
  gold.sourceBackedFarmId
);
assert.equal(
  projection.adr_target_identity.authority_classification,
  'EXACT_DEC_0027_SOURCE_BACKED'
);
assert.deepEqual(
  projection.adr_target_identity.authority_chain.DecisionProblem,
  toWireRef(gold.decisionProblemRef)
);
assert.deepEqual(
  projection.adr_target_identity.authority_chain.AgronomicDecisionProblemFarmTargetBindingCompilation,
  toWireRef(gold.bindingCompilationRef)
);
assert.deepEqual(
  projection.adr_target_identity.authority_chain.AgronomicContextTargetRefFarmInstanceProjectionCompilation,
  toWireRef(gold.parentTargetRefFarmInstanceProjection)
);
assert.equal(projection.geox_field_mapping.status, GEOX_TARGET_IDENTITY_MAPPING_STATUS);
assert.equal(projection.geox_field_mapping.field_id, null);
assert.equal(projection.geox_field_mapping.mapping_authority_ref, null);
assert.equal(projection.field_actionable, false);
assert.equal(projection.dispatch_authorized, false);
assert.equal(projection.authority_claim, GEOX_TARGET_IDENTITY_AUTHORITY_CLAIM);
assert.equal('field_id' in projection.routing_scope, false);
assert.equal('zone_id' in projection.routing_scope, false);

originalLog(JSON.stringify({
  ok: true,
  milestone: 'PRODUCTIZATION_GEOX_ADR_FARM_TARGET_IDENTITY_TOKEN_V1',
  sourceAuthorityWorld: {
    authority: gold.authority,
    parentTargetRefFarmInstanceProjection: gold.parentTargetRefFarmInstanceProjection,
    bindingCompilationRef: gold.bindingCompilationRef,
    decisionProblemRef: gold.decisionProblemRef,
    sourceBackedFarmId: gold.sourceBackedFarmId,
    farmIdAuthorityClassification: gold.farmIdAuthorityClassification,
    fieldSeasonZoneAuthorityCreated: gold.fieldSeasonZoneAuthorityCreated,
    geometryAuthorityCreated: gold.geometryAuthorityCreated
  },
  consumerProjection: projection,
  productBoundary: {
    adrFarmIdentityTransported: true,
    adrFarmIdentityReinterpretedAsGeoxField: false,
    geoxFieldMappingStatus: projection.geox_field_mapping.status,
    fieldActionable: false,
    dispatchAuthorized: false
  },
  genericSdkContractModified: false,
  adrCoreModified: false,
  newArchitectureDecisionRequired: false
}, null, 2));

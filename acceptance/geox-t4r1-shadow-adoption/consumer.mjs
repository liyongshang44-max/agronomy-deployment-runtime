import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';

import {
  GEOX_DECISION_RESULT_SINK_VERSION,
  consumeAdrDecisionResultForGeox
} from '@adr/geox-adapter/decision-result-sink';
import { GeoxDurableTargetAuthorityStore } from '@adr/geox-adapter/durable-target-authority-store';
import {
  createGitHubPublicAuthorityTransport,
  replayGeoxTargetAuthorityResolution,
  resolveGeoxTargetAuthority
} from '@adr/geox-adapter/target-authority-resolver';
import {
  GEOX_TARGET_CORRESPONDENCE_RELATION,
  getGeoxTargetCorrespondenceProfile
} from '@adr/geox-adapter/target-correspondence-profile-registry';

function sha256Text(value) {
  return `sha256:${createHash('sha256').update(value, 'utf8').digest('hex')}`;
}

function expectSinkError(event, consumerScope, expectedCode) {
  let caught = null;
  try {
    consumeAdrDecisionResultForGeox({ event, consumerScope });
  } catch (error) {
    caught = error;
  }
  assert.ok(caught, `sink must reject ${expectedCode} probe`);
  assert.equal(caught.code, expectedCode);
}

const inputPath = process.argv[2];
const durableRoot = process.argv[3];
assert.ok(inputPath && durableRoot, 'shadow consumer requires input and durable-store paths');

const input = JSON.parse(readFileSync(inputPath, 'utf8'));
assert.equal(input.contractVersion, 'adr.geox-t4r1-shadow-adoption-input.v1');
assert.match(input.adrSourceCommit, /^[0-9a-f]{40}$/);
assert.match(input.geoxSourceCommit, /^[0-9a-f]{40}$/);
assert.equal(input.profileRelation, GEOX_TARGET_CORRESPONDENCE_RELATION);
assert.equal(input.decisionResultRef.kind, 'DecisionResult');
assert.equal(input.decisionResultDisposition, 'ACT');
assert.equal(input.structuredAction.actionCode, 'SET_CORN_SEEDING_RATE_RANGE');

const profile = getGeoxTargetCorrespondenceProfile(GEOX_TARGET_CORRESPONDENCE_RELATION);
assert.ok(profile);
assert.equal(profile.replayableResolverSupported, true);
assert.equal(profile.provider.treatment_code, 'T4');
assert.equal(profile.provider.replicate_code, 'R1');
assert.equal(profile.provider.crop_code, 'corn');
assert.equal(profile.provider.hybrid_code, '43-96P');
assert.equal(profile.provider.planting_observation_id, '6974');
assert.equal(profile.geox.field_id, 'field_kbs_mcse_t4r1');
assert.equal(profile.geox.season_id, 'season_2026_corn');
assert.equal(profile.geox.zone_id, 'zone_kbs_mcse_t4r1_crop_formal_v1');

const token = process.env.GITHUB_TOKEN?.trim();
const authenticatedFetch = async (url, init = {}) => globalThis.fetch(url, {
  ...init,
  headers: {
    ...(init.headers ?? {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {})
  }
});

const store = new GeoxDurableTargetAuthorityStore({ rootDir: durableRoot });
const live = await resolveGeoxTargetAuthority({
  ref: input.geoxSourceCommit,
  resolvedAt: input.resolvedAt,
  transport: createGitHubPublicAuthorityTransport({ fetchImpl: authenticatedFetch }),
  snapshotStore: store
});
const receiptHash = store.persistReceipt(live.receipt);
const replay = replayGeoxTargetAuthorityResolution({ receipt: live.receipt, snapshotStore: store });

assert.equal(live.receipt.resolved_commit_sha, input.geoxSourceCommit);
assert.equal(replay.replayClass, 'EXACT');
assert.equal(replay.authorityExport.source_main_sha, input.geoxSourceCommit);
assert.equal(replay.authorityExport.provider_target.treatment_code, profile.provider.treatment_code);
assert.equal(replay.authorityExport.provider_target.replicate_code, profile.provider.replicate_code);
assert.equal(replay.authorityExport.provider_target.crop_code, profile.provider.crop_code);
assert.equal(replay.authorityExport.provider_target.hybrid_code, profile.provider.hybrid_code);
assert.equal(replay.authorityExport.provider_target.planting_observation_id, profile.provider.planting_observation_id);
assert.equal(replay.authorityExport.geox_target.field_id, profile.geox.field_id);
assert.equal(replay.authorityExport.geox_target.season_id, profile.geox.season_id);
assert.equal(replay.authorityExport.geox_target.zone_id, profile.geox.zone_id);
assert.equal(replay.authorityExport.authority_boundary.field_actionability_authorized, false);
assert.equal(replay.authorityExport.authority_boundary.dispatch_authorized, false);
assert.equal(live.receipt.human_approval_authority, 'NONE');
assert.equal(live.receipt.machine_execution_authority, 'NONE');

const projection = consumeAdrDecisionResultForGeox({
  event: input.decisionResultEvent,
  consumerScope: input.consumerScope
});
assert.equal(projection.contract_version, GEOX_DECISION_RESULT_SINK_VERSION);
assert.equal(projection.adr_decision_result_ref.semantic_hash, input.decisionResultRef.semantic_hash);
assert.equal(projection.decision_disposition, 'ACT');
assert.equal(projection.adr_structured_action.actionCode, 'SET_CORN_SEEDING_RATE_RANGE');
assert.equal(projection.target_binding.status, 'UNRESOLVED');
assert.equal(projection.field_actionable, false);
assert.equal(projection.dispatch_authorized, false);
assert.equal(projection.authority_claim, 'NONE_GEOX_ADAPTER_RESULT_PROJECTION_ONLY');

const promotedFieldEvent = structuredClone(input.decisionResultEvent);
promotedFieldEvent.payload.target_binding = {
  mode: 'GEOX_FIELD_BOUND',
  reason_code: 'NEGATIVE_PROBE_MUST_FAIL'
};
expectSinkError(promotedFieldEvent, input.consumerScope, 'GEOX_DECISION_RESULT_TARGET_BINDING_REQUIRED');

const approvalEscalationEvent = structuredClone(input.decisionResultEvent);
approvalEscalationEvent.payload.human_approval_authority = 'GRANTED';
expectSinkError(approvalEscalationEvent, input.consumerScope, 'GEOX_DECISION_RESULT_AUTHORITY_ESCALATION_FORBIDDEN');

const hiddenWriteEvent = structuredClone(input.decisionResultEvent);
hiddenWriteEvent.payload.operation_plan_id = 'forbidden-shadow-write-signal';
expectSinkError(hiddenWriteEvent, input.consumerScope, 'GEOX_DECISION_RESULT_PAYLOAD_FIELD_FORBIDDEN');

const geoxRawBase = `https://raw.githubusercontent.com/liyongshang44-max/GEOX/${input.geoxSourceCommit}`;
const engineUrl = `${geoxRawBase}/apps/server/src/domain/agronomy/engine.ts`;
const cornRulesUrl = `${geoxRawBase}/apps/server/src/domain/agronomy/rules/corn_rules.ts`;
const [engineResponse, cornRulesResponse] = await Promise.all([globalThis.fetch(engineUrl), globalThis.fetch(cornRulesUrl)]);
assert.equal(engineResponse.ok, true, `must fetch exact GEOX engine source at ${input.geoxSourceCommit}`);
assert.equal(cornRulesResponse.ok, true, `must fetch exact GEOX corn rules at ${input.geoxSourceCommit}`);
const engineSource = await engineResponse.text();
const cornRulesSource = await cornRulesResponse.text();
assert.match(engineSource, /export async function generateAgronomyRecommendation\s*\(/);

const nativeActionTypes = [...new Set(
  [...cornRulesSource.matchAll(/action_type:\s*"([A-Z_]+)"/g)].map((match) => match[1])
)].sort();
assert.deepEqual(nativeActionTypes, ['INSPECT', 'IRRIGATE']);
assert.equal(nativeActionTypes.some((action) => /(SEED|PLANT|POPULATION)/.test(action)), false);
assert.equal(cornRulesSource.includes('SET_CORN_SEEDING_RATE_RANGE'), false);

const comparison = Object.freeze({
  status: 'NOT_APPLICABLE',
  reasonCode: 'DOMAIN_NOT_COMPARABLE',
  adrActionCode: projection.adr_structured_action.actionCode,
  nativeRegisteredActionTypes: nativeActionTypes,
  nativeEngineInvoked: false,
  syntheticActionTranslationCreated: false,
  explanation: 'Exact GEOX corn rules expose IRRIGATE and INSPECT only; no planting/seeding-rate native action is registered, so crop equality does not create action-domain comparability.'
});

const shadowEvidence = Object.freeze({
  contractVersion: 'adr.geox-shadow-comparison-evidence.v1',
  classification: 'OBSERVATIONAL_COMPARATIVE_ONLY',
  adrArtifact: {
    sourceCommit: input.adrSourceCommit,
    packageName: input.packageName,
    packageVersion: input.packageVersion,
    packageTarballHash: input.packageTarballHash,
    provenanceHash: input.provenanceHash,
    bundleEvidenceHash: input.bundleEvidenceHash
  },
  decisionResult: {
    authorityRef: input.decisionResultRef,
    disposition: input.decisionResultDisposition,
    structuredAction: input.structuredAction
  },
  geoxAuthority: {
    sourceRepository: 'liyongshang44-max/GEOX',
    resolvedCommitSha: live.receipt.resolved_commit_sha,
    authorityExportHash: live.receipt.authority_export_hash,
    resolutionReceiptHash: receiptHash,
    replayClass: replay.replayClass,
    correspondenceProfileRegistryVersion: input.profileRegistryVersion,
    correspondenceRelation: profile.relation,
    providerTarget: profile.provider,
    geoxTarget: profile.geox
  },
  decisionProjection: projection,
  nativeComparator: {
    sourceCommit: input.geoxSourceCommit,
    enginePath: 'apps/server/src/domain/agronomy/engine.ts',
    engineSourceHash: sha256Text(engineSource),
    cornRulesPath: 'apps/server/src/domain/agronomy/rules/corn_rules.ts',
    cornRulesSourceHash: sha256Text(cornRulesSource),
    comparison
  },
  authorityCeiling: {
    canonicalRecommendationCreated: false,
    recommendationCreated: false,
    approvalRequestCreated: false,
    operationPlanCreated: false,
    taskCreated: false,
    dispatchCreated: false,
    executionReceiptCreated: false,
    machineExecutionAuthorityCreated: false,
    fieldActionabilityGranted: false,
    identityEqualityClaimed: false,
    geometryEqualityClaimed: false
  }
});

console.log(JSON.stringify({
  ok: true,
  milestone: 'ADR_GEOX_T4R1_SAME_TARGET_SHADOW_ADOPTION_V1',
  shadowEvidence
}, null, 2));

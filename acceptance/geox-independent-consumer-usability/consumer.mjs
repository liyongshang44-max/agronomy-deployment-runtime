import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import {
  GEOX_DECISION_RESULT_AUTHORITY_BOUNDARY,
  GEOX_DECISION_RESULT_CONSUMER_DISPOSITION,
  GEOX_DECISION_RESULT_SINK_VERSION,
  GEOX_DECISION_RESULT_TARGET_BINDING_MODE,
  consumeAdrDecisionResultForGeox
} from '@adr/geox-adapter/decision-result-sink';

function sha256(bytes) {
  return `sha256:${createHash('sha256').update(bytes).digest('hex')}`;
}

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])]));
  }
  return value;
}

function canonicalJson(value) {
  return `${JSON.stringify(canonical(value), null, 2)}\n`;
}

function parseChecksums(text) {
  const entries = new Map();
  for (const line of text.trim().split('\n')) {
    const match = /^([0-9a-f]{64})  ([^/]+)$/.exec(line);
    assert.ok(match, `invalid SHA256SUMS line: ${line}`);
    assert.equal(entries.has(match[2]), false, `duplicate checksum entry: ${match[2]}`);
    entries.set(match[2], match[1]);
  }
  return entries;
}

const root = process.cwd();
const bundleDir = join(root, 'bundle');
const receipt = JSON.parse(readFileSync(join(root, 'qualification-receipt.json'), 'utf8'));
const event = JSON.parse(readFileSync(join(root, 'governed-decision-result-event.json'), 'utf8'));

assert.equal(receipt.contractVersion, 'adr.geox-independent-consumer-qualification-receipt.v1');
assert.match(receipt.sourceCommit, /^[0-9a-f]{40}$/);
assert.equal(receipt.packageName, '@adr/geox-adapter');
assert.equal(receipt.packageVersion, '0.1.0-development');
assert.equal(receipt.releaseStatus, 'QUALIFIED_BUNDLE_CANDIDATE_NOT_PUBLISHED');

const bundleFiles = readdirSync(bundleDir).sort();
assert.equal(bundleFiles.length, 3, `qualified bundle must contain exactly three files, got ${bundleFiles.join(', ')}`);
assert.equal(bundleFiles.includes('RELEASE-PROVENANCE.json'), true);
assert.equal(bundleFiles.includes('SHA256SUMS'), true);
const tarballs = bundleFiles.filter((name) => name.endsWith('.tgz'));
assert.equal(tarballs.length, 1);

const tarballName = tarballs[0];
const tarballBytes = readFileSync(join(bundleDir, tarballName));
const provenanceBytes = readFileSync(join(bundleDir, 'RELEASE-PROVENANCE.json'));
const checksumsBytes = readFileSync(join(bundleDir, 'SHA256SUMS'));
const checksums = parseChecksums(checksumsBytes.toString('utf8'));

assert.equal(checksums.size, 2);
assert.equal(checksums.get(tarballName), sha256(tarballBytes).slice('sha256:'.length));
assert.equal(checksums.get('RELEASE-PROVENANCE.json'), sha256(provenanceBytes).slice('sha256:'.length));

const provenance = JSON.parse(provenanceBytes.toString('utf8'));
assert.equal(provenanceBytes.toString('utf8'), canonicalJson(provenance), 'consumer requires canonical release provenance');
assert.equal(provenance.source.commit_sha, receipt.sourceCommit);
assert.equal(provenance.package.name, receipt.packageName);
assert.equal(provenance.package.version, receipt.packageVersion);
assert.equal(provenance.package.private, true);
assert.equal(provenance.package.tarball_sha256, receipt.packageTarballHash);
assert.equal(sha256(tarballBytes), receipt.packageTarballHash);
assert.equal(sha256(provenanceBytes), receipt.provenanceHash);
assert.equal(provenance.release_status, receipt.releaseStatus);
assert.equal(provenance.release_status, 'QUALIFIED_BUNDLE_CANDIDATE_NOT_PUBLISHED');
assert.equal(provenance.authority_ceiling.publication_authority, 'NONE_NO_GITHUB_RELEASE_TAG_OR_REGISTRY_PUBLICATION');
assert.equal(provenance.authority_ceiling.commercial_validation, 'NOT_ESTABLISHED');
assert.equal(provenance.authority_ceiling.human_approval_authority, 'NONE');
assert.equal(provenance.authority_ceiling.dispatch_authority, 'NONE');
assert.equal(provenance.authority_ceiling.machine_execution_authority, 'NONE');
assert.deepEqual(provenance.prohibited_publication_actions, ['GITHUB_RELEASE', 'GIT_TAG', 'NPM_PUBLISH']);

const evidenceHash = sha256(Buffer.from(
  `${sha256(tarballBytes)}\n${sha256(provenanceBytes)}\n${sha256(checksumsBytes)}\n`,
  'utf8'
));
assert.equal(evidenceHash, receipt.bundleEvidenceHash, 'consumer must reproduce qualified bundle evidence hash');

assert.deepEqual(event.authority_ref, receipt.expectedDecisionResultRef);
assert.equal(event.event_type, 'DECISION_RESULT_PUBLISHED');
assert.deepEqual(event.payload.structured_action, receipt.expectedStructuredAction);
assert.equal(event.payload.human_approval_authority, GEOX_DECISION_RESULT_AUTHORITY_BOUNDARY.humanApprovalAuthority);
assert.equal(event.payload.machine_execution_authority, GEOX_DECISION_RESULT_AUTHORITY_BOUNDARY.machineExecutionAuthority);
assert.equal(event.payload.target_binding.mode, GEOX_DECISION_RESULT_TARGET_BINDING_MODE);

const projection = consumeAdrDecisionResultForGeox({
  event,
  consumerScope: receipt.consumerScope
});

assert.equal(projection.contract_version, GEOX_DECISION_RESULT_SINK_VERSION);
assert.deepEqual(projection.adr_decision_result_ref, receipt.expectedDecisionResultRef);
assert.equal(projection.decision_disposition, 'ACT');
assert.deepEqual(projection.adr_structured_action, receipt.expectedStructuredAction);
assert.equal(projection.target_binding.status, 'UNRESOLVED');
assert.equal(projection.target_binding.source_mode, GEOX_DECISION_RESULT_TARGET_BINDING_MODE);
assert.equal(projection.consumer_disposition, GEOX_DECISION_RESULT_CONSUMER_DISPOSITION);
assert.equal(projection.consumer_disposition, 'DISPLAY_ONLY_ADVISORY_CANDIDATE');
assert.equal(projection.field_actionable, false);
assert.equal(projection.dispatch_authorized, false);
assert.equal('field_id' in projection.routing_scope, false);
assert.equal('geometry_ref' in projection.routing_scope, false);
assert.deepEqual(projection.upstream_authority_boundary, {
  human_approval_authority: GEOX_DECISION_RESULT_AUTHORITY_BOUNDARY.humanApprovalAuthority,
  machine_execution_authority: GEOX_DECISION_RESULT_AUTHORITY_BOUNDARY.machineExecutionAuthority
});
assert.equal(projection.authority_claim, 'NONE_GEOX_ADAPTER_RESULT_PROJECTION_ONLY');

const approvalEscalation = structuredClone(event);
approvalEscalation.payload.human_approval_authority = 'HUMAN_APPROVAL_AUTHORIZED';
assert.throws(
  () => consumeAdrDecisionResultForGeox({ event: approvalEscalation, consumerScope: receipt.consumerScope }),
  (error) => error?.code === 'GEOX_DECISION_RESULT_AUTHORITY_ESCALATION_FORBIDDEN'
);

const fieldBindingEscalation = structuredClone(event);
fieldBindingEscalation.payload.target_binding.mode = 'GEOX_FIELD_BOUND';
assert.throws(
  () => consumeAdrDecisionResultForGeox({ event: fieldBindingEscalation, consumerScope: receipt.consumerScope }),
  (error) => error?.code === 'GEOX_DECISION_RESULT_TARGET_BINDING_REQUIRED'
);

const hiddenFieldInjection = structuredClone(event);
hiddenFieldInjection.payload.field_id = 'field_should_not_be_accepted';
assert.throws(
  () => consumeAdrDecisionResultForGeox({ event: hiddenFieldInjection, consumerScope: receipt.consumerScope }),
  (error) => error?.code === 'GEOX_DECISION_RESULT_PAYLOAD_FIELD_FORBIDDEN'
);

console.log(JSON.stringify({
  ok: true,
  milestone: 'PRODUCTIZATION_GEOX_INDEPENDENT_CONSUMER_USABILITY_V1',
  sourceCommit: receipt.sourceCommit,
  packageName: receipt.packageName,
  packageVersion: receipt.packageVersion,
  bundleEvidenceHash: evidenceHash,
  decisionResultRef: receipt.expectedDecisionResultRef,
  action: receipt.expectedStructuredAction,
  consumerProjection: projection,
  independentConsumerBoundary: {
    adrMonorepoImports: 0,
    adrInternalPackageImports: 0,
    architectureDecisionReads: 0,
    networkReads: 0,
    packagePublicSubpathOnly: true,
    bundleIntegrityVerified: true,
    provenanceBoundToExpectedSourceCommit: true,
    governedMessageConsumed: true,
    expectedGeoxProjectionReproduced: true,
    authorityPromotionRejected: true,
    fieldBindingPromotionRejected: true,
    hiddenFieldInjectionRejected: true
  }
}, null, 2));

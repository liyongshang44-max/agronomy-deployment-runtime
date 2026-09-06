import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  GEOX_HISTORICAL_DECISION_BASIS_PROJECTION_AUTHORITY_CLAIM,
  GEOX_HISTORICAL_DECISION_BASIS_PROJECTION_CONSUMER_DISPOSITION,
  consumeAdrHistoricalDecisionBasisProjectionForGeox
} from '@adr/geox-adapter/historical-decision-basis-projection-sink';

const event = JSON.parse(readFileSync('governed-historical-decision-basis-event.json', 'utf8'));
const receipt = JSON.parse(readFileSync('qualification-receipt.json', 'utf8'));

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

console.log(JSON.stringify({
  ok: true,
  sourceCommit: receipt.sourceCommit,
  bundleEvidenceHash: receipt.bundleEvidenceHash,
  projectionHash: projection.projection_hash,
  basisDigest: projection.basis_digest,
  entryDecisionResultRef: projection.entry_decision_result_ref,
  authorityGraphRefCount: projection.historical_basis.authorityGraph.allAuthorityRefs.length,
  consumerDisposition: projection.consumer_disposition,
  fieldActionable: projection.field_actionable,
  dispatchAuthorized: projection.dispatch_authorized,
  transportVerification: projection.transport_verification,
  authorityClaim: projection.authority_claim
}, null, 2));

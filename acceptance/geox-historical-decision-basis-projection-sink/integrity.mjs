import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const consumer = readFileSync('acceptance/geox-historical-decision-basis-projection-sink/consumer.mjs', 'utf8');
const runner = readFileSync('acceptance/geox-historical-decision-basis-projection-sink/run.mjs', 'utf8');
const sink = readFileSync('adapters/geox/src/historical-decision-basis-projection-sink.mjs', 'utf8');
const decisionSink = readFileSync('adapters/geox/src/decision-result-sink.mjs', 'utf8');
const artifactManifest = JSON.parse(readFileSync('adapters/geox/consumer-artifact.manifest.json', 'utf8'));
const apiSurface = JSON.parse(readFileSync('adapters/geox/consumer-api-surface.v1.json', 'utf8'));
const workflow = readFileSync('.github/workflows/productization-geox-historical-decision-basis-projection-sink.yml', 'utf8');

const forbiddenConsumerDependencies = [
  '../../', '../adapters', 'adapters/geox', 'packages/', 'sdks/', 'docs/', 'acceptance/', 'DEC-',
  'node:http', 'node:https', 'fetch(', 'github.com', 'api.github.com'
];
for (const forbidden of forbiddenConsumerDependencies) {
  assert.equal(consumer.includes(forbidden), false, `portable historical consumer must not reference ${forbidden}`);
}
const importSpecifiers = [...consumer.matchAll(/from\s+['"]([^'"]+)['"]/g)].map((match) => match[1]);
assert.ok(importSpecifiers.length > 0);
for (const specifier of importSpecifiers) {
  assert.ok(specifier.startsWith('node:') || specifier.startsWith('@adr/geox-adapter'));
}
assert.match(consumer, /from '@adr\/geox-adapter\/historical-decision-basis-projection-sink'/);
assert.equal(consumer.includes('createAdrHistoricalDecisionBasisProjectionEventForGeox'), false, 'consumer must receive governed projection wire message rather than constructing one');

assert.match(runner, /reconstructHistoricalDecisionBasis/);
assert.match(runner, /createAdrHistoricalDecisionBasisProjectionEventForGeox/);
assert.match(runner, /consumeAdrDecisionResultForGeox/);
assert.match(runner, /buildGeoxConsumerReleaseBundle/);
assert.match(runner, /verifyGeoxConsumerReleaseBundle/);
assert.match(runner, /npm', \[\s*'install'.*'--offline', absoluteTarballPath/s);
assert.match(runner, /NODE_PATH: ''/);
assert.match(runner, /GITHUB_TOKEN: ''/);

assert.equal(sink.includes("packages/historical-decision-basis"), false, 'portable sink may not depend on monorepo historical-basis implementation');
assert.match(sink, /projectionHash:/);
assert.match(sink, /GEOX_HISTORICAL_BASIS_PROJECTION_HASH_MISMATCH/);
assert.match(sink, /PROJECTION_HASH_INTEGRITY_ONLY_UPSTREAM_AUTHORITY_REPLAY_NOT_REPERFORMED/);
assert.match(sink, /field_actionable: false/);
assert.match(sink, /dispatch_authorized: false/);
assert.match(decisionSink, /input\.projection_hash !== undefined \|\| input\.authority_ref === undefined/);

assert.ok(artifactManifest.source_files.includes('historical-decision-basis-projection-sink.mjs'));
assert.equal(
  artifactManifest.exports['./historical-decision-basis-projection-sink'],
  './src/historical-decision-basis-projection-sink.mjs'
);
assert.ok(Array.isArray(apiSurface.modules['./historical-decision-basis-projection-sink']));
assert.ok(apiSurface.modules['./historical-decision-basis-projection-sink'].includes('consumeAdrHistoricalDecisionBasisProjectionForGeox'));
assert.equal(
  artifactManifest.compatibility.consumer_api_surface.surface_hash,
  apiSurface.surface_hash,
  'artifact compatibility envelope and public API baseline must bind the same surface hash'
);

assert.match(workflow, /ADR_HISTORICAL_BASIS_SINK_SOURCE_COMMIT: \$\{\{ github\.event\.pull_request\.head\.sha \|\| github\.sha \}\}/);
assert.match(workflow, /ref: \$\{\{ env\.ADR_HISTORICAL_BASIS_SINK_SOURCE_COMMIT \}\}/);
assert.match(workflow, /permissions:\s*\n\s*contents: read/);
assert.match(workflow, /push:\s*\n\s*branches:\s*\n\s*- 'main'/);
assert.match(workflow, /set -o pipefail[\s\S]*node acceptance\/geox-historical-decision-basis-projection-sink\/run\.mjs \| tee/);
for (const forbidden of ['npm publish', 'git tag', 'gh release', 'actions/create-release', 'softprops/action-gh-release']) {
  assert.equal(workflow.includes(forbidden), false, `historical projection qualification must not publish: ${forbidden}`);
}

console.log(JSON.stringify({
  ok: true,
  integrityCases: 19,
  portableConsumerUsesExplicitHistoricalBasisSubpath: true,
  portableConsumerHasNoMonorepoImports: true,
  consumerCannotConstructProjectionEvent: true,
  producerReconstructsGovernedHistoricalBasis: true,
  projectionTransportUsesExistingResultSinkContract: true,
  projectionTransportDoesNotRequireNewAuthorityKind: true,
  projectionHashTamperGatePresent: true,
  upstreamReplayBoundaryExplicit: true,
  decisionResultSinkProjectionRejectionPreserved: true,
  packageArtifactIncludesNewSubpath: true,
  publicSurfaceBaselineExplicitlyUpdated: true,
  compatibilitySurfaceHashAligned: true,
  cleanOfflineConsumerQualificationRequired: true,
  workflowChecksOutExactCandidateHead: true,
  workflowPipelineFailureCannotBeMaskedByTee: true,
  authoritativeMainPostMergeQualificationEnabled: true,
  publicationSideEffectsAbsent: true
}, null, 2));

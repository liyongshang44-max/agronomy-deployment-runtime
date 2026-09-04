import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const consumer = readFileSync('acceptance/geox-independent-consumer-usability/consumer.mjs', 'utf8');
const runner = readFileSync('acceptance/geox-independent-consumer-usability/run.mjs', 'utf8');
const workflow = readFileSync('.github/workflows/productization-geox-independent-consumer-usability.yml', 'utf8');

const forbiddenConsumerDependencies = [
  '../../', '../adapters', 'adapters/geox', 'packages/', 'sdks/', 'docs/', 'acceptance/', 'DEC-',
  'node:http', 'node:https', 'fetch(', 'github.com', 'api.github.com'
];
for (const forbidden of forbiddenConsumerDependencies) {
  assert.equal(consumer.includes(forbidden), false, `portable consumer must not reference ${forbidden}`);
}

const importSpecifiers = [...consumer.matchAll(/from\s+['"]([^'"]+)['"]/g)].map((match) => match[1]);
assert.ok(importSpecifiers.length > 0);
for (const specifier of importSpecifiers) {
  assert.ok(specifier.startsWith('node:') || specifier.startsWith('@adr/geox-adapter'));
}
assert.match(consumer, /from '@adr\/geox-adapter\/decision-result-sink'/);
assert.equal(consumer.includes('createResultSinkEvent'), false, 'consumer must receive governed wire messages rather than constructing ADR messages itself');
assert.equal(consumer.includes('real-kbs-soybean'), false, 'consumer must not import producer-side real-world acceptance');

assert.match(runner, /real-kbs-soybean-planting-population-target\/run-decision-result-v1\.mjs/);
assert.match(runner, /buildGeoxConsumerReleaseBundle/);
assert.match(runner, /verifyGeoxConsumerReleaseBundle/);
assert.match(runner, /npm', \[\s*'install'.*'--offline', absoluteTarballPath/s);
assert.match(runner, /NODE_PATH: ''/);
assert.match(runner, /GITHUB_TOKEN: ''/);

assert.match(workflow, /ADR_USABILITY_SOURCE_COMMIT: \$\{\{ github\.event\.pull_request\.head\.sha \|\| github\.sha \}\}/);
assert.match(workflow, /ref: \$\{\{ env\.ADR_USABILITY_SOURCE_COMMIT \}\}/);
assert.match(workflow, /permissions:\s*\n\s*contents: read/);
assert.match(workflow, /push:\s*\n\s*branches:\s*\n\s*- 'main'/);
assert.match(workflow, /set -o pipefail[\s\S]*node acceptance\/geox-independent-consumer-usability\/run\.mjs \| tee/);
for (const forbidden of ['npm publish', 'git tag', 'gh release', 'actions/create-release', 'softprops/action-gh-release']) {
  assert.equal(workflow.includes(forbidden), false, `consumer usability qualification must not publish: ${forbidden}`);
}

console.log(JSON.stringify({
  ok: true,
  integrityCases: 14,
  portableConsumerHasNoMonorepoImports: true,
  portableConsumerHasNoInternalPackageImports: true,
  portableConsumerHasNoArchitectureDocumentReads: true,
  portableConsumerHasNoNetworkReads: true,
  portableConsumerUsesPublicAdapterSubpath: true,
  consumerReceivesWireMessageRatherThanBuildingAdrMessage: true,
  producerUsesRealGovernedPlantingDecisionResult: true,
  producerBuildsQualifiedReleaseBundle: true,
  producerVerifiesQualifiedReleaseBundle: true,
  consumerInstallsAbsoluteLocalTarballOffline: true,
  consumerInstallCannotFallBackToGitHubShorthand: true,
  workflowChecksOutExactCandidateHead: true,
  workflowPipelineFailureCannotBeMaskedByTee: true,
  authoritativeMainPostMergeQualificationEnabled: true,
  publicationSideEffectsAbsent: true
}, null, 2));

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  AGRONOMIC_RECORDED_OPERATION_CONTEXT_SOURCE_PROVIDER_IDENTITY_BINDING_COMPILATION_CONTRACT_VERSION,
  AGRONOMIC_RECORDED_OPERATION_CONTEXT_SOURCE_PROVIDER_IDENTITY_BINDING_CONTRACT_VERSION,
  AGRONOMIC_RECORDED_OPERATION_CONTEXT_SOURCE_PROVIDER_IDENTITY_FIRST_ORIGIN_LOCATOR,
  AGRONOMIC_RECORDED_OPERATION_CONTEXT_SOURCE_PROVIDER_IDENTITY_FIRST_PROVIDER_ID,
  agronomicRecordedOperationContextSourceProviderIdentityBindingHash,
  normalizeAgronomicRecordedOperationContextSourceProviderIdentityBinding,
  normalizeAgronomicRecordedOperationContextSourceProviderIdentityBindingCompilation
} from '../src/index.mjs';

const provenanceRef = Object.freeze({
  kind: 'AgronomicRecordedOperationContextProvenanceClassificationCompilation',
  logicalId: 'compilation.test.context-provenance-classification',
  version: '1',
  semanticHash: `sha256:${'1'.repeat(64)}`
});

const sourceRef = Object.freeze({
  kind: 'Source',
  logicalId: 'source.test.value',
  version: '1',
  semanticHash: `sha256:${'2'.repeat(64)}`
});

const sourceArtifactRef = Object.freeze({
  kind: 'SourceArtifact',
  logicalId: 'artifact.test.value',
  version: '1',
  semanticHash: `sha256:${'3'.repeat(64)}`
});

const reviewRef = Object.freeze({
  kind: 'AgronomicRecordedOperationContextSourceProviderIdentityBindingReviewDecision',
  logicalId: 'review.test.context-source-provider-identity-binding',
  version: '1',
  semanticHash: `sha256:${'4'.repeat(64)}`
});

function binding(overrides = {}) {
  return {
    contractVersion:
      AGRONOMIC_RECORDED_OPERATION_CONTEXT_SOURCE_PROVIDER_IDENTITY_BINDING_CONTRACT_VERSION,
    bindingId: 'binding.test.sustainable-corn.provider-identity',
    contextProvenanceClassificationCompilationRef: provenanceRef,
    valueSource: {
      sourceRef,
      sourceArtifactRef,
      sourceArtifactContentHash: `sha256:${'5'.repeat(64)}`
    },
    sourceNamespaceEvidence: {
      exactOriginLocator:
        AGRONOMIC_RECORDED_OPERATION_CONTEXT_SOURCE_PROVIDER_IDENTITY_FIRST_ORIGIN_LOCATOR
    },
    targetContextSemantic: {
      semanticId: 'crop.planting_date',
      value: { type: 'DATE', date: '2011-05-03' }
    },
    epistemicClass: 'ASSERTION',
    provenanceClass: 'EXTERNAL_PROVIDER',
    providerId:
      AGRONOMIC_RECORDED_OPERATION_CONTEXT_SOURCE_PROVIDER_IDENTITY_FIRST_PROVIDER_ID,
    bindingRationale:
      'The exact first value source is supplied through the reviewed isudatateam/datateam GitHub repository namespace.',
    ...overrides
  };
}

function compilation(value = binding(), overrides = {}) {
  return {
    contractVersion:
      AGRONOMIC_RECORDED_OPERATION_CONTEXT_SOURCE_PROVIDER_IDENTITY_BINDING_COMPILATION_CONTRACT_VERSION,
    authorityClass:
      'AGRONOMIC_RECORDED_OPERATION_CONTEXT_SOURCE_PROVIDER_IDENTITY_BINDING_COMPILATION_AUTHORITY',
    binding: value,
    bindingHash:
      agronomicRecordedOperationContextSourceProviderIdentityBindingHash(value),
    providerIdentityReviewRef: reviewRef,
    losslessCoverage: {
      status: 'COMPLETE',
      coveredElements: [
        'CONTEXT_PROVENANCE_CLASSIFICATION',
        'VALUE_SOURCE',
        'VALUE_SOURCE_ARTIFACT',
        'VALUE_SOURCE_CONTENT_HASH',
        'SOURCE_ORIGIN_LOCATOR',
        'TARGET_CONTEXT_SEMANTIC',
        'TARGET_CONTEXT_VALUE',
        'EPISTEMIC_CLASS',
        'PROVENANCE_CLASS',
        'PROVIDER_ID'
      ],
      unrepresentedElements: []
    },
    limitations: [
      'NO_SOURCE_REF_WIRE_PROJECTION',
      'NO_CONTENT_HASH_WIRE_PROJECTION',
      'NO_CONTEXT_DATUM_PUBLICATION'
    ],
    ...overrides
  };
}

test('normalizes first provider namespace as github.com/isudatateam/datateam', () => {
  const normalized =
    normalizeAgronomicRecordedOperationContextSourceProviderIdentityBinding(
      binding()
    );
  assert.equal(
    normalized.providerId,
    'github.com/isudatateam/datateam'
  );
  assert.equal(normalized.epistemicClass, 'ASSERTION');
  assert.equal(normalized.provenanceClass, 'EXTERNAL_PROVIDER');
  assert.equal(
    normalized.sourceNamespaceEvidence.exactOriginLocator,
    AGRONOMIC_RECORDED_OPERATION_CONTEXT_SOURCE_PROVIDER_IDENTITY_FIRST_ORIGIN_LOCATOR
  );
});

test('binding hash is deterministic and exact source namespace material is semantic', () => {
  const baseline = binding();
  assert.equal(
    agronomicRecordedOperationContextSourceProviderIdentityBindingHash(baseline),
    agronomicRecordedOperationContextSourceProviderIdentityBindingHash(
      structuredClone(baseline)
    )
  );

  for (const mutate of [
    (value) => {
      value.valueSource.sourceRef.semanticHash = `sha256:${'6'.repeat(64)}`;
    },
    (value) => {
      value.valueSource.sourceArtifactRef.semanticHash = `sha256:${'7'.repeat(64)}`;
    },
    (value) => {
      value.valueSource.sourceArtifactContentHash = `sha256:${'8'.repeat(64)}`;
    }
  ]) {
    const changed = structuredClone(baseline);
    mutate(changed);
    assert.notEqual(
      agronomicRecordedOperationContextSourceProviderIdentityBindingHash(baseline),
      agronomicRecordedOperationContextSourceProviderIdentityBindingHash(changed)
    );
  }
});

for (const providerId of [
  'github.com',
  'isudatateam',
  'datateam',
  'github.com/isudatateam',
  'github.com/other/datateam',
  'ISU',
  'IOWA_STATE_UNIVERSITY',
  'GITHUB',
  'org-a',
  'source.test.value'
]) {
  test(`v1 rejects providerId ${providerId}`, () => {
    assert.throws(
      () =>
        normalizeAgronomicRecordedOperationContextSourceProviderIdentityBinding(
          binding({ providerId })
        ),
      /supports only providerId github\.com\/isudatateam\/datateam/
    );
  });
}

test('v1 rejects origin-locator drift', () => {
  const value = binding();
  value.sourceNamespaceEvidence.exactOriginLocator =
    'https://github.com/isudatateam/datateam/blob/other/scripts/cscap/chicago.ipynb';
  assert.throws(
    () =>
      normalizeAgronomicRecordedOperationContextSourceProviderIdentityBinding(value),
    /exact first Sustainable Corn occurrence origin locator/
  );
});

test('v1 rejects epistemic or provenance drift', () => {
  assert.throws(
    () =>
      normalizeAgronomicRecordedOperationContextSourceProviderIdentityBinding(
        binding({ epistemicClass: 'OBSERVATION' })
      ),
    /preserves only ASSERTION/
  );
  assert.throws(
    () =>
      normalizeAgronomicRecordedOperationContextSourceProviderIdentityBinding(
        binding({ provenanceClass: 'PLATFORM' })
      ),
    /preserves only EXTERNAL_PROVIDER/
  );
});

test('v1 rejects target semantic or value-type drift', () => {
  const semantic = binding();
  semantic.targetContextSemantic.semanticId = 'crop.harvest_date';
  assert.throws(
    () =>
      normalizeAgronomicRecordedOperationContextSourceProviderIdentityBinding(
        semantic
      ),
    /crop\.planting_date/
  );

  const type = binding();
  type.targetContextSemantic.value.type = 'TIMESTAMP';
  assert.throws(
    () =>
      normalizeAgronomicRecordedOperationContextSourceProviderIdentityBinding(type),
    /crop\.planting_date/
  );
});

test('compilation hash closes the exact provider binding', () => {
  const value = binding();
  const normalized =
    normalizeAgronomicRecordedOperationContextSourceProviderIdentityBindingCompilation(
      compilation(value)
    );
  assert.equal(
    normalized.bindingHash,
    agronomicRecordedOperationContextSourceProviderIdentityBindingHash(value)
  );

  const stale = compilation(value);
  stale.binding.bindingRationale = 'changed';
  assert.throws(
    () =>
      normalizeAgronomicRecordedOperationContextSourceProviderIdentityBindingCompilation(
        stale
      ),
    /bindingHash must exactly match/
  );
});

test('COMPLETE local coverage rejects unrepresented targeted elements', () => {
  const value = compilation();
  value.losslessCoverage.unrepresentedElements = ['PROVIDER_ID'];
  assert.throws(
    () =>
      normalizeAgronomicRecordedOperationContextSourceProviderIdentityBindingCompilation(
        value
      ),
    /COMPLETE provider-identity coverage/
  );
});

test('binding contract rejects sourceRef/contentHash wire and downstream authority laundering fields', () => {
  for (const forbidden of [
    'sourceRef',
    'contentHash',
    'source',
    'availableAt',
    'effectiveInterval',
    'timezone',
    'spatialSupport',
    'geometryRef',
    'unit',
    'uncertainty',
    'temporalSupport',
    'ContextDatum',
    'ContextManifest',
    'DecisionProblem',
    'Policy',
    'RuntimePlan',
    'RuntimeEligibility',
    'RuntimeBinding',
    'DecisionResult',
    'ExecutionReceipt',
    'Outcome',
    'institutionId',
    'canonicalProviderEntity',
    'genericUrlRule',
    'inverseProviderMapping',
    'bindingComplete'
  ]) {
    const value = binding();
    value[forbidden] = 'forbidden';
    assert.throws(
      () =>
        normalizeAgronomicRecordedOperationContextSourceProviderIdentityBinding(value),
      /not part of the provider-identity binding contract/,
      forbidden
    );
  }
});

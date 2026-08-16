import assert from 'node:assert/strict';
import {
  RuntimeProfileError,
  normalizeRuntimeProfile,
  validateRuntimeProfileAuthority
} from '../../packages/runtime-profile/src/index.mjs';
import { baseProfile, createRuntimeProfileEnvironment, publishAuthorizedProfile } from './fixture.mjs';

function test(name, fn) {
  try {
    fn();
    console.log(`PASS ${name}`);
  } catch (error) {
    console.error(`FAIL ${name}`);
    throw error;
  }
}

function expectCode(fn, code) {
  assert.throws(fn, (error) => error instanceof RuntimeProfileError && error.code === code);
}

test('minimal RuntimeProfile publishes without fake Model Policy Implementation or Calibration refs', () => {
  const env = createRuntimeProfileEnvironment('minimal');
  const profile = publishAuthorizedProfile(env);
  const payload = profile.semanticPayload;
  assert.equal(payload.knowledgeReleaseRef.semanticHash, env.release.ref.semanticHash);
  assert.equal(payload.runtimeGovernance.allowedDecisionAuthorityModes[0], 'RUNTIME_ONLY');
  assert.equal('modelConstraints' in payload, false);
  assert.equal('policyConstraints' in payload, false);
  assert.equal('implementationConstraints' in payload, false);
  assert.equal('calibrationConstraints' in payload, false);
});

test('RuntimeProfile validation closes exact KnowledgeRelease authority', () => {
  const env = createRuntimeProfileEnvironment('release-closure');
  const profile = publishAuthorizedProfile(env);
  const validated = validateRuntimeProfileAuthority({ ledger: env.ledger, runtimeProfileRef: profile.ref });
  assert.equal(validated.knowledgeReleaseAuthority.release.ref.semanticHash, env.release.ref.semanticHash);
});

test('context semantic ids and epistemic constraints are canonical order independent', () => {
  const env = createRuntimeProfileEnvironment('context-order');
  const a = normalizeRuntimeProfile(baseProfile(env));
  const b = normalizeRuntimeProfile(baseProfile(env, {
    contextRequirements: {
      requiredSemanticIds: ['soil.volumetric_water_content', 'crop.code'],
      epistemicConstraints: {
        'soil.volumetric_water_content': ['STATE_ESTIMATE', 'OBSERVATION'],
        'crop.code': ['OBSERVATION', 'ASSERTION']
      }
    }
  }));
  assert.deepEqual(a.contextRequirements, b.contextRequirements);
});

test('use/deployment constraint sets are canonical order independent', () => {
  const env = createRuntimeProfileEnvironment('constraint-order');
  const a = normalizeRuntimeProfile(baseProfile(env));
  const b = normalizeRuntimeProfile(baseProfile(env, {
    allowedUseDeploymentConstraints: {
      usePurposes: ['CORN_IRRIGATION_APPLICABILITY'],
      useClasses: ['ADVISORY'],
      runtimeEnvironments: ['STAGING', 'DEVELOPMENT'],
      rolloutStages: ['SHADOW', 'DRAFT', 'SANDBOX']
    }
  }));
  assert.deepEqual(a.allowedUseDeploymentConstraints, b.allowedUseDeploymentConstraints);
});

test('material context requirement change creates distinct RuntimeProfile semantic identity', () => {
  const env = createRuntimeProfileEnvironment('context-identity');
  const a = publishAuthorizedProfile(env, { logicalId: 'rp-context-a' });
  const b = publishAuthorizedProfile(env, {
    logicalId: 'rp-context-b',
    profile: baseProfile(env, {
      contextRequirements: {
        requiredSemanticIds: ['crop.code'],
        epistemicConstraints: { 'crop.code': ['ASSERTION', 'OBSERVATION'] }
      }
    })
  });
  assert.notEqual(a.ref.semanticHash, b.ref.semanticHash);
});

test('material replay minimum change creates distinct RuntimeProfile semantic identity', () => {
  const env = createRuntimeProfileEnvironment('replay-identity');
  const a = publishAuthorizedProfile(env, { logicalId: 'rp-replay-a' });
  const b = publishAuthorizedProfile(env, {
    logicalId: 'rp-replay-b',
    profile: baseProfile(env, { replayRequirement: { minimum: 'CONTENT_ADDRESSED_EXTERNAL' } })
  });
  assert.notEqual(a.ref.semanticHash, b.ref.semanticHash);
});

test('material allowed decision authority mode change creates distinct semantic identity', () => {
  const env = createRuntimeProfileEnvironment('authority-mode');
  const a = publishAuthorizedProfile(env, { logicalId: 'rp-mode-a' });
  const b = publishAuthorizedProfile(env, {
    logicalId: 'rp-mode-b',
    profile: baseProfile(env, {
      runtimeGovernance: {
        allowedDecisionAuthorityModes: ['EXTERNAL_POLICY', 'RUNTIME_ONLY'],
        knowledgeSelectionMode: 'EXACT_KNOWLEDGE_RELEASE',
        contextBindingMode: 'EXACT_CONTEXT_MANIFEST',
        applicabilityMode: 'EXACT_APPLICABILITY_ASSESSMENTS'
      }
    })
  });
  assert.notEqual(a.ref.semanticHash, b.ref.semanticHash);
});

test('runtime environment and rollout stage remain separate constraints', () => {
  const env = createRuntimeProfileEnvironment('orthogonal');
  const payload = normalizeRuntimeProfile(baseProfile(env)).allowedUseDeploymentConstraints;
  assert.deepEqual(payload.runtimeEnvironments, ['DEVELOPMENT', 'STAGING']);
  assert.deepEqual(payload.rolloutStages, ['DRAFT', 'SANDBOX', 'SHADOW']);
  assert.equal(payload.runtimeEnvironments.includes('PILOT'), false);
  assert.equal(payload.rolloutStages.includes('STAGING'), false);
});

test('changing allowed use constraints versions RuntimeProfile without changing KnowledgeRelease', () => {
  const env = createRuntimeProfileEnvironment('independent-version');
  const a = publishAuthorizedProfile(env, { logicalId: 'rp-independent', version: '1' });
  const b = publishAuthorizedProfile(env, {
    logicalId: 'rp-independent',
    version: '2',
    profile: baseProfile(env, {
      allowedUseDeploymentConstraints: {
        usePurposes: ['CORN_IRRIGATION_APPLICABILITY'],
        useClasses: ['ADVISORY', 'DECISION_SUPPORT'],
        runtimeEnvironments: ['DEVELOPMENT', 'STAGING'],
        rolloutStages: ['DRAFT', 'SANDBOX', 'SHADOW']
      }
    })
  });
  assert.equal(a.semanticPayload.knowledgeReleaseRef.semanticHash, b.semanticPayload.knowledgeReleaseRef.semanticHash);
  assert.notEqual(a.ref.semanticHash, b.ref.semanticHash);
});

test('historical exact RuntimeProfile ref remains stable after a later profile version', () => {
  const env = createRuntimeProfileEnvironment('history');
  const old = publishAuthorizedProfile(env, { logicalId: 'rp-history', version: '1' });
  publishAuthorizedProfile(env, {
    logicalId: 'rp-history',
    version: '2',
    profile: baseProfile(env, { replayRequirement: { minimum: 'PROVIDER_DEPENDENT' } })
  });
  const replay = validateRuntimeProfileAuthority({
    ledger: env.ledger,
    runtimeProfileRef: old.ref,
    allowHistorical: true
  });
  assert.equal(replay.record.ref.semanticHash, old.ref.semanticHash);
  assert.equal(replay.semanticPayload.replayRequirement.minimum, 'EXACT');
});

test('epistemic constraints cannot target a semantic id not declared required', () => {
  const env = createRuntimeProfileEnvironment('epistemic-orphan');
  expectCode(() => normalizeRuntimeProfile(baseProfile(env, {
    contextRequirements: {
      requiredSemanticIds: ['crop.code'],
      epistemicConstraints: {
        'soil.volumetric_water_content': ['OBSERVATION']
      }
    }
  })), 'RUNTIME_PROFILE_EPISTEMIC_CONSTRAINT_WITHOUT_REQUIRED_SEMANTIC');
});

test('minimal profile rejects fake Model constraints before S01 authority exists', () => {
  const env = createRuntimeProfileEnvironment('fake-model');
  expectCode(() => normalizeRuntimeProfile({
    ...baseProfile(env),
    modelConstraints: { modelRef: 'fake-model@1' }
  }), 'RUNTIME_PROFILE_SPEC_AUTHORITY_NOT_AVAILABLE');
});

test('minimal profile rejects fake Policy and Implementation constraints', () => {
  const env = createRuntimeProfileEnvironment('fake-policy');
  expectCode(() => normalizeRuntimeProfile({
    ...baseProfile(env),
    policyConstraints: { policyRef: 'fake-policy@1' }
  }), 'RUNTIME_PROFILE_SPEC_AUTHORITY_NOT_AVAILABLE');
  expectCode(() => normalizeRuntimeProfile({
    ...baseProfile(env),
    implementationConstraints: { implementationRef: 'fake-impl@1' }
  }), 'RUNTIME_PROFILE_SPEC_AUTHORITY_NOT_AVAILABLE');
});

test('dynamic latest knowledge selection is forbidden', () => {
  const env = createRuntimeProfileEnvironment('dynamic-knowledge');
  expectCode(() => normalizeRuntimeProfile(baseProfile(env, {
    runtimeGovernance: {
      allowedDecisionAuthorityModes: ['RUNTIME_ONLY'],
      knowledgeSelectionMode: 'LATEST_QUALIFIED_KNOWLEDGE',
      contextBindingMode: 'EXACT_CONTEXT_MANIFEST',
      applicabilityMode: 'EXACT_APPLICABILITY_ASSESSMENTS'
    }
  })), 'RUNTIME_PROFILE_DYNAMIC_KNOWLEDGE_FORBIDDEN');
});

test('mutable target context binding is forbidden', () => {
  const env = createRuntimeProfileEnvironment('mutable-context');
  expectCode(() => normalizeRuntimeProfile(baseProfile(env, {
    runtimeGovernance: {
      allowedDecisionAuthorityModes: ['RUNTIME_ONLY'],
      knowledgeSelectionMode: 'EXACT_KNOWLEDGE_RELEASE',
      contextBindingMode: 'CURRENT_TARGET_CONTEXT',
      applicabilityMode: 'EXACT_APPLICABILITY_ASSESSMENTS'
    }
  })), 'RUNTIME_PROFILE_MUTABLE_CONTEXT_FORBIDDEN');
});

test('RuntimeProfile cannot contain a current ContextManifest or runtime execution object', () => {
  const env = createRuntimeProfileEnvironment('runtime-object');
  expectCode(() => normalizeRuntimeProfile({
    ...baseProfile(env),
    contextManifestRef: { kind: 'ContextManifest', logicalId: 'cm', version: '1', semanticHash: 'x' }
  }), 'INVALID_RUNTIME_PROFILE_FIELD');
});

console.log('RuntimeProfile acceptance: 16 passed');

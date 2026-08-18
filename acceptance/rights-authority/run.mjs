import { strict as assert } from 'node:assert';
import { AuthorityLedger, AuthorityLedgerError } from '../../packages/provenance/src/index.mjs';
import { ExactArtifactStore, SourceRegistry } from '../../packages/source-registry/src/index.mjs';
import {
  RIGHTS_DECISION_AUTHORITY_CLAIM,
  RIGHTS_DECISION_TIME_SEMANTICS,
  RIGHTS_OPERATIONS,
  RightsAuthorityError,
  assertRightsAllowed,
  publishRightsDecision,
  publishRightsGrant,
  publishRightsPolicy,
  publishRightsRevocation,
  validateRightsDecision,
  validateRightsGrant,
  validateRightsRevocation
} from '../../packages/rights-authority/src/index.mjs';

function principal(principalId, organizationId = 'org-a', tenantId = 'tenant-a', type = 'USER') {
  return { principalId, type, organizationId, tenantId };
}

const OWNER = principal('rights-admin');
const NON_OWNER = principal('rights-admin-2');
const ACTOR = principal('scientist-1');
const OTHER_TENANT_ACTOR = principal('scientist-other', 'org-a', 'tenant-b');
const EVALUATOR = principal('rights-engine', 'org-a', 'tenant-a', 'SERVICE_ACCOUNT');
const FOREIGN_EVALUATOR = principal('rights-engine-foreign', 'org-a', 'tenant-b', 'SERVICE_ACCOUNT');
const OBLIGATIONS = ['NO_MODEL_TRAINING'];

function audit(eventId, who, occurredAt, inputRefs = []) {
  return {
    eventId,
    occurredAt,
    actor: { type: who.type, id: who.principalId },
    inputRefs,
    details: { channel: 'rights-authority-acceptance' }
  };
}

function expectError(fn, ErrorType, code) {
  let caught;
  try { fn(); } catch (error) { caught = error; }
  assert.ok(caught instanceof ErrorType, `expected ${ErrorType.name}, got ${caught?.constructor?.name ?? 'no error'}`);
  assert.equal(caught.code, code);
  return caught;
}

function world(label = 'base') {
  const ledger = new AuthorityLedger();
  const sourceRegistry = new SourceRegistry({ ledger, artifactStore: new ExactArtifactStore() });
  const source = sourceRegistry.registerSource({
    logicalId: `source.rights.${label}`,
    version: '1',
    sourceType: 'PUBLICATION',
    title: `Rights fixture ${label}`,
    ownership: { organizationId: 'org-a', tenantId: 'tenant-a' },
    rights: { basis: 'fixture-metadata-only-not-authority' },
    audit: audit(`evt-source-${label}`, OWNER, '2026-08-18T00:00:00Z')
  });
  const artifact = sourceRegistry.materializeArtifact({
    logicalId: `artifact.rights.${label}`,
    version: '1',
    sourceRef: source.ref,
    bytes: Buffer.from(`%PDF-1.7\nrights-${label}`),
    mediaType: 'application/pdf',
    materializationIdentity: `fixture-${label}`,
    acquisition: { method: 'FIXTURE', acquiredAt: '2026-08-18T00:00:00Z', locator: `fixture://${label}` },
    rightsSnapshot: { basis: 'fixture-metadata-only-not-authority' },
    audit: audit(`evt-artifact-${label}`, OWNER, '2026-08-18T00:00:00Z')
  });
  const policy = publishRightsPolicy({
    ledger,
    logicalId: `rights.policy.${label}`,
    version: '1',
    ownership: { organizationId: 'org-a', tenantId: 'tenant-a' },
    ownerPrincipal: OWNER,
    basis: { class: 'INTERNAL_POLICY', evidenceRefs: [] },
    audit: audit(`evt-rights-policy-${label}`, OWNER, '2026-08-18T00:30:00Z')
  });
  return { ledger, sourceRegistry, source, artifact, policy };
}

function allowGrant(env, {
  logicalId = 'rights.grant.default',
  issuedAt = '2026-08-18T01:00:00Z',
  validFrom = '2026-08-18T01:00:00Z',
  validUntil = '2026-08-19T01:00:00Z',
  subjectRef = env.artifact.ref,
  grantee = { organizationId: 'org-a', tenantId: 'tenant-a' },
  operation = 'READ_FOR_EXTRACTION',
  purposes = ['SCIENTIFIC_CLAIM_EXTRACTION'],
  jurisdictions = ['US'],
  obligations = OBLIGATIONS,
  grantorPrincipal = OWNER
} = {}) {
  return publishRightsGrant({
    ledger: env.ledger,
    logicalId,
    version: '1',
    rightsPolicyRef: env.policy.ref,
    subjectRef,
    grantee,
    rules: [{ operation, purposes, jurisdictions, obligations }],
    validFrom,
    validUntil,
    grantorPrincipal,
    audit: audit(`evt-${logicalId}`, grantorPrincipal, issuedAt)
  });
}

function decide(env, {
  logicalId = 'rights.decision.default',
  at = '2026-08-18T02:00:00Z',
  subjectRef = env.artifact.ref,
  actor = ACTOR,
  evaluatorPrincipal = EVALUATOR,
  operation = 'READ_FOR_EXTRACTION',
  purpose = 'SCIENTIFIC_CLAIM_EXTRACTION',
  jurisdiction = 'US'
} = {}) {
  return publishRightsDecision({
    ledger: env.ledger,
    logicalId,
    version: '1',
    rightsPolicyRef: env.policy.ref,
    subjectRef,
    actor,
    evaluatorPrincipal,
    operation,
    purpose,
    jurisdiction,
    evaluatedAt: at,
    audit: audit(`evt-${logicalId}`, evaluatorPrincipal, at)
  });
}

function assertAllowed(env, decision, {
  at = '2026-08-18T02:00:00Z',
  subjectRef = env.artifact.ref,
  actor = ACTOR,
  operation = 'READ_FOR_EXTRACTION',
  purpose = 'SCIENTIFIC_CLAIM_EXTRACTION',
  jurisdiction = 'US',
  enforceableObligations = OBLIGATIONS
} = {}) {
  return assertRightsAllowed({
    ledger: env.ledger,
    rightsDecisionRef: decision.ref,
    subjectRef,
    actor,
    operation,
    purpose,
    jurisdiction,
    requiredAt: at,
    enforceableObligations
  });
}

const tests = [];
function test(name, fn) { tests.push({ name, fn }); }

test('RA01 freezes closed operation vocabulary and RightsDecision has no CONDITIONAL execution outcome', () => {
  assert.deepEqual(RIGHTS_OPERATIONS, [
    'ACQUIRE',
    'RETAIN_FULLTEXT',
    'READ_FOR_EXTRACTION',
    'EXTRACT_CLAIM',
    'CREATE_EMBEDDING',
    'MODEL_EGRESS',
    'RETAIN_DERIVED',
    'DISPLAY_EXCERPT',
    'REDISTRIBUTE',
    'EXPORT',
    'TRAIN_MODEL',
    'USE_FOR_PRODUCTION_DECISION'
  ]);
  assert.equal(RIGHTS_OPERATIONS.includes('CONDITIONAL'), false);
});

test('UNKNOWN/no applicable grant is an auditable DENY, never implicit allow', () => {
  const env = world('unknown-deny');
  const decision = decide(env, { logicalId: 'rights.decision.unknown-deny' });
  assert.equal(decision.semanticPayload.outcome, 'DENY');
  assert.deepEqual(decision.semanticPayload.reasonCodes, ['NO_APPLICABLE_GRANT']);
  assert.equal(decision.semanticPayload.decisionAuthorityClaim, RIGHTS_DECISION_AUTHORITY_CLAIM);
  assert.equal(decision.semanticPayload.decisionTimeSemantics, RIGHTS_DECISION_TIME_SEMANTICS);
  expectError(() => assertAllowed(env, decision), RightsAuthorityError, 'RIGHTS_DENIED');
});

test('exact matching grant yields ALLOW with exact grant authority and mandatory obligations', () => {
  const env = world('allow');
  const grant = allowGrant(env, { logicalId: 'rights.grant.allow' });
  const decision = decide(env, { logicalId: 'rights.decision.allow' });
  assert.equal(decision.semanticPayload.outcome, 'ALLOW');
  assert.deepEqual(decision.semanticPayload.reasonCodes, []);
  assert.deepEqual(decision.semanticPayload.obligations, OBLIGATIONS);
  assert.equal(decision.semanticPayload.grantRefs.length, 1);
  assert.equal(decision.semanticPayload.grantRefs[0].semanticHash, grant.ref.semanticHash);
  assertAllowed(env, decision);
});

test('ALLOW obligations cannot be silently ignored by the consuming enforcement point', () => {
  const env = world('obligations');
  allowGrant(env, { logicalId: 'rights.grant.obligations' });
  const decision = decide(env, { logicalId: 'rights.decision.obligations' });
  expectError(() => assertRightsAllowed({
    ledger: env.ledger,
    rightsDecisionRef: decision.ref,
    subjectRef: env.artifact.ref,
    actor: ACTOR,
    operation: 'READ_FOR_EXTRACTION',
    purpose: 'SCIENTIFIC_CLAIM_EXTRACTION',
    jurisdiction: 'US',
    requiredAt: '2026-08-18T02:00:00Z'
  }), RightsAuthorityError, 'RIGHTS_OBLIGATION_CAPABILITY_REQUIRED');
  expectError(() => assertAllowed(env, decision, { enforceableObligations: [] }), RightsAuthorityError, 'RIGHTS_OBLIGATION_UNSUPPORTED');
  assertAllowed(env, decision, { enforceableObligations: ['NO_MODEL_TRAINING', 'EXTRA_UNUSED_CAPABILITY'] });
});

test('Source grant never silently inherits to SourceArtifact', () => {
  const env = world('no-inheritance');
  allowGrant(env, { logicalId: 'rights.grant.source-only', subjectRef: env.source.ref });
  const artifactDecision = decide(env, { logicalId: 'rights.decision.artifact-no-inheritance' });
  assert.equal(artifactDecision.semanticPayload.outcome, 'DENY');
  assert.deepEqual(artifactDecision.semanticPayload.reasonCodes, ['NO_APPLICABLE_GRANT']);
  const sourceDecision = decide(env, { logicalId: 'rights.decision.source-exact', subjectRef: env.source.ref });
  assert.equal(sourceDecision.semanticPayload.outcome, 'ALLOW');
});

test('actor, purpose and jurisdiction scope mismatches fail closed', () => {
  const env = world('scope');
  allowGrant(env, {
    logicalId: 'rights.grant.scope',
    grantee: { organizationId: 'org-a', tenantId: 'tenant-a', principalId: ACTOR.principalId, principalType: ACTOR.type }
  });
  const actorDecision = decide(env, { logicalId: 'rights.decision.actor-mismatch', actor: OTHER_TENANT_ACTOR });
  assert.equal(actorDecision.semanticPayload.outcome, 'DENY');
  assert.ok(actorDecision.semanticPayload.reasonCodes.includes('GRANTEE_SCOPE_MISMATCH'));
  const purposeDecision = decide(env, { logicalId: 'rights.decision.purpose-mismatch', purpose: 'MODEL_TRAINING' });
  assert.equal(purposeDecision.semanticPayload.outcome, 'DENY');
  assert.ok(purposeDecision.semanticPayload.reasonCodes.includes('PURPOSE_NOT_GRANTED'));
  const jurisdictionDecision = decide(env, { logicalId: 'rights.decision.jurisdiction-mismatch', jurisdiction: 'EU' });
  assert.equal(jurisdictionDecision.semanticPayload.outcome, 'DENY');
  assert.ok(jurisdictionDecision.semanticPayload.reasonCodes.includes('JURISDICTION_NOT_GRANTED'));
});

test('RA01 permits no implicit same-tenant grant administration delegation', () => {
  const env = world('grant-owner');
  expectError(() => allowGrant(env, {
    logicalId: 'rights.grant.non-owner',
    grantorPrincipal: NON_OWNER
  }), RightsAuthorityError, 'RIGHTS_GRANTOR_NOT_POLICY_OWNER');
  assert.equal(env.ledger.exportSnapshot().records.filter((record) => record.ref.kind === 'RightsGrant').length, 0);
});

test('RA01 permits no implicit same-tenant revocation administration delegation', () => {
  const env = world('revoke-owner');
  const grant = allowGrant(env, { logicalId: 'rights.grant.revocation-owner' });
  expectError(() => publishRightsRevocation({
    ledger: env.ledger,
    logicalId: 'rights.revocation.non-owner',
    version: '1',
    rightsGrantRef: grant.ref,
    effectiveAt: '2026-08-18T02:30:00Z',
    reasonCodes: ['LICENSE_TERMINATED'],
    revokerPrincipal: NON_OWNER,
    audit: audit('evt-rights-revocation-non-owner', NON_OWNER, '2026-08-18T03:00:00Z')
  }), RightsAuthorityError, 'RIGHTS_REVOKER_NOT_POLICY_OWNER');
});

test('RightsDecision evaluator is tenant-scoped to the exact RightsPolicy world', () => {
  const env = world('evaluator-scope');
  allowGrant(env, { logicalId: 'rights.grant.evaluator-scope' });
  expectError(() => decide(env, {
    logicalId: 'rights.decision.foreign-evaluator',
    evaluatorPrincipal: FOREIGN_EVALUATOR
  }), RightsAuthorityError, 'RIGHTS_EVALUATOR_SCOPE_MISMATCH');
});

test('grant expiry blocks new use but does not invalidate historical ALLOW replay', () => {
  const env = world('expiry');
  allowGrant(env, { logicalId: 'rights.grant.expiry', validUntil: '2026-08-18T03:00:00Z' });
  const historical = decide(env, { logicalId: 'rights.decision.before-expiry', at: '2026-08-18T02:00:00Z' });
  assert.equal(historical.semanticPayload.outcome, 'ALLOW');
  const current = decide(env, { logicalId: 'rights.decision.after-expiry', at: '2026-08-18T03:00:00Z' });
  assert.equal(current.semanticPayload.outcome, 'DENY');
  assert.ok(current.semanticPayload.reasonCodes.includes('GRANT_EXPIRED'));
  assert.equal(validateRightsDecision({ ledger: env.ledger, rightsDecisionRef: historical.ref }).semanticPayload.outcome, 'ALLOW');
});

test('later-issued retroactive grant cannot rewrite an earlier DENY world', () => {
  const env = world('late-grant');
  const historicalDeny = decide(env, { logicalId: 'rights.decision.pre-grant', at: '2026-08-18T02:00:00Z' });
  assert.equal(historicalDeny.semanticPayload.outcome, 'DENY');
  allowGrant(env, {
    logicalId: 'rights.grant.late-issued',
    issuedAt: '2026-08-18T03:00:00Z',
    validFrom: '2026-08-18T01:00:00Z'
  });
  assert.equal(validateRightsDecision({ ledger: env.ledger, rightsDecisionRef: historicalDeny.ref }).semanticPayload.outcome, 'DENY');
  const current = decide(env, { logicalId: 'rights.decision.post-grant', at: '2026-08-18T04:00:00Z' });
  assert.equal(current.semanticPayload.outcome, 'ALLOW');
});

test('later-recorded revocation blocks current use without rewriting what was known historically', () => {
  const env = world('revocation');
  const grant = allowGrant(env, { logicalId: 'rights.grant.revocable' });
  const historical = decide(env, { logicalId: 'rights.decision.before-revocation-record', at: '2026-08-18T03:00:00Z' });
  assert.equal(historical.semanticPayload.outcome, 'ALLOW');
  const revocation = publishRightsRevocation({
    ledger: env.ledger,
    logicalId: 'rights.revocation.revocable',
    version: '1',
    rightsGrantRef: grant.ref,
    effectiveAt: '2026-08-18T02:30:00Z',
    reasonCodes: ['LICENSE_TERMINATED'],
    revokerPrincipal: OWNER,
    audit: audit('evt-rights-revocation', OWNER, '2026-08-18T05:00:00Z')
  });
  assert.equal(validateRightsDecision({ ledger: env.ledger, rightsDecisionRef: historical.ref }).semanticPayload.outcome, 'ALLOW');
  const current = decide(env, { logicalId: 'rights.decision.after-revocation-record', at: '2026-08-18T06:00:00Z' });
  assert.equal(current.semanticPayload.outcome, 'DENY');
  assert.ok(current.semanticPayload.reasonCodes.includes('GRANT_REVOKED'));
  assert.equal(current.semanticPayload.revocationRefs.length, 1);
  assert.equal(current.semanticPayload.revocationRefs[0].semanticHash, revocation.ref.semanticHash);
  const validatedRevocation = validateRightsRevocation({ ledger: env.ledger, rightsRevocationRef: revocation.ref });
  assert.equal(validatedRevocation.record.ref.semanticHash, revocation.ref.semanticHash);
  assert.ok(env.ledger.lineageFor(grant.ref).some((edge) => edge.relation === 'revokes' && edge.from.semanticHash === revocation.ref.semanticHash));
});

test('point-in-time ALLOW cannot be replayed as authority for a later action time', () => {
  const env = world('stale');
  allowGrant(env, { logicalId: 'rights.grant.stale' });
  const decision = decide(env, { logicalId: 'rights.decision.stale', at: '2026-08-18T02:00:00Z' });
  expectError(() => assertAllowed(env, decision, { at: '2026-08-18T02:00:01Z' }), RightsAuthorityError, 'STALE_RIGHTS_DECISION_FOR_ACTION');
});

test('unknown operation fails closed before a RightsDecision can be published', () => {
  const env = world('unknown-operation');
  expectError(() => decide(env, {
    logicalId: 'rights.decision.unknown-operation',
    operation: 'DO_WHATEVER_THE_MODEL_WANTS'
  }), RightsAuthorityError, 'UNKNOWN_RIGHTS_OPERATION');
  assert.equal(env.ledger.exportSnapshot().records.filter((record) => record.ref.kind === 'RightsDecision').length, 0);
});

test('generic AuthorityLedger cannot smuggle hidden RightsGrant semantics past the hardened evaluator', () => {
  const env = world('semantic-smuggling');
  const valid = allowGrant(env, { logicalId: 'rights.grant.valid-template' });
  const injected = env.ledger.publish({
    kind: 'RightsGrant',
    logicalId: 'rights.grant.injected-hidden-field',
    version: '1',
    semanticPayload: {
      ...valid.semanticPayload,
      hiddenOverride: 'ALLOW_EVERYTHING'
    },
    audit: audit(
      'evt-rights-grant-injected-hidden-field',
      OWNER,
      valid.semanticPayload.issuedAt,
      [env.policy.ref, env.artifact.ref]
    )
  });
  expectError(() => validateRightsGrant({
    ledger: env.ledger,
    rightsGrantRef: injected.ref
  }), RightsAuthorityError, 'RIGHTS_SEMANTIC_FIELD_FORBIDDEN');
  expectError(() => decide(env, {
    logicalId: 'rights.decision.block-smuggled-world'
  }), RightsAuthorityError, 'RIGHTS_SEMANTIC_FIELD_FORBIDDEN');
});

test('semantic publication timestamps are authority-bound to direct audit time', () => {
  const env = world('audit-time');
  const valid = allowGrant(env, { logicalId: 'rights.grant.audit-template' });
  const injected = env.ledger.publish({
    kind: 'RightsGrant',
    logicalId: 'rights.grant.audit-time-forged',
    version: '1',
    semanticPayload: {
      ...valid.semanticPayload,
      issuedAt: '2026-08-18T01:30:00Z'
    },
    audit: audit(
      'evt-rights-grant-audit-time-forged',
      OWNER,
      '2026-08-18T01:00:00Z',
      [env.policy.ref, env.artifact.ref]
    )
  });
  expectError(() => validateRightsGrant({ ledger: env.ledger, rightsGrantRef: injected.ref }), RightsAuthorityError, 'RIGHTS_GRANT_AUDIT_TIME_MISMATCH');
});

test('Rights authority objects inherit immutable semantic identity from AuthorityLedger', () => {
  const env = world('mutation');
  expectError(() => env.ledger.publish({
    kind: 'RightsPolicy',
    logicalId: env.policy.ref.logicalId,
    version: env.policy.ref.version,
    semanticPayload: { ...env.policy.semanticPayload, defaultOutcome: 'ALLOW' },
    audit: audit('evt-rights-policy-mutation', OWNER, '2026-08-18T07:00:00Z')
  }), AuthorityLedgerError, 'SEMANTIC_MUTATION_FORBIDDEN');
});

let passed = 0;
for (const { name, fn } of tests) {
  try {
    await fn();
    passed += 1;
    console.log(`PASS ${name}`);
  } catch (error) {
    console.error(`FAIL ${name}`);
    console.error(error instanceof Error ? error.stack ?? error.message : String(error));
    process.exitCode = 1;
  }
}

console.log(JSON.stringify({ total: tests.length, passed, failed: tests.length - passed }, null, 2));
if (passed !== tests.length) process.exitCode = 1;

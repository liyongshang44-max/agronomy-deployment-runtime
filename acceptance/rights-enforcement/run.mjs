import { strict as assert } from 'node:assert';
import { AuthorityLedger } from '../../packages/provenance/src/index.mjs';
import { ExactArtifactStore, SourceRegistry } from '../../packages/source-registry/src/index.mjs';
import {
  RightsAuthorityError,
  publishRightsGrant,
  publishRightsPolicy
} from '../../packages/rights-authority/src/index.mjs';
import {
  RIGHTS_EFFECT_GATE_AUTHORITY_CLAIM,
  RIGHTS_EFFECT_GATE_VERSION,
  RightsEffectGate
} from '../../packages/rights-enforcement/src/index.mjs';

const OWNER = {
  principalId: 'rights-owner',
  type: 'USER',
  organizationId: 'org-a',
  tenantId: 'tenant-a'
};
const ACTOR = {
  principalId: 'pilot-operator',
  type: 'USER',
  organizationId: 'org-a',
  tenantId: 'tenant-a'
};
const EVALUATOR = {
  principalId: 'rights-effect-gate',
  type: 'SERVICE_ACCOUNT',
  organizationId: 'org-a',
  tenantId: 'tenant-a'
};

function audit(eventId, principal, occurredAt) {
  return {
    eventId,
    occurredAt,
    actor: { type: principal.type, id: principal.principalId },
    details: { channel: 'rights-enforcement-acceptance' }
  };
}

function setup(label) {
  const ledger = new AuthorityLedger();
  const sourceRegistry = new SourceRegistry({ ledger, artifactStore: new ExactArtifactStore() });
  const source = sourceRegistry.registerSource({
    logicalId: `source.rights-enforcement.${label}`,
    version: '1',
    sourceType: 'PUBLICATION',
    title: `Rights enforcement ${label}`,
    ownership: { organizationId: 'org-a', tenantId: 'tenant-a' },
    rights: { basis: 'metadata-only' },
    audit: audit(`evt-source-${label}`, OWNER, '2026-08-18T11:00:00Z')
  });
  const artifact = sourceRegistry.materializeArtifact({
    logicalId: `artifact.rights-enforcement.${label}`,
    version: '1',
    sourceRef: source.ref,
    bytes: Buffer.from(`%PDF-1.7\n${label}`),
    mediaType: 'application/pdf',
    materializationIdentity: `fixture:${label}`,
    acquisition: { method: 'FIXTURE', acquiredAt: '2026-08-18T11:00:00Z', locator: `fixture://${label}` },
    audit: audit(`evt-artifact-${label}`, OWNER, '2026-08-18T11:00:00Z')
  });
  const policy = publishRightsPolicy({
    ledger,
    logicalId: `rights.policy.enforcement.${label}`,
    version: '1',
    ownership: { organizationId: 'org-a', tenantId: 'tenant-a' },
    ownerPrincipal: OWNER,
    basis: { class: 'INTERNAL_POLICY', evidenceRefs: [] },
    audit: audit(`evt-policy-${label}`, OWNER, '2026-08-18T11:05:00Z')
  });
  return { ledger, sourceRegistry, source, artifact, policy, gate: new RightsEffectGate({ ledger }) };
}

function grant(env, label, rules) {
  return publishRightsGrant({
    ledger: env.ledger,
    logicalId: `rights.grant.enforcement.${label}`,
    version: '1',
    rightsPolicyRef: env.policy.ref,
    subjectRef: env.artifact.ref,
    grantee: { organizationId: 'org-a', tenantId: 'tenant-a', principalId: ACTOR.principalId, principalType: ACTOR.type },
    rules,
    validFrom: '2026-08-18T11:10:00Z',
    validUntil: '2026-08-19T11:10:00Z',
    grantorPrincipal: OWNER,
    audit: audit(`evt-grant-${label}`, OWNER, '2026-08-18T11:10:00Z')
  });
}

function use(env, label, operation, {
  purpose = 'SCIENTIFIC_CLAIM_EXTRACTION',
  obligations = [],
  at = '2026-08-18T12:00:00Z'
} = {}) {
  return {
    logicalId: `rights.decision.enforcement.${label}.${operation.toLowerCase()}`,
    version: '1',
    rightsPolicyRef: env.policy.ref,
    subjectRef: env.artifact.ref,
    actor: ACTOR,
    evaluatorPrincipal: EVALUATOR,
    operation,
    purpose,
    jurisdiction: 'US',
    evaluatedAt: at,
    enforceableObligations: obligations,
    audit: audit(`evt-decision-${label}-${operation.toLowerCase()}`, EVALUATOR, at)
  };
}

async function expectAsyncError(fn, ErrorType, code) {
  let caught;
  try { await fn(); } catch (error) { caught = error; }
  assert.ok(caught instanceof ErrorType, `expected ${ErrorType.name}, got ${caught?.constructor?.name ?? 'no error'}`);
  assert.equal(caught.code, code);
  return caught;
}

const tests = [];
function test(name, fn) { tests.push({ name, fn }); }

test('RETAIN_FULLTEXT DENY means retention effect is never invoked', async () => {
  const env = setup('retain-deny');
  let calls = 0;
  await expectAsyncError(() => env.gate.execute({
    uses: [use(env, 'retain-deny', 'RETAIN_FULLTEXT', { purpose: 'SOURCE_RETENTION' })],
    effect: async () => { calls += 1; return 'stored'; }
  }), RightsAuthorityError, 'RIGHTS_DENIED');
  assert.equal(calls, 0);
  const decisions = env.ledger.exportSnapshot().records.filter((record) => record.ref.kind === 'RightsDecision');
  assert.equal(decisions.length, 1);
  assert.equal(decisions[0].semanticPayload.outcome, 'DENY');
});

test('exact RETAIN_FULLTEXT ALLOW invokes retention once and returns exact RightsDecision ref', async () => {
  const env = setup('retain-allow');
  publishRightsGrant({
    ledger: env.ledger,
    logicalId: 'rights.grant.enforcement.retain-allow',
    version: '1',
    rightsPolicyRef: env.policy.ref,
    subjectRef: env.artifact.ref,
    grantee: { organizationId: 'org-a', tenantId: 'tenant-a', principalId: ACTOR.principalId, principalType: ACTOR.type },
    rules: [{ operation: 'RETAIN_FULLTEXT', purposes: ['SOURCE_RETENTION'], jurisdictions: ['US'], obligations: [] }],
    validFrom: '2026-08-18T11:10:00Z',
    validUntil: '2026-08-19T11:10:00Z',
    grantorPrincipal: OWNER,
    audit: audit('evt-grant-retain-allow', OWNER, '2026-08-18T11:10:00Z')
  });
  let calls = 0;
  const result = await env.gate.execute({
    uses: [use(env, 'retain-allow', 'RETAIN_FULLTEXT', { purpose: 'SOURCE_RETENTION' })],
    effect: async ({ rightsDecisionRefs }) => {
      calls += 1;
      assert.equal(rightsDecisionRefs.length, 1);
      return { receipt: 'retained' };
    }
  });
  assert.equal(calls, 1);
  assert.equal(result.rightsDecisionRefs.length, 1);
  assert.equal(result.value.receipt, 'retained');
  assert.equal(result.gateVersion, RIGHTS_EFFECT_GATE_VERSION);
  assert.equal(result.authorityClaim, RIGHTS_EFFECT_GATE_AUTHORITY_CLAIM);
  assert.equal(env.ledger.resolve(result.rightsDecisionRefs[0]).semanticPayload.operation, 'RETAIN_FULLTEXT');
});

test('READ_FOR_EXTRACTION DENY means extractor effect never receives control', async () => {
  const env = setup('read-deny');
  let extractorCalls = 0;
  await expectAsyncError(() => env.gate.execute({
    uses: [use(env, 'read-deny', 'READ_FOR_EXTRACTION')],
    effect: async () => { extractorCalls += 1; return 'bytes'; }
  }), RightsAuthorityError, 'RIGHTS_DENIED');
  assert.equal(extractorCalls, 0);
});

test('MODEL_EGRESS DENY blocks provider before any combined read/egress effect runs', async () => {
  const env = setup('egress-deny');
  grant(env, 'read-only', [{
    operation: 'READ_FOR_EXTRACTION',
    purposes: ['SCIENTIFIC_CLAIM_EXTRACTION'],
    jurisdictions: ['US'],
    obligations: []
  }]);
  let providerCalls = 0;
  await expectAsyncError(() => env.gate.execute({
    uses: [
      use(env, 'egress-deny-read', 'READ_FOR_EXTRACTION'),
      use(env, 'egress-deny-model', 'MODEL_EGRESS')
    ],
    effect: async () => { providerCalls += 1; return 'provider-result'; }
  }), RightsAuthorityError, 'RIGHTS_DENIED');
  assert.equal(providerCalls, 0);
  const decisions = env.ledger.exportSnapshot().records.filter((record) => record.ref.kind === 'RightsDecision');
  assert.equal(decisions.length, 2);
  assert.equal(decisions.find((record) => record.semanticPayload.operation === 'READ_FOR_EXTRACTION').semanticPayload.outcome, 'ALLOW');
  assert.equal(decisions.find((record) => record.semanticPayload.operation === 'MODEL_EGRESS').semanticPayload.outcome, 'DENY');
});

test('unsupported mandatory obligation blocks provider before side effect', async () => {
  const env = setup('obligation-block');
  grant(env, 'obligation-block', [
    { operation: 'READ_FOR_EXTRACTION', purposes: ['SCIENTIFIC_CLAIM_EXTRACTION'], jurisdictions: ['US'], obligations: [] },
    { operation: 'MODEL_EGRESS', purposes: ['SCIENTIFIC_CLAIM_EXTRACTION'], jurisdictions: ['US'], obligations: ['DELETE_PROVIDER_COPY'] }
  ]);
  let providerCalls = 0;
  await expectAsyncError(() => env.gate.execute({
    uses: [
      use(env, 'obligation-read', 'READ_FOR_EXTRACTION'),
      use(env, 'obligation-egress', 'MODEL_EGRESS', { obligations: [] })
    ],
    effect: async () => { providerCalls += 1; return 'provider-result'; }
  }), RightsAuthorityError, 'RIGHTS_OBLIGATION_UNSUPPORTED');
  assert.equal(providerCalls, 0);
});

test('READ_FOR_EXTRACTION plus MODEL_EGRESS ALLOW calls provider once and returns both exact decision refs', async () => {
  const env = setup('dual-allow');
  grant(env, 'dual-allow', [
    { operation: 'READ_FOR_EXTRACTION', purposes: ['SCIENTIFIC_CLAIM_EXTRACTION'], jurisdictions: ['US'], obligations: [] },
    { operation: 'MODEL_EGRESS', purposes: ['SCIENTIFIC_CLAIM_EXTRACTION'], jurisdictions: ['US'], obligations: [] }
  ]);
  let providerCalls = 0;
  const result = await env.gate.execute({
    uses: [
      use(env, 'dual-read', 'READ_FOR_EXTRACTION'),
      use(env, 'dual-egress', 'MODEL_EGRESS')
    ],
    effect: async ({ rightsDecisionRefs }) => {
      providerCalls += 1;
      return { observedDecisionCount: rightsDecisionRefs.length };
    }
  });
  assert.equal(providerCalls, 1);
  assert.equal(result.rightsDecisionRefs.length, 2);
  assert.equal(result.value.observedDecisionCount, 2);
  assert.deepEqual(
    result.rightsDecisionRefs.map((ref) => env.ledger.resolve(ref).semanticPayload.operation),
    ['READ_FOR_EXTRACTION', 'MODEL_EGRESS']
  );
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

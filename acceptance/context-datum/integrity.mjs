import assert from 'node:assert/strict';
import { semanticHash } from '../../packages/canonicalization/src/index.mjs';
import { AuthorityLedger } from '../../packages/provenance/src/index.mjs';
import { PERMISSIONS, publishRoleAssignment, recordAuthorizationDecision } from '../../packages/authorization/src/index.mjs';
import { authorizeContextWrite } from '../../packages/authorization/src/context-write.mjs';
import {
  CONTEXT_DATUM_CONTRACT_VERSION,
  publishContextDatum,
  validateContextDatumAuthority
} from '../../packages/context-contract/src/index.mjs';
import { audit, baseDatum, createWriteAuthorization, principal, publishAuthorized } from './fixtures.mjs';

let passed = 0;
function test(name, fn) {
  try {
    fn();
    passed += 1;
    console.log(`PASS ${name}`);
  } catch (error) {
    console.error(`FAIL ${name}`);
    throw error;
  }
}

test('raw naked values are rejected instead of being inferred into ContextDatum semantics', () => {
  const ledger = new AuthorityLedger();
  assert.throws(
    () => publishContextDatum({ ledger, logicalId: 'ctx-raw', version: '1', target: { organizationId: 'org-a', tenantId: 'tenant-a' }, datum: { soil_moisture: 32 }, principal, audit: audit() }),
    (error) => error?.code === 'INVALID_CONTEXT_DATUM_FIELD'
  );
});

test('epistemic class must be explicit and cannot be inferred from provenance', () => {
  const ledger = new AuthorityLedger();
  assert.throws(
    () => publishContextDatum({ ledger, logicalId: 'ctx-no-epistemic', version: '1', target: { organizationId: 'org-a', tenantId: 'tenant-a' }, datum: baseDatum({ epistemicClass: undefined }), principal, audit: audit() }),
    (error) => error?.code === 'INVALID_CONTEXT_DATUM_INPUT'
  );
  const explicit = publishAuthorized(ledger, 'ctx-assertion-provider', '1', baseDatum({ epistemicClass: 'ASSERTION', provenanceClass: 'EXTERNAL_PROVIDER' }));
  assert.equal(explicit.semanticPayload.epistemicClass, 'ASSERTION');
});

test('unsupported epistemic and provenance classes are fail-closed', () => {
  for (const override of [{ epistemicClass: 'TRUTH' }, { provenanceClass: 'AI_GUESS' }]) {
    const ledger = new AuthorityLedger();
    assert.throws(
      () => publishContextDatum({ ledger, logicalId: 'ctx-class-bad', version: '1', target: { organizationId: 'org-a', tenantId: 'tenant-a' }, datum: baseDatum(override), principal, audit: audit() }),
      (error) => ['INVALID_EPISTEMIC_CLASS', 'INVALID_PROVENANCE_CLASS'].includes(error?.code)
    );
  }
});

test('value type vocabulary is exact and rejects lowercase or unknown aliases', () => {
  for (const value of [{ type: 'decimal', decimal: '0.32' }, { type: 'NUMBER', decimal: '0.32' }]) {
    const ledger = new AuthorityLedger();
    assert.throws(
      () => publishContextDatum({ ledger, logicalId: 'ctx-value-type-bad', version: '1', target: { organizationId: 'org-a', tenantId: 'tenant-a' }, datum: baseDatum({ value }), principal, audit: audit() }),
      (error) => error?.code === 'INVALID_CONTEXT_VALUE_TYPE'
    );
  }
});

test('unsafe numeric coercion, exponent decimals and ambiguous leading zeros are rejected', () => {
  for (const value of [
    { type: 'DECIMAL', decimal: 0.32 },
    { type: 'DECIMAL', decimal: '3.2e-1' },
    { type: 'DECIMAL', decimal: '00.32' },
    { type: 'INTEGER', integer: 12 }
  ]) {
    const ledger = new AuthorityLedger();
    assert.throws(
      () => publishContextDatum({ ledger, logicalId: 'ctx-number-bad', version: '1', target: { organizationId: 'org-a', tenantId: 'tenant-a' }, datum: baseDatum({ value }), principal, audit: audit() }),
      (error) => ['INVALID_CONTEXT_DATUM_INPUT', 'INVALID_CONTEXT_DECIMAL', 'INVALID_CONTEXT_INTEGER'].includes(error?.code)
    );
  }
});

test('authority timestamps require strict RFC3339 timezone and deterministic millisecond precision', () => {
  for (const availableAt of [
    '2026-08-16',
    '2026-08-16T02:00:00',
    '2026-02-30T02:00:00Z',
    '2026-08-16T24:00:00Z',
    '2026-08-16T02:00:00.1234Z',
    '2026-08-16T02:00:00+15:00'
  ]) {
    const ledger = new AuthorityLedger();
    assert.throws(
      () => publishContextDatum({ ledger, logicalId: 'ctx-time-bad', version: '1', target: { organizationId: 'org-a', tenantId: 'tenant-a' }, datum: baseDatum({ availableAt }), principal, audit: audit() }),
      (error) => error?.code === 'INVALID_CONTEXT_TIME'
    );
  }
});

test('invalid effective and vertical supports are rejected', () => {
  for (const override of [
    { effectiveInterval: { start: '2026-08-16T02:00:00Z', end: '2026-08-16T01:00:00Z' } },
    { verticalSupport: { fromMm: '600', toMm: '0' } }
  ]) {
    const ledger = new AuthorityLedger();
    assert.throws(
      () => publishContextDatum({ ledger, logicalId: 'ctx-support-bad', version: '1', target: { organizationId: 'org-a', tenantId: 'tenant-a' }, datum: baseDatum(override), principal, audit: audit() }),
      (error) => ['INVALID_EFFECTIVE_INTERVAL', 'INVALID_VERTICAL_SUPPORT'].includes(error?.code)
    );
  }
});

test('INTERVAL does not invent ordering semantics for STRING or CATEGORY values', () => {
  for (const endpointType of ['STRING', 'CATEGORY']) {
    const key = endpointType === 'STRING' ? 'string' : 'category';
    const ledger = new AuthorityLedger();
    assert.throws(
      () => publishContextDatum({
        ledger,
        logicalId: `ctx-interval-${endpointType.toLowerCase()}`,
        version: '1',
        target: { organizationId: 'org-a', tenantId: 'tenant-a' },
        datum: baseDatum({ value: { type: 'INTERVAL', lower: { type: endpointType, [key]: 'A' }, upper: { type: endpointType, [key]: 'B' } } }),
        principal,
        audit: audit()
      }),
      (error) => error?.code === 'INVALID_CONTEXT_INTERVAL'
    );
  }
});

test('invalid uncertainty interval and duplicate categorical uncertainty are rejected', () => {
  for (const uncertainty of [
    { type: 'INTERVAL', lowerDecimal: '10', upperDecimal: '5' },
    { type: 'CATEGORICAL_SET', values: ['LOW', 'LOW'] }
  ]) {
    const ledger = new AuthorityLedger();
    assert.throws(
      () => publishContextDatum({ ledger, logicalId: 'ctx-uncertainty-bad', version: '1', target: { organizationId: 'org-a', tenantId: 'tenant-a' }, datum: baseDatum({ uncertainty }), principal, audit: audit() }),
      (error) => ['INVALID_UNCERTAINTY_INTERVAL', 'DUPLICATE_UNCERTAINTY_VALUE'].includes(error?.code)
    );
  }
});

test('ContextDatum write requires a replayable context.write AuthorizationDecisionAudit', () => {
  const ledger = new AuthorityLedger();
  assert.throws(
    () => publishContextDatum({ ledger, logicalId: 'ctx-no-auth', version: '1', target: { organizationId: 'org-a', tenantId: 'tenant-a' }, datum: baseDatum(), principal, audit: audit() }),
    (error) => error?.code === 'INVALID_AUTHORITY_REF' || error?.code === 'CONTEXT_WRITE_AUTHORIZATION_REQUIRED'
  );
});

test('decision.problem.create permission does not authorize ContextDatum writes', () => {
  const ledger = new AuthorityLedger();
  const assignment = publishRoleAssignment({
    ledger,
    logicalId: 'wrong-permission',
    version: '1',
    principal,
    role: 'WRONG',
    roleDefinitionVersion: 'test',
    permissions: [PERMISSIONS.DECISION_PROBLEM_CREATE],
    scope: { organizationId: 'org-a', tenantId: 'tenant-a', resourceType: 'CONTEXT_DATUM' },
    audit: audit()
  });
  const decision = authorizeContextWrite({ principal, roleAssignments: [assignment], authorizationScope: { organizationId: 'org-a', tenantId: 'tenant-a', resourceType: 'CONTEXT_DATUM', resourceId: 'ctx-wrong-permission' } });
  assert.equal(decision.allowed, false);
  const denied = recordAuthorizationDecision({ ledger, decision, audit: audit(principal, 'denied') });
  assert.throws(
    () => publishContextDatum({ ledger, logicalId: 'ctx-wrong-permission', version: '1', target: { organizationId: 'org-a', tenantId: 'tenant-a' }, datum: baseDatum(), principal, authorizationDecisionAuditRef: denied.ref, audit: audit() }),
    (error) => error?.code === 'CONTEXT_WRITE_AUTHORIZATION_MISMATCH'
  );
});

test('context-write authorization is bound to exact ContextDatum logical id', () => {
  const ledger = new AuthorityLedger();
  const { recorded } = createWriteAuthorization(ledger, 'ctx-a');
  assert.throws(
    () => publishContextDatum({ ledger, logicalId: 'ctx-b', version: '1', target: { organizationId: 'org-a', tenantId: 'tenant-a' }, datum: baseDatum(), principal, authorizationDecisionAuditRef: recorded.ref, audit: audit() }),
    (error) => error?.code === 'CONTEXT_WRITE_AUTHORIZATION_MISMATCH'
  );
});

test('cross-organization/tenant target creation is denied before publication', () => {
  for (const target of [{ organizationId: 'org-b', tenantId: 'tenant-a' }, { organizationId: 'org-a', tenantId: 'tenant-b' }]) {
    const ledger = new AuthorityLedger();
    assert.throws(
      () => publishContextDatum({ ledger, logicalId: 'ctx-cross-scope', version: '1', target, datum: baseDatum(), principal, audit: audit() }),
      (error) => error?.code === 'CONTEXT_DATUM_TARGET_SCOPE_DENIED'
    );
  }
});

test('publication audit actor cannot impersonate ContextDatum creator', () => {
  const ledger = new AuthorityLedger();
  const { recorded } = createWriteAuthorization(ledger, 'ctx-audit');
  const foreign = { ...principal, principalId: 'other-service' };
  assert.throws(
    () => publishContextDatum({ ledger, logicalId: 'ctx-audit', version: '1', target: { organizationId: 'org-a', tenantId: 'tenant-a' }, datum: baseDatum(), principal, authorizationDecisionAuditRef: recorded.ref, audit: audit(foreign) }),
    (error) => error?.code === 'CONTEXT_DATUM_AUDIT_ACTOR_MISMATCH'
  );
});

test('forged allow AuthorizationDecision without RoleAssignment cannot create ContextDatum authority', () => {
  const ledger = new AuthorityLedger();
  const basis = { operation: 'CONTEXT_WRITE', principal, assignmentRefs: [], request: { authorizationScope: { organizationId: 'org-a', tenantId: 'tenant-a', resourceType: 'CONTEXT_DATUM', resourceId: 'ctx-forged' } }, allowed: true, reasons: [] };
  const forged = ledger.publish({ kind: 'AuthorizationDecisionAudit', logicalId: 'forged-context-auth', version: '1', semanticPayload: { ...basis, decisionHash: semanticHash('AuthorizationDecision', basis) }, audit: { ...audit(), action: 'AUTHORIZATION_CONTEXT_WRITE_ALLOW', inputRefs: [] } });
  assert.throws(
    () => publishContextDatum({ ledger, logicalId: 'ctx-forged', version: '1', target: { organizationId: 'org-a', tenantId: 'tenant-a' }, datum: baseDatum(), principal, authorizationDecisionAuditRef: forged.ref, audit: audit() }),
    (error) => error?.code === 'CONTEXT_WRITE_ROLE_ASSIGNMENT_REQUIRED'
  );
});

test('copying A02 audit vocabulary cannot launder a generic-ledger ContextDatum', () => {
  const ledger = new AuthorityLedger();
  const basis = { operation: 'CONTEXT_WRITE', principal, assignmentRefs: [], request: { authorizationScope: { organizationId: 'org-a', tenantId: 'tenant-a', resourceType: 'CONTEXT_DATUM', resourceId: 'ctx-laundered' } }, allowed: true, reasons: [] };
  const forgedAuth = ledger.publish({ kind: 'AuthorizationDecisionAudit', logicalId: 'forged-context-auth-2', version: '1', semanticPayload: { ...basis, decisionHash: semanticHash('AuthorizationDecision', basis) }, audit: { ...audit(), action: 'AUTHORIZATION_CONTEXT_WRITE_ALLOW', inputRefs: [] } });
  const normalizedRecord = publishAuthorized(new AuthorityLedger(), 'ctx-template', '1');
  const malformed = ledger.publish({
    kind: 'ContextDatum',
    logicalId: 'ctx-laundered',
    version: '1',
    semanticPayload: { ...normalizedRecord.semanticPayload, datumId: 'ctx-laundered' },
    audit: {
      ...audit(),
      action: 'PUBLISH_CONTEXT_DATUM',
      inputRefs: [forgedAuth.ref],
      details: { creationPrincipal: principal, targetScope: { organizationId: 'org-a', tenantId: 'tenant-a' }, authorizationDecisionAuditRef: forgedAuth.ref, authorityClass: 'CONTEXT_FACT' }
    }
  });
  assert.throws(
    () => validateContextDatumAuthority({ ledger, contextDatumRef: malformed.ref }),
    (error) => error?.code === 'CONTEXT_DATUM_AUDIT_INVALID'
  );
});

test('same logical/version ContextDatum cannot be semantically rewritten', () => {
  const ledger = new AuthorityLedger();
  publishAuthorized(ledger, 'ctx-immutable', '1', baseDatum({ value: { type: 'DECIMAL', decimal: '0.30' } }));
  assert.throws(
    () => publishAuthorized(ledger, 'ctx-immutable', '1', baseDatum({ value: { type: 'DECIMAL', decimal: '0.31' } })),
    (error) => error?.code === 'SEMANTIC_MUTATION_FORBIDDEN'
  );
});

test('AUTHORIZED_REFERENCE is a distinct mode and cannot masquerade as inline ContextDatum', () => {
  const ledger = new AuthorityLedger();
  assert.throws(
    () => publishContextDatum({
      ledger,
      logicalId: 'ctx-ref',
      version: '1',
      target: { organizationId: 'org-a', tenantId: 'tenant-a' },
      datum: { contractVersion: CONTEXT_DATUM_CONTRACT_VERSION, valueMode: 'AUTHORIZED_REFERENCE', referenceId: 'ref-1' },
      principal,
      audit: audit()
    }),
    (error) => error?.code === 'INVALID_CONTEXT_DATUM_FIELD'
  );
});

console.log(`ContextDatum integrity acceptance: ${passed} passed`);

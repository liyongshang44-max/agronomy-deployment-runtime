import { strict as assert } from 'node:assert';
import { AuthorityLedgerError } from '../../packages/provenance/src/index.mjs';
import { createPrincipal, publishBuiltinRoleAssignment } from '../../packages/authorization/src/index.mjs';
import { ScientificQualificationService, qualificationResourceId } from '../../packages/knowledge-registry/src/qualification.mjs';
import { validateQualifiedKnowledgeAuthority, QualifiedAuthorityError } from '../../packages/knowledge-registry/src/qualified-authority.mjs';
import {
  DerivedKnowledgeService,
  SynthesisAuthorityError,
  derivationMethodResourceId,
  synthesisResourceId
} from '../../packages/synthesis-engine/src/index.mjs';
import { validateDerivedKnowledgeAuthority, DerivedAuthorityValidationError } from '../../packages/synthesis-engine/src/authority.mjs';
import {
  KnowledgeConflictError,
  KnowledgeConflictService,
  conflictAssessmentResourceId,
  conflictResolutionResourceId
} from '../../packages/conflict-engine/src/index.mjs';
import {
  USE_APPLICABILITY,
  USE_OTHER,
  audit,
  authorizeForResource,
  createEnvironment,
  makeQualifiedKnowledge
} from './fixture.mjs';

function expectError(fn, ErrorType, code) {
  let caught;
  try { fn(); } catch (error) { caught = error; }
  assert.ok(caught instanceof ErrorType, `expected ${ErrorType.name}, got ${caught?.constructor?.name ?? 'no error'}`);
  assert.equal(caught.code, code);
}

function makeMethod(env, {
  label = 'water-threshold',
  semanticRole = 'corn.irrigation.depletion_threshold',
  minimumInputs = 2,
  methodSpec = { estimator: 'GOVERNED_CONSENSUS', weighting: 'EXPLICIT_METHOD' },
  contextPolicy = 'PRESERVE_ALL_ORIGINS',
  principal = env.approver,
  roleAssignment = env.approverRole,
  ownership = { organizationId: 'org-a', tenantId: 'tenant-a' }
} = {}) {
  const logicalId = `method.${label}`;
  const approval = authorizeForResource(env, {
    resourceId: derivationMethodResourceId(logicalId),
    qualificationTarget: { use: 'DERIVATION_METHOD_APPROVAL' },
    logicalId: `method-approval-${label}`,
    ownership,
    principal,
    roleAssignment
  });
  const service = new DerivedKnowledgeService({ ledger: env.ledger });
  const method = service.publishDerivationMethod({
    logicalId,
    version: '1',
    methodType: 'GOVERNED_SYNTHESIS',
    semanticRole,
    minimumInputs,
    contextPolicy,
    methodSpec,
    ownership,
    approverPrincipal: principal,
    authorizationDecisionAuditRef: approval.authAudit.ref,
    audit: audit(`evt-method-${label}`, principal.principalId)
  });
  return { service, method, approval };
}

function derivePair(env, methodBundle, a, b, {
  label = 'derived-threshold',
  semanticRole = methodBundle.method.semanticPayload.semanticRole,
  assertion = 'Governed synthesis retains a bounded corn irrigation depletion-threshold knowledge assertion.',
  restrictions = [{ semanticId: 'crop.code', operator: 'EQUALS', value: 'maize' }],
  heterogeneity = [{ dimension: 'soil.texture', status: 'UNRESOLVED_HETEROGENEITY' }]
} = {}) {
  const approval = authorizeForResource(env, {
    resourceId: synthesisResourceId(methodBundle.method.ref),
    qualificationTarget: { use: 'DERIVED_KNOWLEDGE_SYNTHESIS' },
    logicalId: `synthesis-${label}`
  });
  return methodBundle.service.derive({
    derivedKnowledgeLogicalId: `derived.${label}`,
    derivedKnowledgeVersion: '1',
    derivedContextLogicalId: `derived-context.${label}`,
    derivedContextVersion: '1',
    derivationMethodRef: methodBundle.method.ref,
    inputBindings: [
      { qualifiedKnowledgeRef: a.knowledge.ref, useTarget: USE_APPLICABILITY },
      { qualifiedKnowledgeRef: b.knowledge.ref, useTarget: USE_APPLICABILITY }
    ],
    semanticRole,
    assertion,
    derivedValue: { type: 'BOUNDED_PARAMETER', lower: '0.42', upper: '0.48' },
    introducedRestrictions: restrictions,
    unresolvedContextHeterogeneity: heterogeneity,
    limitations: [{ code: 'DO_NOT_COLLAPSE_SOURCE_CONTEXT_HETEROGENEITY' }],
    approverPrincipal: env.approver,
    authorizationDecisionAuditRef: approval.authAudit.ref,
    audit: audit(`evt-synthesis-${label}`, env.approver.principalId)
  });
}

function makeConflict(env, a, b, {
  label = 'threshold-conflict',
  semanticRole = 'corn.irrigation.depletion_threshold',
  useTarget = USE_APPLICABILITY
} = {}) {
  const approval = authorizeForResource(env, {
    resourceId: conflictAssessmentResourceId(semanticRole),
    qualificationTarget: { use: 'KNOWLEDGE_CONFLICT_ASSESSMENT' },
    logicalId: `conflict-assessment-${label}`
  });
  const service = new KnowledgeConflictService({ ledger: env.ledger });
  const conflict = service.createConflict({
    logicalId: `conflict.${label}`,
    version: '1',
    semanticRole,
    scientificUseTarget: useTarget,
    memberKnowledgeRefs: [a.knowledge.ref, b.knowledge.ref],
    overlapAssessment: { status: 'OVERLAPPING', dimensions: ['crop.code', 'decision.use'] },
    incompatibilityAssessment: { status: 'MATERIAL_DIFFERENCE', description: 'threshold assertions disagree materially' },
    approverPrincipal: env.approver,
    authorizationDecisionAuditRef: approval.authAudit.ref,
    audit: audit(`evt-conflict-${label}`, env.approver.principalId)
  });
  return { service, conflict, approval };
}

function resolveConflict(env, conflictBundle, {
  label,
  resolutionType,
  selectedKnowledgeRef,
  derivedKnowledgeRef,
  precedenceAuthority,
  supersedesResolutionRef
}) {
  const approval = authorizeForResource(env, {
    resourceId: conflictResolutionResourceId(conflictBundle.conflict.ref),
    qualificationTarget: { use: 'KNOWLEDGE_CONFLICT_RESOLUTION' },
    logicalId: `conflict-resolution-${label}`
  });
  return conflictBundle.service.resolveConflict({
    logicalId: `conflict-resolution.${label}`,
    version: '1',
    knowledgeConflictRef: conflictBundle.conflict.ref,
    resolutionType,
    ...(selectedKnowledgeRef ? { selectedKnowledgeRef } : {}),
    ...(derivedKnowledgeRef ? { derivedKnowledgeRef } : {}),
    ...(precedenceAuthority ? { precedenceAuthority } : {}),
    rationale: `governed K05 resolution ${label}`,
    approverPrincipal: env.approver,
    authorizationDecisionAuditRef: approval.authAudit.ref,
    ...(supersedesResolutionRef ? { supersedesResolutionRef } : {}),
    audit: audit(`evt-conflict-resolution-${label}`, env.approver.principalId)
  });
}

const tests = [];
function test(name, fn) { tests.push({ name, fn }); }

test('DerivedKnowledge retains every exact QualifiedKnowledge and SourceContext origin with full lineage', () => {
  const env = createEnvironment();
  const a = makeQualifiedKnowledge(env, { label: 'a', assertion: 'Irrigation threshold is 0.42 depletion fraction.' });
  const b = makeQualifiedKnowledge(env, { label: 'b', assertion: 'Irrigation threshold is 0.48 depletion fraction.' });
  const method = makeMethod(env);
  const derived = derivePair(env, method, a, b);

  assert.equal(derived.derivedKnowledge.ref.kind, 'DerivedKnowledge');
  assert.equal(derived.derivedContext.ref.kind, 'DerivedKnowledgeContext');
  assert.equal(derived.derivedContext.semanticPayload.originContexts.length, 2);
  assert.ok(derived.derivedContext.semanticPayload.originContexts.some((item) => item.sourceContextRef.semanticHash === a.reviewed.sourceContext.ref.semanticHash));
  assert.ok(derived.derivedContext.semanticPayload.originContexts.some((item) => item.sourceContextRef.semanticHash === b.reviewed.sourceContext.ref.semanticHash));
  assert.ok(env.ledger.lineageFor(derived.derivedKnowledge.ref).filter((edge) => edge.relation === 'DERIVED_FROM').length === 2);
  assert.ok(env.ledger.lineageFor(derived.derivedContext.ref).filter((edge) => edge.relation === 'ORIGIN_CONTEXT_FROM').length === 2);
  validateDerivedKnowledgeAuthority({ ledger: env.ledger, derivedKnowledgeRef: derived.derivedKnowledge.ref, requiredUseTarget: USE_APPLICABILITY });
});

test('DerivedKnowledgeContext never impersonates one arbitrary input SourceContext', () => {
  const env = createEnvironment();
  const a = makeQualifiedKnowledge(env, { label: 'a-context', assertion: 'Threshold A.' });
  const b = makeQualifiedKnowledge(env, { label: 'b-context', assertion: 'Threshold B.' });
  const derived = derivePair(env, makeMethod(env, { label: 'context' }), a, b, { label: 'context' });
  assert.ok(!('sourceContextRef' in derived.derivedKnowledge.semanticPayload));
  assert.ok(!('sourceContextRef' in derived.derivedContext.semanticPayload));
  assert.equal(derived.derivedContext.semanticPayload.authorityClass, 'DERIVED_KNOWLEDGE_CONTEXT');
  assert.equal(derived.derivedContext.semanticPayload.originContexts.length, 2);
});

test('derivation method itself requires exact Scientific Approver authorization', () => {
  const env = createEnvironment();
  const reviewer = createPrincipal({ principalId: 'reviewer-method', type: 'USER', organizationId: 'org-a', tenantId: 'tenant-a' });
  const role = publishBuiltinRoleAssignment({
    ledger: env.ledger,
    logicalId: 'role.reviewer-method',
    version: '1',
    principal: reviewer,
    role: 'AGRONOMY_REVIEWER',
    scope: { organizationId: 'org-a', tenantId: 'tenant-a' },
    audit: audit('evt-reviewer-method-role', 'iam-admin')
  });
  const logicalId = 'method.unauthorized';
  const approval = authorizeForResource(env, {
    resourceId: derivationMethodResourceId(logicalId),
    qualificationTarget: { use: 'DERIVATION_METHOD_APPROVAL' },
    logicalId: 'unauthorized-method',
    principal: reviewer,
    roleAssignment: role
  });
  assert.equal(approval.authAudit.semanticPayload.allowed, false);
  expectError(() => new DerivedKnowledgeService({ ledger: env.ledger }).publishDerivationMethod({
    logicalId,
    version: '1',
    methodType: 'GOVERNED_SYNTHESIS',
    semanticRole: 'corn.irrigation.depletion_threshold',
    methodSpec: { estimator: 'GOVERNED_CONSENSUS' },
    ownership: { organizationId: 'org-a', tenantId: 'tenant-a' },
    approverPrincipal: reviewer,
    authorizationDecisionAuditRef: approval.authAudit.ref,
    audit: audit('evt-unauthorized-method', reviewer.principalId)
  }), SynthesisAuthorityError, 'SYNTHESIS_AUTHORIZATION_DENIED');
});

test('derivation refuses insufficient inputs instead of pretending one source is a synthesis', () => {
  const env = createEnvironment();
  const a = makeQualifiedKnowledge(env, { label: 'single', assertion: 'Single source threshold.' });
  const method = makeMethod(env, { label: 'min-two', minimumInputs: 2 });
  const approval = authorizeForResource(env, {
    resourceId: synthesisResourceId(method.method.ref),
    qualificationTarget: { use: 'DERIVED_KNOWLEDGE_SYNTHESIS' },
    logicalId: 'single-input-synthesis'
  });
  expectError(() => method.service.derive({
    derivedKnowledgeLogicalId: 'derived.single',
    derivedKnowledgeVersion: '1',
    derivedContextLogicalId: 'derived-context.single',
    derivedContextVersion: '1',
    derivationMethodRef: method.method.ref,
    inputBindings: [{ qualifiedKnowledgeRef: a.knowledge.ref, useTarget: USE_APPLICABILITY }],
    semanticRole: method.method.semanticPayload.semanticRole,
    assertion: 'Not enough inputs.',
    approverPrincipal: env.approver,
    authorizationDecisionAuditRef: approval.authAudit.ref,
    audit: audit('evt-single-synthesis', env.approver.principalId)
  }), SynthesisAuthorityError, 'INSUFFICIENT_DERIVATION_INPUTS');
});

test('revoked QualifiedKnowledge cannot enter a new DerivedKnowledge synthesis', () => {
  const env = createEnvironment();
  const a = makeQualifiedKnowledge(env, { label: 'revoked-a', assertion: 'Threshold A.' });
  const b = makeQualifiedKnowledge(env, { label: 'revoked-b', assertion: 'Threshold B.' });
  const revokeAuth = authorizeForResource(env, {
    resourceId: qualificationResourceId(a.reviewed.claim.ref, a.reviewed.sourceContext.ref),
    qualificationTarget: USE_APPLICABILITY,
    logicalId: 'revoke-input'
  });
  a.qualification.revokeQualifiedKnowledgeUse({
    revocationLogicalId: 'revocation.input-a',
    revocationVersion: '1',
    qualifiedKnowledgeRef: a.knowledge.ref,
    qualificationTarget: USE_APPLICABILITY,
    approverPrincipal: env.approver,
    authorizationDecisionAuditRef: revokeAuth.authAudit.ref,
    reasonCodes: ['INPUT_NO_LONGER_QUALIFIED'],
    audit: audit('evt-revoke-input-a', env.approver.principalId)
  });
  const method = makeMethod(env, { label: 'revoked-input' });
  expectError(() => derivePair(env, method, a, b, { label: 'revoked-input' }), QualifiedAuthorityError, 'QUALIFIED_USE_NOT_ACTIVE');
});

test('K05 v1 refuses cross-owner synthesis instead of laundering private knowledge across tenants', () => {
  const env = createEnvironment();
  const a = makeQualifiedKnowledge(env, { label: 'owner-a', assertion: 'Owner A threshold.' });
  const b = makeQualifiedKnowledge(env, {
    label: 'owner-b',
    assertion: 'Owner B threshold.',
    ownership: { organizationId: 'org-b', tenantId: 'tenant-b' }
  });
  const method = makeMethod(env, { label: 'cross-owner' });
  expectError(() => derivePair(env, method, a, b, { label: 'cross-owner' }), SynthesisAuthorityError, 'CROSS_OWNER_SYNTHESIS_NOT_AUTHORIZED');
});

test('different scientific-use authorities cannot be silently mixed in one synthesis', () => {
  const env = createEnvironment();
  const a = makeQualifiedKnowledge(env, { label: 'use-a', assertion: 'Use A threshold.' });
  const b = makeQualifiedKnowledge(env, { label: 'use-b', assertion: 'Use B threshold.', useTarget: USE_OTHER });
  const method = makeMethod(env, { label: 'use-mismatch' });
  expectError(() => derivePair(env, method, a, b, { label: 'use-mismatch' }), QualifiedAuthorityError, 'QUALIFIED_USE_NOT_ACTIVE');
});

test('forged DerivedKnowledge missing exact synthesis lineage cannot pass downstream authority validation', () => {
  const env = createEnvironment();
  const a = makeQualifiedKnowledge(env, { label: 'forge-a', assertion: 'A.' });
  const b = makeQualifiedKnowledge(env, { label: 'forge-b', assertion: 'B.' });
  const derived = derivePair(env, makeMethod(env, { label: 'forge' }), a, b, { label: 'forge' });
  const forged = env.ledger.publish({
    kind: 'DerivedKnowledge',
    logicalId: 'derived.forged-copy',
    version: '1',
    semanticPayload: { ...derived.derivedKnowledge.semanticPayload },
    audit: audit('evt-forged-derived', 'forger')
  });
  expectError(() => validateDerivedKnowledgeAuthority({ ledger: env.ledger, derivedKnowledgeRef: forged.ref, requiredUseTarget: USE_APPLICABILITY }), DerivedAuthorityValidationError, 'DERIVED_AUDIT_INVALID');
});

test('KnowledgeConflict freezes exact competing members, origin contexts and overlap/incompatibility assessments', () => {
  const env = createEnvironment();
  const a = makeQualifiedKnowledge(env, { label: 'conflict-a', assertion: 'Threshold is 0.42.' });
  const b = makeQualifiedKnowledge(env, { label: 'conflict-b', assertion: 'Threshold is 0.58.' });
  const bundle = makeConflict(env, a, b);
  assert.equal(bundle.conflict.semanticPayload.status, 'UNRESOLVED');
  assert.equal(bundle.conflict.semanticPayload.memberBindings.length, 2);
  assert.equal(bundle.service.currentResolution({ knowledgeConflictRef: bundle.conflict.ref }).status, 'UNRESOLVED');
});

test('KnowledgeConflict cannot duplicate one member or claim conflict without at least two legal knowledge authorities', () => {
  const env = createEnvironment();
  const a = makeQualifiedKnowledge(env, { label: 'dup-a', assertion: 'A.' });
  const semanticRole = 'corn.irrigation.depletion_threshold';
  const approval = authorizeForResource(env, {
    resourceId: conflictAssessmentResourceId(semanticRole),
    qualificationTarget: { use: 'KNOWLEDGE_CONFLICT_ASSESSMENT' },
    logicalId: 'dup-conflict'
  });
  const service = new KnowledgeConflictService({ ledger: env.ledger });
  expectError(() => service.createConflict({
    logicalId: 'conflict.duplicate',
    version: '1',
    semanticRole,
    scientificUseTarget: USE_APPLICABILITY,
    memberKnowledgeRefs: [a.knowledge.ref, a.knowledge.ref],
    overlapAssessment: { status: 'OVERLAPPING' },
    incompatibilityAssessment: { status: 'MATERIAL_DIFFERENCE' },
    approverPrincipal: env.approver,
    authorizationDecisionAuditRef: approval.authAudit.ref,
    audit: audit('evt-duplicate-conflict', env.approver.principalId)
  }), KnowledgeConflictError, 'DUPLICATE_CONFLICT_MEMBER');
});

test('explicit precedence is legal only with explicit scientific authority, never newest-wins or LLM preference', () => {
  const env = createEnvironment();
  const a = makeQualifiedKnowledge(env, { label: 'precedence-a', assertion: 'A.' });
  const b = makeQualifiedKnowledge(env, { label: 'precedence-b', assertion: 'B.' });
  const conflict = makeConflict(env, a, b, { label: 'precedence' });
  const approval = authorizeForResource(env, {
    resourceId: conflictResolutionResourceId(conflict.conflict.ref),
    qualificationTarget: { use: 'KNOWLEDGE_CONFLICT_RESOLUTION' },
    logicalId: 'precedence-resolution'
  });
  expectError(() => conflict.service.resolveConflict({
    logicalId: 'resolution.newest-wins',
    version: '1',
    knowledgeConflictRef: conflict.conflict.ref,
    resolutionType: 'EXPLICIT_PRECEDENCE',
    selectedKnowledgeRef: a.knowledge.ref,
    precedenceAuthority: { type: 'NEWEST_WINS' },
    rationale: 'newest is not scientific authority',
    approverPrincipal: env.approver,
    authorizationDecisionAuditRef: approval.authAudit.ref,
    audit: audit('evt-newest-wins', env.approver.principalId)
  }), KnowledgeConflictError, 'FORBIDDEN_CONFLICT_SHORTCUT');

  const resolution = conflict.service.resolveConflict({
    logicalId: 'resolution.explicit-precedence',
    version: '1',
    knowledgeConflictRef: conflict.conflict.ref,
    resolutionType: 'EXPLICIT_PRECEDENCE',
    selectedKnowledgeRef: a.knowledge.ref,
    precedenceAuthority: { type: 'HUMAN_SCIENTIFIC_ADJUDICATION', basis: 'protocol scope matches governed program' },
    rationale: 'explicit scientific precedence for the declared use',
    approverPrincipal: env.approver,
    authorizationDecisionAuditRef: approval.authAudit.ref,
    audit: audit('evt-explicit-precedence', env.approver.principalId)
  });
  assert.equal(resolution.semanticPayload.selectedKnowledgeRef.semanticHash, a.knowledge.ref.semanticHash);
});

test('PRESERVE_ALTERNATIVES resolves workflow without laundering one member into winner authority', () => {
  const env = createEnvironment();
  const a = makeQualifiedKnowledge(env, { label: 'alternatives-a', assertion: 'A.' });
  const b = makeQualifiedKnowledge(env, { label: 'alternatives-b', assertion: 'B.' });
  const conflict = makeConflict(env, a, b, { label: 'alternatives' });
  const resolution = resolveConflict(env, conflict, { label: 'alternatives', resolutionType: 'PRESERVE_ALTERNATIVES' });
  assert.equal(resolution.semanticPayload.resolutionType, 'PRESERVE_ALTERNATIVES');
  assert.equal(resolution.semanticPayload.preservedKnowledgeRefs.length, 2);
  assert.ok(!('selectedKnowledgeRef' in resolution.semanticPayload));
});

test('DERIVED_SYNTHESIS conflict resolution must cover every exact conflict member', () => {
  const env = createEnvironment();
  const a = makeQualifiedKnowledge(env, { label: 'synth-res-a', assertion: 'A.' });
  const b = makeQualifiedKnowledge(env, { label: 'synth-res-b', assertion: 'B.' });
  const c = makeQualifiedKnowledge(env, { label: 'synth-res-c', assertion: 'C.' });
  const method = makeMethod(env, { label: 'synth-res' });
  const derivedAB = derivePair(env, method, a, b, { label: 'synth-res-ab' });
  const conflict = makeConflict(env, a, c, { label: 'synth-res' });
  const approval = authorizeForResource(env, {
    resourceId: conflictResolutionResourceId(conflict.conflict.ref),
    qualificationTarget: { use: 'KNOWLEDGE_CONFLICT_RESOLUTION' },
    logicalId: 'synth-res-incomplete'
  });
  expectError(() => conflict.service.resolveConflict({
    logicalId: 'resolution.synth-incomplete',
    version: '1',
    knowledgeConflictRef: conflict.conflict.ref,
    resolutionType: 'DERIVED_SYNTHESIS',
    derivedKnowledgeRef: derivedAB.derivedKnowledge.ref,
    rationale: 'incomplete input closure must fail',
    approverPrincipal: env.approver,
    authorizationDecisionAuditRef: approval.authAudit.ref,
    audit: audit('evt-synth-incomplete', env.approver.principalId)
  }), KnowledgeConflictError, 'DERIVED_RESOLUTION_INPUT_INCOMPLETE');

  const derivedAC = derivePair(env, method, a, c, { label: 'synth-res-ac' });
  const resolution = conflict.service.resolveConflict({
    logicalId: 'resolution.synth-complete',
    version: '1',
    knowledgeConflictRef: conflict.conflict.ref,
    resolutionType: 'DERIVED_SYNTHESIS',
    derivedKnowledgeRef: derivedAC.derivedKnowledge.ref,
    rationale: 'complete governed synthesis closes exact conflict member set',
    approverPrincipal: env.approver,
    authorizationDecisionAuditRef: approval.authAudit.ref,
    audit: audit('evt-synth-complete', env.approver.principalId)
  });
  assert.equal(resolution.semanticPayload.derivedKnowledgeRef.semanticHash, derivedAC.derivedKnowledge.ref.semanticHash);
});

test('CALIBRATION_REQUIRED never creates DerivedKnowledge or CalibrationArtifact by implication', () => {
  const env = createEnvironment();
  const a = makeQualifiedKnowledge(env, { label: 'cal-a', assertion: 'A.' });
  const b = makeQualifiedKnowledge(env, { label: 'cal-b', assertion: 'B.' });
  const conflict = makeConflict(env, a, b, { label: 'calibration' });
  const before = env.ledger.exportSnapshot().records.length;
  const resolution = resolveConflict(env, conflict, { label: 'calibration', resolutionType: 'CALIBRATION_REQUIRED' });
  const afterRecords = env.ledger.exportSnapshot().records;
  assert.equal(resolution.semanticPayload.calibrationDisposition, 'REQUIRE_SEPARATE_CALIBRATION_ARTIFACT');
  assert.equal(afterRecords.filter((record) => record.ref.kind === 'CalibrationArtifact').length, 0);
  assert.equal(afterRecords.filter((record) => record.ref.kind === 'DerivedKnowledge').length, 0);
  assert.ok(afterRecords.length > before);
});

test('conflict resolution revisions are immutable and must explicitly supersede current active resolution', () => {
  const env = createEnvironment();
  const a = makeQualifiedKnowledge(env, { label: 'revision-a', assertion: 'A.' });
  const b = makeQualifiedKnowledge(env, { label: 'revision-b', assertion: 'B.' });
  const conflict = makeConflict(env, a, b, { label: 'revision' });
  const first = resolveConflict(env, conflict, { label: 'revision-1', resolutionType: 'PRESERVE_ALTERNATIVES' });
  expectError(() => resolveConflict(env, conflict, { label: 'revision-no-supersede', resolutionType: 'CALIBRATION_REQUIRED' }), KnowledgeConflictError, 'ACTIVE_CONFLICT_RESOLUTION_EXISTS');
  const second = resolveConflict(env, conflict, {
    label: 'revision-2',
    resolutionType: 'CALIBRATION_REQUIRED',
    supersedesResolutionRef: first.ref
  });
  assert.notEqual(second.ref.semanticHash, first.ref.semanticHash);
  assert.equal(conflict.service.currentResolution({ knowledgeConflictRef: conflict.conflict.ref }).resolution.ref.semanticHash, second.ref.semanticHash);
});

test('QualifiedKnowledge validator rejects a generic-ledger forged QualifiedKnowledge summary', () => {
  const env = createEnvironment();
  const a = makeQualifiedKnowledge(env, { label: 'forged-qk', assertion: 'A.' });
  const forged = env.ledger.publish({
    kind: 'QualifiedKnowledge',
    logicalId: 'knowledge.forged-summary',
    version: '1',
    semanticPayload: {
      ...a.knowledge.semanticPayload,
      allowedUses: [{ use: 'FAKE_USE' }]
    },
    audit: audit('evt-forged-qk', 'forger')
  });
  expectError(() => validateQualifiedKnowledgeAuthority({ ledger: env.ledger, qualifiedKnowledgeRef: forged.ref, requiredUseTarget: USE_APPLICABILITY }), QualifiedAuthorityError, 'QUALIFIED_KNOWLEDGE_SCOPE_INVALID');
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

import { strict as assert } from 'node:assert';
import { createPrincipal, publishBuiltinRoleAssignment } from '../../packages/authorization/src/index.mjs';
import { qualificationResourceId } from '../../packages/knowledge-registry/src/qualification.mjs';
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

function makeMethod(env, options = {}) {
  const {
    label = 'water-threshold',
    semanticRole = 'corn.irrigation.depletion_threshold',
    minimumInputs = 2,
    methodSpec = { estimator: 'GOVERNED_CONSENSUS', weighting: 'EXPLICIT_METHOD' },
    contextPolicy = 'PRESERVE_ALL_ORIGINS',
    principal = env.approver,
    roleAssignment = env.approverRole,
    ownership = { organizationId: 'org-a', tenantId: 'tenant-a' },
    prohibitedShortcuts
  } = options;
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
    ...(prohibitedShortcuts ? { prohibitedShortcuts } : {}),
    ownership,
    approverPrincipal: principal,
    authorizationDecisionAuditRef: approval.authAudit.ref,
    audit: audit(`evt-method-${label}`, principal.principalId)
  });
  return { service, method, approval };
}

function derivePair(env, methodBundle, a, b, options = {}) {
  const {
    label = 'derived-threshold',
    semanticRole = methodBundle.method.semanticPayload.semanticRole,
    assertion = 'Governed synthesis retains a bounded corn irrigation depletion-threshold knowledge assertion.'
  } = options;
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
    introducedRestrictions: [{ semanticId: 'crop.code', operator: 'EQUALS', value: 'maize' }],
    unresolvedContextHeterogeneity: [{ dimension: 'soil.texture', status: 'UNRESOLVED_HETEROGENEITY' }],
    limitations: [{ code: 'DO_NOT_COLLAPSE_SOURCE_CONTEXT_HETEROGENEITY' }],
    approverPrincipal: env.approver,
    authorizationDecisionAuditRef: approval.authAudit.ref,
    audit: audit(`evt-synthesis-${label}`, env.approver.principalId)
  });
}

function makeConflict(env, a, b, options = {}) {
  const {
    label = 'threshold-conflict',
    semanticRole = 'corn.irrigation.depletion_threshold',
    useTarget = USE_APPLICABILITY
  } = options;
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
    incompatibilityAssessment: { status: 'MATERIAL_DIFFERENCE', description: 'assertions disagree materially' },
    approverPrincipal: env.approver,
    authorizationDecisionAuditRef: approval.authAudit.ref,
    audit: audit(`evt-conflict-${label}`, env.approver.principalId)
  });
  return { service, conflict };
}

function resolutionApproval(env, conflict, label) {
  return authorizeForResource(env, {
    resourceId: conflictResolutionResourceId(conflict.ref),
    qualificationTarget: { use: 'KNOWLEDGE_CONFLICT_RESOLUTION' },
    logicalId: `conflict-resolution-${label}`
  });
}

function resolveConflict(env, bundle, options) {
  const approval = resolutionApproval(env, bundle.conflict, options.label);
  return bundle.service.resolveConflict({
    logicalId: `conflict-resolution.${options.label}`,
    version: '1',
    knowledgeConflictRef: bundle.conflict.ref,
    resolutionType: options.resolutionType,
    ...(options.selectedKnowledgeRef ? { selectedKnowledgeRef: options.selectedKnowledgeRef } : {}),
    ...(options.derivedKnowledgeRef ? { derivedKnowledgeRef: options.derivedKnowledgeRef } : {}),
    ...(options.precedenceAuthority ? { precedenceAuthority: options.precedenceAuthority } : {}),
    rationale: `governed resolution ${options.label}`,
    approverPrincipal: env.approver,
    authorizationDecisionAuditRef: approval.authAudit.ref,
    ...(options.supersedesResolutionRef ? { supersedesResolutionRef: options.supersedesResolutionRef } : {}),
    audit: audit(`evt-conflict-resolution-${options.label}`, env.approver.principalId)
  });
}

const tests = [];
function test(name, fn) { tests.push({ name, fn }); }

test('DerivedKnowledge retains every exact QualifiedKnowledge and SourceContext origin with canonical lineage', () => {
  const env = createEnvironment();
  const a = makeQualifiedKnowledge(env, { label: 'a', assertion: 'Irrigation threshold is 0.42 depletion fraction.' });
  const b = makeQualifiedKnowledge(env, { label: 'b', assertion: 'Irrigation threshold is 0.48 depletion fraction.' });
  const derived = derivePair(env, makeMethod(env), a, b);
  assert.equal(derived.derivedContext.semanticPayload.originContexts.length, 2);
  assert.ok(env.ledger.lineageFor(derived.derivedKnowledge.ref).filter((edge) => edge.relation === 'derived_from' && edge.details.lineageRole === 'QUALIFIED_KNOWLEDGE_INPUT').length === 2);
  assert.ok(env.ledger.lineageFor(derived.derivedContext.ref).filter((edge) => edge.relation === 'derived_from' && edge.details.lineageRole === 'ORIGIN_SOURCE_CONTEXT').length === 2);
  validateDerivedKnowledgeAuthority({ ledger: env.ledger, derivedKnowledgeRef: derived.derivedKnowledge.ref, requiredUseTarget: USE_APPLICABILITY });
});

test('DerivedKnowledgeContext never impersonates one arbitrary input SourceContext', () => {
  const env = createEnvironment();
  const a = makeQualifiedKnowledge(env, { label: 'a-context', assertion: 'Threshold A.' });
  const b = makeQualifiedKnowledge(env, { label: 'b-context', assertion: 'Threshold B.' });
  const derived = derivePair(env, makeMethod(env, { label: 'context' }), a, b, { label: 'context' });
  assert.ok(!('sourceContextRef' in derived.derivedKnowledge.semanticPayload));
  assert.ok(!('sourceContextRef' in derived.derivedContext.semanticPayload));
  assert.equal(derived.derivedContext.semanticPayload.originContexts.length, 2);
});

test('DerivationMethod requires exact Scientific Approver authorization', () => {
  const env = createEnvironment();
  const reviewer = createPrincipal({ principalId: 'reviewer-method', type: 'USER', organizationId: 'org-a', tenantId: 'tenant-a' });
  const role = publishBuiltinRoleAssignment({ ledger: env.ledger, logicalId: 'role.reviewer-method', version: '1', principal: reviewer, role: 'AGRONOMY_REVIEWER', scope: { organizationId: 'org-a', tenantId: 'tenant-a' }, audit: audit('evt-reviewer-method-role', 'iam-admin') });
  const logicalId = 'method.unauthorized';
  const approval = authorizeForResource(env, { resourceId: derivationMethodResourceId(logicalId), qualificationTarget: { use: 'DERIVATION_METHOD_APPROVAL' }, logicalId: 'unauthorized-method', principal: reviewer, roleAssignment: role });
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

test('method specification cannot hide SIMPLE_AVERAGE/newest/LLM/calibration shortcuts', () => {
  const env = createEnvironment();
  expectError(() => makeMethod(env, { label: 'simple-average', methodSpec: { estimator: 'SIMPLE_AVERAGE' } }), SynthesisAuthorityError, 'FORBIDDEN_DERIVATION_SHORTCUT');
});

test('derivation refuses insufficient inputs instead of pretending one source is synthesis', () => {
  const env = createEnvironment();
  const a = makeQualifiedKnowledge(env, { label: 'single', assertion: 'Single source threshold.' });
  const method = makeMethod(env, { label: 'min-two', minimumInputs: 2 });
  const approval = authorizeForResource(env, { resourceId: synthesisResourceId(method.method.ref), qualificationTarget: { use: 'DERIVED_KNOWLEDGE_SYNTHESIS' }, logicalId: 'single-input-synthesis' });
  expectError(() => method.service.derive({
    derivedKnowledgeLogicalId: 'derived.single', derivedKnowledgeVersion: '1', derivedContextLogicalId: 'derived-context.single', derivedContextVersion: '1', derivationMethodRef: method.method.ref,
    inputBindings: [{ qualifiedKnowledgeRef: a.knowledge.ref, useTarget: USE_APPLICABILITY }], semanticRole: method.method.semanticPayload.semanticRole, assertion: 'Not enough inputs.', approverPrincipal: env.approver, authorizationDecisionAuditRef: approval.authAudit.ref, audit: audit('evt-single-synthesis', env.approver.principalId)
  }), SynthesisAuthorityError, 'INSUFFICIENT_DERIVATION_INPUTS');
});

test('revoked QualifiedKnowledge cannot enter new synthesis', () => {
  const env = createEnvironment();
  const a = makeQualifiedKnowledge(env, { label: 'revoked-a', assertion: 'Threshold A.' });
  const b = makeQualifiedKnowledge(env, { label: 'revoked-b', assertion: 'Threshold B.' });
  const revokeAuth = authorizeForResource(env, { resourceId: qualificationResourceId(a.reviewed.claim.ref, a.reviewed.sourceContext.ref), qualificationTarget: USE_APPLICABILITY, logicalId: 'revoke-input' });
  a.qualification.revokeQualifiedKnowledgeUse({ revocationLogicalId: 'revocation.input-a', revocationVersion: '1', qualifiedKnowledgeRef: a.knowledge.ref, qualificationTarget: USE_APPLICABILITY, approverPrincipal: env.approver, authorizationDecisionAuditRef: revokeAuth.authAudit.ref, reasonCodes: ['INPUT_NO_LONGER_QUALIFIED'], audit: audit('evt-revoke-input-a', env.approver.principalId) });
  expectError(() => derivePair(env, makeMethod(env, { label: 'revoked-input' }), a, b, { label: 'revoked-input' }), QualifiedAuthorityError, 'QUALIFIED_USE_NOT_ACTIVE');
});

test('K05 v1 refuses cross-owner synthesis', () => {
  const env = createEnvironment();
  const a = makeQualifiedKnowledge(env, { label: 'owner-a', assertion: 'Owner A threshold.' });
  const b = makeQualifiedKnowledge(env, { label: 'owner-b', assertion: 'Owner B threshold.', ownership: { organizationId: 'org-b', tenantId: 'tenant-b' } });
  expectError(() => derivePair(env, makeMethod(env, { label: 'cross-owner' }), a, b, { label: 'cross-owner' }), SynthesisAuthorityError, 'CROSS_OWNER_SYNTHESIS_NOT_AUTHORIZED');
});

test('different scientific-use authorities cannot be silently mixed', () => {
  const env = createEnvironment();
  const a = makeQualifiedKnowledge(env, { label: 'use-a', assertion: 'Use A threshold.' });
  const b = makeQualifiedKnowledge(env, { label: 'use-b', assertion: 'Use B threshold.', useTarget: USE_OTHER });
  expectError(() => derivePair(env, makeMethod(env, { label: 'use-mismatch' }), a, b, { label: 'use-mismatch' }), QualifiedAuthorityError, 'QUALIFIED_USE_NOT_ACTIVE');
});

test('forged DerivedKnowledge without exact synthesis audit/lineage fails validation', () => {
  const env = createEnvironment();
  const a = makeQualifiedKnowledge(env, { label: 'forge-a', assertion: 'A.' });
  const b = makeQualifiedKnowledge(env, { label: 'forge-b', assertion: 'B.' });
  const derived = derivePair(env, makeMethod(env, { label: 'forge' }), a, b, { label: 'forge' });
  const forged = env.ledger.publish({ kind: 'DerivedKnowledge', logicalId: 'derived.forged-copy', version: '1', semanticPayload: { ...derived.derivedKnowledge.semanticPayload }, audit: audit('evt-forged-derived', 'forger') });
  expectError(() => validateDerivedKnowledgeAuthority({ ledger: env.ledger, derivedKnowledgeRef: forged.ref, requiredUseTarget: USE_APPLICABILITY }), DerivedAuthorityValidationError, 'DERIVED_AUDIT_INVALID');
});

test('KnowledgeConflict freezes exact members, origin contexts, overlap and incompatibility', () => {
  const env = createEnvironment();
  const a = makeQualifiedKnowledge(env, { label: 'conflict-a', assertion: 'Threshold is 0.42.' });
  const b = makeQualifiedKnowledge(env, { label: 'conflict-b', assertion: 'Threshold is 0.58.' });
  const bundle = makeConflict(env, a, b);
  assert.equal(bundle.conflict.semanticPayload.memberBindings.length, 2);
  assert.equal(bundle.service.currentResolution({ knowledgeConflictRef: bundle.conflict.ref }).status, 'UNRESOLVED');
});

test('KnowledgeConflict rejects duplicate pseudo-conflict members', () => {
  const env = createEnvironment();
  const a = makeQualifiedKnowledge(env, { label: 'dup-a', assertion: 'A.' });
  const role = 'corn.irrigation.depletion_threshold';
  const approval = authorizeForResource(env, { resourceId: conflictAssessmentResourceId(role), qualificationTarget: { use: 'KNOWLEDGE_CONFLICT_ASSESSMENT' }, logicalId: 'dup-conflict' });
  expectError(() => new KnowledgeConflictService({ ledger: env.ledger }).createConflict({ logicalId: 'conflict.duplicate', version: '1', semanticRole: role, scientificUseTarget: USE_APPLICABILITY, memberKnowledgeRefs: [a.knowledge.ref, a.knowledge.ref], overlapAssessment: { status: 'OVERLAPPING' }, incompatibilityAssessment: { status: 'MATERIAL_DIFFERENCE' }, approverPrincipal: env.approver, authorizationDecisionAuditRef: approval.authAudit.ref, audit: audit('evt-duplicate-conflict', env.approver.principalId) }), KnowledgeConflictError, 'DUPLICATE_CONFLICT_MEMBER');
});

test('explicit precedence cannot use newest-wins or LLM preference', () => {
  const env = createEnvironment();
  const a = makeQualifiedKnowledge(env, { label: 'precedence-a', assertion: 'A.' });
  const b = makeQualifiedKnowledge(env, { label: 'precedence-b', assertion: 'B.' });
  const bundle = makeConflict(env, a, b, { label: 'precedence' });
  const approval = resolutionApproval(env, bundle.conflict, 'precedence');
  expectError(() => bundle.service.resolveConflict({ logicalId: 'resolution.newest-wins', version: '1', knowledgeConflictRef: bundle.conflict.ref, resolutionType: 'EXPLICIT_PRECEDENCE', selectedKnowledgeRef: a.knowledge.ref, precedenceAuthority: { type: 'NEWEST_WINS' }, rationale: 'forbidden', approverPrincipal: env.approver, authorizationDecisionAuditRef: approval.authAudit.ref, audit: audit('evt-newest-wins', env.approver.principalId) }), KnowledgeConflictError, 'FORBIDDEN_CONFLICT_SHORTCUT');
  const resolution = bundle.service.resolveConflict({ logicalId: 'resolution.explicit-precedence', version: '1', knowledgeConflictRef: bundle.conflict.ref, resolutionType: 'EXPLICIT_PRECEDENCE', selectedKnowledgeRef: a.knowledge.ref, precedenceAuthority: { type: 'HUMAN_SCIENTIFIC_ADJUDICATION', basis: 'scope fit' }, rationale: 'explicit scientific precedence', approverPrincipal: env.approver, authorizationDecisionAuditRef: approval.authAudit.ref, audit: audit('evt-explicit-precedence', env.approver.principalId) });
  assert.equal(resolution.semanticPayload.selectedKnowledgeRef.semanticHash, a.knowledge.ref.semanticHash);
});

test('PRESERVE_ALTERNATIVES does not invent a winner', () => {
  const env = createEnvironment();
  const a = makeQualifiedKnowledge(env, { label: 'alternatives-a', assertion: 'A.' });
  const b = makeQualifiedKnowledge(env, { label: 'alternatives-b', assertion: 'B.' });
  const bundle = makeConflict(env, a, b, { label: 'alternatives' });
  const resolution = resolveConflict(env, bundle, { label: 'alternatives', resolutionType: 'PRESERVE_ALTERNATIVES' });
  assert.equal(resolution.semanticPayload.preservedKnowledgeRefs.length, 2);
  assert.ok(!('selectedKnowledgeRef' in resolution.semanticPayload));
});

test('DERIVED_SYNTHESIS resolution must cover every exact conflict member', () => {
  const env = createEnvironment();
  const a = makeQualifiedKnowledge(env, { label: 'synth-res-a', assertion: 'A.' });
  const b = makeQualifiedKnowledge(env, { label: 'synth-res-b', assertion: 'B.' });
  const c = makeQualifiedKnowledge(env, { label: 'synth-res-c', assertion: 'C.' });
  const method = makeMethod(env, { label: 'synth-res' });
  const derivedAB = derivePair(env, method, a, b, { label: 'synth-res-ab' });
  const bundle = makeConflict(env, a, c, { label: 'synth-res' });
  const approval = resolutionApproval(env, bundle.conflict, 'synth-res');
  expectError(() => bundle.service.resolveConflict({ logicalId: 'resolution.synth-incomplete', version: '1', knowledgeConflictRef: bundle.conflict.ref, resolutionType: 'DERIVED_SYNTHESIS', derivedKnowledgeRef: derivedAB.derivedKnowledge.ref, rationale: 'incomplete', approverPrincipal: env.approver, authorizationDecisionAuditRef: approval.authAudit.ref, audit: audit('evt-synth-incomplete', env.approver.principalId) }), KnowledgeConflictError, 'DERIVED_RESOLUTION_INPUT_INCOMPLETE');
  const derivedAC = derivePair(env, method, a, c, { label: 'synth-res-ac' });
  const resolution = bundle.service.resolveConflict({ logicalId: 'resolution.synth-complete', version: '1', knowledgeConflictRef: bundle.conflict.ref, resolutionType: 'DERIVED_SYNTHESIS', derivedKnowledgeRef: derivedAC.derivedKnowledge.ref, rationale: 'complete synthesis', approverPrincipal: env.approver, authorizationDecisionAuditRef: approval.authAudit.ref, audit: audit('evt-synth-complete', env.approver.principalId) });
  assert.equal(resolution.semanticPayload.derivedKnowledgeRef.semanticHash, derivedAC.derivedKnowledge.ref.semanticHash);
});

test('CALIBRATION_REQUIRED creates no DerivedKnowledge or CalibrationArtifact by implication', () => {
  const env = createEnvironment();
  const a = makeQualifiedKnowledge(env, { label: 'cal-a', assertion: 'A.' });
  const b = makeQualifiedKnowledge(env, { label: 'cal-b', assertion: 'B.' });
  const bundle = makeConflict(env, a, b, { label: 'calibration' });
  const resolution = resolveConflict(env, bundle, { label: 'calibration', resolutionType: 'CALIBRATION_REQUIRED' });
  const records = env.ledger.exportSnapshot().records;
  assert.equal(resolution.semanticPayload.calibrationDisposition, 'REQUIRE_SEPARATE_CALIBRATION_ARTIFACT');
  assert.equal(records.filter((record) => record.ref.kind === 'CalibrationArtifact').length, 0);
  assert.equal(records.filter((record) => record.ref.kind === 'DerivedKnowledge').length, 0);
});

test('conflict resolution revisions require explicit supersession', () => {
  const env = createEnvironment();
  const a = makeQualifiedKnowledge(env, { label: 'revision-a', assertion: 'A.' });
  const b = makeQualifiedKnowledge(env, { label: 'revision-b', assertion: 'B.' });
  const bundle = makeConflict(env, a, b, { label: 'revision' });
  const first = resolveConflict(env, bundle, { label: 'revision-1', resolutionType: 'PRESERVE_ALTERNATIVES' });
  expectError(() => resolveConflict(env, bundle, { label: 'revision-no-supersede', resolutionType: 'CALIBRATION_REQUIRED' }), KnowledgeConflictError, 'ACTIVE_CONFLICT_RESOLUTION_EXISTS');
  const second = resolveConflict(env, bundle, { label: 'revision-2', resolutionType: 'CALIBRATION_REQUIRED', supersedesResolutionRef: first.ref });
  assert.equal(bundle.service.currentResolution({ knowledgeConflictRef: bundle.conflict.ref }).resolution.ref.semanticHash, second.ref.semanticHash);
});

test('generic-ledger forged QualifiedKnowledge summary fails downstream validation', () => {
  const env = createEnvironment();
  const a = makeQualifiedKnowledge(env, { label: 'forged-qk', assertion: 'A.' });
  const forged = env.ledger.publish({ kind: 'QualifiedKnowledge', logicalId: 'knowledge.forged-summary', version: '1', semanticPayload: { ...a.knowledge.semanticPayload, allowedUses: [{ use: 'FAKE_USE' }] }, audit: audit('evt-forged-qk', 'forger') });
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

import { strict as assert } from 'node:assert';
import { semanticHash } from '../../packages/canonicalization/src/index.mjs';
import { makeAuthorityRef } from '../../packages/contracts/src/authority.mjs';
import { AuthorityLedger, AuthorityLedgerError } from '../../packages/provenance/src/index.mjs';
import {
  DerivedKnowledgeService,
  SynthesisAuthorityError,
  derivationMethodResourceId,
  synthesisResourceId
} from '../../packages/synthesis-engine/src/index.mjs';
import {
  ConflictAuthorityValidationError,
  validateKnowledgeConflictAuthority
} from '../../packages/conflict-engine/src/authority.mjs';
import {
  KnowledgeConflictService,
  conflictAssessmentResourceId,
  conflictResolutionResourceId
} from '../../packages/conflict-engine/src/index.mjs';
import {
  USE_APPLICABILITY,
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

function qualifiedPair(env, prefix) {
  return [
    makeQualifiedKnowledge(env, { label: `${prefix}-a`, assertion: 'Threshold is 0.42.' }),
    makeQualifiedKnowledge(env, { label: `${prefix}-b`, assertion: 'Threshold is 0.58.' })
  ];
}

function legitimateConflict(env, a, b, label) {
  const semanticRole = 'corn.irrigation.depletion_threshold';
  const approval = authorizeForResource(env, {
    resourceId: conflictAssessmentResourceId(semanticRole),
    qualificationTarget: { use: 'KNOWLEDGE_CONFLICT_ASSESSMENT' },
    logicalId: `integrity-conflict-${label}`
  });
  const service = new KnowledgeConflictService({ ledger: env.ledger });
  const conflict = service.createConflict({
    logicalId: `conflict.integrity.${label}`,
    version: '1',
    semanticRole,
    scientificUseTarget: USE_APPLICABILITY,
    memberKnowledgeRefs: [a.knowledge.ref, b.knowledge.ref],
    overlapAssessment: { status: 'OVERLAPPING', dimensions: ['crop.code'] },
    incompatibilityAssessment: { status: 'MATERIAL_DIFFERENCE', description: 'threshold disagreement' },
    approverPrincipal: env.approver,
    authorizationDecisionAuditRef: approval.authAudit.ref,
    audit: audit(`evt-conflict-integrity-${label}`, env.approver.principalId)
  });
  return { service, conflict, semanticRole };
}

const tests = [];
function test(name, fn) { tests.push({ name, fn }); }

test('authority plus lineage batch is all-or-none when lineage preflight fails', () => {
  const ledger = new AuthorityLedger();
  const root = ledger.publish({
    kind: 'RootAuthority',
    logicalId: 'root.atomic',
    version: '1',
    semanticPayload: { value: 'root' },
    audit: audit('evt-root-atomic', 'authority-admin')
  });
  const payload = { value: 'must-not-survive' };
  const stagedRef = makeAuthorityRef({
    kind: 'AtomicCandidate',
    logicalId: 'candidate.atomic',
    version: '1',
    semanticHash: semanticHash('AtomicCandidate', payload)
  });
  const before = ledger.exportSnapshot();
  expectError(() => ledger.publishBatchWithLineage({
    entries: [{
      kind: 'AtomicCandidate',
      logicalId: 'candidate.atomic',
      version: '1',
      semanticPayload: payload,
      audit: audit('evt-atomic-candidate', 'authority-admin')
    }],
    lineages: [{
      relation: 'NOT_A_REAL_LINEAGE',
      from: stagedRef,
      to: root.ref,
      audit: audit('evt-invalid-lineage', 'authority-admin')
    }]
  }), AuthorityLedgerError, 'INVALID_LINEAGE_RELATION');
  const after = ledger.exportSnapshot();
  assert.equal(after.records.length, before.records.length);
  assert.equal(after.lineage.length, before.lineage.length);
  assert.equal(after.audit.length, before.audit.length);
  assert.equal(ledger.has(stagedRef), false);
});

test('generic-ledger forged DerivationMethod with copied authorization cannot mint DerivedKnowledge', () => {
  const env = createEnvironment();
  const [a, b] = qualifiedPair(env, 'forged-method');
  const logicalId = 'method.integrity.forged';
  const approval = authorizeForResource(env, {
    resourceId: derivationMethodResourceId(logicalId),
    qualificationTarget: { use: 'DERIVATION_METHOD_APPROVAL' },
    logicalId: 'forged-method-approval'
  });
  const forgedMethod = env.ledger.publish({
    kind: 'DerivationMethod',
    logicalId,
    version: '1',
    semanticPayload: {
      methodType: 'GOVERNED_SYNTHESIS',
      semanticRole: 'corn.irrigation.depletion_threshold',
      minimumInputs: 2,
      contextPolicy: 'PRESERVE_ALL_ORIGINS',
      methodSpec: { estimator: 'GOVERNED_CONSENSUS' },
      prohibitedShortcuts: ['LLM_PREFERENCE', 'LOCAL_CALIBRATION_AS_KNOWLEDGE', 'NEWEST_WINS', 'SIMPLE_AVERAGE'],
      ownership: { organizationId: 'org-a', tenantId: 'tenant-a' },
      approverPrincipal: env.approver,
      authorizationDecisionAuditRef: approval.authAudit.ref,
      approvalPolicyRef: approval.policy.ref,
      authorityClass: 'DERIVATION_METHOD_AUTHORITY'
    },
    audit: {
      ...audit('evt-forged-method-publication', 'forger'),
      inputRefs: [approval.authAudit.ref, approval.policy.ref]
    }
  });
  const synthesisApproval = authorizeForResource(env, {
    resourceId: synthesisResourceId(forgedMethod.ref),
    qualificationTarget: { use: 'DERIVED_KNOWLEDGE_SYNTHESIS' },
    logicalId: 'forged-method-synthesis'
  });
  expectError(() => new DerivedKnowledgeService({ ledger: env.ledger }).derive({
    derivedKnowledgeLogicalId: 'derived.from-forged-method',
    derivedKnowledgeVersion: '1',
    derivedContextLogicalId: 'derived-context.from-forged-method',
    derivedContextVersion: '1',
    derivationMethodRef: forgedMethod.ref,
    inputBindings: [
      { qualifiedKnowledgeRef: a.knowledge.ref, useTarget: USE_APPLICABILITY },
      { qualifiedKnowledgeRef: b.knowledge.ref, useTarget: USE_APPLICABILITY }
    ],
    semanticRole: 'corn.irrigation.depletion_threshold',
    assertion: 'This must never be published.',
    approverPrincipal: env.approver,
    authorizationDecisionAuditRef: synthesisApproval.authAudit.ref,
    audit: audit('evt-forged-method-derive', env.approver.principalId)
  }), SynthesisAuthorityError, 'DERIVATION_METHOD_AUDIT_INVALID');
  assert.equal(env.ledger.listVersions('DerivedKnowledge', 'derived.from-forged-method').length, 0);
});

test('KnowledgeConflict assessment remains declarative and passes full downstream authority validation', () => {
  const env = createEnvironment();
  const [a, b] = qualifiedPair(env, 'declarative-conflict');
  const bundle = legitimateConflict(env, a, b, 'declarative');
  assert.equal(bundle.conflict.semanticPayload.assessmentSemantics, 'DECLARATIVE_SCIENTIFIC_JUDGMENT_ONLY');
  const validated = validateKnowledgeConflictAuthority({ ledger: env.ledger, knowledgeConflictRef: bundle.conflict.ref });
  assert.equal(validated.members.length, 2);
  assert.ok(bundle.conflict.semanticPayload.memberBindings.every((binding) => binding.semanticRoleAuthority === 'CONFLICT_ASSESSMENT'));
});

test('generic-ledger forged KnowledgeConflict cannot become resolution input without exact approver audit', () => {
  const env = createEnvironment();
  const [a, b] = qualifiedPair(env, 'forged-conflict');
  const semanticRole = 'corn.irrigation.depletion_threshold';
  const approval = authorizeForResource(env, {
    resourceId: conflictAssessmentResourceId(semanticRole),
    qualificationTarget: { use: 'KNOWLEDGE_CONFLICT_ASSESSMENT' },
    logicalId: 'forged-conflict-assessment'
  });
  const forged = env.ledger.publish({
    kind: 'KnowledgeConflict',
    logicalId: 'conflict.integrity.forged',
    version: '1',
    semanticPayload: {
      semanticRole,
      scientificUseTarget: USE_APPLICABILITY,
      memberBindings: [a, b].map((item) => ({
        knowledgeRef: item.knowledge.ref,
        knowledgeKind: 'QualifiedKnowledge',
        originContextRef: item.reviewed.sourceContext.ref,
        semanticRoleAuthority: 'CONFLICT_ASSESSMENT',
        assertionHash: semanticHash('ADR-K05-CONFLICT-ASSERTION', item.reviewed.claim.semanticPayload.assertion)
      })),
      overlapAssessment: { status: 'OVERLAPPING' },
      incompatibilityAssessment: { status: 'MATERIAL_DIFFERENCE' },
      assessmentSemantics: 'DECLARATIVE_SCIENTIFIC_JUDGMENT_ONLY',
      limitations: [],
      ownership: { organizationId: 'org-a', tenantId: 'tenant-a' },
      status: 'UNRESOLVED',
      approverPrincipal: env.approver,
      authorizationDecisionAuditRef: approval.authAudit.ref,
      assessmentPolicyRef: approval.policy.ref,
      authorityClass: 'KNOWLEDGE_CONFLICT_AUTHORITY'
    },
    audit: {
      ...audit('evt-forged-conflict', 'forger'),
      inputRefs: [approval.authAudit.ref, approval.policy.ref, a.knowledge.ref, b.knowledge.ref, a.reviewed.sourceContext.ref, b.reviewed.sourceContext.ref]
    }
  });
  expectError(() => validateKnowledgeConflictAuthority({ ledger: env.ledger, knowledgeConflictRef: forged.ref }), ConflictAuthorityValidationError, 'CONFLICT_DIRECT_AUDIT_INVALID');
});

test('forged resolution cannot become current merely by copying payload and adding lineage; audit must bind selected authority', () => {
  const env = createEnvironment();
  const [a, b] = qualifiedPair(env, 'forged-resolution');
  const bundle = legitimateConflict(env, a, b, 'forged-resolution');
  const approval = authorizeForResource(env, {
    resourceId: conflictResolutionResourceId(bundle.conflict.ref),
    qualificationTarget: { use: 'KNOWLEDGE_CONFLICT_RESOLUTION' },
    logicalId: 'forged-resolution-approval'
  });
  const forged = env.ledger.publish({
    kind: 'KnowledgeConflictResolutionDecision',
    logicalId: 'conflict-resolution.integrity.forged',
    version: '1',
    semanticPayload: {
      knowledgeConflictRef: bundle.conflict.ref,
      resolutionType: 'EXPLICIT_PRECEDENCE',
      selectedKnowledgeRef: a.knowledge.ref,
      precedenceAuthority: { type: 'HUMAN_SCIENTIFIC_ADJUDICATION', basis: 'forged publication path' },
      approverPrincipal: env.approver,
      authorizationDecisionAuditRef: approval.authAudit.ref,
      resolutionPolicyRef: approval.policy.ref,
      rationale: 'payload looks internally coherent but publication audit omits selected authority',
      authorityClass: 'KNOWLEDGE_CONFLICT_RESOLUTION'
    },
    audit: {
      ...audit('evt-forged-resolution', env.approver.principalId),
      inputRefs: [bundle.conflict.ref, approval.authAudit.ref, approval.policy.ref]
    }
  });
  env.ledger.addLineage({
    relation: 'derived_from',
    from: forged.ref,
    to: bundle.conflict.ref,
    details: { lineageRole: 'KNOWLEDGE_CONFLICT_RESOLUTION', resolutionType: 'EXPLICIT_PRECEDENCE' },
    audit: audit('evt-forged-resolution-lineage', env.approver.principalId)
  });
  expectError(() => bundle.service.currentResolution({ knowledgeConflictRef: bundle.conflict.ref }), ConflictAuthorityValidationError, 'CONFLICT_DIRECT_AUDIT_INVALID');
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

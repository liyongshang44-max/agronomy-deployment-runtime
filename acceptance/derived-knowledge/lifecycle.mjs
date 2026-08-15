import { strict as assert } from 'node:assert';
import { KnowledgeConflictService, conflictAssessmentResourceId, conflictResolutionResourceId } from '../../packages/conflict-engine/src/index.mjs';
import { ConflictAuthorityValidationError } from '../../packages/conflict-engine/src/authority.mjs';
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

function createConflict(env) {
  const a = makeQualifiedKnowledge(env, { label: 'lifecycle-a', assertion: 'Threshold A.' });
  const b = makeQualifiedKnowledge(env, { label: 'lifecycle-b', assertion: 'Threshold B.' });
  const semanticRole = 'corn.irrigation.depletion_threshold';
  const assessment = authorizeForResource(env, {
    resourceId: conflictAssessmentResourceId(semanticRole),
    qualificationTarget: { use: 'KNOWLEDGE_CONFLICT_ASSESSMENT' },
    logicalId: 'lifecycle-conflict-assessment'
  });
  const service = new KnowledgeConflictService({ ledger: env.ledger });
  const conflict = service.createConflict({
    logicalId: 'conflict.lifecycle',
    version: '1',
    semanticRole,
    scientificUseTarget: USE_APPLICABILITY,
    memberKnowledgeRefs: [a.knowledge.ref, b.knowledge.ref],
    overlapAssessment: { status: 'OVERLAPPING' },
    incompatibilityAssessment: { status: 'MATERIAL_DIFFERENCE' },
    approverPrincipal: env.approver,
    authorizationDecisionAuditRef: assessment.authAudit.ref,
    audit: audit('evt-lifecycle-conflict', env.approver.principalId)
  });
  return { service, conflict };
}

const tests = [];
function test(name, fn) { tests.push({ name, fn }); }

test('declared conflict-resolution supersession without exact supersedes lineage cannot become current', () => {
  const env = createEnvironment();
  const { service, conflict } = createConflict(env);
  const firstApproval = authorizeForResource(env, {
    resourceId: conflictResolutionResourceId(conflict.ref),
    qualificationTarget: { use: 'KNOWLEDGE_CONFLICT_RESOLUTION' },
    logicalId: 'lifecycle-resolution-first'
  });
  const first = service.resolveConflict({
    logicalId: 'conflict-resolution.lifecycle.first',
    version: '1',
    knowledgeConflictRef: conflict.ref,
    resolutionType: 'PRESERVE_ALTERNATIVES',
    rationale: 'preserve uncertainty',
    approverPrincipal: env.approver,
    authorizationDecisionAuditRef: firstApproval.authAudit.ref,
    audit: audit('evt-lifecycle-resolution-first', env.approver.principalId)
  });

  const secondApproval = authorizeForResource(env, {
    resourceId: conflictResolutionResourceId(conflict.ref),
    qualificationTarget: { use: 'KNOWLEDGE_CONFLICT_RESOLUTION' },
    logicalId: 'lifecycle-resolution-forged-successor'
  });
  const forged = env.ledger.publish({
    kind: 'KnowledgeConflictResolutionDecision',
    logicalId: 'conflict-resolution.lifecycle.forged-successor',
    version: '1',
    semanticPayload: {
      knowledgeConflictRef: conflict.ref,
      resolutionType: 'CALIBRATION_REQUIRED',
      calibrationDisposition: 'REQUIRE_SEPARATE_CALIBRATION_ARTIFACT',
      approverPrincipal: env.approver,
      authorizationDecisionAuditRef: secondApproval.authAudit.ref,
      resolutionPolicyRef: secondApproval.policy.ref,
      rationale: 'declares predecessor but omits supersession lineage',
      supersedesResolutionRef: first.ref,
      authorityClass: 'KNOWLEDGE_CONFLICT_RESOLUTION'
    },
    audit: {
      ...audit('evt-lifecycle-forged-successor', env.approver.principalId),
      inputRefs: [conflict.ref, secondApproval.authAudit.ref, secondApproval.policy.ref, first.ref]
    }
  });
  env.ledger.addLineage({
    relation: 'derived_from',
    from: forged.ref,
    to: conflict.ref,
    details: { lineageRole: 'KNOWLEDGE_CONFLICT_RESOLUTION', resolutionType: 'CALIBRATION_REQUIRED' },
    audit: audit('evt-lifecycle-forged-conflict-lineage', env.approver.principalId)
  });

  expectError(
    () => service.currentResolution({ knowledgeConflictRef: conflict.ref }),
    ConflictAuthorityValidationError,
    'CONFLICT_RESOLUTION_LINEAGE_INVALID'
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

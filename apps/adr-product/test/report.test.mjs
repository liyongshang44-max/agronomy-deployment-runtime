import assert from 'node:assert/strict';
import { test } from 'node:test';
import { renderDemoReport } from '../src/report.mjs';

test('report renders exact evidence, missing data and safely escapes reviewer text', () => {
  const hash = 'sha256:' + 'a'.repeat(64);
  const attempt = {
    id: 'demo-test',
    state: 'CONFIRMED',
    assessmentRef: { kind: 'ApplicabilityAssessment', logical_id: 'one', version: '1', semantic_hash: hash },
    workbenchCase: {
      classification: 'CONTEXT_GAP',
      reviewRequired: true,
      projectionHash: 'sha256:' + 'b'.repeat(64),
      scientificEvidence: { knowledgeKind: 'QualifiedKnowledge', knowledgeRef: {
        kind: 'QualifiedKnowledge', logicalId: 'knowledge', version: '1', semanticHash: hash
      }, source: { title: 'Test <script>alert(1)</script>', contentHash: hash },
      claim: { assertion: 'Observed statement' } },
      targetContext: {
        targetRef: { fieldId: 'field-1', seasonId: '2026' },
        datums: [{
          semanticId: 'soil.volumetric_water_content',
          value: { type: 'DECIMAL', decimal: '0.31' },
          unit: 'm3_per_m3',
          effectiveInterval: { start: '2026-08-01', end: '2026-08-02' }
        }]
      },
      applicability: { transportStatus: 'CONTEXT_GAP', missingContextSemanticIds: ['crop.code'] }
    }
  };
  const document = renderDemoReport({ attempt, review: {
    reviewerId: 'demo-reviewer',
    outcome: 'CONTEXT_REQUESTED',
    notes: 'Unsafe <script>alert(2)</script>',
    startedAt: '2026-11-17T00:00:00Z',
    completedAt: '2026-11-17T00:01:00Z',
    durationMs: 60000,
    caseProjectionHash: 'sha256:' + 'b'.repeat(64)
  } });
  assert.ok(document.includes('ADR · 合成演示评估报告'));
  assert.ok(document.includes(hash));
  assert.ok(document.includes('0.31 m3_per_m3'));
  assert.ok(document.includes('crop.code'));
  assert.ok(document.includes('CONTEXT_REQUESTED'));
  assert.ok(document.includes('&lt;script&gt;'));
  assert.equal(document.includes('<script>'), false);
});

test('cannot export unconfirmed write outcome as successful assessment', () => {
  assert.throws(() => renderDemoReport({
    attempt: { state: 'UNKNOWN_OUTCOME' }, review: null
  }), /EXACT_CONFIRMED_CASE_REQUIRED_FOR_REPORT/);
});

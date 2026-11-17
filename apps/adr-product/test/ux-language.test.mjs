import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  classificationExplanation, statusExplanation,
  reviewTimingLabel, TERM_HELP, textAvailability
} from '../public/ux-language.js';
import { contextCard, sourceCard, resultCard } from '../public/assessment-view.js';
import { renderDemoReport } from '../src/report.mjs';

const esc = (v) => String(v ?? '').replace(/[&<>"']/g,
  (x) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[x]));
const ref = (kind,id) => ({
  kind, logicalId:id, version:'1', semanticHash:'sha256:'+'a'.repeat(64)
});

test('UX translations are presentation-only and never equate no-review with safety', () => {
  const a=classificationExplanation('NO_REVIEW_CANDIDATE');
  assert.match(a.next,/不是安全/);
  assert.match(classificationExplanation('CONTEXT_GAP').next,/补充/);
  const other=classificationExplanation('UNRECOGNIZED_EXACT_SOURCE_CODE');
  assert.match(other.next,/不得推断/);
  assert.match(statusExplanation('UNKNOWN_OUTCOME'),/禁止新建身份/);
  assert.match(statusExplanation('WRITE_CONFIRMED_READ_PENDING'),/写入已得到确认/);
  assert.match(statusExplanation('CONFIRMED'),/不表示可以执行农业作业/);
  assert.match(TERM_HELP.QualifiedKnowledge,/不表示适用于每块田/);
  assert.equal(textAvailability(null),'未提供 / UNKNOWN');
  assert.equal(textAvailability(0),'0');
});
test('review timing never interprets missing start or malformed duration as measured', () => {
  assert.match(reviewTimingLabel({reviewDurationStatus:'UNKNOWN',durationMs:6000}),/未知/);
  assert.match(reviewTimingLabel({reviewDurationStatus:'MEASURED',durationMs:null}),/未知/);
  assert.match(reviewTimingLabel({reviewDurationStatus:'MEASURED',durationMs:-1}),/未知/);
  assert.equal(reviewTimingLabel({reviewDurationStatus:'MEASURED',durationMs:38000}),'38 秒');
  assert.equal(reviewTimingLabel({reviewDurationStatus:'MEASURED',durationMs:72000}),'1 分 12 秒');
});
test('derived knowledge reader displays all qualified sources without inventing document text', () => {
  const source=(title,id)=>({
    source:{title,sourceArtifactRef:ref('SourceArtifact',id),contentHash:'sha256:'+id},
    claim:{assertion:'Measured association '+id,claimRef:ref('ScientificClaim',id+'.claim')},
    sourceSpan:{previewAvailable:false}
  });
  const evidence={
    knowledgeKind:'DerivedKnowledge',
    knowledgeRef:ref('DerivedKnowledge','derived.1'),
    inputQualifiedEvidence:[source('First source','a'),source('Second <img src=x onerror=alert(1)>','b')]
  };
  const output=sourceCard(evidence,esc);
  assert.match(output,/First source/);
  assert.match(output,/Second &lt;img/);
  assert.match(output,/来源证据 1/);
  assert.match(output,/来源证据 2/);
  assert.equal(output.includes('<img src=x'),false);
  assert.match(output,/当前没有授权原文预览/);
  assert.match(output,/合格知识/);
  const noSource=sourceCard({knowledgeKind:'DerivedKnowledge',knowledgeRef:ref('DerivedKnowledge','no-source')},esc);
  assert.match(noSource,/没有提供可展示的来源证据明细/);
});
test('read models distinguish UNKNOWN and show limitations without changing ADR code', () => {
  const caseView={
    classification:'CONTEXT_GAP',reviewRequired:true,reasonCodes:['NEEDS_CONTEXT'],
    applicability:{
      scientificUseStatus:'UNQUALIFIED',
      transportStatus:'CONTEXT_GAP',
      missingContextSemanticIds:['crop.stage'],
      limitations:['only observed in test region']
    }
  };
  const output=resultCard(caseView,esc);
  assert.match(output,/CONTEXT_GAP/);
  assert.match(output,/需要补充/);
  assert.match(output,/crop.stage/);
  assert.match(output,/only observed in test region/);
  assert.match(output,/不改变科学结论/);
  const unknown=resultCard({classification:'FUTURE_CODE',applicability:{}},esc);
  assert.match(unknown,/需要查看原始分类代码/);
  assert.match(unknown,/FUTURE_CODE/);
  const context=contextCard({targetRef:{fieldId:'demo'},datums:[]},esc);
  assert.match(context,/不得推断缺失资料/);
});
test('report has human first summary and includes every derived source while keeping exact refs', () => {
  const scientificEvidence={
    knowledgeKind:'DerivedKnowledge',knowledgeRef:ref('DerivedKnowledge','derived.1'),
    inputQualifiedEvidence:[
      {source:{title:'Agronomy source A'},claim:{assertion:'Assertion A'}},
      {source:{title:'Agronomy source B'},claim:{assertion:'Assertion B'}}
    ]
  };
  const attempt={
    id:'operation.ux',
    state:'CONFIRMED',
    assessmentRef:{kind:'ApplicabilityAssessment',logical_id:'ux-case',version:'1',
      semantic_hash:'sha256:'+'f'.repeat(64)},
    workbenchCase:{
      classification:'NO_REVIEW_CANDIDATE',reviewRequired:false,
      projectionHash:'sha256:'+'b'.repeat(64),
      scientificEvidence,targetContext:{targetRef:{fieldId:'F'},datums:[]},
      applicability:{limitations:['No inference beyond study conditions']}
    }
  };
  const doc=renderDemoReport({attempt,review:{
    outcome:'DEFERRED',reviewDurationStatus:'UNKNOWN',durationMs:null,
    assessmentCreatedAt:'2026-11-17T01:00:00Z',startedAt:null,
    completedAt:'2026-11-17T01:05:00Z',notes:'not yet reviewed'
  }});
  assert.match(doc,/首先阅读 · 这次评估说明了什么/);
  assert.match(doc,/Agronomy source A/);
  assert.match(doc,/Agronomy source B/);
  assert.match(doc,/Assertion A/);
  assert.match(doc,/Assertion B/);
  assert.match(doc,/NO_REVIEW_CANDIDATE/);
  assert.match(doc,/不是安全/);
  assert.match(doc,/未知（没有可验证的独立复核开始事件）/);
  assert.match(doc,/No inference beyond study conditions/);
  assert.match(doc,/sha256:ffffffff/);
});

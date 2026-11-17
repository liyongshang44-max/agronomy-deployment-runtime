// UX-02 targeted science-faithfulness tests: product-facing interpretations only.
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { fieldState, knowledgeReading, evidenceItems,
  literalGloss, readableDimensionValue } from '../public/knowledge-reading.js';
import { sourceCard, resultCard } from '../public/assessment-view.js';
import { renderDemoReport } from '../src/report.mjs';

const esc=(v)=>String(v??'UNKNOWN').replace(/[&<>"']/g,
  c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const ref=(kind,id)=>({kind,logicalId:id,version:'1',semanticHash:'sha256:'+'c'.repeat(64)});
const source=(id,title,context,extras={})=>({
  knowledgeKind:'QualifiedKnowledge', knowledgeRef:ref('QualifiedKnowledge','knowledge.'+id),
  source:{title,sourceArtifactRef:ref('SourceArtifact',id),contentHash:'sha256:'+id},
  claim:{claimRef:ref('Claim','claim.'+id),claimType:'ASSOCIATION',
    assertion:'Original claim for '+id,sourceLocator:{kind:'BYTE_RANGE',start:0,endExclusive:39}},
  originContext:{contextFamilies:context},
  sourceFaithfulReview:{disposition:'ACCEPT_SOURCE_FAITHFUL'},
  qualification:{decisions:[{disposition:'QUALIFY_USE',
    qualificationTarget:{use:'EVALUATE_APPLICABILITY'},
    semanticPreconditions:[{semanticId:'crop.code',operator:'EQUALS',value:'maize'}],
    limitations:[{code:'ONLY_TEST_REGION'}],transportConstraints:[]}]},
  sourceSpan:{previewAvailable:false},
  ...extras
});
const biological={BIOLOGICAL:{status:'REPORTED',
  dimensions:[{semanticId:'crop.code',value:{type:'CATEGORY',category:'maize'}}]},
  MEASUREMENT:{status:'NOT_REPORTED',dimensions:[]}};
const qualified=source('src.1','Source One',biological);
const derived={
  knowledgeKind:'DerivedKnowledge',knowledgeRef:ref('DerivedKnowledge','d.1'),
  assertion:'Original derived synthesis statement',semanticRole:'SYNTHESIS',
  originContext:{introducedRestrictions:['Derived restriction A'],unresolvedContextHeterogeneity:[]},
  inputQualifiedEvidence:[qualified,source('src.2','Source Two',biological)]
};
const applicability={
  scientificUseStatus:'QUALIFIED',transportStatus:'CONTEXT_GAP',
  conditionResults:[],missingContextSemanticIds:['soil.moisture'],
  limitations:['Only conditions tested; not operation authorization'],
  conflicts:[],requiredCalibrationCodes:[],requiredTransformationRefs:[]
};
const mockAttempt=()=>({
  state:'CONFIRMED',id:'operation.ux02',
  assessmentRef:ref('ApplicabilityAssessment','operation.ux02'),
  inputBinding:{knowledgeRef:derived.knowledgeRef},
  workbenchCase:{
    scientificEvidence:structuredClone(derived),
    targetContext:{decisionType:'IRRIGATION',usePurpose:'EVALUATE_APPLICABILITY',
      targetRef:{fieldId:'field.demo',seasonId:'s1'},evidenceCutoff:'2026-01-01',
      datums:[{semanticId:'water.value',value:{type:'INTEGER',integer:0},unit:'mm',
        effectiveInterval:{start:'2026-01-01',end:'2026-01-02'},
        spatialSupport:{type:'FIELD'},verticalSupport:null,
        temporalSupport:{kind:'INSTANT'}}]},
    applicability:structuredClone(applicability),
    classification:'NO_REVIEW_CANDIDATE',reviewRequired:false,
    projectionHash:'sha256:'+'b'.repeat(64),reasonCodes:[]
  }
});

test('scientific reading is exact and side-effect-free across multiple derived sources',()=>{
  const e=structuredClone(derived),a=structuredClone(applicability);
  const before=JSON.stringify([e,a]);
  const model=knowledgeReading(e,a);
  assert.equal(model.assertion,'Original derived synthesis statement');
  assert.equal(model.sourceCount,2);
  assert.deepEqual(model.items.map(x=>x.title),['Source One','Source Two']);
  assert.deepEqual(model.items.map(x=>x.claimRef.logicalId),['claim.src.1','claim.src.2']);
  assert.match(JSON.stringify(model.knownContexts),/maize/);
  assert.match(JSON.stringify(model.qualificationLimits),/ONLY_TEST_REGION/);
  assert.equal(model.items[0].rightsStatus.includes('没有授权原文预览'),true);
  assert.equal(model.items[0].actualThreshold,'未提供具体阈值');
  assert.equal(model.explanationStatus,'SCIENTIFIC_EXPLANATION_INSUFFICIENT');
  assert.equal(JSON.stringify([e,a]),before,'product projection must not mutate the exact Host records');
  assert.deepEqual(evidenceItems(e).map(x=>x.knowledgeRef.logicalId),
    ['knowledge.src.1','knowledge.src.2']);
});
test('knowledge/assessment/report repeat exact assertions, citations, qualification and limits',()=>{
  const attempt=mockAttempt(),c=attempt.workbenchCase;
  const before=JSON.stringify(attempt);
  const view=sourceCard(c.scientificEvidence,esc,{applicability:c.applicability});
  const assessment=resultCard(c,esc);
  const report=renderDemoReport({attempt,review:{
    reviewerId:'demo-person',outcome:'CONTEXT_REQUESTED',notes:'Request more data',
    assessmentCreatedAt:'2026-11-17T01:00:00Z',startedAt:null,
    completedAt:'2026-11-17T01:01:00Z',
    reviewDurationStatus:'UNKNOWN',durationMs:null,
    caseProjectionHash:c.projectionHash
  }});
  for(const text of ['Original derived synthesis statement','Source One','Source Two',
    'Original claim for src.1','Original claim for src.2',
    'ONLY_TEST_REGION','soil.moisture','未提供具体阈值']) {
    assert.ok(view.includes(text),'missing from knowledge: '+text);
    assert.ok(report.includes(text),'missing from report: '+text);
  }
  assert.match(assessment,/未触发人工复核，不代表农业操作安全、建议有效或允许执行/);
  assert.match(report,/未触发人工复核，不代表农业操作安全、建议有效或允许执行/);
  assert.match(report,/CONTEXT_REQUESTED/);
  assert.match(report,/人工意见只反映用户反馈|不会修改 ADR 原始科学分类/);
  assert.match(report,/NOT_REPORTED（未报告）、UNKNOWN（未知）、UNAVAILABLE（不可用）与数值 0 互不等价/);
  assert.ok(report.indexOf('1. 本次评估针对的农业问题') <
    report.indexOf('2. 科学分类与阅读解释'));
  assert.ok(report.indexOf('2. 科学分类与阅读解释') <
    report.indexOf('3. 可以确认的科学依据'));
  assert.ok(report.indexOf('3. 可以确认的科学依据') <
    report.indexOf('4. 尚未得到证明或缺失的信息'));
  assert.ok(report.indexOf('4. 尚未得到证明或缺失的信息') <
    report.indexOf('5. 人工复核意见'));
  assert.ok(report.indexOf('5. 人工复核意见') <
    report.indexOf('6. 完整技术证据和精确引用'));
  assert.match(report,/sha256:cccccccccccc/);
  assert.match(report,/sha256:bbbbbbbbbbbb/);
  assert.match(report,/water.value/);
  assert.match(report,/>0 mm</);
  assert.equal(JSON.stringify(attempt),before,
    'no change to original AuthorityRefs, hashes, inputs or classification');
});
test('absence states retain distinct meaning; zero stays zero and no source is not fabricated',()=>{
  assert.equal(fieldState(undefined),'NOT_REPORTED');
  assert.equal(fieldState(null),'UNKNOWN');
  assert.equal(fieldState('UNAVAILABLE'),'UNAVAILABLE');
  assert.equal(fieldState('NOT_REPORTED'),'NOT_REPORTED');
  assert.equal(fieldState(0),'0');
  assert.notEqual(fieldState([]),fieldState(undefined));
  const empty={knowledgeKind:'DerivedKnowledge',knowledgeRef:ref('DerivedKnowledge','id'),
    inputQualifiedEvidence:[]};
  const model=knowledgeReading(empty,{conditionResults:[],limitations:[]});
  assert.equal(model.assertion,'NOT_REPORTED');
  assert.equal(model.explanationStatus,'SCIENTIFIC_EXPLANATION_INSUFFICIENT');
  const html=sourceCard(empty,esc,{applicability:{conditionResults:[],limitations:[]}});
  assert.match(html,/SCIENTIFIC_EXPLANATION_INSUFFICIENT/);
  assert.match(html,/没有提供可展示的来源证据明细/);
  assert.doesNotMatch(html,/没有限制/);
  const x=sourceCard(source('id','<img src=x onerror=alert(1)>',{}),esc);
  assert.doesNotMatch(x,/<img src=x/);
  assert.match(x,/&lt;img/);
});
test('no fabricated author, year, verified full text or numeric threshold',()=>{
  const model=knowledgeReading(qualified);
  assert.equal(model.items[0].author,'NOT_REPORTED');
  assert.equal(model.items[0].year,'NOT_REPORTED');
  assert.equal(model.items[0].actualThreshold,'未提供具体阈值');
  assert.equal(model.items[0].previewNotAvailable,true);
  assert.equal(model.items[0].sourceRefProvided,true);
  assert.equal(model.items[0].locatorProvided,true);
  assert.match(sourceCard(qualified,esc),/有内部来源引用不等于已独立核对论文全文/);
  assert.doesNotMatch(sourceCard(qualified,esc),/已独立核实论文/);
  const noLocator=structuredClone(qualified);
  delete noLocator.claim.sourceLocator;
  const missing=knowledgeReading(noLocator);
  assert.ok(missing.absenceReasons.includes('可核查来源定位'));
});

test('exact synthetic literal Chinese gloss and category translations do not broaden source claims',()=>{
  const exact='Maintain irrigation depletion within the qualified threshold.';
  const gloss=literalGloss(exact);
  assert.ok(gloss && gloss.includes('中文直译'));
  assert.ok(gloss.includes('未给出具体阈值数字'));
  assert.equal(literalGloss(exact+' Now recommend irrigation.'),null,
    'even a one-sentence change must not reuse unsupported translation');
  assert.equal(literalGloss('Different treatment with 50 percent yield increase'),null);
  assert.equal(readableDimensionValue({type:'CATEGORY',category:'maize'}),'玉米（原始值 maize）');
  assert.equal(readableDimensionValue({type:'CATEGORY',category:'silt loam'}),'粉砂壤土（原始值 silt loam）');
  assert.equal(readableDimensionValue({type:'INTEGER',integer:0}),'0');
  const literalSource=structuredClone(qualified);
  literalSource.claim.assertion=exact;
  const view=sourceCard(literalSource,esc);
  assert.match(view,/中文直译（仅帮助阅读原句）/);
  assert.match(view,/没有授权原文预览/);
  assert.match(view,/未提供具体阈值/);
  assert.equal(JSON.stringify(literalSource.claim.assertion),JSON.stringify(exact));
});

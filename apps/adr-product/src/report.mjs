import { classificationExplanation, REVIEW_OUTCOME_LABELS, reviewTimingLabel } from '../public/ux-language.js';
import { knowledgeReading, fieldState } from '../public/knowledge-reading.js';
import { sourceCard, contextCard } from '../public/assessment-view.js';

// ADR-PROD HTML report. All agronomic data are immutable Host read-model
// values. Reuse exactly the same sourceCard used in the knowledge/assessment UI.
const esc=(x)=>String(x??'UNKNOWN').replace(/[&<>"']/g,
  c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const raw=(v)=>esc(fieldState(v));
const table=(rows)=>'<table><tbody>'+rows.map(([k,v])=>
  '<tr><th scope="row">'+esc(k)+'</th><td>'+raw(v)+'</td></tr>').join('')+'</tbody></table>';
const section=(title,content)=>'<section class="report-section"><h2>'+esc(title)+'</h2>'+content+'</section>';
const items=(value)=> {
  if(value===undefined)return '<p class="missing">NOT_REPORTED：未报告；不代表没有限制</p>';
  if(value===null)return '<p class="missing">UNKNOWN：原始值未知</p>';
  if(!Array.isArray(value))return '<p class="missing">'+raw(value)+'</p>';
  if(!value.length)return '<p class="missing">已返回空列表（不证明不存在缺口或限制）</p>';
  return '<ul>'+value.map(x=>'<li>'+raw(x)+'</li>').join('')+'</ul>';
};
export function renderDemoReport({attempt,review}) {
  if(attempt?.state!=='CONFIRMED'||!attempt?.assessmentRef||
      !attempt?.workbenchCase?.projectionHash)
    throw new Error('EXACT_CONFIRMED_CASE_REQUIRED_FOR_REPORT');
  const c=attempt.workbenchCase;
  const a=c.applicability??{};
  const t=c.targetContext??{};
  const target=t.targetRef??{};
  const scientific=c.scientificEvidence;
  const reading=knowledgeReading(scientific,a);
  const summary=classificationExplanation(c.classification);
  const reviewRecord=review?table([
    ['人工复核结果（原始代码）',review.outcome],
    ['中文阅读辅助',REVIEW_OUTCOME_LABELS[review.outcome]??'UNKNOWN'],
    ['复核人',review.reviewerId],
    ['人工意见',review.notes],
    ['评估创建时间（不计入复核）',review.assessmentCreatedAt],
    ['复核开始时间',review.startedAt],
    ['复核完成时间',review.completedAt],
    ['计时可信状态',review.reviewDurationStatus],
    ['复核耗时（便于阅读）',reviewTimingLabel(review)],
    ['复核耗时（原始毫秒）',review.durationMs],
    ['绑定的 Workbench 哈希',review.caseProjectionHash]
  ]):'<p class="missing">NOT_REPORTED：尚无人工复核反馈。</p>';
  return '<!doctype html><html lang="zh-CN"><head><meta charset="utf-8">'+
    '<meta name="viewport" content="width=device-width, initial-scale=1">'+
    '<title>ADR DEMO · 科学知识与适用性报告</title>'+
    '<style>'+
    'body{font:14px/1.75 "Segoe UI","PingFang SC",sans-serif;color:#283a52;max-width:900px;margin:34px auto;padding:0 24px}'+
    'h1{font-size:26px;margin-bottom:8px}h2{font-size:19px;margin:22px 0 10px;border-bottom:1px solid #dbe4ed;padding-bottom:7px}'+
    'h3{font-size:15px;margin:12px 0 6px}h4{font-size:13px;margin:10px 0 5px}'+
    '.stamp,.science-demo-label{border:1px solid #dab789;background:#fff7e7;color:#76501e;padding:10px 14px}'+
    '.summary,.reading-question,.condition-item{padding:12px;margin:12px 0;background:#f5f8fc;border-left:3px solid #6f94b7}'+
    '.science-assertion{white-space:pre-wrap;overflow-wrap:anywhere;border-left:4px solid #386fa4;margin:10px 0;padding:12px;background:#fff;font-size:15px}'+
    '.source-claim{white-space:pre-wrap}table{width:100%;table-layout:fixed;border-collapse:collapse;margin:10px 0}'+
    'th,td{text-align:left;vertical-align:top;border-bottom:1px solid #e5ecf2;padding:6px 7px;overflow-wrap:anywhere}'+
    'th{width:37%;font-size:12px;color:#5f7085}td{font-size:12px}p,li{overflow-wrap:anywhere}'+
    '.muted,.source-caption{color:#506880;font-size:12px}.science-unknown,.missing{color:#785e41}'+
    '.technical-detail{padding:10px;border:1px solid #d8e1eb;border-radius:8px;margin:10px 0}summary{cursor:pointer}'+
    '.evidence-json{white-space:pre-wrap;overflow-wrap:anywhere;font-size:10px;background:#f4f7fa;padding:12px}'+
    'footer{font-size:11px;color:#526a80;border-top:1px solid #d5e0ea;margin-top:27px;padding-top:13px}'+
    '@page{size:A4;margin:17mm}@media print{body{padding:0;margin:0}'+
    '.report-section,.science-block{break-inside:avoid;page-break-inside:avoid}}'+
    '</style></head><body>'+
    '<h1>ADR · 合成演示科学知识与适用性报告</h1>'+
    '<p class="stamp">DEMO · 合格合成测试世界。非真实客户科学意见、生产授权或农业作业指令。</p>'+
    section('1. 本次评估针对的农业问题',
      '<p>报告仅反映下列来自 ADR Host 的已登记目标，不能把研究结论推广到未给出的田块。</p>'+
      table([
        ['决策类型',t.decisionType],['目标田块',target.fieldId],
        ['农场',target.farmId],['季节',target.seasonId],
        ['使用目的',t.usePurpose],['逻辑时间',t.logicalTime],
        ['证据截止时间',t.evidenceCutoff]
      ]))+
    section('2. 科学分类与阅读解释',
      '<div class="summary"><h3>首先阅读 · 这次评估说明了什么？</h3>'+
      '<p><strong>'+esc(summary.label)+'</strong>：'+esc(summary.next)+'</p>'+
      '<p>未触发人工复核，不代表农业操作安全、建议有效或允许执行。</p></div>'+
      table([
        ['ADR 原始分类',c.classification],
        ['知识科学用途状态',a.scientificUseStatus],
        ['目标条件适用性状态',a.transportStatus],
        ['是否触发人工复核',c.reviewRequired===true?'是':c.reviewRequired===false?'否':'UNKNOWN'],
        ['产品科学解释状态（非 ADR 分类）',reading.explanationStatus],
        ['农业作业授权','本次评估不提供；合成环境不得执行农业作业']
      ]))+
    section('3. 可以确认的科学依据',
      sourceCard(scientific,esc,{
        applicability:a,heading:'科学知识 · 同源主张、来源、资格与限制',
        includeTechnical:false
      }))+
    section('4. 尚未得到证明或缺失的信息',
      '<h3>目标上下文缺口</h3>'+items(a.missingContextSemanticIds)+
      '<h3>既有适用性限制</h3>'+items(a.limitations)+
      '<h3>知识冲突</h3>'+items(a.conflicts)+
      '<h3>已返回条件核对</h3>'+items(a.conditionResults)+
      '<h3>校准与正式转换需求</h3>'+
      items(a.requiredCalibrationCodes)+items(a.requiredTransformationRefs)+
      (reading.absenceReasons.length?'<h3>尚不足以独立解释的来源字段</h3>'+
        items(reading.absenceReasons):'')+
      '<p>NOT_REPORTED（未报告）、UNKNOWN（未知）、UNAVAILABLE（不可用）与数值 0 互不等价；空列表也不能证明没有限制。</p>')+
    section('5. 人工复核意见（非权威产品记录）',
      reviewRecord+
      '<p>CONTEXT_REQUESTED 等人工意见只反映用户反馈；不会修改 ADR 原始科学分类、AuthorityRef 或证据哈希。</p>')+
    section('6. 完整技术证据和精确引用',
      '<p>以下材料供审计复查；上文不要求阅读内部对象或哈希才能理解报告。</p>'+
      table([
        ['评估 AuthorityRef',attempt.assessmentRef],
        ['知识 AuthorityRef',scientific?.knowledgeRef],
        ['Workbench 投影哈希',c.projectionHash],
        ['演示操作编号',attempt.id],
        ['精确输入绑定',attempt.inputBinding]
      ])+
      '<details class="technical-detail"><summary>展开原始科学证据及来源（完整 JSON）</summary>'+
      '<pre class="evidence-json">'+raw(scientific)+'</pre></details>'+
      '<details class="technical-detail"><summary>展开原始目标上下文（ContextManifest / ContextDatum）</summary>'+
      '<pre class="evidence-json">'+raw(t)+'</pre></details>'+
      '<details class="technical-detail"><summary>展开原始适用性和分类数据</summary>'+
      '<pre class="evidence-json">'+raw({
        classification:c.classification,reviewRequired:c.reviewRequired,reasonCodes:c.reasonCodes,
        applicability:a,projectionHash:c.projectionHash,assessmentRef:attempt.assessmentRef
      })+'</pre></details>'+
      contextCard(t,esc))+
    '<footer>来源：已授权 ADR v0.3 Pilot Host Workbench 投影，以及独立 DEMO 人工反馈。'+
    '未取得真实客户生产资格；导出报告不增加科学或执行权限。</footer>'+
    '</body></html>';
}

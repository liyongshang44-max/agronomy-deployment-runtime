import { classificationExplanation, TERM_HELP, textAvailability } from './ux-language.js';
import { knowledgeReading, fieldState } from './knowledge-reading.js';
// Pure product presentation only: no classification, scientific authority, or unit inference.
const stringify = (v) => typeof v === 'string' ? v : JSON.stringify(v ?? 'UNKNOWN');
const value = (datum) => {
  const source = datum?.value;
  if (!source || source.type === 'UNKNOWN') return 'UNKNOWN';
  const raw = ['category', 'decimal', 'integer', 'string'].map(k => source[k])
    .find((x) => x !== null && x !== undefined);
  return raw === undefined ? stringify(source) : stringify(raw);
};
const row = (name, text, esc) => '<tr><th scope="row">' + esc(name) + '</th><td>' + esc(text ?? 'UNKNOWN') + '</td></tr>';
const table = (rows) => '<table class="science-table"><tbody>' + rows.join('') + '</tbody></table>';
const refs = (r) => r ? [r.kind, r.logicalId ?? r.logical_id, r.version,
  r.semanticHash ?? r.semantic_hash].map(x => x ?? 'UNKNOWN').join(' / ') : 'UNKNOWN';
const list = (items, esc) => {
  if (!Array.isArray(items) || items.length === 0) return '<p class="muted">未列出</p>';
  return '<ul class="science-list">' + items.map(x => '<li>' + esc(stringify(x)) + '</li>').join('') + '</ul>';
};
const codeList = (items, esc) => Array.isArray(items) && items.length
  ? items.map((x) => esc(stringify(x))).join('、') : '未列出';

export function contextCard(ctx, esc) {
  const target = ctx?.targetRef ?? {};
  const datums = ctx?.datums ?? [];
  return '<section class="panel science-card"><h2>第一步 · 核对目标上下文</h2>' +
    '<p class="muted">请先确认：这是哪块田、哪个季节、何时取得的观测，以及哪些条件没有数据。本次只展示已建立精确引用的合成观测；不会推测或换算缺失值。</p>' +
    '<details class="term-help"><summary>什么是上下文清单（ContextManifest）？</summary><p>' +
    esc(TERM_HELP.ContextManifest) + '</p></details>' +
    table([
      row('决策类型', ctx?.decisionType, esc),
      row('田块 / 季节', (target.fieldId ?? 'UNKNOWN') + ' / ' + (target.seasonId ?? 'UNKNOWN'), esc),
      row('Program', ctx?.programId, esc),
      row('逻辑时间', ctx?.logicalTime, esc),
      row('证据截止', ctx?.evidenceCutoff, esc),
      row('使用目的', ctx?.usePurpose, esc),
      row('ContextManifest 引用', refs(ctx?.contextManifestRef), esc)
    ]) +
    '<h2>已记录的观测与上下文</h2>' +
    '<p class="muted">下面的数值、单位及支持范围保留来自 ADR 的原始表达；“未知”不等于 0。</p>' +
    (datums.length ? datums.map((d) =>
      '<div class="science-block"><h3>' + esc(d.semanticId ?? 'UNKNOWN') + '</h3>' +
      table([
        row('原始值和单位', value(d) + ' ' + (d.unit ?? 'UNKNOWN'), esc),
        row('事实类别', d.epistemicClass, esc),
        row('来源类别', d.provenanceClass, esc),
        row('生效区间', (d.effectiveInterval?.start ?? 'UNKNOWN') + ' → ' +
          (d.effectiveInterval?.end ?? 'UNKNOWN'), esc),
        row('可取得时间', d.availableAt, esc),
        row('时间支持', stringify(d.temporalSupport), esc),
        row('空间支持', stringify(d.spatialSupport), esc),
        row('垂直支持', stringify(d.verticalSupport), esc),
        row('ContextDatum 引用', refs(d.contextDatumRef), esc)
      ]) + '</div>'
    ).join('') : '<p class="muted">当前 ContextManifest 未提供可展示的观测值；不得推断缺失资料。</p>') +
    '</section>';
}

// This exact sourceCard is shared by /knowledge, /assessments and HTML reports.
// It does not translate scientific content into a newly asserted conclusion.
export function sourceCard(evidence, esc, options = {}) {
  const reading=knowledgeReading(evidence,options.applicability);
  const fmt=(v)=>esc(fieldState(v));
  const lines=(items,empty='NOT_REPORTED（该列表没有给出可核查条目；不表示不存在）') =>
    Array.isArray(items) && items.length
      ? '<ul class="science-list">'+items.map(v=>'<li>'+fmt(v)+'</li>').join('')+'</ul>'
      : '<p class="science-unknown">'+esc(empty)+'</p>';
  const technicalTable=(rows)=>'<table class="science-table"><tbody>'+rows.map(([k,v])=>
    '<tr><th scope="row">'+esc(k)+'</th><td>'+fmt(v)+'</td></tr>').join('')+'</tbody></table>';
  const allSources=reading.items.map(src=>
    '<article class="science-block" data-source-index="'+src.index+'"><h3>来源证据 '+src.index+'</h3>'+
    '<p class="source-caption">来源记录名称（Host 原样返回）：<strong>'+fmt(src.title)+'</strong></p>'+
    '<p>原始研究主张：<span class="source-claim">'+fmt(src.assertion)+'</span></p>'+
    '<p class="muted">出处定位：'+fmt(src.locatorProvided?src.locator:'NOT_REPORTED')+
    ' · 忠实性复核记录：'+fmt(src.faithfulReview)+'</p>'+
    '<p>原文核查：'+esc(src.rightsStatus)+'</p>'+
    (src.sourceRefProvided ? '<p class="muted">已提供精确来源引用（不代表独立核查论文）</p>':
      '<p class="science-unknown">精确来源引用：NOT_REPORTED</p>')+
    '<p>作者：'+fmt(src.author)+' · 年份：'+fmt(src.year)+
    ' · 结构化阈值：'+fmt(src.actualThreshold)+'</p>'+
    '<div class="condition-list"><h4>原研究报告的条件</h4>'+
    (src.conditions.length?src.conditions.map(c=>
      '<div class="condition-item"><strong>'+esc(c.label)+'</strong> <span class="muted">['+esc(c.code)+'] '+fmt(c.status)+'</span>'+
      (c.dimensions.length?'<ul class="science-list">'+c.dimensions.map(d=>
        '<li>'+esc(d.label)+'：'+fmt(d.value)+' <span class="muted">('+fmt(d.semanticId)+')</span></li>').join('')+'</ul>':
        '<p class="science-unknown">该类别没有列出具体条件值；不得填补。</p>')+
      '</div>').join(''):
      '<p class="science-unknown">NOT_REPORTED：未提供来源条件清单</p>')+
    '</div>'+
    '<h4>既有科学资格决定（原样）</h4>'+
    (src.decisions.length?src.decisions.map((d,i)=>
      '<div class="condition-item"><p>决定 '+(i+1)+'：'+fmt(d.disposition)+
      ' · 资格目标：'+fmt(d.qualificationTarget)+'</p>'+
      '<p>前置条件</p>'+lines(d.semanticPreconditions)+
      '<p>范围与限制</p>'+lines(d.limitations)+
      '<p>跨情境约束</p>'+lines(d.transportConstraints)+'</div>').join(''):
      '<p class="science-unknown">NOT_REPORTED：本次投影未列出资格决定</p>')+
    '<details class="technical-detail"><summary>查看此来源的精确引用、哈希与原始字段</summary>'+
    technicalTable([
      ['SourceArtifact AuthorityRef',src.sourceRef],
      ['Claim AuthorityRef',src.claimRef],
      ['来源内容 SHA-256',src.contentHash],
      ['原始 Claim 类型',src.claimType],
      ['原始来源定位',src.locator],
      ['来源忠实性复核状态',src.faithfulReview]
    ])+'</details></article>').join('');
  return '<section class="panel science-card knowledge-reading" data-knowledge-reading>'+
    '<h2>'+esc(options.heading ?? '第二步 · 阅读农艺知识和来源')+'</h2>'+
    '<p class="science-demo-label">SYNTHETIC DEMO · 仅用于隔离合成测试，不是对生产田块的农业建议。</p>'+
    '<div class="reading-question"><h3>1. 这项研究说了什么？</h3>'+
    '<p class="muted">下面仅重述 ADR Host 返回的原始科学主张，不翻译出新的阈值、因果关系或用途。</p>'+
    '<blockquote class="science-assertion" data-reading-assertion>'+fmt(reading.assertion)+'</blockquote>'+
    (reading.isDerived?'<p>此项为综合知识；各条输入研究的原始主张见下一部分，不能当作单项实验结论。</p>':'')+
    '</div>'+
    '<div class="reading-question"><h3>2. 证据来自哪里？</h3>'+
    '<p>合格知识和目标田块适用性需分别核对。本次 Host 返回的证据条目：'+reading.sourceCount+
    '。有内部来源引用不等于已独立核对论文全文；有忠实性复核记录不代表研究可推广到所有条件。</p>'+
    (allSources||'<p class="science-unknown">NOT_REPORTED：该读模型没有提供可展示的来源证据明细；不得补造。</p>')+
    '</div>'+
    '<div class="reading-question"><h3>3. 已证明适用于什么条件？</h3>'+
    '<p>仅显示来源上下文与资格决定实际返回的条件；缺失项不得根据农业常识补齐。</p>'+
    (reading.preconditions.length?'<h4>已返回的前置条件</h4>'+lines(reading.preconditions):'')+
    (reading.derivedRestrictions.length?'<h4>综合知识新增限制</h4>'+lines(reading.derivedRestrictions):'')+
    '<p class="muted">当前目标上下文的适用性状态（Host 原始值）：'+fmt(reading.transportStatus)+
    '；科学用途状态：'+fmt(reading.scientificUseStatus)+'。资格不等于当前田块可用。</p></div>'+
    '<div class="reading-question"><h3>4. 哪些条件不知道或尚未证明？</h3>'+
    '<h4>既有资格范围及目标适用性限制</h4>'+lines(reading.limits)+
    '<h4>目标田块缺失信息</h4>'+lines(reading.missing)+
    '<h4>来源原文/权限与解释完整性</h4>'+
    (reading.absenceReasons.length?lines(reading.absenceReasons):
      '<p>已取得当前展示字段；仍不能推断来源全文权利或适用于未检查的目标条件。</p>')+
    (reading.explanationStatus==='SCIENTIFIC_EXPLANATION_INSUFFICIENT'?
      '<p class="science-unknown" role="status">SCIENTIFIC_EXPLANATION_INSUFFICIENT · 当前返回证据不足以完整解释研究；此为产品阅读状态，并非 ADR 科学分类。</p>':'')+
    '</div>'+
    '<div class="reading-question"><h3>5. 下一步能做什么？</h3>'+
    '<p>可补充有正式来源的作物、测量与时间信息，请农艺师核查来源和适用条件，或进入适用性评估查看 Host 已有分类。不能从本页面直接推导播种、施肥、灌溉或其他作业指令。</p>'+
    '<p><strong>未触发人工复核，不代表农业操作安全、建议有效或允许执行。</strong></p>'+
    '</div>'+
    (options.includeTechnical===false ? '' :
      '<details class="technical-detail"><summary>审计用：展开全部 ADR AuthorityRef、原始 JSON 和哈希</summary>'+
      technicalTable([
        ['知识类型',reading.evidenceKind],
        ['知识 AuthorityRef',evidence?.knowledgeRef],
        ['展示来源条数',reading.sourceCount],
        ['产品阅读状态',reading.explanationStatus]
      ])+
      '<pre class="evidence-json">'+fmt({scientificEvidence:evidence,applicability:options.applicability})+'</pre></details>')+
    '<p class="muted">来源忠实性复核、科学用途资格、目标适用性检查、人工复核与作业授权属于不同层次；产品展示不提升任何权限。</p>'+
    '</section>';
}

export function resultCard(c, esc) {
  const a = c?.applicability ?? {};
  const interpretation = classificationExplanation(c?.classification);
  return '<div class="science-card">' +
    '<div class="outcome-explainer" role="note"><p class="eyebrow">如何理解这次分类</p>' +
    '<h3>' + esc(interpretation.label) + '</h3><p>' + esc(interpretation.next) + '</p>' +
    '<p class="muted">ADR 原始分类代码：<code>' + esc(textAvailability(c?.classification)) +
    '</code>。解释仅帮助阅读，不改变科学结论和权限。</p></div>' +
    '<div class="science-block"><h3>五项独立边界（不可相互推导）</h3>' +
    table([
      row('1 · 科学用途资格', a.scientificUseStatus, esc),
      row('2 · 目标上下文适用性', a.transportStatus, esc),
      row('3 · 本次触发人工复核', c?.reviewRequired == null ? 'UNKNOWN' : c.reviewRequired ? '是' : '否', esc),
      row('4 · 已报告的上下文缺口', Array.isArray(a.missingContextSemanticIds) && a.missingContextSemanticIds.length ?
        a.missingContextSemanticIds.map(stringify).join('、') :
        'NOT_REPORTED（未列出不代表无缺口）', esc),
      row('5 · 农业作业授权', '未由此评估提供；本合成 DEMO 不得执行农业作业', esc)
    ]) + '<p>未触发人工复核，不代表农业操作安全、建议有效或允许执行。人工反馈不改变 ADR 原始科学分类。</p></div>' +
    '<div class="science-block"><h3>结果与下一步</h3>' +
    table([
      row('是否进入人工复核', c?.reviewRequired == null ? 'UNKNOWN' : c.reviewRequired ? '是' : '否', esc),
      row('目标适用性状态（Transport Status）', a.transportStatus, esc),
      row('科学用途资格（Scientific Use Status）', a.scientificUseStatus, esc),
      row('需要关注的原因代码', codeList(c?.reasonCodes, esc), (x) => x)
    ]) +
    '<details class="term-help"><summary>这两个状态有什么区别？</summary><p>' +
    esc(TERM_HELP.TransportStatus) + ' ' + esc(TERM_HELP.ScientificUseStatus) +
    '</p></details></div>' +
    '<div class="science-block"><h3>待补充的目标信息</h3>' +
    list(a.missingContextSemanticIds, esc) + '</div>' +
    '<div class="science-block"><h3>条件核对（ADR 原始值）</h3>' +
    list(a.conditionResults, esc) + '</div>' +
    '<div class="science-block"><h3>冲突与限制</h3>' +
    '<h4>知识冲突</h4>' + list(a.conflicts, esc) +
    '<h4>适用性限制</h4>' + list(a.limitations, esc) + '</div>' +
    '<div class="science-block"><h3>进一步治理需求</h3>' +
    '<h4>校准要求</h4>' + list(a.requiredCalibrationCodes, esc) +
    '<h4>正式转换要求</h4>' + list(a.requiredTransformationRefs, esc) + '</div>' +
    '<p class="muted">“未列出”仅表示此只读投影未提供相应条目，不保证该问题不存在。</p>' +
    '</div>';
}

import { classificationExplanation, TERM_HELP, textAvailability } from './ux-language.js';
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
        row('空间支持', stringify(d.spatialSupport), esc),
        row('垂直支持', stringify(d.verticalSupport), esc),
        row('ContextDatum 引用', refs(d.contextDatumRef), esc)
      ]) + '</div>'
    ).join('') : '<p class="muted">当前 ContextManifest 未提供可展示的观测值；不得推断缺失资料。</p>') +
    '</section>';
}

export function sourceCard(evidence, esc) {
  const candidates = evidence?.knowledgeKind === 'DerivedKnowledge'
    ? (Array.isArray(evidence.inputQualifiedEvidence) ? evidence.inputQualifiedEvidence : [])
    : evidence ? [evidence] : [];
  const renderOne = (item, i) => {
    const source = item?.source ?? {};
    const claim = item?.claim ?? {};
    const span = item?.sourceSpan ?? {};
    return '<div class="science-block"><h3>来源证据 ' + (i + 1) + '</h3>' +
      table([
        row('来源标题', source.title, esc),
        row('SourceArtifact 精确引用', refs(source.sourceArtifactRef), esc),
        row('来源内容哈希', source.contentHash, esc),
        row('原始科学主张', stringify(claim.assertion), esc),
        row('主张类型', claim.claimType, esc),
        row('Claim 精确引用', refs(claim.claimRef), esc),
        row('来源定位', stringify(claim.sourceLocator ?? span.locator), esc),
        row('来源忠实性复核状态', item?.sourceFaithfulReview?.disposition, esc),
        row('资格决定数量', item?.qualification?.decisions?.length ?? 'UNKNOWN', esc),
        row('原文预览', span.previewAvailable ? '来源声明可用；实际读取仍以授权接口为准' :
          '当前没有授权原文预览', esc)
      ]) + '</div>';
  };
  return '<section class="panel science-card"><h2>第二步 · 阅读农艺知识和来源</h2>' +
    '<p class="muted">优先核对研究原始主张、适用条件和来源定位。合格知识不代表自动适用于当前田块。</p>' +
    '<details class="term-help"><summary>“合格知识”和“精确引用”分别意味着什么？</summary><p>' +
    esc(TERM_HELP.QualifiedKnowledge) + ' ' + esc(TERM_HELP.AuthorityRef) + '</p></details>' +
    table([
      row('知识类型（ADR 原始值）', evidence?.knowledgeKind, esc),
      row('知识精确引用', refs(evidence?.knowledgeRef), esc),
      row('展示的来源证据条数', candidates.length, esc)
    ]) +
    (candidates.length ? candidates.map(renderOne).join('') :
      '<p class="muted">该读模型没有提供可展示的来源证据明细；不能凭空补齐。</p>') +
    '<p class="muted">如无授权原文，当前页面只显示已返回的来源元数据，不能声称已核实论文全文或具体页码。</p></section>';
}

export function resultCard(c, esc) {
  const a = c?.applicability ?? {};
  const interpretation = classificationExplanation(c?.classification);
  return '<div class="science-card">' +
    '<div class="outcome-explainer" role="note"><p class="eyebrow">如何理解这次分类</p>' +
    '<h3>' + esc(interpretation.label) + '</h3><p>' + esc(interpretation.next) + '</p>' +
    '<p class="muted">ADR 原始分类代码：<code>' + esc(textAvailability(c?.classification)) +
    '</code>。解释仅帮助阅读，不改变科学结论和权限。</p></div>' +
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

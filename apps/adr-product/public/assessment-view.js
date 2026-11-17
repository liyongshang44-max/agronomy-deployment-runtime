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
    '<p class="muted">本次仅使用已建立 AuthorityRef 的合成观测；显示来源的原始单位和时间支持，不进行推测性换算。</p>' +
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
  const item = evidence?.knowledgeKind === 'DerivedKnowledge'
    ? evidence.inputQualifiedEvidence?.[0] ?? {}
    : evidence ?? {};
  const source = item.source ?? {};
  const claim = item.claim ?? {};
  const span = item.sourceSpan ?? {};
  return '<section class="panel science-card"><h2>第二步 · 阅读农艺知识和来源</h2>' +
    table([
      row('知识类型', evidence?.knowledgeKind, esc),
      row('知识 AuthorityRef', refs(evidence?.knowledgeRef), esc),
      row('来源标题', source.title, esc),
      row('SourceArtifact 引用', refs(source.sourceArtifactRef), esc),
      row('来源内容哈希', source.contentHash, esc),
      row('科学主张', stringify(claim.assertion), esc),
      row('主张类型', claim.claimType, esc),
      row('Claim 引用', refs(claim.claimRef), esc),
      row('来源定位', stringify(claim.sourceLocator ?? span.locator), esc),
      row('科学复核状态', item.sourceFaithfulReview?.disposition, esc),
      row('资格决定数量', item.qualification?.decisions?.length ?? 'UNKNOWN', esc),
      row('来源全文预览', span.previewAvailable ? '已获授权可用' : '未提供授权原文', esc)
    ]) +
    '<p class="muted">科学资格引用不等于对当前田块的自动执行许可；没有授权原文时不伪造页码或全文。</p></section>';
}

export function resultCard(c, esc) {
  const a = c?.applicability ?? {};
  return '<div class="science-card">' +
    '<div class="science-block"><h3>适用性解释</h3>' +
    table([
      row('原始 ADR 分类代码', c?.classification, esc),
      row('是否进入人工复核', c?.reviewRequired ? '是' : '否', esc),
      row('运输适用性状态', a.transportStatus, esc),
      row('科学使用状态', a.scientificUseStatus, esc),
      row('复核原因代码', codeList(c?.reasonCodes, esc), (x) => x)
    ]) + '</div>' +
    '<div class="science-block"><h3>缺失的目标上下文</h3>' +
    list(a.missingContextSemanticIds, esc) + '</div>' +
    '<div class="science-block"><h3>条件匹配</h3>' +
    list(a.conditionResults, esc) + '</div>' +
    '<div class="science-block"><h3>知识冲突和适用性限制</h3>' +
    list(a.conflicts, esc) + list(a.limitations, esc) + '</div>' +
    '<div class="science-block"><h3>校准与受治理转换需求</h3>' +
    list(a.requiredCalibrationCodes, esc) +
    list(a.requiredTransformationRefs, esc) + '</div>' +
    '</div>';
}

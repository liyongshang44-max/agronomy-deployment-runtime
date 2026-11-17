import { classificationExplanation, TERM_HELP, reviewTimingLabel } from '../public/ux-language.js';
// Human-readable, non-authority report presentation of the exact validated Host read model.
// Never synthesize missing scientific statements or silently reinterpret units.
const escape = (x) => String(x ?? 'UNKNOWN').replace(/[&<>"']/g,
  (c) => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' })[c]);
const asText = (v) => typeof v === 'string' ? v : JSON.stringify(v ?? 'UNKNOWN');
const refString = (r) => !r ? 'NOT_AVAILABLE' : [
  r.kind, r.logicalId ?? r.logical_id, r.version,
  r.semanticHash ?? r.semantic_hash
].map((x) => x ?? 'UNKNOWN').join(' / ');
const tr = (name, content) => '<tr><th scope="row">' + escape(name) + '</th><td>' + escape(content ?? 'NOT_REPORTED') + '</td></tr>';
const table = (rows) => '<table>' + rows.join('') + '</table>';
const section = (title, text) => '<section><h2>' + escape(title) + '</h2>' + text + '</section>';
const dump = (items) => !items?.length
  ? '<p class="missing">未提供 / NOT_REPORTED</p>'
  : '<ul>' + items.map((v) => '<li>' + escape(asText(v)) + '</li>').join('') + '</ul>';
const rawValue = (datum) => {
  const v = datum.value;
  if (!v) return 'UNKNOWN';
  const found = ['category', 'decimal', 'integer', 'string']
    .map((key) => v[key]).find((item) => item !== undefined && item !== null);
  return String(found === undefined ? asText(v) : found) + ' ' + (datum.unit ?? 'UNKNOWN');
};
const CLASSIFICATION_LABELS = Object.freeze({
  NO_REVIEW_CANDIDATE:'未触发本次复核条件（不表示安全或正确）',
  AGRONOMIST_REVIEW_REQUIRED:'需要农艺师复核',
  CONTEXT_GAP:'目标上下文缺口',
  KNOWLEDGE_CONFLICT:'知识冲突',
  CALIBRATION_NEEDED:'需要校准',
  GOVERNED_TRANSFORM_NEEDED:'需要受治理的转换'
});

export function renderDemoReport({ attempt, review }) {
  if (attempt?.state !== 'CONFIRMED'
    || !attempt?.assessmentRef
    || !attempt?.workbenchCase?.projectionHash) {
    throw new Error('EXACT_CONFIRMED_CASE_REQUIRED_FOR_REPORT');
  }
  const c = attempt.workbenchCase;
  const a = c.applicability ?? {};
  const t = c.targetContext ?? {};
  const e = c.scientificEvidence ?? {};
  const sourceItems = e.knowledgeKind === 'DerivedKnowledge'
    ? (Array.isArray(e.inputQualifiedEvidence) ? e.inputQualifiedEvidence : [])
    : e && typeof e === 'object' ? [e] : [];
  const target = t.targetRef ?? {};
  const measurements = (t.datums ?? []).map((d) =>
    table([
      tr('ContextDatum', refString(d.contextDatumRef)),
      tr('语义指标', d.semanticId),
      tr('原始值和单位', rawValue(d)),
      tr('事实 / 来源类别', (d.epistemicClass ?? 'UNKNOWN') + ' / ' + (d.provenanceClass ?? 'UNKNOWN')),
      tr('生效时间范围', (d.effectiveInterval?.start ?? 'UNKNOWN') + ' → ' +
        (d.effectiveInterval?.end ?? 'UNKNOWN')),
      tr('资料可取得时间', d.availableAt),
      tr('空间支持', asText(d.spatialSupport)),
      tr('垂直支持', asText(d.verticalSupport))
    ])).join('');
  const evidenceHeader = table([
    tr('知识类型（ADR 原始值）', e.knowledgeKind),
    tr('知识 AuthorityRef', refString(e.knowledgeRef)),
    tr('该投影返回的来源条数', sourceItems.length)
  ]);
  const evidenceRows = sourceItems.map((item, index) => {
    const source = item?.source ?? {};
    const claim = item?.claim ?? {};
    return '<h3>来源条目 ' + (index + 1) + '</h3>' + table([
      tr('来源标题', source.title),
      tr('来源内容 SHA-256', source.contentHash),
      tr('SourceArtifact', refString(source.sourceArtifactRef)),
      tr('Claim', refString(claim.claimRef)),
      tr('原始研究主张', asText(claim.assertion)),
      tr('来源定位', asText(claim.sourceLocator ?? item.sourceSpan?.locator)),
      tr('SourceContext', refString(item.originContext?.originContextRef)),
      tr('来源忠实性复核状态', item.sourceFaithfulReview?.disposition),
      tr('原文可用性', item.sourceSpan?.previewAvailable ?
        '读模型声明预览可用；实际读取仍须另行授权' : '未提供授权原文预览')
    ]);
  }).join('') || '<p class="missing">该 Workbench 投影未返回可展示的来源明细；不得补造。</p>';
  const explanation = classificationExplanation(c.classification);

  return '<!doctype html><html lang="zh-CN"><head><meta charset="utf-8">' +
    '<meta name="viewport" content="width=device-width, initial-scale=1">' +
    '<title>ADR DEMO · 案件报告</title>' +
    '<style>body{font:14px/1.7 "Segoe UI","PingFang SC",sans-serif;color:#293b53;max-width:900px;margin:40px auto;padding:0 25px}' +
    'h1{font-size:27px;margin-bottom:5px}h2{font-size:18px;margin-top:27px;border-bottom:1px solid #dbe4ed;padding-bottom:8px}' +
    '.summary{border-left:4px solid #4f7599;background:#f4f7fa;padding:16px;margin:20px 0}' +
    '.summary h2{margin:0 0 8px;border:0;padding:0}.summary p{margin:8px 0}' +
    '.summary strong{font-size:16px}.report-meta{color:#566d83;font-size:12px}' +
    '.stamp{border:1px solid #dab789;background:#fff6e7;padding:12px;color:#87561c;font-weight:700}' +
    '.missing{color:#9a6980}table{border-collapse:collapse;width:100%;table-layout:fixed;margin:12px 0 20px}' +
    'th,td{text-align:left;border-bottom:1px solid #e5ecf2;vertical-align:top;padding:7px;overflow-wrap:anywhere}' +
    'th{width:32%;font-size:12px;color:#6b7e91}td{font-size:12px}li{margin:5px 0}footer{margin-top:35px;font-size:11px;color:#718398}' +
    '@page{size:A4;margin:18mm}@media print{body{margin:0;padding:0}.stamp{color:#333}}</style></head><body>' +
    '<h1>ADR · 合成演示评估报告</h1>' +
    '<p class="stamp">DEMO · 合格合成测试世界。该报告不是客户科学意见、生产授权或农业操作指令。</p>' +
    '<div class="summary"><h2>首先阅读 · 这次评估说明了什么？</h2>' +
    '<p><strong>' + escape(explanation.label) + '</strong></p>' +
    '<p>' + escape(explanation.next) + '</p>' +
    '<p class="report-meta">ADR 原始代码：' + escape(c.classification) +
    '。上述中文内容是产品阅读辅助，不是新增科学裁决，也不构成执行建议。</p></div>' +
    section('案件及评估分类',table([
      tr('ADR 原始分类', c.classification),
      tr('分类解释', explanation.label),
      tr('需要人工复核', c.reviewRequired ? '是' : '否'),
      tr('Transport Status', a.transportStatus),
      tr('Scientific Use Status', a.scientificUseStatus),
      tr('ApplicabilityAssessment AuthorityRef', refString(attempt.assessmentRef)),
      tr('Workbench Projection Hash', c.projectionHash),
      tr('演示运行操作 ID', attempt.id)
    ])) +
    section('目标田块和时间证据', table([
      tr('DecisionProblem', refString(t.decisionProblemRef)),
      tr('目标田块', (target.fieldId ?? 'UNKNOWN') + ' / ' + (target.farmId ?? 'UNKNOWN')),
      tr('季节', target.seasonId),
      tr('决策类型', t.decisionType),
      tr('逻辑时间', t.logicalTime),
      tr('决策用途', t.usePurpose),
      tr('证据截止', t.evidenceCutoff),
      tr('ContextManifest', refString(t.contextManifestRef))
    ]) + (measurements || '<p class="missing">未记录可展示的 ContextDatum。</p>')) +
    section('来源主张及科学资格',
      '<p>逐项核对可用的研究主张和定位。已资格化的知识并不自动适用于所有田块。</p>' +
      evidenceHeader + evidenceRows) +
    section('适用性解释与缺口',
      '<h3>复核原因</h3>' + dump(c.reasonCodes) +
      '<h3>缺失的目标上下文</h3>' + dump(a.missingContextSemanticIds) +
      '<h3>条件结果</h3>' + dump(a.conditionResults) +
      '<h3>知识冲突</h3>' + dump(a.conflicts) +
      '<h3>适用性限制</h3>' + dump(a.limitations) +
      '<h3>校准需求</h3>' + dump(a.requiredCalibrationCodes) +
      '<h3>受治理转换需求</h3>' + dump(a.requiredTransformationRefs)) +
    section('人工复核（非权威产品记录）',
      review ? table([
        tr('复核人', review.reviewerId), tr('人工结论', review.outcome),
        tr('备注', review.notes), tr('评估创建时间（不计入复核）', review.assessmentCreatedAt),
        tr('复核开始时间', review.startedAt ?? 'UNKNOWN'),
        tr('复核完成时间', review.completedAt),
        tr('复核耗时状态', review.reviewDurationStatus ?? 'UNKNOWN'),
        tr('复核耗时（便于阅读）', reviewTimingLabel(review)),
        tr('复核耗时（原始毫秒）', review.durationMs ?? 'UNKNOWN'),
        tr('绑定的 Workbench 哈希', review.caseProjectionHash)
      ]) : '<p class="missing">尚无人工复核反馈。</p>') +
    section('术语与数据限制',
      '<p><strong>精确引用：</strong>' + escape(TERM_HELP.AuthorityRef) + '</p>' +
      '<p><strong>适用性评估：</strong>' + escape(TERM_HELP.ApplicabilityAssessment) + '</p>' +
      '<p><strong>未知数据：</strong>' + escape(TERM_HELP.UNKNOWN) + '</p>' +
      '<p><strong>人工反馈：</strong>' + escape(TERM_HELP.ReviewFeedback) + '</p>' +
      '<p>如列表未列出限制，并不能据此证明没有限制；不要补写来源原文或转换单位。</p>') +
    '<footer>来源：ADR v0.3 Pilot Host 已授权 Workbench 投影及独立 DEMO 产品反馈。' +
    ' 导出不增加任何新的科学资格或执行权限。可由浏览器打印为 PDF。</footer></body></html>';
}

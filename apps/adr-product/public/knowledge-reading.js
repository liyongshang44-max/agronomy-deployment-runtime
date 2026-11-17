// ADR-PROD UX-02: read-only interpretation of the *already returned* Workbench projection.
// No scientific classification, language-model summarization, authority, source-rights
// inference or new qualification can originate here. Shared by knowledge, assessment,
// and exported report. All evidence objects remain byte-for-byte untouched.
export function fieldState(v) {
  if (v === undefined) return 'NOT_REPORTED';
  if (v === null) return 'UNKNOWN';
  if (v === 'UNKNOWN' || v === 'NOT_REPORTED' || v === 'UNAVAILABLE') return v;
  if (typeof v === 'string' && v.length === 0) return 'NOT_REPORTED';
  if (Array.isArray(v) && v.length === 0) return '已返回空列表（不证明不存在）';
  if (typeof v === 'string') return v;
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  return JSON.stringify(v);
}
export const hasValue = (v) => v !== undefined && v !== null &&
  v !== '' && v !== 'UNKNOWN' && v !== 'NOT_REPORTED' && v !== 'UNAVAILABLE';
const nonEmpty = (v) => Array.isArray(v) && v.length > 0;
const exactRef = (v) => Boolean(v && typeof v === 'object' && hasValue(v.kind) &&
  hasValue(v.logicalId ?? v.logical_id) && hasValue(v.version) &&
  hasValue(v.semanticHash ?? v.semantic_hash));
export function evidenceItems(evidence) {
  if (evidence?.knowledgeKind === 'DerivedKnowledge')
    return Array.isArray(evidence.inputQualifiedEvidence) ? evidence.inputQualifiedEvidence : [];
  if (evidence?.knowledgeKind === 'QualifiedKnowledge') return [evidence];
  return [];
}
export const FAMILY_LABELS = Object.freeze({
  BIOLOGICAL:'作物与生育条件',
  ENVIRONMENTAL:'环境与土壤条件',
  MANAGEMENT:'管理措施',
  OPERATIONAL:'作业条件',
  MEASUREMENT:'测量及方法',
  JURISDICTION_ECONOMIC:'地区、法规与经济条件'
});
export const DIMENSION_LABELS = Object.freeze({
  'crop.code':'作物',
  'crop.stage':'作物生育阶段',
  'crop.growth_stage':'作物生育阶段',
  'field.id':'田块',
  'soil.texture_class':'土壤质地',
  'soil.root_zone.depletion_fraction':'根区耗水比例'
});
// Do not project a dimension into a target field just because it looks familiar.
// The label only explains the existing semanticId; the exact ID/value are retained.
export function sourceConditions(item) {
  const families=item?.originContext?.contextFamilies;
  if (!families || typeof families !== 'object' || Array.isArray(families)) return [];
  return Object.entries(families).map(([code,family]) => ({
    code,
    label:FAMILY_LABELS[code] ?? '其他已记录条件',
    status:fieldState(family?.status),
    dimensions:Array.isArray(family?.dimensions) ? family.dimensions.map(d => ({
      semanticId:fieldState(d?.semanticId),
      label:DIMENSION_LABELS[d?.semanticId] ?? '来源记录指标',
      value:fieldState(d?.value)
    })) : []
  }));
}
const recordedArray=(arr) => Array.isArray(arr) ? arr : [];
export function knowledgeReading(evidence,applicability) {
  const items=evidenceItems(evidence);
  const derived=evidence?.knowledgeKind === 'DerivedKnowledge';
  const assertion=derived ? evidence?.assertion : items[0]?.claim?.assertion;
  const sourceSummaries=items.map((item,index) => {
    const source=item?.source ?? {};
    const claim=item?.claim ?? {};
    const span=item?.sourceSpan ?? {};
    const decisions=recordedArray(item?.qualification?.decisions);
    return {
      index:index+1,
      title:fieldState(source.title),
      author:fieldState(source.author ?? source.authors),
      year:fieldState(source.year ?? source.publicationYear),
      assertion:fieldState(claim.assertion),
      claimType:fieldState(claim.claimType),
      sourceRef:source.sourceArtifactRef,
      sourceTitleProvided:hasValue(source.title),
      sourceRefProvided:exactRef(source.sourceArtifactRef),
      claimRef:claim.claimRef,
      claimRefProvided:exactRef(claim.claimRef),
      locator:claim.sourceLocator ?? span.locator,
      locatorProvided:hasValue(claim.sourceLocator ?? span.locator),
      contentHash:source.contentHash,
      readPreview:span.previewAvailable === true && typeof span.previewText === 'string'
        ? span.previewText : null,
      previewDeclared:span.previewAvailable === true,
      previewNotAvailable:span.previewAvailable === false,
      faithfulReview:fieldState(item?.sourceFaithfulReview?.disposition),
      decisions,
      conditions:sourceConditions(item),
      rightsStatus:span.previewAvailable === true && typeof span.previewText === 'string'
        ? '接口返回可读预览；不表示已获得完整原文或再传播权'
        : '当前没有授权原文预览；未取得完整原文核查能力',
      actualThreshold:hasValue(claim.threshold) ? fieldState(claim.threshold) :
        hasValue(item?.threshold) ? fieldState(item.threshold) : '未提供具体阈值'
    };
  });
  const qualificationLimits=sourceSummaries.flatMap(s=>s.decisions.flatMap(decision =>
    recordedArray(decision?.limitations)));
  const preconditions=sourceSummaries.flatMap(s=>s.decisions.flatMap(decision =>
    recordedArray(decision?.semanticPreconditions)));
  const transportConstraints=sourceSummaries.flatMap(s=>s.decisions.flatMap(decision =>
    recordedArray(decision?.transportConstraints)));
  // A status-only family is not evidence of any particular crop, stage,
  // geography or measurement; only explicit dimensions supply conditions.
  const knownContexts=sourceSummaries.flatMap(s=>s.conditions.filter(f=>
    f.dimensions.length > 0));
  const derivedRestrictions=recordedArray(evidence?.originContext?.introducedRestrictions);
  const heterogeneous=recordedArray(evidence?.originContext?.unresolvedContextHeterogeneity);
  const limits=[
    ...qualificationLimits,...transportConstraints,...derivedRestrictions,
    ...heterogeneous,...recordedArray(applicability?.limitations)
  ];
  const absent=[];
  if (!hasValue(assertion)) absent.push('综合科学主张');
  if (!sourceSummaries.some(s=>s.sourceTitleProvided)) absent.push('可读来源名称');
  if (!sourceSummaries.some(s=>s.locatorProvided)) absent.push('可核查来源定位');
  if (knownContexts.length===0 && preconditions.length===0)
    absent.push('明确报告的适用条件');
  if (!sourceSummaries.some(s=>s.readPreview !== null))
    absent.push('可授权核查的来源原文');
  return {
    evidenceKind:fieldState(evidence?.knowledgeKind),
    assertion:fieldState(assertion),
    isDerived:derived,items:sourceSummaries,
    sourceCount:sourceSummaries.length,
    qualificationLimits,preconditions,transportConstraints,
    knownContexts,derivedRestrictions,heterogeneous,limits,
    missing:recordedArray(applicability?.missingContextSemanticIds),
    conditionResults:recordedArray(applicability?.conditionResults),
    scientificUseStatus:fieldState(applicability?.scientificUseStatus),
    transportStatus:fieldState(applicability?.transportStatus),
    authorInfoProvided:sourceSummaries.some(s=>hasValue(s.author)),
    yearInfoProvided:sourceSummaries.some(s=>hasValue(s.year)),
    absenceReasons:absent,
    explanationStatus:absent.length ? 'SCIENTIFIC_EXPLANATION_INSUFFICIENT' : 'EVIDENCE_FIELDS_PRESENT',
    rawEvidence:evidence,
    rawApplicability:applicability
  };
}

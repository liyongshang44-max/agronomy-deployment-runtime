// ADR-PROD presentation vocabulary only. This file does not change ADR authority,
// classifications, evidence, scientific qualifications or execution permissions.
export const CLASSIFICATION_EXPLANATIONS = Object.freeze({
  NO_REVIEW_CANDIDATE: Object.freeze({
    label: '当前未触发人工复核条件',
    next: '仍需检查来源、适用范围和限制；这不是安全、有效或推荐执行的结论。'
  }),
  AGRONOMIST_REVIEW_REQUIRED: Object.freeze({
    label: '需要农艺师复核',
    next: '先核查目标田块信息、来源证据与适用条件，再记录人工意见。'
  }),
  CONTEXT_GAP: Object.freeze({
    label: '目标信息不足',
    next: '查看“缺失的目标上下文”，明确需要补充哪些有来源的观测；不要猜测缺失值。'
  }),
  KNOWLEDGE_CONFLICT: Object.freeze({
    label: '知识证据存在冲突',
    next: '逐项阅读冲突引用及研究条件；不能自行选择其中一项当作最终科学裁决。'
  }),
  CALIBRATION_NEEDED: Object.freeze({
    label: '需要测量校准',
    next: '检查设备、测量方法及校准限制；当前结果不能代替已校准的正式证据。'
  }),
  GOVERNED_TRANSFORM_NEEDED: Object.freeze({
    label: '需要受治理的数据转换',
    next: '核对缺失的正式转换依据，产品页面不能自行换算并宣称得到合格数据。'
  })
});
export const REVIEW_OUTCOME_LABELS = Object.freeze({
  CONFIRMED_CLASSIFICATION: '同意当前分类（仅人工反馈）',
  REVIEWER_DISAGREED: '不同意当前分类',
  CONTEXT_REQUESTED: '需要补充目标信息',
  AUTHORITY_ACTION_PERFORMED: '已在独立授权流程操作（仅记录声明）',
  DEFERRED: '暂缓处理'
});
export const TERM_HELP = Object.freeze({
  ApplicabilityAssessment: '适用性评估：ADR 对特定知识能否用于特定目标情境的受治理判断；不直接构成农业作业指令。',
  Workbench: '复核工作台：展示 ADR 原始评估分类、证据、限制和人工处理入口的只读投影。',
  AuthorityRef: '精确引用：用于定位某个版本的 ADR 权威记录。哈希用于核对记录身份，不是质量或安全评分。',
  ContextManifest: '上下文清单：对这次判断所使用的目标观测及时间范围的精确记录。',
  QualifiedKnowledge: '合格知识：已在 ADR 既有资格流程中具备限定用途的知识；不表示适用于每块田。',
  ScientificUseStatus: '科学用途状态：针对给定用途的知识资格状态；必须同时阅读目标适用性、来源和限制。',
  TransportStatus: '适用性条件状态：反映知识与目标条件的匹配/缺口等情况；不是交通运输状态。',
  UNKNOWN: '未知：当前数据没有可据以作出结论的可靠信息，不应补写默认值。',
  UNAVAILABLE: '不可用：当前界面或授权接口不提供这项能力；不代表科学上不存在该对象。',
  ReviewFeedback: '人工反馈：独立的非权威产品记录，不修改 ADR 原始科学评估。',
  DecisionProblem: '决策问题：包括田块、季节、用途、时间和待决动作空间的正式问题定义。'
});
export function classificationExplanation(code) {
  return CLASSIFICATION_EXPLANATIONS[code] ?? {
    label: '需要查看原始分类代码',
    next: '此代码暂无产品层解释，请阅读完整 ADR 回执；不得推断其科学含义。'
  };
}
export function statusExplanation(code) {
  if (code === 'UNKNOWN' || code == null) return '状态未知，请核查原始证据。';
  if (code === 'UNAVAILABLE') return '当前未提供该能力或数据，不能据此得出科学结论。';
  if (code === 'CONFIRMED') return '评估写入和对应 Workbench 读取均已确认；不表示可以执行农业作业。';
  if (code === 'REJECTED') return '该操作已被明确拒绝；查看原始错误代码和下一步提示。';
  if (code === 'UNKNOWN_OUTCOME') return '无法确认写入是否生效；保留原操作编号，恢复连接后先核对，禁止新建身份重试。';
  if (code === 'WRITE_CONFIRMED_READ_PENDING') return '写入已得到确认，但案件详情尚未读取成功；保留原操作编号继续核对。';
  if (code === 'IN_PROGRESS' || code === 'PREPARED' || code === 'SUBMITTED')
    return '尚未收到完整终态回执；不能当作成功或失败。';
  return '当前状态须结合原始代码、证据和权限边界判断。';
}
export function reviewTimingLabel(review) {
  if (!review || review.reviewDurationStatus !== 'MEASURED' ||
      typeof review.durationMs !== 'number' || !Number.isFinite(review.durationMs) ||
      review.durationMs < 0) return '未知（没有可验证的独立复核开始事件）';
  const sec = Math.round(review.durationMs / 1000);
  if (sec < 60) return sec + ' 秒';
  return Math.floor(sec / 60) + ' 分 ' + (sec % 60) + ' 秒';
}
export function textAvailability(v) {
  return v == null ? '未提供 / UNKNOWN' : String(v);
}

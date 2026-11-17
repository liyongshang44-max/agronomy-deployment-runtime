// Product-only fictional content. No object in this module is an ADR authority fact.
export const DEMO_CLASSIFICATIONS = Object.freeze([
  'NO_REVIEW_CANDIDATE',
  'AGRONOMIST_REVIEW_REQUIRED',
  'CONTEXT_GAP',
  'KNOWLEDGE_CONFLICT',
  'CALIBRATION_NEEDED',
  'GOVERNED_TRANSFORM_NEEDED'
]);

const descriptions = Object.freeze({
  NO_REVIEW_CANDIDATE: '演示分支：没有触发本次样例中的人工复核条件；不代表安全、正确或允许执行。',
  AGRONOMIST_REVIEW_REQUIRED: '演示分支：需要专业农艺师审查相关条件和来源限制。',
  CONTEXT_GAP: '演示分支：生育阶段被明确记录为 UNKNOWN，信息不足。',
  KNOWLEDGE_CONFLICT: '演示分支：预置样例包含两项相互冲突的知识条件。',
  CALIBRATION_NEEDED: '演示分支：预置样例缺少可验证的测量校准信息。',
  GOVERNED_TRANSFORM_NEEDED: '演示分支：预置样例的测量表达需要受治理的转换。'
});

export const DEMO_CASES = Object.freeze(DEMO_CLASSIFICATIONS.map((classification, index) => {
  const number = String(index + 1).padStart(3, '0');
  return Object.freeze({
    id: 'DEMO-' + number,
    synthetic: true,
    authoritative: false,
    classification,
    reviewRequired: classification !== 'NO_REVIEW_CANDIDATE',
    decisionProblem: '示例：判断一项研究主张是否适用于目标田块',
    crop: '示例作物（合成）',
    stage: classification === 'CONTEXT_GAP' ? 'UNKNOWN' : '示例阶段',
    region: '虚构试点区域',
    observedAt: null,
    evidenceCutoff: null,
    assessmentAuthorityRef: null,
    projectionHash: null,
    source: {
      title: '合成来源记录（非真实论文）',
      version: 'demo',
      sourceLocator: null,
      originalTextAvailable: false,
      qualifiedKnowledgeRef: null
    },
    reason: descriptions[classification],
    limitations: [
      '该页面展示的是静态合成 UI 测试资料，未执行 ADR 科学适用性计算。',
      '没有正式 AuthorityRef、来源哈希、科学资格或客户授权。'
    ]
  });
}));

export function demoCaseById(id) {
  return DEMO_CASES.find((item) => item.id === id) ?? null;
}

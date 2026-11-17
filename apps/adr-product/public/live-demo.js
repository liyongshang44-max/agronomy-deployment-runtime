import { contextCard, sourceCard, resultCard } from './assessment-view.js';
// Browser UI for the real ADR v0.3 synthetic world.
// All actual scientific values displayed below come from the ADR Host, never from UI classification rules.
const jsonText = (value) => JSON.stringify(value, null, 2);
const refLabel = (ref = {}) => [
  ref.kind ?? 'UNKNOWN', ref.logicalId ?? ref.logical_id ?? 'UNKNOWN',
  ref.version ?? 'UNKNOWN', ref.semanticHash ?? ref.semantic_hash ?? 'UNKNOWN'
].join(' / ');
const OUTCOMES = [
  'CONFIRMED_CLASSIFICATION', 'REVIEWER_DISAGREED',
  'CONTEXT_REQUESTED', 'AUTHORITY_ACTION_PERFORMED', 'DEFERRED'
];

export async function renderLiveReviews({shell, json, escapeHtml, status}) {
  await json('/api/demo/session');
  const cases = await json('/api/workbench/escalations');
  shell('专家复核', '实时读取真正的 ADR Pilot Host Workbench HTTP 接口（隔离合成世界）。',
    '<section class="panel"><div class="sectionhead"><h2>待复核案件</h2>' +
    '<span class="muted">' + cases.length + ' 条 Host 投影</span></div>' +
    '<p class="muted">此接口只返回需要复核的案件，不代表所有历史 Assessment。</p>' +
    cases.map((item, index) => {
      const ref = item.applicability?.applicabilityAssessmentRef;
      return '<div class="case-row"><div><strong>' + escapeHtml(refLabel(ref)) + '</strong>' +
        '<span class="muted">投影哈希：' + escapeHtml(item.projectionHash) + '</span></div>' +
        '<div>' + status(item.classification) +
        '<button type="button" class="print-button" data-host-index="' + index + '">阅读依据</button></div></div>';
    }).join('') +
    '<div id="host-case-detail" aria-live="polite"></div></section>');
  document.querySelectorAll('[data-host-index]').forEach((button) => {
    button.addEventListener('click', async () => {
      const c = cases[Number(button.dataset.hostIndex)];
      const ref = c.applicability?.applicabilityAssessmentRef;
      const id = ref.logicalId ?? ref.logical_id;
      const target = document.getElementById('host-case-detail');
      try {
        const full = await json('/api/workbench/cases/' + encodeURIComponent(id));
        target.innerHTML = '<h2>已读取案件详情</h2><pre class="evidence-json">' +
          escapeHtml(jsonText({
            assessmentRef: full.applicability.applicabilityAssessmentRef,
            classification: full.classification, why: full.why,
            scientificEvidence: full.scientificEvidence, targetContext: full.targetContext,
            applicability: full.applicability
          })) + '</pre>';
      } catch (e) { target.textContent = '案件无法读取：' + e.message; }
    });
  });
}

export async function renderLiveAssessment({shell, json, escapeHtml, status, cell}) {
  const session = await json('/api/demo/session');
  const scenario = await json('/api/demo/scenario');
  const sample = scenario.sampleCase;
  shell('适用性评估', '真实 Pilot Host 的 ApplicabilityAssessment 写入及 Workbench 读取；使用现有合格合成世界。',
    '<section class="panel"><div class="sectionhead"><h2>已合格演示世界</h2>' +
    '<span class="status">真实 Host HTTP</span></div>' +
    '<p>当前仅使用 ADR 已建立的合成知识、ContextManifest、KnowledgeRetrievalResult 和测试授权。浏览器不选择 ADR Principal、凭据或科学资格。</p>' +
    '<div class="fact-grid">' +
    cell('已有基线评估', refLabel(sample.applicability?.applicabilityAssessmentRef)) +
    cell('知识引用', refLabel(sample.scientificEvidence?.knowledgeRef)) +
    cell('科学使用状态', sample.applicability?.scientificUseStatus ?? 'UNKNOWN') +
    cell('基线 Workbench 分类', sample.classification) +
    '</div></section>' +
    contextCard(sample.targetContext, escapeHtml) +
    sourceCard(sample.scientificEvidence, escapeHtml) +
    '<section class="panel"><h2>实际执行</h2><p>每次明确触发后生成新的评估逻辑 ID，BFF 固定全部已授权证据引用。发生超时后仅允许使用同一操作 ID 重新核对。</p>' +
    '<div class="confirmation"><label><input type="checkbox" id="confirm-context"> 已核对当前合成目标上下文、时间和测量来源</label>' +
    '<label><input type="checkbox" id="confirm-knowledge"> 已核对知识引用、原始主张及使用限制</label></div>' +
    '<button type="button" class="primary-link" id="live-run" disabled>运行 ADR 适用性评估</button>' +
    '<p class="muted">这是隔离测试世界的真实科学计算，不是正式客户的科学授权或农业执行指令。</p></section>' +
    '<div id="live-result" aria-live="polite"></div>');

  const show = (result) => {
    const target = document.getElementById('live-result');
    if (!target) return;
    if (result.state !== 'CONFIRMED' || !result.workbenchCase) {
      target.innerHTML = '<section class="panel"><h2>执行状态：' + escapeHtml(result.state) +
        '</h2><p>原因：' + escapeHtml(result.failureCode ?? '尚未完成') +
        '</p><p>如结果不确定，再次点击运行将使用同一个 operationId / Idempotency-Key。</p></section>';
      return;
    }
    const c = result.workbenchCase;
    target.innerHTML = '<section class="panel"><div class="sectionhead"><h2>实际 ADR 评估结果</h2>' +
      status(c.classification) + '</div>' +
      '<p class="muted">下列数据直接来自新创建的 ApplicabilityAssessment 及其 Workbench 投影。</p>' +
      '<div class="fact-grid">' +
      cell('AuthorityRef', refLabel(result.assessmentRef)) +
      cell('Workbench Projection Hash', c.projectionHash) +
      cell('Transport Status', c.applicability?.transportStatus) +
      cell('Scientific Use Status', c.applicability?.scientificUseStatus) + '</div>' +
      resultCard(c, escapeHtml) +
      sourceCard(c.scientificEvidence, escapeHtml) +
      '<details class="technical-detail"><summary>查看完整原始 Workbench 证据</summary>' +
      '<pre class="evidence-json">' + escapeHtml(jsonText({
        why: c.why, scientificEvidence: c.scientificEvidence,
        targetContext: c.targetContext, applicability: c.applicability
      })) + '</pre></details></section>' +
      '<section class="panel"><h2>非权威人工复核</h2>' +
      '<p>反馈只存储在独立产品记录中，不改变 ADR ApplicabilityAssessment。</p>' +
      '<label class="review-input">复核结论<select id="live-outcome">' +
      OUTCOMES.map((o) => '<option>' + o + '</option>').join('') + '</select></label>' +
      '<label class="review-input">备注<textarea id="live-notes" maxlength="2000" rows="4" placeholder="说明复核依据和需补充的材料"></textarea></label>' +
      '<div class="quick"><button type="button" id="live-review" class="primary-link">保存复核反馈</button>' +
      '<a href="/api/demo/reports/' + encodeURIComponent(result.operationId) +
      '" id="live-report">导出含证据的 HTML 报告</a></div>' +
      '<div id="review-feedback" role="status"></div></section>';
    document.getElementById('live-review').addEventListener('click', async () => {
      const button = document.getElementById('live-review');
      button.disabled = true;
      try {
        const response = await fetch('/api/demo/reviews/' + encodeURIComponent(result.operationId), {
          method: 'POST',
          headers: { 'content-type': 'application/json', 'x-csrf-token': session.csrf },
          body: JSON.stringify({
            outcome: document.getElementById('live-outcome').value,
            notes: document.getElementById('live-notes').value
          })
        });
        const record = await response.json();
        if (!response.ok) throw new Error(record.code ?? 'UNKNOWN_FEEDBACK_OUTCOME');
        document.getElementById('review-feedback').textContent =
          '非权威复核已保存，绑定投影：' + record.caseProjectionHash;
      } catch (e) {
        document.getElementById('review-feedback').textContent =
          '复核尚未确认保存：' + e.message;
        button.disabled = false;
      }
    });
    json('/api/demo/reviews/' + encodeURIComponent(result.operationId))
      .then((r) => {
        const view = document.getElementById('review-feedback');
        if (view) view.textContent = '此前已保存：' + r.outcome;
        const btn = document.getElementById('live-review');
        if (btn) btn.disabled = true;
      }).catch(() => {});
  };

  const contextAck = document.getElementById('confirm-context');
  const knowledgeAck = document.getElementById('confirm-knowledge');
  const runButton = document.getElementById('live-run');
  const updateReady = () => { runButton.disabled = !(contextAck.checked && knowledgeAck.checked); };
  contextAck.addEventListener('change', updateReady);
  knowledgeAck.addEventListener('change', updateReady);

  const operation = sessionStorage.getItem('adr-product-demo-operation');
  if (operation) {
    try { show(await json('/api/demo/assessments/' + encodeURIComponent(operation))); } catch {}
  }
  document.getElementById('live-run').addEventListener('click', async () => {
    const button = document.getElementById('live-run');
    button.disabled = true;
    let id = sessionStorage.getItem('adr-product-demo-operation');
    if (id) {
      try {
        const old = await json('/api/demo/assessments/' + encodeURIComponent(id));
        if (old.state === 'CONFIRMED' || old.state === 'REJECTED') id = null;
      } catch { id = null; }
    }
    if (!id) {
      id = crypto.randomUUID();
      sessionStorage.setItem('adr-product-demo-operation', id);
    }
    try {
      const response = await fetch('/api/demo/assessments', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-csrf-token': session.csrf },
        body: JSON.stringify({ operationId: id })
      });
      const result = await response.json();
      if (!response.ok && response.status !== 202) throw new Error(result.code ?? 'RUN_UNCONFIRMED');
      show(result);
    } catch (e) {
      document.getElementById('live-result').innerHTML =
        '<section class="panel"><h2>提交结果不确定</h2><p>' + escapeHtml(e.message) +
        '</p><p>原操作 ID：' + escapeHtml(id) +
        '。不能以新幂等键自动重发。</p></section>';
    } finally { button.disabled = false; }
  });
}

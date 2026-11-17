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
    '<button type="button" class="print-button" id="new-demo-case" disabled>明确开始新案件</button>' +
    '<p class="muted" id="operation-identity-status" role="status">尚未创建本次操作。</p>' +
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
      '<div class="quick"><button type="button" id="begin-review" class="print-button">开始人工复核计时</button>' +
    '<button type="button" id="live-review" class="primary-link" disabled>保存复核反馈</button>' +
      '<a href="/api/demo/reports/' + encodeURIComponent(result.operationId) +
      '" id="live-report">导出含证据的 HTML 报告</a></div>' +
      '<div id="review-feedback" role="status"></div></section>';
    const startButton = document.getElementById('begin-review');
    const saveButton = document.getElementById('live-review');
    const startUrl = '/api/demo/reviews/' + encodeURIComponent(result.operationId) + '/start';
    const markStarted = (record) => {
      if (!record?.startedAt) return;
      startButton.disabled = true;
      saveButton.disabled = false;
      document.getElementById('review-feedback').textContent =
        '复核开始时间：' + record.startedAt + '（与评估创建时间分离）';
    };
    startButton.addEventListener('click', async () => {
      startButton.disabled = true;
      try {
        const response = await fetch(startUrl, {
          method: 'POST',
          headers: { 'x-csrf-token': session.csrf }
        });
        const data = await response.json();
        if (!response.ok || !data.startedAt) throw new Error(data.code ?? 'REVIEW_START_UNCONFIRMED');
        markStarted(data);
      } catch (error) {
        document.getElementById('review-feedback').textContent =
          '复核开始事件尚未确认；不可计算复核时长：' + error.message;
        startButton.disabled = false;
      }
    });
    json(startUrl).then(markStarted).catch(() => {});
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
          '非权威复核已保存，复核时长：' +
          (record.reviewDurationStatus === 'MEASURED' ? record.durationMs + ' 毫秒' : 'UNKNOWN') +
          '，绑定投影：' + record.caseProjectionHash;
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

  // Once created, an operation identity is retained until the user explicitly
  // begins a new case from a known terminal state. A failed GET never
  // permits a replacement request identity.
  const key = 'adr-product-demo-operation';
  const identityStatus = document.getElementById('operation-identity-status');
  const newCase = document.getElementById('new-demo-case');
  let terminal = false;
  const noteIdentity = (id, message) => {
    identityStatus.textContent = id ? '原操作 ID：' + id + ' · ' + message : message;
  };
  const showStored = async (id) => {
    try {
      const latest = await json('/api/demo/assessments/' + encodeURIComponent(id));
      show(latest);
      terminal = ['CONFIRMED', 'REJECTED'].includes(latest.state);
      newCase.disabled = !terminal;
      noteIdentity(id, terminal ? '已确认终态；可以明确开始新案件' : '未终态；保持精确幂等身份');
      return latest;
    } catch (error) {
      terminal = false;
      newCase.disabled = true;
      noteIdentity(id, '状态读取失败，未更换身份；等待核对原请求');
      document.getElementById('live-result').innerHTML =
        '<section class="panel"><h2>原操作状态暂不可核对</h2><p>' +
        escapeHtml(error.message) + '</p><p>已保留操作 ID：' + escapeHtml(id) +
        '。查询失败不能视为新案件授权。</p></section>';
      return null;
    }
  };
  const operation = sessionStorage.getItem(key);
  if (operation) await showStored(operation);
  newCase.addEventListener('click', () => {
    if (!terminal || !sessionStorage.getItem(key)) return;
    sessionStorage.removeItem(key);
    terminal = false;
    newCase.disabled = true;
    document.getElementById('live-result').replaceChildren();
    noteIdentity(null, '已明确开始新案件；下次执行将取得新的操作 ID');
  });
  document.getElementById('live-run').addEventListener('click', async () => {
    const button = document.getElementById('live-run');
    button.disabled = true;
    try {
      let id = sessionStorage.getItem(key);
      if (id) {
        const old = await showStored(id);
        if (!old) return; // 5xx/invalid JSON/disconnect must not create a new write
        if (terminal) return; // explicit new-case action required
      } else {
        id = crypto.randomUUID();
        sessionStorage.setItem(key, id); // persist exact client identity before write
        noteIdentity(id, '新演示评估，等待真实 Host 回执');
      }
      const response = await fetch('/api/demo/assessments', {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-csrf-token': session.csrf },
        body: JSON.stringify({ operationId: id, scenarioId: 'QUALIFIED_SYNTHETIC_V03' })
      });
      const result = await response.json();
      if (!response.ok && response.status !== 202) throw new Error(result.code ?? 'RUN_UNCONFIRMED');
      show(result);
      terminal = ['CONFIRMED', 'REJECTED'].includes(result.state);
      newCase.disabled = !terminal;
      noteIdentity(id, terminal ? '已确认终态' : '结果尚未终态；保留原身份以核对');
    } catch (error) {
      const id = sessionStorage.getItem(key);
      terminal = false;
      newCase.disabled = true;
      noteIdentity(id, '请求结果不确定；保留同一幂等身份');
      document.getElementById('live-result').innerHTML =
        '<section class="panel"><h2>提交结果不确定</h2><p>' + escapeHtml(error.message) +
        '</p><p>原操作 ID：' + escapeHtml(id ?? '未取得') +
        '。不可自动创建新幂等键。</p></section>';
    } finally { button.disabled = false; }
  });
}

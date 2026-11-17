import { contextCard, sourceCard, resultCard } from './assessment-view.js';
import { TERM_HELP, REVIEW_OUTCOME_LABELS, statusExplanation, classificationExplanation, reviewTimingLabel } from './ux-language.js';
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
  shell('适用性评估', '分四步核对证据，再执行真实 ADR 适用性评估。全部数据来自隔离合成测试世界。',
    '<nav class="ux-step-nav" aria-label="评估步骤">' +
    '<a href="#ux-context">1. 目标信息</a><a href="#ux-source">2. 科学来源</a>' +
    '<a href="#ux-scenario">3. 选择场景</a><a href="#ux-run">4. 核对并运行</a></nav>' +
    '<section class="panel"><div class="sectionhead"><h2>已合格演示世界</h2>' +
    '<span class="status">真实 Host HTTP</span></div>' +
    '<p>当前仅使用 ADR 已建立的合成知识、ContextManifest、KnowledgeRetrievalResult 和测试授权。浏览器不选择 ADR Principal、凭据或科学资格。</p>' +
    '<div class="fact-grid">' +
    cell('已有基线评估', refLabel(sample.applicability?.applicabilityAssessmentRef)) +
    cell('知识引用', refLabel(sample.scientificEvidence?.knowledgeRef)) +
    cell('科学使用状态', sample.applicability?.scientificUseStatus ?? 'UNKNOWN') +
    cell('基线 Workbench 分类', sample.classification) +
    '</div></section>' +
    '<div id="ux-context">' + contextCard(sample.targetContext, escapeHtml) + '</div>' +
    '<div id="ux-source">' + sourceCard(sample.scientificEvidence, escapeHtml) + '</div>' +
    '<section class="panel" id="ux-scenario"><h2>第三步 · 选择合格演示场景</h2>' +
    '<label class="review-input">选择实际可执行场景<select id="selected-scenario" required>' +
    '<option value="">请选择合格演示场景</option>' +
    '<option value="' + escapeHtml(scenario.scenarioId) + '">v0.3 合格合成世界 · ' + escapeHtml(scenario.scenarioId) + '</option>' +
    '<option disabled value="">其他知识/田块组合：UNAVAILABLE（缺少合格接口）</option>' +
    '</select></label><p class="muted">选定场景绑定以下精确输入，而非由浏览器自行签发科学资格：</p>' +
    '<pre class="evidence-json">' + escapeHtml(jsonText({
      knowledgeRef:sample.scientificEvidence?.knowledgeRef,
      contextManifestRef:sample.targetContext?.contextManifestRef,
      decisionProblemRef:sample.targetContext?.decisionProblemRef
    })) + '</pre></section>' +
    '<section class="panel" id="ux-run"><h2>第四步 · 确认并执行</h2>' +
    '<p>确认所选场景、观测时间和科学来源。系统保存精确操作编号；如发生断线，只核对原操作，不自动产生新评估。</p>' +
    '<div class="confirmation"><label><input type="checkbox" id="confirm-context"> 已核对当前合成目标上下文、时间和测量来源</label>' +
    '<label><input type="checkbox" id="confirm-knowledge"> 已核对知识引用、原始主张及使用限制</label></div>' +
    '<button type="button" class="primary-link" id="live-run" disabled aria-describedby="operation-identity-status">执行真实适用性评估</button>' +
    '<button type="button" class="print-button" id="new-demo-case" disabled>明确开始新案件</button>' +
    '<p class="muted" id="operation-identity-status" role="status">尚未创建本次操作。</p>' +
    '<p class="muted">这是隔离测试世界的真实科学计算，不是正式客户的科学授权或农业执行指令。</p></section>' +
    '<div id="live-result" aria-live="polite"></div>');

  const show = (result) => {
    const target = document.getElementById('live-result');
    if (!target) return;
    if (result.state !== 'CONFIRMED' || !result.workbenchCase) {
      target.innerHTML = '<section class="panel ux-state" role="status">' +
        '<h2>执行状态：' + escapeHtml(result.state) + '</h2>' +
        '<p>' + escapeHtml(statusExplanation(result.state)) + '</p>' +
        '<p class="muted">原始原因代码：<code>' + escapeHtml(result.failureCode ?? '未提供') +
        '</code></p><p>当前操作编号：<code>' + escapeHtml(result.operationId ?? 'UNKNOWN') +
        '</code></p><p>再次核对时只会使用原操作及原幂等身份。未确认的结果不得导出为成功报告。</p></section>';
      return;
    }
    const c = result.workbenchCase;
    const interpretation = classificationExplanation(c.classification);
    target.innerHTML = '<section class="panel"><div class="sectionhead"><h2>实际 ADR 评估结果</h2>' +
      status(c.classification) + '</div>' +
      '<p class="muted">已从真实 ADR Pilot Host 取得新评估记录与 Workbench 投影；这不是农业行动许可。</p>' +
      '<p class="ux-guidance"><strong>优先阅读：</strong>' + escapeHtml(interpretation.label) +
      '。' + escapeHtml(interpretation.next) + '</p>' +
      '<div class="fact-grid">' +
      cell('AuthorityRef', refLabel(result.assessmentRef)) +
      cell('Workbench Projection Hash', c.projectionHash) +
      cell('本次选择场景', result.scenarioId) +
      cell('实际输入知识', refLabel(result.inputBinding?.knowledgeRef)) +
      cell('实际 ContextManifest', refLabel(result.inputBinding?.contextManifestRef)) +
      cell('实际检索结果', refLabel(result.inputBinding?.retrievalRef)) +
      cell('Transport Status', c.applicability?.transportStatus) +
      cell('Scientific Use Status', c.applicability?.scientificUseStatus) + '</div>' +
      resultCard(c, escapeHtml) +
      sourceCard(c.scientificEvidence, escapeHtml) +
      '<details class="technical-detail"><summary>查看完整原始 Workbench 证据</summary>' +
      '<pre class="evidence-json">' + escapeHtml(jsonText({
        why: c.why, scientificEvidence: c.scientificEvidence,
        targetContext: c.targetContext, applicability: c.applicability
      })) + '</pre></details></section>' +
      '<section class="panel" id="ux-review"><h2>人工复核与记录</h2>' +
      '<p>先点击“开始人工复核”，阅读结果并记录意见。人工意见只保存于独立产品记录，不更改 ADR 的原始分类或科学资格。</p>' +
      '<details class="term-help"><summary>人工复核是否会修改科学结论？</summary><p>' +
      escapeHtml(TERM_HELP.ReviewFeedback) + '</p></details>' +
      '<label class="review-input">人工意见<select id="live-outcome">' +
      OUTCOMES.map((o) => '<option value="' + o + '">' +
        escapeHtml(REVIEW_OUTCOME_LABELS[o] ?? o) + '</option>').join('') + '</select></label>' +
      '<label class="review-input">复核说明（可注明证据缺口）<textarea id="live-notes" maxlength="2000" rows="4" placeholder="例如：需补充某个观测的时间和测量来源"></textarea></label>' +
      '<div class="quick"><button type="button" id="begin-review" class="print-button">开始人工复核计时</button>' +
    '<button type="button" id="live-review" class="primary-link" disabled>保存复核反馈</button>' +
      '<a href="/api/demo/reports/' + encodeURIComponent(result.operationId) +
      '" id="live-report">导出可追溯报告（HTML）</a></div>' +
      '<div id="review-feedback" role="status"></div></section>';
    const startButton = document.getElementById('begin-review');
    const saveButton = document.getElementById('live-review');
    const startUrl = '/api/demo/reviews/' + encodeURIComponent(result.operationId) + '/start';
    const reviewUrl = '/api/demo/reviews/' + encodeURIComponent(result.operationId);
    const feedbackView = document.getElementById('review-feedback');
    let feedbackSaved = false;
    const currentView = () => feedbackView.isConnected &&
      document.getElementById('review-feedback') === feedbackView;
    const showSaved = (record, restored = false) => {
      if (!currentView()) return;
      feedbackSaved = true;
      startButton.disabled = true;
      saveButton.disabled = true;
      feedbackView.textContent = restored ? '此前已保存：' + record.outcome +
        '（' + (REVIEW_OUTCOME_LABELS[record.outcome] ?? '请核查原始代码') + '）' :
        '非权威复核已保存，耗时：' + reviewTimingLabel(record) +
        '，绑定投影：' + record.caseProjectionHash;
    };
    const markStarted = (record) => {
      if (!currentView() || feedbackSaved || !record?.startedAt) return;
      startButton.disabled = true;
      saveButton.disabled = false;
      feedbackView.textContent =
        '复核开始时间：' + record.startedAt + '（仅从此事件开始计时，不包含评估执行及等待）';
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
        showSaved(record);
      } catch (e) {
        document.getElementById('review-feedback').textContent =
          '复核尚未确认保存：' + e.message;
        button.disabled = false;
      }
    });
    // Rehydrate both endpoints as a single state transition. Previously these
    // independent promises raced: the later review-start GET could overwrite a
    // persisted "already saved" receipt and re-enable submission.
    Promise.allSettled([json(startUrl), json(reviewUrl)]).then(([started, saved]) => {
      if (!currentView() || feedbackSaved) return;
      if (saved.status === 'fulfilled') {
        showSaved(saved.value, true);
      } else if (started.status === 'fulfilled') {
        markStarted(started.value);
      }
    });
  };

  const contextAck = document.getElementById('confirm-context');
  const knowledgeAck = document.getElementById('confirm-knowledge');
  const selectedScenario = document.getElementById('selected-scenario');
  const runButton = document.getElementById('live-run');
  const updateReady = () => {
    runButton.disabled = !(contextAck.checked && knowledgeAck.checked
      && selectedScenario.value === scenario.scenarioId);
  };
  contextAck.addEventListener('change', updateReady);
  knowledgeAck.addEventListener('change', updateReady);
  selectedScenario.addEventListener('change', updateReady);

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
      noteIdentity(id, '状态暂时无法读取；原操作编号和幂等身份保持不变');
      document.getElementById('live-result').innerHTML =
        '<section class="panel"><h2>原操作状态暂不可核对</h2><p>' +
        escapeHtml(error.message) + '</p><p>已保留操作 ID：' + escapeHtml(id) +
        '。请检查连接并再次点击“执行真实适用性评估”核对同一操作；查询失败不允许新建案件。</p></section>';
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
        body: JSON.stringify({ operationId: id, scenarioId: selectedScenario.value })
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
      noteIdentity(id, '写入结果尚未确认；保持同一操作编号，先核对状态');
      document.getElementById('live-result').innerHTML =
        '<section class="panel"><h2>提交结果不确定</h2><p>' + escapeHtml(error.message) +
        '</p><p>原操作 ID：' + escapeHtml(id ?? '未取得') +
        '。网络恢复后先核对原操作；不可自动创建新幂等键。</p></section>';
    } finally { button.disabled = false; }
  });
}

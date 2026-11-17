import { contextCard, sourceCard, resultCard } from './assessment-view.js';
import { classificationExplanation } from './ux-language.js';
import {renderSourceIntake} from './source-intake.js';
import { renderLiveAssessment, renderLiveReviews } from './live-demo.js';
// ADR-PROD product shell. DEMO cases are synthetic illustrations, never scientific outcomes.
const app = document.getElementById('app');
const nav = [
  ['/', '总览', '◫'],
  ['/knowledge', '农艺知识', '▤'],
  ['/context', '目标上下文', '◈'],
  ['/assessments', '适用性评估', '◎'],
  ['/reviews', '专家复核', '▣'],
  ['/reports', '报告', '▥']
];
const classes = {
  NO_REVIEW_CANDIDATE: '无待复核触发项（非安全结论）',
  AGRONOMIST_REVIEW_REQUIRED: '需要农艺师复核',
  CONTEXT_GAP: '目标上下文缺口',
  KNOWLEDGE_CONFLICT: '知识冲突',
  CALIBRATION_NEEDED: '需要测量校准',
  GOVERNED_TRANSFORM_NEEDED: '需要受治理的转换'
};

const escapeHtml = (v) => String(v ?? '').replace(/[&<>"']/g,
  (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]);
const cell = (label, value) => '<div class="fact"><dt>' + escapeHtml(label) + '</dt><dd>' + escapeHtml(value ?? '未提供') + '</dd></div>';
const status = (code) => '<span class="status">' + escapeHtml(classes[code] || code) + '</span>';
const safePath = (path) => nav.some((item) => item[0] === path) || /^\/reviews\/DEMO-[0-9]{3}$/.test(path);
let meta = null;
let cases = null;

async function json(path) {
  let response;
  try {
    response = await fetch(path, { credentials: 'same-origin', cache: 'no-store' });
  } catch {
    throw new Error('网络连接失败；请检查连接。已存在的操作编号不会因为读取失败而更换。');
  }
  let value;
  try {
    value = await response.json();
  } catch {
    throw new Error('服务器返回了无法解析的响应（HTTP ' + response.status +
      '）；请保留当前操作编号并稍后核对。');
  }
  if (!response.ok) {
    const code = String(value?.code ?? 'HTTP_' + response.status);
    throw new Error('请求未完成（HTTP ' + response.status + ' / ' + code +
      '）。请检查当前连接或授权，不应创建替代操作。');
  }
  return value;
}
function link(path, title, className = '') {
  return '<a class="' + className + '" href="' + escapeHtml(path) + '" data-route>' + escapeHtml(title) + '</a>';
}
function shell(title, subtitle, content) {
  const path = location.pathname;
  const active = path.startsWith('/reviews/') ? '/reviews' : path;
  app.innerHTML =
    '<a class="skip-link" href="#main-content">跳转至正文</a>' +
    '<div class="workspace"><aside class="sidebar" aria-label="主导航">' +
    '<div class="brand"><div class="brand-mark">A</div><div><strong>ADR</strong><small>AGRONOMY RUNTIME</small></div></div>' +
    '<div class="side-label">客户工作台</div><nav class="navigation">' +
    nav.map((n) => '<a href="' + n[0] + '" data-route class="navitem ' + (active === n[0] ? 'selected' : '') + '"><span class="navicon">' + n[2] + '</span>' + n[1] + '</a>').join('') +
    '</nav><div class="side-bottom"><div class="mode-dot"></div><span>产品开发预览</span><small>ADR v0.3</small></div></aside>' +
    '<main class="main" id="main-content" tabindex="-1"><header class="topbar"><span>ADR / ' + escapeHtml(title) + '</span>' +
    '<span class="mode-pill">' + (meta?.mode === 'DEMO' ? 'DEMO · 合成资料' : 'PILOT · 未配置') + '</span></header>' +
    '<div class="page"><div class="pageheading"><div><p class="eyebrow">AGRONOMIC APPLICABILITY</p>' +
    '<h1>' + escapeHtml(title) + '</h1><p class="subtitle">' + escapeHtml(subtitle) + '</p></div></div>' +
    '<div class="notice"><strong>演示隔离：</strong>' + (meta?.liveDemoAvailable ? '通过真实 ADR Pilot Host 对合格的合成测试世界执行评估；不是客户数据，也不构成农业行动许可。' : '当前展示的是虚构测试资料，不是 ADR 科学评估、合格知识或真实客户记录。不得据此采取农业行动。') + '</div>' +
    content + '<footer>ADR-PROD · M1 功能实现已接受 · 独立易用性验证进行中 · M2 尚未验收</footer></div></main></div>';
}
const empty = (title, text, action) => '<div class="empty"><div class="empty-icon">◇</div><h2>' +
  escapeHtml(title) + '</h2><p>' + escapeHtml(text) + '</p>' + (action || '') + '</div>';
function counter(label, value, desc) {
  return '<div class="metric"><span>' + escapeHtml(label) + '</span><strong>' + escapeHtml(value) +
    '</strong><small>' + escapeHtml(desc) + '</small></div>';
}
async function renderHome() {
  if (meta.liveDemoAvailable) {
    await json('/api/demo/session');
    const scenario = await json('/api/demo/scenario');
    const assessment = scenario.sampleCase.applicability ?? {};
    shell('总览', '真实 ADR 合成评估环境：从精确科学引用到可复核的客户报告。',
      '<section class="metrics">' +
      counter('合格合成场景', scenario.runnable ? 1 : 0, '由正式 ADR Pilot Host 测试世界提供') +
      counter('基线科学分类', scenario.sampleCase.classification, '直接来自 Host Workbench 投影') +
      counter('客户运行状态', 'DEMO', '生产身份及授权尚未接入') +
      '</section><section class="split"><div class="panel"><h2>执行一条可追溯的评估</h2>' +
      '<p>在真实测试世界核对目标观测、知识来源和使用限制，提交新的 ApplicabilityAssessment，完成复核并导出报告。</p>' +
      '<div class="quick">' + link('/assessments','进入评估向导','primary-link') +
      link('/knowledge','核对科学来源') + '</div></div>' +
      '<div class="panel"><h2>演示世界边界</h2><dl class="fact-grid">' +
      cell('基线 AuthorityRef', scenario.sampleCase.applicability?.applicabilityAssessmentRef?.logicalId) +
      cell('使用状态', assessment.scientificUseStatus) +
      cell('Workbench 投影哈希', scenario.sampleCase.projectionHash) +
      '</dl></div></section>');
    return;
  }
  const review = cases.filter((c) => c.reviewRequired).length;
  shell('总览', '从可追溯的科学证据到受治理的适用性复核。',
    '<section class="metrics">' +
    counter('演示案件', cases.length, '仅合成测试资料') +
    counter('示例待复核', review, '不代表真实业务积压') +
    counter('真实客户数据', '0', '尚未接入正式身份') +
    '</section><section class="split"><div class="panel"><div class="sectionhead"><h2>工作台入口</h2>' +
    link('/reviews', '查看演示案件 →') + '</div><p>按 ADR 原始分类展示复核原因、目标上下文、知识来源和限制。</p>' +
    '<div class="quick">' + link('/reviews', '打开专家复核', 'primary-link') + link('/assessments', '适用性评估') +
    '</div></div><div class="panel"><h2>当前产品边界</h2><ul class="bullets"><li>ADR Core v0.3 语义保持冻结</li>' +
    '<li>产品层不签发身份或科学资格</li><li>正式 Host 接线由独立授权接口完成</li></ul></div></section>');
}
function caseRow(c) {
  return '<a class="case-row" data-route data-case-row data-class="' + escapeHtml(c.classification) +
    '" data-search="' + escapeHtml((c.id + ' ' + c.classification + ' ' + c.decisionProblem).toLowerCase()) +
    '" href="/reviews/' + encodeURIComponent(c.id) + '"><div><strong>' + escapeHtml(c.id) +
    '</strong><span class="muted">' + escapeHtml(c.decisionProblem) + '</span></div>' +
    '<div>' + status(c.classification) + '</div><span class="chevron">›</span></a>';
}
function bindReviewFilters() {
  const filter = document.getElementById('case-filter');
  const query = document.getElementById('case-search');
  if (!filter || !query) return;
  const update = () => {
    const q = query.value.trim().toLowerCase();
    let count = 0;
    document.querySelectorAll('[data-case-row]').forEach((row) => {
      const visible = (filter.value === 'ALL' || row.dataset.class === filter.value) &&
        (row.dataset.search || '').includes(q);
      row.hidden = !visible;
      if (visible) count++;
    });
    document.getElementById('filter-count').textContent = count + ' 条合成案例';
  };
  filter.addEventListener('change', update);
  query.addEventListener('input', update);
}
async function renderReviews() {
  if (meta.liveDemoAvailable) return await renderLiveReviews({shell, json, escapeHtml, status, cell});
  shell('专家复核', '按原始 ADR 分类阅读案件。所有条目仅供界面交互验证。',
    '<section class="panel"><div class="sectionhead"><h2>案件队列</h2><span id="filter-count" class="muted">' +
    cases.length + ' 条合成案例</span></div><div class="filters"><label>分类筛选<select id="case-filter"><option value="ALL">所有分类</option>' +
    Object.keys(classes).map((c) => '<option value="' + c + '">' + escapeHtml(classes[c]) + '</option>').join('') +
    '</select></label><label>查找演示案件<input id="case-search" type="search" placeholder="输入编号或关键字"></label></div>' +
    '<div class="case-list">' + cases.map(caseRow).join('') + '</div></section>');
  bindReviewFilters();
}
function renderCase(c) {
  shell('案件 ' + c.id, '查看原始分类、复核原因与来源可用性。',
    '<div class="breadcrumbs">' + link('/reviews', '← 返回专家复核') + '</div>' +
    '<section class="panel"><div class="sectionhead"><h2>适用性分类</h2>' + status(c.classification) +
    '</div><p class="reason">' + escapeHtml(c.reason) + '</p>' +
    '<div class="fact-grid">' + cell('演示案件编号', c.id) + cell('原始分类代码', c.classification) +
    cell('需要复核', c.reviewRequired ? '是' : '否') + cell('正式 Assessment 引用', '不存在（演示）') +
    '</div></section><section class="split"><div class="panel"><h2>目标上下文</h2><dl class="fact-grid">' +
    cell('决策问题', c.decisionProblem) + cell('作物', c.crop) +
    cell('生育阶段', c.stage) + cell('空间范围', c.region) +
    cell('观测时间', c.observedAt) + cell('证据截止时间', c.evidenceCutoff) +
    '</dl></div><div class="panel"><h2>来源及科学资格</h2><dl class="fact-grid">' +
    cell('来源', c.source.title) + cell('版本', c.source.version) +
    cell('原文预览', '无授权原文') + cell('QualifiedKnowledge 引用', '未建立') +
    '</dl></div></section><section class="panel"><h2>适用性限制</h2>' +
    '<ul class="bullets">' + c.limitations.map((x) => '<li>' + escapeHtml(x) + '</li>').join('') + '</ul>' +
    '<p class="muted">人工复核反馈与报告的持久化正在 ADR-PROD-06 施工范围内；当前界面不伪造保存成功。</p></section>');
}
async function renderKnowledge() {
  if (meta.liveDemoAvailable) return await renderSourceIntake({shell, json, escapeHtml});
  shell('农艺知识', '查看来源、资格与使用边界。',
    empty('尚无正式知识目录',
      '当前 Public API 未提供授权知识目录。产品组将对接 WP 提供的已授权目录；不会将上传成功等同于知识已资格化。',
      link('/reviews', '查看合成案例来源', 'primary-link')));
}
async function renderContext() {
  if (meta.liveDemoAvailable) {
    await json('/api/demo/session');
    const scenario=await json('/api/demo/scenario');
    shell('目标上下文', '以真实 ADR Host Workbench 投影核对农业观测的支持范围及原始引用。',
      contextCard(scenario.sampleCase.targetContext, escapeHtml) +
      '<section class="panel"><p class="muted">该页面只读。新 ContextDatum、ContextManifest 和测量语义不得由产品自行创造；当前向导使用已合格的精确合成输入。</p>' +
      link('/assessments', '进入适用性评估', 'primary-link') + '</section>');
    return;
  }
  shell('目标上下文', '组织作物、阶段、空间、测量与时间证据。',
    empty('正式上下文提交尚未启用',
      '向导必须先获得正确的 ADR 主体、授权决定及精确来源引用。缺失值将明确保留 UNKNOWN。',
      link('/reviews', '查看案例上下文结构', 'primary-link')));
}
async function renderAssessments() {
  if (meta.liveDemoAvailable) return await renderLiveAssessment({shell, json, escapeHtml, status, cell});
  shell('适用性评估', '从决策问题到受治理的知识适用性判断。',
    '<div class="steps">' + ['定义决策问题', '填写目标上下文', '选择已获资格知识', '核对资料', '提交评估', '阅读复核原因']
      .map((item, i) => '<div class="step"><b>' + (i + 1) + '</b><span>' + item + '</span></div>').join('') +
    '</div>' + empty('正式评估向导尚未接线',
      'ADR-PROD-04 将使用冻结的七个写入合同。当前仅展示流程设计，不会模拟一次已获科学授权的评估。',
      link('/reviews', '查看界面演示结果', 'primary-link')));
}
async function renderReports() {
  if (meta.liveDemoAvailable) {
    await json('/api/demo/session');
    const id=sessionStorage.getItem('adr-product-demo-operation');
    if (!id) {
      shell('报告','真实 ADR 评估与客户可追溯报告。',
        empty('尚无本次会话的演示评估',
          '先在评估向导运行实际 ADR ApplicabilityAssessment，然后从此处导出报告。',
          link('/assessments','进入评估向导','primary-link')));
      return;
    }
    try {
      const outcome=await json('/api/demo/assessments/'+encodeURIComponent(id));
      const c=outcome.workbenchCase;
      if (outcome.state !== 'CONFIRMED' || !c) {
        shell('报告','报告生成必须依赖已确认的精确评估。',
          '<section class="panel"><h2>原操作尚未确认</h2>' +
          '<p>操作 ID：'+escapeHtml(id)+'</p><p>状态：'+escapeHtml(outcome.state)+
          '。在结果未确认之前不导出伪科学报告。</p></section>');
        return;
      }
      const explanation=classificationExplanation(c.classification);
      shell('报告','先理解农业问题与科学证据，再下载保留精确引用的完整报告。',
        '<section class="panel"><h2>本次合成农业问题</h2>' +
        '<p>田块：'+escapeHtml(c.targetContext?.targetRef?.fieldId ?? 'UNKNOWN')+
        ' · 农业决策问题：'+escapeHtml(c.targetContext?.decisionType ?? 'UNKNOWN')+
        ' · 证据截止：'+escapeHtml(c.targetContext?.evidenceCutoff ?? 'UNKNOWN')+'</p>' +
        '<h2>分类与结论边界</h2><p class="ux-guidance"><strong>'+
        escapeHtml(explanation.label)+'</strong>：'+escapeHtml(explanation.next)+'</p>' +
        '<p>未触发人工复核，不代表农业操作安全、建议有效或允许执行。</p>' +
        '<a href="/api/demo/reports/'+encodeURIComponent(id)+
        '" id="reports-export" class="primary-link">下载完整科学证据报告（HTML）</a></section>'+
        sourceCard(c.scientificEvidence,escapeHtml,{
          applicability:c.applicability,heading:'同源科学知识 · 报告预览'
        })+
        '<section class="panel"><h2>目标适用性与复核条件</h2>'+
        resultCard(c,escapeHtml)+'</section>'+
        '<details class="technical-detail"><summary>查看报告的审计引用与原始分类</summary>'+
        '<dl class="fact-grid">'+
        cell('操作 ID',id)+
        cell('评估 AuthorityRef',JSON.stringify(outcome.assessmentRef))+
        cell('Workbench 投影哈希',c.projectionHash)+
        cell('ADR 原始分类',c.classification)+'</dl></details>');
    } catch (error) {
      shell('报告','暂时无法核对原操作，不生成其他身份或伪造报告。',
        '<section class="panel"><h2>待核对</h2><p>原操作 ID：'+escapeHtml(id)+'</p><p>'+
        escapeHtml(error.message)+'</p></section>');
    }
    return;
  }
  shell('报告', '保留引用、来源和限制，输出可阅读的客户资料。',
    '<section class="panel"><div class="sectionhead"><h2>合成数据概览</h2>' +
    '<button type="button" id="print-report" class="print-button">打印页面</button></div>' +
    '<p class="muted">打印仅生成浏览器视图；正式的案件报告及使用指标仍待 ADR-PROD-06 接线。</p>' +
    '<div class="report-table"><table><thead><tr><th>案例</th><th>分类</th><th>复核</th></tr></thead><tbody>' +
    cases.map((c) => '<tr><td>' + escapeHtml(c.id) + '</td><td>' + escapeHtml(classes[c.classification]) +
      '</td><td>' + (c.reviewRequired ? '是' : '否') + '</td></tr>').join('') +
    '</tbody></table></div></section>');
  document.getElementById('print-report').addEventListener('click', () => window.print());
}
function showFailure(message) {
  app.innerHTML = '<div class="fatal" role="alert"><h1>暂时无法读取当前页面</h1><p>' +
    escapeHtml(message) +
    '</p><p>不会通过演示身份回退到正式客户运行。刷新前请保存当前操作编号。</p>' +
    '<button type="button" class="primary-link" id="retry-product-read">重新读取当前页面</button></div>';
  document.getElementById('retry-product-read').addEventListener('click', () => { void render(); });
}
async function render() {
  const path = location.pathname;
  if (!safePath(path)) {
    history.replaceState(null, '', '/');
    return render();
  }
  try {
    meta = await json('/api/meta');
    if (meta.mode !== 'DEMO' || meta.dataOrigin !== 'SYNTHETIC_DEMO_ONLY') {
      return showFailure('正式客户模式尚未配置已验证的身份与授权接口。');
    }
    cases = await json('/api/cases');
    if (path === '/') return await renderHome();
    if (path === '/knowledge') return await renderKnowledge();
    if (path === '/context') return await renderContext();
    if (path === '/assessments') return await renderAssessments();
    if (path === '/reviews') return await renderReviews();
    if (path === '/reports') return await renderReports();
    const id = decodeURIComponent(path.split('/')[2] || '');
    const found = cases.find((x) => x.id === id);
    if (found) return renderCase(found);
    return showFailure('案件不存在或不可访问。');
  } catch (cause) {
    showFailure(cause.message);
  }
}
document.addEventListener('click', (event) => {
  const anchor = event.target.closest('a[data-route]');
  if (!anchor || event.defaultPrevented || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  event.preventDefault();
  const next = new URL(anchor.href);
  if (next.origin !== location.origin || !safePath(next.pathname)) return;
  history.pushState(null, '', next.pathname);
  void render().then(() => document.getElementById('main-content')?.focus({preventScroll:true}));
  window.scrollTo(0, 0);
});
window.addEventListener('popstate', render);
render();

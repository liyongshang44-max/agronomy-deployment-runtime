// Actual Chromium browser acceptance: user flow against real ADR v0.3 Host HTTP.
// Evidence is a qualified synthetic DEMO, not M1 or M2 production qualification.
import assert from 'node:assert/strict';
import { mkdir, readFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import { createDemoHarness } from '../src/demo-harness.mjs';
import { createProductServer } from '../src/server.mjs';

const evidenceDir = new URL('../browser-evidence/', import.meta.url);
await mkdir(evidenceDir, { recursive: true });
const harness = await createDemoHarness();
let product;
let browser;
try {
  product = createProductServer({ mode: 'DEMO', demoBinding: harness });
  await new Promise((resolve, reject) => {
    product.once('error', reject);
    product.listen(0, '127.0.0.1', resolve);
  });
  const url = 'http://127.0.0.1:' + product.address().port;
  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    acceptDownloads: true,
    locale: 'zh-CN'
  });
  const page = await context.newPage();
  const pageErrors = [];
  page.on('pageerror', (err) => pageErrors.push(err.message));

  await page.goto(url, { waitUntil: 'networkidle' });
  await page.screenshot({ path: new URL('01-home-desktop.png', evidenceDir).pathname, fullPage: true });

  // UI-01: stress-test an exact long classification code at mobile/tablet/desktop
  // widths. This changes DOM text for layout testing ONLY, not the Host result
  // or any scientific/authority write. The original read model is untouched.
  const originalDashboardClass = await page.locator('.metric strong').nth(1).innerText();
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({width,height:900});
    await page.locator('.metric strong').nth(1).evaluate(el => {
      el.textContent='AGRONOMIST_REVIEW_REQUIRED';
    });
    const measure=await page.evaluate(() => {
      const title=document.querySelectorAll('.metric strong')[1];
      const box=title.getBoundingClientRect();
      return {
        viewport:window.innerWidth,
        pageWidth:document.documentElement.scrollWidth,
        metricWidth:title.parentElement.getBoundingClientRect().width,
        codeWidth:box.width,
        text:title.textContent,
        textScrollWidth:title.scrollWidth,
        codeClientWidth:title.clientWidth
      };
    });
    assert.equal(measure.text,'AGRONOMIST_REVIEW_REQUIRED');
    assert.ok(measure.pageWidth<=measure.viewport+1,
      'UI-01 document overflow with exact classification: '+JSON.stringify(measure));
    assert.ok(measure.textScrollWidth<=measure.codeClientWidth+1,
      'UI-01 classification text overflow: '+JSON.stringify(measure));
  }
  await page.setViewportSize({width:1440,height:900});
  await page.locator('.metric strong').nth(1).evaluate((el,text) => {
    el.textContent=text;
  },originalDashboardClass);

  // Register metadata only: it must remain SUBMITTED/UNAVAILABLE, never science.
  await page.locator('.navigation a[href="/knowledge"]').click();
  await page.locator('text=正式 Host 已可读取的合格演示知识').waitFor();
  await page.locator('#source-intake input[name="title"]').fill('合成候选研究资料');
  await page.locator('#source-intake input[name="owner"]').fill('演示来源所有者');
  await page.locator('#source-intake input[name="version"]').fill('demo-revision-1');
  await page.locator('#source-intake input[name="crop"]').fill('maize');
  await page.locator('#source-intake input[name="region"]').fill('Synthetic region');
  await page.locator('#source-intake input[name="season"]').fill('demo-season');
  await page.locator('#source-intake select[name="rightsBasis"]').selectOption('NOT_PROVIDED');
  await page.locator('#source-intake button[type="submit"]').click();
  await page.locator('text=来源元数据已登记：').waitFor({timeout:15000});
  assert.match(await page.locator('#sources-list').innerText(), /SUBMITTED/);
  assert.match(await page.locator('#sources-list').innerText(), /UNAVAILABLE/);
  await page.screenshot({ path: new URL('01b-knowledge-source-intake.png', evidenceDir).pathname, fullPage: true });

  await page.locator('.navigation a[href="/context"]').click();
  await page.locator('text=第一步 · 核对目标上下文').waitFor();
  assert.match(await page.locator('.science-table').first().innerText(),/ContextManifest/);
  await page.screenshot({ path: new URL('01c-real-target-context.png', evidenceDir).pathname, fullPage: true });

  await page.locator('.navigation a[href="/assessments"]').click();
  await page.locator('text=已合格演示世界').waitFor();
  assert.equal(await page.locator('.ux-step-nav a').count(),4);
  assert.equal(await page.locator('main#main-content').count(),1);
  assert.equal(await page.locator('.skip-link').count(),1);
  assert.match(await page.locator('.term-help summary').first().innerText(),/上下文清单/);
  await page.locator('.term-help summary').first().click();
  assert.match(await page.locator('.term-help').first().innerText(),/上下文清单/);
  assert.equal(await page.locator('#live-run').isDisabled(), true);
  await page.locator('#selected-scenario').selectOption('QUALIFIED_SYNTHETIC_V03');
  await page.locator('#confirm-context').check();
  await page.locator('#confirm-knowledge').check();
  assert.equal(await page.locator('#live-run').isEnabled(), true);
  await page.locator('#live-run').click();
  await page.locator('text=实际 ADR 评估结果').waitFor({ timeout: 45000 });
  const content = await page.locator('#live-result').innerText();
  assert.match(content, /AuthorityRef/);
  assert.match(content, /ApplicabilityAssessment/);
  assert.match(content, /Workbench Projection Hash/);
  assert.match(content, /sha256:/);
  assert.match(content,/如何理解这次分类/);
  assert.match(content,/冲突与限制/);
  assert.match(content,/优先阅读/);
  const originalAssessment = await page.locator('#live-result').innerText();
  await page.screenshot({ path: new URL('02-real-assessment.png', evidenceDir).pathname, fullPage: true });

  // User completes and saves a non-authority review, not a scientific promotion.
  await page.locator('#begin-review').click();
  await page.locator('text=复核开始时间：').waitFor({timeout:15000});
  const actualReviewStartLine=await page.locator('#review-feedback').innerText();
  await page.reload({waitUntil:'networkidle'});
  await page.locator('text=实际 ADR 评估结果').waitFor({timeout:15000});
  await page.locator('text=复核开始时间：').waitFor({timeout:15000});
  assert.equal(await page.locator('#review-feedback').innerText(),actualReviewStartLine);
  assert.equal(await page.locator('#begin-review').isDisabled(),true);
  await page.locator('#live-outcome').selectOption('CONTEXT_REQUESTED');
  await page.locator('#live-notes').fill('Browser-qualified synthetic example, request additional context.');
  await page.locator('#live-review').click();
  await page.locator('text=非权威复核已保存').waitFor({ timeout: 15000 });
  await page.screenshot({ path: new URL('03-review-recorded.png', evidenceDir).pathname, fullPage: true });

  const downloadPromise = page.waitForEvent('download');
  await page.locator('#live-report').click();
  const download = await downloadPromise;
  assert.equal(download.suggestedFilename(), 'adr-demo-report.html');
  assert.ok(!await download.failure());
  const reportHtml=await readFile(await download.path(),'utf8');
  assert.match(reportHtml,/首先阅读 · 这次评估说明了什么/);
  assert.match(reportHtml,/术语与数据限制/);
  assert.match(reportHtml,/人工复核（非权威产品记录）/);

  await page.locator('.navigation a[href="/reports"]').click();
  await page.locator('text=已确认的真实演示报告').first().waitFor();
  assert.equal(await page.locator('#reports-export').count(),1);
  await page.screenshot({ path: new URL('03b-real-reports-page.png', evidenceDir).pathname,fullPage:true });
  await page.locator('.navigation a[href="/assessments"]').click();
  await page.locator('text=实际 ADR 评估结果').waitFor();

  // Reproduce the observed race: review-feedback GET returns before the
  // review-start GET. Persisted "already saved" status must always win.
  const persistedOperationId=await page.evaluate(() => sessionStorage.getItem('adr-product-demo-operation'));
  let delayedStartRequests=0;
  await page.route('**/api/demo/reviews/' + persistedOperationId + '/start', async (route) => {
    delayedStartRequests+=1;
    await new Promise((resolve) => setTimeout(resolve, 300));
    return route.continue();
  });
  // The page must recover exact operation references from the same demo session.
  await page.reload({ waitUntil: 'networkidle' });
  await page.locator('text=实际 ADR 评估结果').waitFor({ timeout: 15000 });
  const recovered = await page.locator('#live-result').innerText();
  assert.ok(recovered.includes('ApplicabilityAssessment'));
  assert.ok(recovered.includes('Workbench Projection Hash'));
  assert.ok(originalAssessment.includes('sha256:'));
  await page.locator('text=此前已保存：CONTEXT_REQUESTED').waitFor({ timeout: 15000 });
  assert.ok(delayedStartRequests>=1);
  assert.equal(await page.locator('#begin-review').isDisabled(), true);
  assert.equal(await page.locator('#live-review').isDisabled(), true);
  assert.match(await page.locator('#review-feedback').innerText(), /此前已保存：CONTEXT_REQUESTED/);
  await page.unroute('**/api/demo/reviews/' + persistedOperationId + '/start');


  // A new assessment identity is permissible only after the terminal operation
  // AND an explicit new-case click by the agronomist.
  const previousOperation=await page.evaluate(() => sessionStorage.getItem('adr-product-demo-operation'));
  assert.equal(await page.locator('#new-demo-case').isEnabled(),true);
  await page.locator('#new-demo-case').click();
  assert.equal(await page.evaluate(() => sessionStorage.getItem('adr-product-demo-operation')),null);
  await page.locator('#selected-scenario').selectOption('QUALIFIED_SYNTHETIC_V03');
  await page.locator('#confirm-context').check();
  await page.locator('#confirm-knowledge').check();
  await page.locator('#live-run').click();
  await page.locator('text=实际 ADR 评估结果').waitFor({timeout:45000});
  const newOperation=await page.evaluate(() => sessionStorage.getItem('adr-product-demo-operation'));
  assert.ok(newOperation && newOperation!==previousOperation);

  await page.locator('a[href="/reviews"]').click();
  await page.locator('text=Host 投影').waitFor({ timeout: 15000 });
  const details = page.locator('[data-host-index]').first();
  if (await details.count()) {
    await details.click();
    await page.locator('text=已读取案件详情').waitFor();
    assert.match(await page.locator('#host-case-detail').innerText(), /semanticHash/);
  }
  await page.screenshot({ path: new URL('04-host-review-queue.png', evidenceDir).pathname, fullPage: true });

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(url + '/assessments', { waitUntil: 'networkidle' });
  await page.locator('text=实际 ADR 评估结果').waitFor({ timeout: 15000 });
  await page.screenshot({ path: new URL('05-assessment-mobile.png', evidenceDir).pathname, fullPage: true });
  const geometry = await page.evaluate(() => ({
    viewport: window.innerWidth, width: document.documentElement.scrollWidth
  }));
  const overflowElements = await page.evaluate(() => [...document.querySelectorAll('*')]
    .map((el) => {
      const box = el.getBoundingClientRect();
      return {
        tag: el.tagName, className: String(el.className).slice(0, 80),
        text: (el.innerText || '').slice(0, 70), left: Math.round(box.left),
        right: Math.round(box.right), width: Math.round(box.width)
      };
    })
    .filter((item) => item.right > window.innerWidth + 6 || item.left < -6)
    .sort((a, b) => b.right - a.right).slice(0, 20));
  console.log('MOBILE_LAYOUT_OVERFLOW_DIAGNOSTIC=' + JSON.stringify(overflowElements));
  assert.ok(geometry.width <= geometry.viewport + 5,
    'mobile layout unexpectedly overflows horizontally: ' + JSON.stringify(geometry));
  // PROD-FIX-01: an existing operation must survive repeated malformed/5xx/lost
  // lookup attempts without producing any second Authority Write identity.
  const originalOperation = await page.evaluate(() => sessionStorage.getItem('adr-product-demo-operation'));
  assert.ok(originalOperation);
  let lookupCount = 0;
  const authorityWrites = [];
  await page.route('**/api/demo/assessments/' + originalOperation, async (route) => {
    lookupCount += 1;
    if (lookupCount === 1) return route.fulfill({
      status: 503, contentType: 'application/json',
      body: JSON.stringify({code: 'REMOTE_UNKNOWN'})
    });
    if (lookupCount === 2) return route.fulfill({
      status: 200, contentType: 'application/json', body: '{ malformed body'
    });
    return route.abort('failed');
  });
  await page.route('**/api/demo/assessments', async (route) => {
    authorityWrites.push(JSON.parse(route.request().postData() || '{}').operationId);
    return route.continue();
  });
  await page.goto(url + '/assessments', { waitUntil: 'networkidle' });
  await page.locator('text=原操作状态暂不可核对').waitFor();
  await page.locator('#selected-scenario').selectOption('QUALIFIED_SYNTHETIC_V03');
  await page.locator('#confirm-context').check();
  await page.locator('#confirm-knowledge').check();
  for (let i = 0; i < 3; i += 1) {
    await page.locator('#live-run').click();
    assert.equal(await page.evaluate(() => sessionStorage.getItem('adr-product-demo-operation')), originalOperation);
    assert.equal(await page.locator('#new-demo-case').isDisabled(), true);
  }
  assert.equal(authorityWrites.length, 0, 'failed status lookup must not start another write');
  assert.ok(lookupCount >= 4);
  await page.unrouteAll({ behavior: 'wait' });
  console.log('PROD_FIX_01_BROWSER_RECOVERY_PASS=' + originalOperation);
  assert.deepEqual(pageErrors, []);
  await context.close();
  console.log(JSON.stringify({
    result: 'BROWSER_HTTP_END_TO_END_PASS',
    actualHostAssessment: true,
    syntheticOnly: true,
    savedReview: true,
    reportDownloaded: true,
    sessionRecoveredAfterRefresh: true,
    mobileViewport: geometry
  }));
} finally {
  if (browser) await browser.close();
  if (product?.listening) await new Promise((resolve) => product.close(resolve));
  await harness.close();
}

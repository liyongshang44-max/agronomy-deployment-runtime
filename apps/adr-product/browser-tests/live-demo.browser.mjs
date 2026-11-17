// Actual Chromium browser acceptance: user flow against real ADR v0.3 Host HTTP.
// Evidence is a qualified synthetic DEMO, not M1 or M2 production qualification.
import assert from 'node:assert/strict';
import { mkdir } from 'node:fs/promises';
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

  await page.locator('a[href="/assessments"]').click();
  await page.locator('text=已合格演示世界').waitFor();
  await page.locator('#live-run').click();
  await page.locator('text=实际 ADR 评估结果').waitFor({ timeout: 45000 });
  const content = await page.locator('#live-result').innerText();
  assert.match(content, /AuthorityRef/);
  assert.match(content, /ApplicabilityAssessment/);
  assert.match(content, /Workbench Projection Hash/);
  assert.match(content, /sha256:/);
  const originalAssessment = await page.locator('#live-result').innerText();
  await page.screenshot({ path: new URL('02-real-assessment.png', evidenceDir).pathname, fullPage: true });

  // User completes and saves a non-authority review, not a scientific promotion.
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

  // The page must recover exact operation references from the same demo session.
  await page.reload({ waitUntil: 'networkidle' });
  await page.locator('text=实际 ADR 评估结果').waitFor({ timeout: 15000 });
  const recovered = await page.locator('#live-result').innerText();
  assert.ok(recovered.includes('ApplicabilityAssessment'));
  assert.ok(recovered.includes('Workbench Projection Hash'));
  assert.ok(originalAssessment.includes('sha256:'));
  await page.locator('text=此前已保存：CONTEXT_REQUESTED').waitFor({ timeout: 15000 });

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
  assert.ok(geometry.width <= geometry.viewport + 5,
    'mobile layout unexpectedly overflows horizontally: ' + JSON.stringify(geometry));
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

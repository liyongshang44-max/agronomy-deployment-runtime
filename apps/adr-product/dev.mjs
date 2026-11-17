// Local-only demonstration launcher: real ADR v0.3 fixture -> real Pilot Host HTTP
// -> product BFF -> browser. No customer credentials, no production data.
import { createDemoHarness } from './src/demo-harness.mjs';
import { startProductServer } from './src/server.mjs';

const harness = await createDemoHarness();
let product;
try {
  product = await startProductServer({ mode: 'DEMO', demoBinding: harness });
  console.log(JSON.stringify({
    event: 'ADR_PRODUCT_QUALIFIED_SYNTHETIC_DEMO',
    url: 'http://127.0.0.1:' + product.address().port,
    synthetic: true,
    commercialQualification: 'NOT_ESTABLISHED',
    realHostHttp: true
  }));
} catch (error) {
  await harness.close();
  throw error;
}
const close = async () => {
  if (product?.listening) await new Promise((resolve) => product.close(resolve));
  await harness.close();
};
process.once('SIGINT', () => { void close().then(() => process.exit(0)); });
process.once('SIGTERM', () => { void close().then(() => process.exit(0)); });

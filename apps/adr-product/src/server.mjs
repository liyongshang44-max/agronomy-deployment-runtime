import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { DEMO_CASES, demoCaseById } from './demo.mjs';
import { createDemoController } from './demo-controller.mjs';

const ASSETS = Object.freeze({
  '/': ['../public/index.html', 'text/html; charset=utf-8'],
  '/app.js': ['../public/app.js', 'text/javascript; charset=utf-8'],
  '/live-demo.js': ['../public/live-demo.js', 'text/javascript; charset=utf-8'],
  '/assessment-view.js': ['../public/assessment-view.js', 'text/javascript; charset=utf-8'],
  '/ux-language.js': ['../public/ux-language.js', 'text/javascript; charset=utf-8'],
  '/source-intake.js': ['../public/source-intake.js', 'text/javascript; charset=utf-8'],
  '/styles.css': ['../public/styles.css', 'text/css; charset=utf-8']
});

const SECURITY_HEADERS = Object.freeze({
  'cache-control': 'no-store',
  'x-content-type-options': 'nosniff',
  'referrer-policy': 'no-referrer',
  'x-frame-options': 'DENY',
  'content-security-policy': "default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'self'; img-src 'self' data:; base-uri 'none'; form-action 'self'; frame-ancestors 'none'"
});

function respond(res, status, body, contentType = 'application/json; charset=utf-8') {
  const bytes = Buffer.from(typeof body === 'string' ? body : JSON.stringify(body));
  res.writeHead(status, { ...SECURITY_HEADERS, 'content-type': contentType, 'content-length': bytes.length });
  res.end(bytes);
}

function error(res, status, code, message) {
  respond(res, status, { code, message });
}

export function createProductServer({ mode = 'DEMO', demoBinding = null } = {}) {
  if (!['DEMO', 'PILOT'].includes(mode)) throw new Error('ADR_PRODUCT_MODE must be DEMO or PILOT');
  if (mode === 'PILOT' && demoBinding) throw new Error('PILOT_DEMO_BINDING_FORBIDDEN');
  const demoController = mode === 'DEMO' && demoBinding ? createDemoController(demoBinding) : null;
  return createServer(async (req, res) => {
    try {
      const pathname = new URL(req.url ?? '/', 'http://adr-product.local').pathname;
      if (demoController && (pathname.startsWith('/api/demo/') || pathname.startsWith('/api/workbench/'))) {
        return await demoController.handle(req, res, pathname);
      }
      if (req.method !== 'GET') {
        return error(res, 405, 'METHOD_NOT_ALLOWED', 'product route does not support this method');
      }

      // The product shell is visible in both modes, but no synthetic authority data
      // can ever be served from the customer PILOT mode.
      const clientRoutes = new Set(['/knowledge', '/context', '/assessments', '/reviews', '/reports']);
      const asset = ASSETS[pathname] ?? ((clientRoutes.has(pathname) || /^\/reviews\/DEMO-[0-9]{3}$/.test(pathname)) ? ASSETS['/'] : null);
      if (asset) {
        const content = await readFile(new URL(asset[0], import.meta.url));
        return respond(res, 200, content.toString('utf8'), asset[1]);
      }

      if (pathname === '/api/meta') {
        return respond(res, 200, {
          product: 'ADR Customer Workbench',
          mode,
          phase: 'PRODUCT_SHELL',
          customerAuthReady: false,
          authorityWritesAvailable: false,
          liveDemoAvailable: Boolean(demoController),
          dataOrigin: mode === 'DEMO' ? 'SYNTHETIC_DEMO_ONLY' : 'NOT_CONFIGURED'
        });
      }

      if (pathname.startsWith('/api/')) {
        if (mode !== 'DEMO') {
          return error(res, 503, 'CUSTOMER_AUTH_BINDING_NOT_CONFIGURED',
            'Pilot data is unavailable until verified customer identity and authorization are integrated');
        }
        if (pathname === '/api/cases') {
          return respond(res, 200, DEMO_CASES);
        }
        const match = /^\/api\/cases\/(DEMO-[0-9]{3})$/.exec(pathname);
        if (match) {
          const item = demoCaseById(match[1]);
          return item ? respond(res, 200, item) : error(res, 404, 'CASE_NOT_FOUND', 'case not found');
        }
      }
      return error(res, 404, 'ROUTE_NOT_FOUND', 'route not found');
    } catch {
      return error(res, 500, 'PRODUCT_SHELL_ERROR', 'product shell request failed');
    }
  });
}

export async function startProductServer({
  mode = process.env.ADR_PRODUCT_MODE ?? 'DEMO',
  demoBinding = null,
  host = process.env.ADR_PRODUCT_HOST ?? '127.0.0.1',
  port = Number(process.env.PORT ?? 3080)
} = {}) {
  const server = createProductServer({ mode, demoBinding });
  await new Promise((resolveListen, rejectListen) => {
    server.once('error', rejectListen);
    server.listen(port, host, resolveListen);
  });
  console.log(JSON.stringify({ event: 'ADR_PRODUCT_SHELL_LISTENING', mode, host, port: server.address().port }));
  return server;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await startProductServer();
}

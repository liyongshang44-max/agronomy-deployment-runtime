# ADR Customer Product — ADR-PROD

Status: M1 implementation candidate (CTO acceptance pending); M2 not accepted. This is an isolated customer application under apps/adr-product. ADR Core, frozen API/SDK and WP Pilot Host remain unchanged.

## Run the real ADR synthetic demo (Node.js 24)

    npm --prefix apps/adr-product run demo

Open http://127.0.0.1:3080/ on the same machine. The launcher uses the existing qualified v0.3 synthetic acceptance world and real Pilot Host HTTP. The browser selects the one qualified synthetic scenario, reviews exact context and knowledge, triggers a new real ApplicabilityAssessment and reads the resulting Workbench case.

The session-isolated BFF keeps service tokens and authorization references out of browser input, persists the original operation and Idempotency-Key, and permits a new operation ID only after a terminal result plus an explicit new-case action. A human review-start event is independently stored. Without it the review duration is UNKNOWN. Non-authority feedback and a human-readable HTML report are saved and presented separately from ADR science authority.

The knowledge page accepts source metadata only and marks it SUBMITTED / qualification UNAVAILABLE, without PDF upload, raw fulltext retention, model egress or qualification promotion.

## Tests

    npm --prefix apps/adr-product test
    npm --prefix apps/adr-product install --no-audit --no-fund
    ./apps/adr-product/node_modules/.bin/playwright install chromium
    npm --prefix apps/adr-product run test:browser

GitHub Actions also runs Constitution and the frozen Public API contract, followed by Node HTTP integration and actual Chromium end-to-end acceptance with screenshot evidence.

## Local layout-only preview

    npm --prefix apps/adr-product start

This is merely a static, clearly fictional UI fixture, not an ADR scientific result.

## PILOT fail-closed check

    ADR_PRODUCT_MODE=PILOT npm --prefix apps/adr-product start

Formal customer identity, authenticated Principal mapping, knowledge/source permissions, production records and Host deployment remain with the independent WP team. No Demo bootstrap or fallback is allowed in PILOT.

The complete browser operation guide is at docs/product/ADR-PROD-M1-OPERATOR-GUIDE.md. M1 and M2 remain separate from commercial validation (NOT_ESTABLISHED).

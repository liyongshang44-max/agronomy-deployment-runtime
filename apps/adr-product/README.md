# ADR Customer Product — ADR-PROD-00/01 product shell

This is a separate, non-authority customer application. The first commit delivers a responsive browser shell and explicitly fictional DEMO read models, not M1 or M2 acceptance.

## Start

Use Node 24. From the repository root:

    npm --prefix apps/adr-product test
    npm --prefix apps/adr-product start

Open http://127.0.0.1:3080/. No package installation, secret, or third-party provider is needed.

The app starts in DEMO mode and serves only explicitly fictional, synthetic product-layout fixtures. Original ADR classification code values remain intact, but these examples are not governed ApplicabilityAssessment resources, QualifiedKnowledge, or real customer data.

To verify fail-closed PILOT behavior:

    ADR_PRODUCT_MODE=PILOT npm --prefix apps/adr-product start

PILOT blocks all product data requests until WP-supplied identity, authorization, Host and knowledge bindings can be validated. It never silently falls back to DEMO. Do not expose the local HTTP development server directly to the Internet.

## Scope and current limitations

Delivered: six-route navigation, responsive design system, browser direct links, synthetic case queue/filter, case evidence layout, read-only context/knowledge/assessment structure, print-oriented demo report layout, no-store security headers and basic Node HTTP acceptance.

Not delivered: customer authentication, authorized real Host reads, authoritative writes, actual assessment wizard, source PDF preview, persistence of review feedback, product PDF generation, M1, M2 or commercial qualification. Do not claim these.

Core, Public API, SDK and the existing Pilot Host are untouched. See docs/product/ADR-PROD-00-CONTRACT-V1.md for exact upstream dependencies and gaps.

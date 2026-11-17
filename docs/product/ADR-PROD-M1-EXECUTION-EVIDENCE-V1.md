# ADR-PROD M1 — execution evidence and remaining closure

Date: 2026-11-17
Scope: ADR-PROD only; no WP ownership transfer
Base protected main: d63c3058d6b95873e811445920f7302ded980ef3
PR: #231 (Draft)
Status: IMPLEMENTATION_IN_PROGRESS / M1_NOT_YET_ACCEPTED / M2_NOT_YET_ACCEPTED

## What is actually implemented

1. Independent apps/adr-product customer browser application and local non-authority product BFF.
2. True ADR v0.3 synthetic acceptance world created using existing Pilot Host's qualified synthetic bootstrap.
3. New ApplicabilityAssessment submitted through the existing Pilot Host HTTP POST /v1/applicability-assessments using an exact retrieval, manifest, knowledge and runtime-authorization binding.
4. New exact workbench case read through GET /v1/workbench/cases/{assessment_id}; existing escalation queue read through GET /v1/workbench/escalations.
5. Session-scoped operationId and stable transport Idempotency-Key, preserved across uncertain outcomes in the demo product record store.
6. Independent non-authority review feedback saved with case projection hash and exact Assessment ref; HTML report emits those refs and source evidence. No scientific authority is minted by product feedback.
7. Browser flow using Playwright Chromium, and responsive mobile-width screenshots.

## Actual evidence as of the last qualified completed check

- GitHub Actions product-shell workflow on exact source d711658c214a5e9f330493c3f4d261f594ef7f9a: run 44015758990, conclusion SUCCESS. The job contains Node 24 Constitution scanner, frozen Public API tests, ADR product HTTP integration, Chromium install and actual browser E2E.
- Other same-head duplicate product-shell run 44015765113: SUCCESS.
- Browser evidence includes desktop overview, governed assessment after click, product feedback, Host queue and mobile-size screenshots retained as workflow artifact.
- Initial Chromium locator ambiguity failed at earlier head 642d0f7a...; the exact test selector was corrected in d711658... with no API/Core changes.
- The root Constitutional workflow is separate; its result must be checked on the latest exact head before merge or status promotion.

## Explicit boundaries and gaps (do not claim M1 yet)

- The presently interactive scenario uses pre-existing, qualified synthetic ContextManifest/DecisionProblem/Retrieval/Knowledge. It does not yet allow the operator to define arbitrary new ContextDatum, DecisionProblem, Manifest or KnowledgeRetrievalResult.
- The source intake UI is not wired to a governed upload or rights-qualified fulltext read; no automatic knowledge qualification is provided.
- Review feedback persistence is demo-only and non-authority, not the customer production record store.
- No qualified customer identity mapping or authorization-provider configuration is installed. Formal PILOT mode remains fail-closed.
- Report HTML can be printed as PDF, but no independent PDF document-generation backend is claimed.
- Browser test covers Chromium on desktop and a mobile-sized viewport, not Edge/WebKit/Firefox or production customer browser environments.
- M1 non-developer flow acceptance, user documentation, deployment packaging and full-source rights experience still require final review.

## Acceptance expectations for next tranche

For M1: demonstrate an actual user-facing step-by-step workflow using a qualified synthetic world with explicit context selection/confirmation, source evidence display, run, review feedback, report, refresh and negative permission/uncertain outcome tests. Verify no fabricated state can be mistaken for a scientific result.

For M2: wait for WP-issued customer identity, authorized knowledge/deployment discovery, exact historical read and rights-governed source endpoints, and qualified Pilot Host bootstrap. The product must not issue or repair those authorities.

M1 and M2 remain separate from commercial validation (NOT_ESTABLISHED) and from ADR Core engineering freeze.

# ADR-PROD-00 — Product contract and candidate asset decision

Decision: ADR_PROD_V1_PRODUCT_SHELL_STARTED / FROZEN_V03 / NO_AUTHORITY_CHANGE
Base main: d63c3058d6b95873e811445920f7302ded980ef3
Date: 2026-11-17
Owner: ADR-PROD (WP is separately owned)
State: initial inventory, NOT final PROD-00 acceptance

## Product boundary

ADR-PROD is responsible for the user-facing customer product, its server BFF, non-authority records, report presentation and interaction testing. ADR Core semantics, scientific qualification, source-rights authority, Principal issuance, authorization issuance, Deployment and Pilot Host durability remain outside ADR-PROD. Do not modify them to close UI gaps.

The first application is apps/adr-product, deliberately separate from the existing deploy/adr-pilot-host and from every external farm portal. An isolated DEMO origin exposes fictional examples. PILOT is fail-closed until verified WP bindings exist.

## Frozen v0.3 Public API — exact 9 operations

| Verb | Path | Role |
| --- | --- | --- |
| POST | /v1/decision-problems | governed DecisionProblem write |
| POST | /v1/context-data | governed ContextDatum write |
| POST | /v1/context-references | governed AuthorizedContextReference write |
| POST | /v1/context-references/{reference_id}/resolutions | governed ResolvedContextDatumReceipt write |
| POST | /v1/context-manifests | governed ContextManifest write |
| POST | /v1/knowledge-retrieval-results | governed KnowledgeRetrievalResult write |
| POST | /v1/applicability-assessments | governed ApplicabilityAssessment write |
| GET | /v1/workbench/cases/{assessment_id} | non-authority workbench projection |
| GET | /v1/workbench/escalations | non-authority escalation projection |

Source of truth: packages/public-api/src/surface.mjs and openapi.mjs at exact base. All seven writes require an Idempotency-Key, a principal bound to the authenticated bearer, and an exact replay-validated AuthorizationDecisionAudit ref. A supplied ref by itself is never authorization. The SDK in sdks/typescript/src/client.mjs covers these nine operations but does not issue principals or decisions.

## Candidate assets

| Asset | Ruling | Reason |
| --- | --- | --- |
| packages/public-api/src/surface.mjs + openapi.mjs | REUSE_AS_IS | frozen 9-route transport and schema |
| sdks/typescript/src/client.mjs | REUSE_WITH_ADAPTATION | Node/server transport and token injection; browser must not hold service Bearer |
| packages/workbench/src/case.mjs | REUSE_AS_IS through Host projection | authority-validated source/condition/limitation view |
| packages/workbench/src/queue.mjs | REUSE_AS_IS through Host projection | default queue filters NO_REVIEW_CANDIDATE |
| packages/workbench/src/instrumentation.mjs | REUSE_WITH_ADAPTATION | non-authority review metric generation only, not persistence |
| deploy/adr-pilot-host/server.mjs | REUSE_AS_IS as WP-owned service | not product BFF or browser application |
| PR #56 (large PDF ingestion) | NOT_ADOPTED | stacked open Draft; rights and authority changes require separate governance |
| PR #60 (automated source-faithful second review) | NOT_ADOPTED | stacked open Draft on #56; not a shipped product source |
| PR #62 (source/read/model egress rights) | NOT_ADOPTED | stacked open Draft on #60; not a shipped source-preview service |

## Contract gaps for WP — interface requests, not WP task control

- WP-IF-01: validated customer identity -> exact ADR Principal/program/tenant mapping and authorized delegation without admin impersonation.
- WP-IF-02: allowed and scope-validated AuthorizationDecisionAudit references per write operation, before submitting a resource.
- WP-IF-03: authorized selectable QualifiedKnowledge/Deployment directory; current Public API has no such list route.
- WP-IF-04: authorized historical assessment listing and exact version/hash lookup. Current Host detail looks up logical_id only and rejects multiple versions as ASSESSMENT_ID_AMBIGUOUS.
- WP-IF-05: rights-governed source reading / PDF preview. Existing Host workbench currently does not pass sourceRegistry to the Workbench projection.
- WP-IF-06: customer-ready Pilot Host, validated bootstrap, recovery and source permissions.

These are M2 integration dependencies; independent product-shell implementation continues now. M1 demo may use isolated, accurately labeled fixtures, but must not present fabricated scientific facts as qualified evidence.

## Defect and risk register

- Host GET /v1/workbench/escalations returns only review-required items by default; it cannot populate all-history or show NO_REVIEW_CANDIDATE records.
- Host GET /v1/workbench/cases/{assessment_id} detects multi-version ambiguity instead of selecting one. The UI must preserve the error rather than choosing latest.
- Workbench instrumentation provides non-authority metrics; no formal feedback persistence endpoint exists in the nine-route API. ADR-PROD owns an isolated, permission-checked product record boundary.
- Unknown write outcome or Host persistence fault must not generate a new idempotency key or claim success. Reconcile with exact key, request and principal.
- Knowledge upload is not qualification; the product must distinguish source intake from a genuine QualifiedKnowledge ref.
- Node 24 is the repository engine; new application acceptance must be tested on Node 24 before release.

## Product milestones

M1 PRODUCT_DEMO_READY: a nontechnical user navigates the full scenario, submits or replays a clearly identified demonstration assessment, inspects evidence, records non-authority feedback and exports a readable report. Current product shell does not satisfy this yet.

M2 CUSTOMER_PILOT_UI_READY: same UI with validated WP identity, lawful Host writes, true persisted reads across restart, exact source provenance, negative cross-tenant tests and a separately accepted Pilot Host. Current product shell does not satisfy this.

Keep source work in small PRs and never amend protected main directly.

# ADR v0.3 — Paid Design-Partner Pilot Release Record — 2026-09-23

Status: RELEASE IDENTITY / CUSTOMER PILOT / NOT ARCHITECTURE AUTHORITY / NOT DOMAIN AUTHORITY

Software payload anchor:

```text
c0081a2a2ddf0002f0f798af084b08f6e2a7113f
```

Release name:

```text
ADR v0.3 — Paid Design-Partner Pilot
```

Machine/software qualification state:

```text
PAID_DESIGN_PARTNER_PILOT_CANDIDATE
```

Commercial validation state:

```text
NOT_ESTABLISHED
```

Architecture state:

```text
v1.0 FROZEN
```

## 1. Release decision

ADR is no longer managed as "continue building toward a complete autonomous agronomy product before release."

The v0.3 product is released to bounded paid design-partner pilots at the already-qualified product boundary:

```text
customer agronomic knowledge
  -> exact source/version
  -> candidate claim + source context
  -> source-faithful review / scientific qualification
  -> target context
  -> ApplicabilityAssessment
  -> Agronomist Workbench
  -> human review where required
```

This release does not require Gate D or Gate E and does not imply recommendation or execution authority.

## 2. Core engineering freeze

Effective with this release record:

```text
ADR CORE ENGINEERING = FROZEN
```

No new ADR product capability is authorized merely to make the pilot feel more complete.

Permitted post-freeze changes are limited to P0 production defects, security-critical corrections, release/deployment configuration that does not widen ADR authority or product semantics, and evidence/documentation corrections that preserve existing authority boundaries.

Recommendation, runtime-legality, DecisionResult, autonomous execution, new transformation authority, or new product-domain semantics require a separately authorized roadmap decision.

## 3. Product boundary

The release ends at:

```text
ApplicabilityAssessment
+
Agronomist Workbench
```

Allowed customer product classifications are:

```text
NO_REVIEW_CANDIDATE
AGRONOMIST_REVIEW_REQUIRED
CONTEXT_GAP
KNOWLEDGE_CONFLICT
CALIBRATION_NEEDED
GOVERNED_TRANSFORM_NEEDED
```

`NO_REVIEW_CANDIDATE` is not renamed `SAFE` and does not become an action recommendation. Unknown and conflict cases remain expert-review cases.

## 4. Public pilot surface

```text
POST /v1/decision-problems
POST /v1/context-data
POST /v1/context-references
POST /v1/context-references/{reference_id}/resolutions
POST /v1/context-manifests
POST /v1/knowledge-retrieval-results
POST /v1/applicability-assessments

GET  /v1/workbench/cases/{assessment_id}
GET  /v1/workbench/escalations
```

The v0.3 product does not expose:

```text
/recommend
/runtime-eligibility
/runtime-bindings
/decision-results
```

Successful applicability is not a safety claim, treatment order, irrigation order, fertilizer prescription, machine authorization, or DecisionResult.

## 5. Distribution boundary

ADR v0.3 is not an npm/public-package release. The repository package remains intentionally:

```text
version = 0.0.0-development
private = true
```

The intended customer distribution is a hosted pilot service composed from the existing public contract, Workbench read model, customer casebook, OpenAPI contract, and SDK integration. This record does not change package publication status and does not authorize npm publication.

## 6. Deployment truth

The current ADR repository freezes a platform-neutral API contract. It deliberately does not choose an HTTP framework, persistence technology, or deployment topology.

At this release anchor the repository contains `packages/public-api`, `packages/workbench`, and the TypeScript SDK, but no selected deployable HTTP host or browser Workbench application entrypoint.

Therefore:

```text
ADR v0.3 product release identity = ESTABLISHED
hosted ADR Pilot API live status  = NOT YET CLAIMED BY THIS RECORD
Workbench browser UI live status  = NOT YET CLAIMED BY THIS RECORD
```

A hosted pilot may be activated through a thin deployment host that implements the already-frozen P01 transport contract without widening ADR semantics. That deployment must separately prove authentication, tenant isolation, retained-artifact handling, recovery/backup configuration required by the pilot contract, and smoke-tested public routes before claiming a live customer service.

The deployment host is packaging/infrastructure, not a new ADR product capability.

## 7. GEOX independence

```text
ADR CORE ENGINEERING = FROZEN
ADR v0.3 = RELEASED TO PAID DESIGN-PARTNER PILOT
GEOX INTEGRATION = CONTINUES INDEPENDENTLY WHEN MCFT/FIELD-STATE IS READY
```

GEOX is a first-party integration, reference consumer, and field-validation substrate. It is not the host or authority source of ADR. P03 non-GEOX integration remains part of v0.3 release closure; P04 GEOX integration is useful but is not a release prerequisite.

## 8. Customer-facing casebook

The first customer-facing casebook is:

```text
docs/customer_examples/ADR-AGRONOMIC-KNOWLEDGE-APPLICABILITY-CASEBOOK-PUBLIC-PILOT-V1.md
```

It demonstrates public-source agronomic knowledge against synthetic targets while preserving the distinction between source material, qualification prerequisites, target context, applicability, review, and action authority.

The default first design-partner domain is:

```text
late-season irrigation
```

## 9. Bounded design-partner onboarding

```text
1 decision domain
20-100 real customer agronomy claims
3-10 customer protocols/source documents
10-30 real or historical target cases
1 customer agronomist review team
1 context provider
```

The pilot is not a self-serve general agronomy sandbox.

## 10. Commercial validation

Software release does not establish a business. The pilot must collect evidence including claim traceability, context gaps surfaced, applicability agreement/disagreement with customer agronomists, silent-promotion prevention, measurement/calibration mismatches, knowledge conflicts, review time before/after ADR, integration/support burden, and paid continuation or expansion signal.

The business question after this release is:

```text
Will somebody pay for this?
```

not:

```text
What additional ADR architecture can we build?
```

## 11. Explicit nonclaims

This release does not claim ADR 1.0 GA, autonomous agronomic decision authority, production autonomous agronomy, commercial validation or product-market fit, willingness to pay, yield/profit uplift, causal agronomic benefit, recommendation correctness, runtime legality or DecisionResult availability, a hosted production service already live, or GEOX/MCFT authoritative cutover.

The software qualification remains exactly:

```text
PAID_DESIGN_PARTNER_PILOT_CANDIDATE
```

until real design-partner evidence supports a later commercial adjudication.

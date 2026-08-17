# ADR v0.3 — Paid Design-Partner Pilot Release Acceptance

Status: IMPLEMENTATION CANDIDATE

Release target: `Paid Design-Partner Pilot Candidate`

Exact implementation baseline: `main @ 730c68e8b0d6d4589c8e2db20293e775da303bbd`

## 1. Purpose

This acceptance closes the software-engineering boundary for the v0.3 Agronomist Pilot slice.

It does not add a new agronomy, runtime, decision or evaluation authority. It proves that the already-closed v0.3-required capabilities can coexist in one coherent paid-design-partner workflow.

Permanent release nonclaim:

`NONE_RELEASE_ACCEPTANCE_IS_NOT_DOMAIN_AUTHORITY`

Release status:

`PAID_DESIGN_PARTNER_PILOT_CANDIDATE`

Commercial validation status at software release:

`NOT_ESTABLISHED`

## 2. Required closure

The integrated release acceptance freezes this exact software closure set:

- Gate A;
- A11 Agronomist Workbench Core;
- P01 pilot Public API;
- P02 SDK + Generic Integration;
- P03 Non-GEOX Reference Integration Acceptance;
- P06 pilot async/idempotency/observability;
- P07 pilot security/retention/audit isolation;
- P08 pilot-contract recovery/SLO subset.

P04 GEOX remains a useful first-party adapter and is tested by the repository, but it cannot substitute for P03 and is not a prerequisite for v0.3 product qualification.

Gate D and Gate E are intentionally not prerequisites for this release slice.

## 3. Integrated workflow proof

The positive acceptance proves one continuous non-GEOX path:

```text
customer-like field context
  -> P03 explicit representation mapping
  -> P02 SDK transport
  -> ContextDatum authority
  -> ContextManifest
  -> Retrieval / Applicability
  -> A10 product classification
  -> A11 Agronomist Workbench
```

The same pilot world is then exercised through:

```text
P06 retry-safe operational job evidence
  + P07 tenant-scoped retained customer payload
  + P08 authority checkpoint / restore
  + P08 pilot SLO projection
```

A11 review instrumentation is also exercised to prove that review volume/time/classification metrics can be collected without becoming domain authority.

## 4. Product boundary

The v0.3 release ends at the governed product classification / Agronomist Workbench boundary.

Allowed product taxonomy includes:

- `NO_REVIEW_CANDIDATE`
- `AGRONOMIST_REVIEW_REQUIRED`
- `CONTEXT_GAP`
- `KNOWLEDGE_CONFLICT`
- `CALIBRATION_NEEDED`
- `GOVERNED_TRANSFORM_NEEDED`

`NO_REVIEW_CANDIDATE` is not renamed `SAFE` and does not become an ACT recommendation.

The release acceptance must not require or fabricate:

- RuntimeEligibility;
- RuntimeBinding;
- DecisionRobustness;
- DecisionResult;
- autonomous execution authority.

Unknown and conflict cases must remain in expert review.

## 5. Operational substrate remains non-authority

P06 OperationalTrace/Journal, P07 security/retention metadata, P08 recovery checkpoint/SLO records and the integrated release evidence are operational evidence only.

They cannot change:

- Workbench classification;
- scientific qualification;
- applicability authority;
- Model/Policy semantics;
- runtime legality;
- DecisionResult authority.

The release gate explicitly checks that exercising P06/P07/P08 leaves the exact Gate-A authority ledger unchanged.

## 6. Commercial nonclaim

Passing this acceptance permits the software label:

`Paid Design-Partner Pilot Candidate`

It does not permit the claims:

- commercial GO;
- proven willingness to pay;
- paid continuation or expansion;
- yield uplift;
- profit uplift;
- causal agronomic effect;
- recommendation correctness.

Those require real design-partner evidence.

The pilot must preregister at minimum:

- routine-review reduction target;
- false-safe ceiling;
- minimum evidence volume;
- commercial continuation condition.

The actual commercial adjudication must use customer/pilot observations such as review volume/time, cases per agronomist, escalation quality, false-safe/missed-review rate, unknown/conflict rate, override/disagreement, integration/support burden and paid continuation/expansion signal.

## 7. Acceptance structure

Positive acceptance proves:

1. non-GEOX context traverses P02/P03 into exact Gate-A/A11;
2. P06 exact retry replays without redispatch and retains exact authority refs;
3. P07 customer payload retention is tenant-scoped;
4. P08 restores exact Gate-A authorities and evaluates the same P06 job under pilot SLO;
5. A11 instrumentation records expert-review work as non-authority workflow metrics;
6. the composed evidence declares only `PAID_DESIGN_PARTNER_PILOT_CANDIDATE` with commercial validation `NOT_ESTABLISHED`.

Integrity acceptance proves:

1. Gate-D authority is neither required nor fabricated;
2. the public v0.3 product surface has no recommendation/RuntimeEligibility/RuntimeBinding/DecisionResult contract;
3. P06/P07/P08 cannot mutate the Workbench classification or underlying authority ledger;
4. context-gap and knowledge-conflict cases remain expert-review-required;
5. release qualification cannot self-assert commercial success.

## 8. Explicit deferred work

This release acceptance does not close:

- real customer pilot execution;
- commercial GO/NO-GO;
- v0.4+ Runtime Legality / Decision Shadow product surfaces;
- v0.6 Evaluation Loop;
- v1.0 enterprise production requirements.

Those remain separate roadmap stages and cannot be inferred from a green v0.3 software release gate.

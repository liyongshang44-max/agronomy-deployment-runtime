# ADR v0.3 — MTL-P03 Non-GEOX Reference Integration Acceptance

Status: **IMPLEMENTATION CONTRACT / NON-ARCHITECTURE-AUTHORITY**

Baseline: `main @ 1085b721c39847bb4105279ff7750affd8790e85`

## 1. Purpose

MTL-P03 proves that the Gate-A product surface is usable by a customer-like integration that does not depend on GEOX runtime, schema, identifiers or adapter code.

This task is an independence/product-integration proof. It does not create new scientific authority and successful integration is not evidence of agronomic validity, safety, runtime legality or decision correctness.

## 2. Reference consumer/provider

The reference integration is intentionally modeled as an unrelated field-data platform with raw customer fields:

```text
plot_key
reading_key
metric_code
raw_value
observed_from
observed_to
released_at
content_hash
```

These field names have no ADR semantic authority.

The customer `metric_code` is deliberately not used to infer `semantic_id`, unit or value type. Canonical ADR representation is supplied only through an explicit integration mapping configuration.

The integration mapping also freezes the exact source-selection scope:

```text
sourcePlotKey
sourceMetricCode
```

A record from another plot or another metric fails closed before representation mapping. This prevents a valid explicit semantic mapping from being accidentally reused over unrelated customer data.

## 3. Dependency boundary

The reference adapter lives under:

```text
adapters/reference-field-platform/
```

It may depend on the P02 public SDK/integration layer and public ADR contracts. It must not import internal scientific, authorization, applicability, runtime or decision packages.

The adapter contains no GEOX/MCFT/KBS/T3R1/CAP-specific runtime or schema dependency.

Root `test:reference-integration` is independent of `adapters/geox`. A future first-party GEOX adapter may be added by P04, but P03 acceptance must continue to pass if that adapter is absent or removed.

## 4. ContextProvider mapping

The active reference ContextProvider performs only P02-governed representation mapping:

```text
EXACT_COPY
EXPLICIT_CONSTANT
```

For the executable crop-context proof:

- exact source plot and exact source metric must match the configured mapping scope;
- raw customer value is copied exactly into the configured ADR value field;
- observation/support/availability times are copied exactly;
- source reading/content identities are copied exactly;
- `semantic_id`, unit, value type, epistemic class, provenance class, spatial support type/target geometry ref and source provider id are explicit integration configuration/constants.

The adapter cannot:

- infer semantic identity from `metric_code` or field names;
- accept another plot/metric under an unrelated mapping;
- default missing source readings;
- perform unit conversion or formulas;
- synthesize scientific context;
- claim qualification/applicability/decision authority.

The resulting message is `adr.integration-message.v1` with role `CONTEXT_PROVIDER` and message type `CONTEXT_DATUM_AVAILABLE`.

## 5. P02/P01 transport exercise

P03 passes the exact provider message resource through the P02 pilot SDK `createContextDatum` operation.

The proof retains:

- client-fixed service Principal;
- bearer transport separation;
- exact AuthorizationDecisionAudit reference transport;
- logical id/version/idempotency key;
- full context semantic/provenance/time/support/source payload;
- exact response authority identity checks inherited from P02.

The acceptance gateway resolves the SDK write through the real `publishContextDatum` authority seam on the same ledger and returns the exact resulting ContextDatum authority ref. That exact ref — not a separately republished equivalent datum — is the member subsequently frozen into ContextManifest and consumed by Gate-A applicability/workbench processing.

Therefore P03 proves continuity of one exact authority chain across the public SDK boundary rather than merely proving payload equivalence on two independent paths.

P03 does not claim a production HTTP gateway; P01 is the public contract and P06/P08 own production async/operational/SLO concerns.

## 6. Standalone Gate-A closure

Executable acceptance takes the customer-originated provider payload and publishes the same exact governed ContextDatum through the P02 SDK transport seam into an otherwise existing Gate-A authority world, then closes:

```text
customer-like raw record
  -> exact source plot/metric mapping scope
  -> reference ContextProvider
  -> P02 SDK/P01 write contract
  -> exact ContextDatum authority
  -> ContextManifest containing that exact ref
  -> KnowledgeRetrievalResult
  -> ApplicabilityAssessment
  -> Agronomist Workbench projection
  -> reference ResultSink consumer
```

The positive fixture uses explicit `crop.code = maize` context and must resolve to:

```text
transportStatus = DIRECTLY_APPLICABLE
scientificUseStatus = QUALIFIED
decisionRelevance = MATERIAL
workbench classification = NO_REVIEW_CANDIDATE
```

This is a deterministic integration acceptance over already-established authority. It is not a claim that `maize` or any other value is generally agronomically valid outside the exact frozen fixture.

## 7. Result consumption

The reference consumer accepts only `adr.result-sink-event.v1` events of type `APPLICABILITY_PUBLISHED` carrying an exact `ApplicabilityAssessment` authority ref.

A projection hash, another authority kind or malformed ref cannot masquerade as ApplicabilityAssessment identity.

Consumption creates no ADR authority and leaves the authority ledger unchanged. The consumer output explicitly carries:

```text
authorityClaim = NONE_TRANSPORT_CONSUMER_ONLY
```

## 8. Permanent nonclaims

P03 does not establish or imply:

- agronomic validity from integration success;
- recommendation authority;
- RuntimeEligibility;
- RuntimeBinding;
- DecisionRobustness;
- DecisionResult;
- ACT/WAIT authority;
- GEOX adapter correctness;
- production network/retry/SLO readiness.

`Integration success != agronomic validity` remains a hard boundary.

## 9. Acceptance

Root CI includes:

```text
npm run test:reference-integration
```

Positive acceptance proves:

- customer-like schema maps through explicit representation rules;
- customer metric names do not infer ADR semantic identity;
- exact source plot/metric scope is configured rather than guessed;
- full provider payload traverses P02 SDK without semantic flattening;
- the ContextDatum authority returned by the SDK write is the exact ContextDatum ref used downstream;
- a non-GEOX provider closes the existing Gate-A applicability/workbench path;
- exact ApplicabilityAssessment identity reaches the reference consumer;
- result consumption does not mutate the authority ledger;
- no RuntimeEligibility/RuntimeBinding/DecisionRobustness/DecisionResult is fabricated.

Integrity acceptance proves:

- adapter imports no internal ADR authority package;
- no first-party runtime/schema coupling tokens exist in the reference adapter;
- root P03 test wiring has no dependency on `adapters/geox`;
- missing source data is not defaulted;
- wrong source plot fails closed;
- wrong source metric fails closed;
- ungoverned value-type inference is rejected;
- source content identity is explicit;
- projection-only or wrong-kind result events fail closed;
- consumer output does not claim recommendation/runtime/decision authority.

P03 is CLOSED only after exact feature-head CI, current merge-ref CI, independent integration/independence review, Ready-state merge-candidate revalidation, actual-main verification and exact-main full root CI are all green.

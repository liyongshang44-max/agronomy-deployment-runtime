# ADR v0.1 — MTL-D02 Exact Runtime Execution Broker

Status: **IMPLEMENTATION CONTRACT / NON-ARCHITECTURE-AUTHORITY**

Baseline: `main @ d36564002aad64b3b010b72b66a8d661d8826582` (Gate R/D/S closed)

## 1. Purpose

D02 implements C17: execute or broker exactly the executable runtime node frozen by D01, while preserving the S03 Specification ↔ Implementation ↔ ImplementationConformance relation and exact ContextDatum input authority.

It answers:

> Which exact bound executable was dispatched with which exact input-authority envelope, under which current Deployment and Conformance state, and what opaque execution evidence came back?

It does not answer:

> Is that raw output semantically or agronomically valid?

Semantic output authority begins at D03.

## 2. Hard predecessors

D02 requires:

```text
MTL-D01 RuntimeBinding
MTL-S03 ImplementationConformance
```

The exact RuntimeBinding must contain exactly one executable specification binding in the current v1 surface. D02 does not discover a newer implementation, conformance record, deployment, specification or input datum by logical ID.

## 3. Closed caller input boundary

The broker caller may provide only:

```text
ledger
runtimeBindingRef
inputDatumRefs
```

The caller cannot override:

- Specification;
- Implementation;
- ImplementationConformance;
- dispatch class;
- runtime environment;
- execution locator;
- raw input payload;
- executor identity.

Those values are derived from the exact RuntimeBinding and validated authority world.

## 4. Current-use authority before dispatch

D01 historical replay remains historical authority only. It is not sufficient for a new execution.

Before every D02 broker call can reach an executor, D02 revalidates at one explicit dispatch timestamp:

```text
exact RuntimeBinding historical integrity
+ current Deployment runtime eligibility
+ current ImplementationConformance validity/control state
+ exact frozen executionContext
+ exact Specification/Implementation relation
+ exact Deployment runtimeEnvironment relation
```

The timestamp used for that current-use validation is the same timestamp recorded as `startedAt` for a newly dispatched execution.

A later suspension/revocation/expiry therefore blocks a later broker call even if the same execution identity already has an in-process cached result. Cache replay is not an authority bypass.

## 5. Exact input authority envelope

Every required executable input must be an exact valid `ContextDatum` that is a member of the frozen D01 ContextManifest and satisfies the exact Specification input contract for:

- semantic ID;
- value type;
- unit;
- allowed epistemic class.

One semantic ID may appear at most once. No raw caller-provided values may substitute for ContextDatum authority.

The input envelope binds:

```text
RuntimeBinding ref
runtime node identity
Specification ref
Implementation ref
ImplementationConformance ref
sorted exact ContextDatum entries
```

Its hash is the execution input hash.

## 6. Runtime node and execution identity

The runtime node ID is deterministic over:

```text
RuntimeBinding
Specification
Implementation
ImplementationConformance
```

The execution ID is deterministic over:

```text
RuntimeBinding
runtimeNodeId
inputEnvelopeHash
```

The D02 contract normalizer recomputes these relations and rejects an envelope whose claimed node/execution identity does not match its exact authority tuple.

This prevents a structurally well-formed envelope from relabeling one execution as another.

## 7. Internal and external executor seam

Executor registration is exact-Implementation keyed. There is no fallback to a different implementation.

Provider classes map to dispatch classes as follows:

```text
INTERNAL / WASM -> INTERNAL
HTTP / CUSTOMER / FIRST_PARTY / BATCH -> EXTERNAL
```

The frozen S02 execution locator is passed to the registered executor adapter. For HTTP implementations S02 already requires a credential-free HTTPS locator without username/password, query string or fragment.

D02 does not claim to provide:

- credential issuance;
- secret storage;
- HTTP authentication;
- network policy enforcement;
- mTLS;
- customer-runtime connectivity;
- durable remote-job orchestration.

Those are adapter/platform concerns outside the D02 semantic authority contract.

## 8. Idempotency

Execution identity is the idempotency key.

The current v1 `RuntimeExecutionIdempotencyStore` is explicitly process-local and non-durable. It coalesces concurrent exact duplicates and caches a completed success, normalized execution failure, or broker-integrity rejection under the exact execution identity.

The retry contract is:

```text
current Deployment/Conformance revalidation
then
same exact execution identity -> cached in-process outcome
```

Therefore:

```text
retry != authority bypass
retry != new semantic result
retry != durable exactly-once across process restart
```

A production-grade durable idempotency store remains future operational work.

## 9. Timeout, transport and chronology

D02 normalizes executor transport exceptions and timeout into failed execution envelopes. Timeout timers are cleared when either side of the race settles so a fast execution does not retain a stale timer.

A timeout means only that the broker deadline elapsed before an executor result was observed. It does **not** prove that an already-dispatched internal/external executor was canceled, that a remote system stopped work, or that no external side effect occurred. The current executor seam has no cancellation/acknowledgement protocol that could justify those stronger claims.

The explicit broker clock is also an integrity boundary:

```text
startedAt = current-use dispatch authorization timestamp
completedAt >= startedAt
```

A clock regression after executor invocation fails closed with `RUNTIME_EXECUTION_CLOCK_REGRESSION`. Because the in-process idempotency promise is already installed before executor invocation, an exact retry cannot duplicate the side effect in that process.

## 10. Raw output is non-semantic evidence

A successful executor return is canonicalized only as opaque JSON-compatible evidence.

D02 records:

```text
rawOutput
rawOutputHash
semanticValidation = NOT_PERFORMED_D03_REQUIRED
```

The contract recomputes the opaque raw-output hash and rejects mismatched output/hash pairs.

D02 does not publish or mutate:

- RuntimeResult;
- RuntimeDatum;
- DecisionResult;
- DecisionPackage;
- ContextDatum;
- Knowledge authority.

HTTP success, executor success or raw-output presence is not semantic validity.

## 11. Fail-closed executable gaps

Current D02 v1 intentionally refuses to invent missing authority:

- a Model with required parameter slots is blocked until exact parameter/calibration authority exists;
- a Policy requiring upstream RuntimeDatum is blocked until D03 exists;
- a RuntimeBinding without the exact S03 executable relation is blocked;
- a wrong/missing executor registration is blocked;
- a wrong dispatch class is blocked.

These are explicit scope boundaries, not fallback behavior.

## 12. Acceptance surface

D02 remains root-wired through:

```text
npm run test:implementation-broker
```

which runs:

```text
acceptance/implementation-broker/run.mjs
acceptance/implementation-broker/integrity.mjs
acceptance/implementation-broker/idempotency.mjs
acceptance/implementation-broker/hardening.mjs
```

The initial implementation head `1aff53862ffbb19a74ff472d28d72e6f9290a749` had 28 D02 acceptance tests and exact-head full-root ADR Constitution run `31974561931` GREEN.

Independent review adds executable coverage for:

- runtime/execution identity tamper rejection;
- opaque raw-output hash tamper rejection;
- current-use authority revalidation before cached retry;
- post-dispatch clock regression without duplicate executor side effect;
- explicit retry-disposition semantics;
- runtime-node identity binding in the exact input envelope.

D02 is not CLOSED by a feature-branch GREEN alone. Closure still requires the repository delivery sequence: hardened exact feature head, Draft PR merge-ref validation, independent final diff review, Ready-state candidate revalidation, expected-head merge, actual protected-main verification and exact-main full-root CI.

## 13. Nonclaims

D02 does not claim:

```text
RuntimeExecutionEnvelope == RuntimeResult
rawOutput == RuntimeDatum
HTTP 200 == semantic validity
Implementation registered == conformant
historical RuntimeBinding replay == current runtime authorization
process-local idempotency == durable exactly-once
broker timeout == executor cancellation or no external side effect
executor locator == credential/network security
execution success == agronomic correctness
```

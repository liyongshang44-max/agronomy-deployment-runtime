# ADR v0.3 — MTL-P02 SDK + Generic Integration Contracts

Status: **IMPLEMENTATION CONTRACT / NON-ARCHITECTURE-AUTHORITY**

Baseline: `main @ c46b39b62c0dec82cb728f88ea7b816d5530ab3a`

## 1. Version-slice decision

P02 is implemented for the v0.3 Agronomist Pilot, not for later Runtime Legality or Decision Runtime versions.

The executable SDK surface is:

- TypeScript-compatible JavaScript runtime (`.mjs`);
- TypeScript declarations (`.d.ts`);
- P01 REST transport contract;
- generic ContextProvider / ResultSink message, webhook and batch envelopes;
- explicit adapter mapping rules;
- service-principal bearer authentication carrier.

Python is not claimed in v0.3. A Python binding may be added when an actual integration requires it, without changing P01 authority semantics.

`MODEL_EXECUTOR` and `OUTCOME_PROVIDER` remain standard integration-role names but are marked `RESERVED_NOT_EXERCISED_V0_3`. P02 does not fabricate ImplementationConformance, RuntimeBinding, RuntimeResult or Outcome authority before the corresponding later capability paths are implemented.

## 2. SDK authority boundary

The SDK is a transport/representation layer only.

It MUST NOT:

- call internal ADR scientific/authorization/runtime authority packages directly;
- infer or transform agronomic values;
- default missing source context;
- convert units;
- select semantic IDs from customer field names;
- create QualifiedKnowledge, Applicability or other authority outside P01 governed endpoints;
- expose recommendation / RuntimeEligibility / RuntimeBinding / DecisionResult shortcuts.

The repository constitution enforces that `sdks/*` may import only public ADR contracts internally; non-contract authority imports fail closed.

## 3. P01 parity

`SDK_PILOT_WRITE_OPERATIONS` and `SDK_PILOT_READ_OPERATIONS` must remain exactly aligned with P01's frozen operation registry.

Every authority write carries:

```text
Bearer token
Idempotency-Key
client-fixed Principal
exact AuthorizationDecisionAudit ref
logical id
version
exact resource contract version
full public resource payload
```

The SDK fixes Principal identity when the client is constructed. There is no per-call principal override.

The bearer token is transport-only and must never enter semantic resource payload, integration message, authority ref or ResultSink event.

Returned authority resources must reproduce the endpoint's exact frozen resource contract version and exact authority ref tuple:

```text
kind
logical_id
version
semantic_hash
```

Contract drift fails closed.

## 4. Semantic round-trip

The SDK must transport authority-critical public fields without flattening or reinterpretation. Executable acceptance uses a full ContextDatum including:

- semantic id/value/unit;
- epistemic class;
- provenance class;
- effective and available times;
- spatial/vertical/temporal support;
- uncertainty;
- source identity/hash;
- semantic hash.

The transport receives a defensive copy so it cannot mutate caller-owned semantic input.

## 5. Generic integration contracts

Standard role vocabulary:

```text
CONTEXT_PROVIDER    ACTIVE_PILOT
RESULT_SINK         ACTIVE_PILOT
MODEL_EXECUTOR      RESERVED_NOT_EXERCISED_V0_3
OUTCOME_PROVIDER    RESERVED_NOT_EXERCISED_V0_3
```

Generic integration messages preserve:

- role;
- message type/id;
- exact authority refs where applicable;
- opaque customer/provider payload.

Generic batch envelopes preserve message identity and reject duplicate message IDs.

ResultSink events distinguish exactly one of:

```text
exact authority_ref
or
non-authority projection_hash
```

They cannot conflate Workbench projection identity with ADR authority identity.

## 6. Adapter mapping rules

v0.3 adapters may perform only:

```text
EXACT_COPY
EXPLICIT_CONSTANT
```

`EXACT_COPY` copies a named source field byte-for-value into an explicit target field.

`EXPLICIT_CONSTANT` records a declared integration mapping constant, for example the customer-approved mapping from a source feed to a canonical ADR `semantic_id` or unit label.

The adapter contract rejects hidden:

- formulas;
- unit conversions;
- defaults;
- inferred crop/context values;
- scientific transformations.

A missing source field fails rather than being filled.

Scientific semantic conversion beyond explicit representation mapping belongs to governed Transformation authority, not the SDK/adapter.

## 7. Service principal auth

P02 does not mint tokens. `getAccessToken()` is an injected credential provider.

The client transports the token only in the HTTP Authorization header and sends the client-fixed ADR Principal in the P01 request envelope. P01 gateway semantics remain authoritative:

```text
bearer subject == declared request principal
AuthorizationDecisionAudit ref == replay-validated evidence, not capability
```

## 8. Acceptance

Root CI includes:

```text
npm run test:sdk-generic
```

Acceptance proves:

- exact SDK/P01 operation parity;
- full ContextDatum semantic round-trip;
- fixed client Principal and exact authorization ref transport;
- bearer/idempotency headers;
- exact path encoding;
- response contract drift fails closed;
- generic message/batch identity preservation;
- ResultSink authority-vs-projection separation;
- only v0.3 exercised roles are enabled;
- adapter rules reject formula/unit/default/transform shortcuts;
- missing source input is not invented;
- customer field names do not become ADR semantic IDs implicitly;
- tokens remain outside semantic payload;
- transport cannot mutate caller-owned semantic input;
- SDK source has no GEOX coupling, internal authority imports or downstream authority shortcuts;
- repository constitution rejects SDK internal authority imports.

P02 may be declared closed only after exact feature-head CI, current merge-ref CI, independent integration/security review, merge, actual main verification and exact-main CI are all green.

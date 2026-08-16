# ADR v0.1 — MTL-S02 Implementation Registry

Status: IMPLEMENTED CANDIDATE — merge gate not yet closed

Baseline: `main @ a21d75d703387e894ccf9d48c70e1939bd8387d7`

Task: `MTL-S02 — Implementation Registry`

## Frozen boundary

S02 registers immutable executable implementation identity only.

The frozen separation is:

`Specification ≠ Implementation ≠ ImplementationConformance`

An `Implementation` record does not assert that it implements any exact `QualifiedTransformation`, `Model`, or `Policy`. The exact specification-to-implementation relationship belongs exclusively to S03 `ImplementationConformance`.

Registration success therefore means only: an exact executable identity/version/hash exists in the registry under exact management authority.

It does **not** mean:

- the implementation conforms to a specification;
- the implementation is healthy or reachable now;
- the implementation is production-qualified;
- an executor owner may qualify its own implementation;
- a Model/Policy/Transformation semantic contract may be rewritten by executor metadata.

## F03 authorization seam

S02 adds a dedicated scoped permission:

`implementation.manage`

Resource type:

`IMPLEMENTATION`

No frozen built-in role receives this permission implicitly.

`specification.manage`, `runtime.profile.manage`, `knowledge.deploy`, and other existing permissions are not substitutes.

Publication requires exact Principal identity, exact RoleAssignment refs, organization/tenant scope, exact Implementation logical id, and a replayable `AuthorizationDecisionAudit`. No fake `KnowledgeGovernancePolicy` is introduced for this non-knowledge operation.

## Implementation v1

Contract: `adr.implementation.v1`

Authority class:

`EXECUTABLE_IMPLEMENTATION_IDENTITY`

Frozen semantic fields:

- `controlScope`
- `providerType`
- `implementationDigest`
- `executionLocator`
- `artifact`
  - `artifactId`
  - `contentHash`
- `runtimeMetadata`
  - `runtime`
  - `runtimeVersion`
  - `platform`
  - `architecture`
- `operationalConstraints`
- `conformanceClaim = NONE_REGISTRATION_ONLY`

The contract is closed. Specification refs, semantic model IO, decision logic, endpoint-health status, qualification status, `ImplementationConformance`, RuntimeBinding, and downstream decision/result fields cannot be embedded into an Implementation.

## Provider vocabulary

Core ADR provider vocabulary is platform-neutral:

- `INTERNAL` / `INTERNAL_FUNCTION`
- `HTTP` / `HTTPS_ENDPOINT`
- `CUSTOMER` / `CUSTOMER_RUNTIME`
- `FIRST_PARTY` / `FIRST_PARTY_RUNTIME`
- `WASM` / `WASM_MODULE`
- `BATCH` / `BATCH_JOB`

An initial S02 candidate used `GEOX` as a core provider enum because the planning document lists GEOX as an example provider type. Root Constitution run `31951596016` rejected that candidate before acceptance because ADR core may not depend on first-party consumer vocabulary.

That rejection is authoritative and the design was corrected rather than weakening the scanner. A concrete first-party consumer such as GEOX may register/adapt a first-party implementation outside the ADR core type system, but `GEOX` is not an ADR core provider class.

## Exact identity semantics

### implementationDigest

`implementationDigest` is the exact implementation/executable fingerprint used as part of immutable Implementation semantic identity.

It must be canonical `sha256:<64 lowercase hex>`.

Changing the implementation digest is a material Implementation change and requires a new immutable version.

### artifact.contentHash

`artifact.contentHash` is the exact content identity of the registered implementation artifact/build.

It is independently material and must also be canonical SHA-256.

S02 deliberately does not infer that `implementationDigest` and `artifact.contentHash` must be equal. They represent separate declared identities: executable implementation fingerprint versus exact registered artifact content. Both are frozen and replayable; neither permits `latest` semantics.

### executionLocator

`executionLocator` is exact immutable registry routing identity, not a health assertion.

For HTTP implementations, S02 requires an absolute credential-free HTTPS URL with no username/password, query, or fragment. A locator change is material to Implementation identity and requires a new version.

S02 does not probe the endpoint and does not claim it is currently healthy, reachable, performant, or conformant.

## Registration vs specification semantics

Implementation registration contains no Specification ref.

This is intentional. An executor may be registered before any claim is made about which exact specification it implements. Likewise, multiple implementation candidates may coexist without changing a Model/Policy/Transformation specification.

Acceptance proves that two executable candidates can be registered while an existing exact Model remains byte/semantic-ref unchanged.

S03 is the sole authority that may later bind:

`exact Specification ref + exact Implementation ref + conformance method/evidence/results/limits`

## Publication and replay

Implementation publication:

- validates exact `implementation.manage` authorization;
- requires publication actor = exact implementation manager;
- binds exactly the management `AuthorizationDecisionAudit` as publication input;
- rejects hidden additional authorization inputs;
- creates no `ImplementationConformance` as a side effect;
- preserves historical exact Implementation refs after newer versions exist;
- uses AuthorityLedger idempotency so an exact semantic retry cannot append a new publication audit or rebind original governance.

Validation returns:

`conformanceStatus = NOT_ESTABLISHED_BY_IMPLEMENTATION_REGISTRATION`

This is an explicit nonclaim, not a conformance state machine.

## Acceptance

All S02 suites are wired into root `npm test`.

S02-specific acceptance surface:

- F03 Implementation authorization: 8
- positive registry semantics/replay: 8
- integrity/nonclaim: 15
- retry governance: 1
- total: 32

Current exact root-wired GREEN:

- head `c4d0c018db3a85a4e2870662185af65cf9b0dec8`
- run `31951737780`
- result: GREEN full root CI

## Superseded red candidates

### Run 31951596016

RED at Constitution static check because S02 initially placed `GEOX` inside ADR core provider vocabulary.

Resolution: replace consumer-specific ontology with platform-neutral `FIRST_PARTY`; do not weaken Constitution.

### Run 31951683562

Reached S02 acceptance and produced 7/8 positive. The only failure was an acceptance fixture using nonexistent `ledger.list()` while proving that Implementation registration creates no conformance authority.

Resolution: use the existing immutable ledger snapshot and count `ImplementationConformance` records before/after registration. No registry authority semantics were weakened.

## Explicit nonclaims / next dependency

S02 does not prove any registered executor conforms to S01 specification authority.

The correct continuation is:

`S01 Specification Authority → S02 Implementation Registry → S03 ImplementationConformance Qualification → D02 Runtime Execution Broker`

D02 remains blocked until S03 establishes conformance for the exact specification/implementation actually executed.

## Closure rule

This document does not itself close S02. S02 becomes CLOSED only after final feature-head full-root CI, Draft merge-ref full-root CI, independent review, Ready-state exact candidate CI, exact-head merge, actual-main verification, and exact-main full-root CI are all GREEN.

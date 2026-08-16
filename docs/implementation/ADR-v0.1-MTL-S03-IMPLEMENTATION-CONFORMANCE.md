# ADR v0.1 — MTL-S03 ImplementationConformance Qualification

Status: IMPLEMENTED CANDIDATE — merge gate not yet closed

Baseline: `main @ 83d086d92b93f8226bbcfe5bf4acfce5e1a88f97`

Task: `MTL-S03 — ImplementationConformance Qualification`

## Frozen boundary

S03 establishes a first-class immutable authority relation proving that one exact `Implementation@version/hash` is qualified to implement one exact S01 `QualifiedTransformation`, `Model`, or `Policy` specification under stated execution conditions.

Invariant:

`Specification ≠ Implementation ≠ ImplementationConformance`

Registration success, endpoint reachability, HTTP 200, schema similarity, or executor ownership do not establish conformance.

## Qualification authorization

S03 adds one dedicated scoped F03 permission:

`implementation.conformance.qualify`

Resource type:

`IMPLEMENTATION_CONFORMANCE`

No frozen built-in role receives this permission implicitly.

`implementation.manage`, `specification.manage`, and `knowledge.qualify` are not substitutes.

The same explicit permission is used for S03 lifecycle controls `REVOKE` and `SUPERSEDE`, but each control is a separate exact authorization operation and audit record.

The qualification actor is intentionally separate from specification and implementation managers in acceptance fixtures. Executor ownership therefore confers no automatic self-certification authority.

## ImplementationConformance v1

Contract:

`adr.implementation-conformance.v1`

Authority class:

`SPECIFICATION_IMPLEMENTATION_CONFORMANCE`

The immutable relation binds:

- exact Specification ref/hash;
- exact Implementation ref/hash;
- qualification status `QUALIFIED`;
- exact qualification method id + definition SHA-256;
- complete compatibility-test evidence;
- derived exact input semantic hash;
- derived exact output semantic hash;
- exact Implementation digest;
- exact registered artifact content hash;
- qualified execution environment;
- required runtime capabilities;
- known limitations;
- strict validity interval;
- exact qualifier authorization/publication audit closure.

S03 v1 requires Specification, Implementation, qualifier, and conformance control scope to close on one organization/tenant.

## Compatibility evidence

The minimum v0.1 compatibility suite is closed and requires all three test classes:

1. `INPUT_CONTRACT_COMPATIBILITY`
2. `OUTPUT_CONTRACT_COMPATIBILITY`
3. `EXECUTION_FIXTURE`

Every required test must be present exactly once and have `outcome = PASS`.

Each test freezes:

- test type;
- test id;
- exact test-definition SHA-256;
- exact result SHA-256;
- PASS outcome.

The qualification method likewise freezes method id + exact definition SHA-256.

For v0.1 these content-addressed test/method records are embedded qualification evidence governed by the independent qualifier. The frozen architecture does not require a separate first-class TestResult authority type, so S03 does not expand the ontology beyond its task boundary.

## Qualified semantic envelope

Input/output semantic hashes are not caller assertions. S03 derives them from the exact S01 specification resolved from `specificationRef`.

- QualifiedTransformation → exact input/output contracts
- Model → exact inputs/outputs
- Policy → exact required inputs/runtime outputs

Historical validation recomputes these hashes from the exact frozen specification and rejects drift.

## Exact implementation identity

S03 independently freezes:

- `implementationDigest`
- `artifactContentHash`
- runtime
- runtime version
- platform
- architecture

Historical validation recomputes them from the exact S02 Implementation record.

A different executor version therefore needs a new Implementation and a new ImplementationConformance, but does not require a fake specification version.

## Execution scope

A current conformance is usable only when:

- current time is inside the exact half-open validity interval;
- runtime/runtimeVersion/platform/architecture match exactly;
- requested technical runtime environment is one of the qualified environments;
- every required capability is present;
- no valid REVOKE/SUPERSEDE control exists.

Current validation requires explicit `atTime` and execution context.

Historical validation preserves exact immutable qualification evidence without reapplying later lifecycle state.

## Lifecycle

### REVOKE

REVOKE blocks future/current runtime use of that exact conformance version without mutating or deleting its historical authority.

### SUPERSEDE

SUPERSEDE requires an exact successor `ImplementationConformance` version that:

- has the same conformance logical id;
- is a distinct exact version/hash;
- binds the same exact Specification ref;
- binds the same exact Implementation ref.

The old version becomes unavailable for new runtime composition; both old and successor remain historically replayable.

One exact conformance version may have at most one valid terminal lifecycle control.

## RuntimeBinding conditional seam

Independent review of the first GREEN S03 candidate found that C11/MTL-S03 was not complete until RuntimeBinding could enforce conformance authority.

The D01 contract therefore activates its previously conditional S03 seam while preserving the original minimal path.

A RuntimeBinding may still contain **zero** executable specification bindings, exactly as before.

When an executable specification is selected, S03 v1 permits at most one exact relation per RuntimeBinding:

- one exact S01 specification ref in the corresponding transformation/model/policy binding array;
- one exact Implementation ref;
- one exact ImplementationConformance ref;
- one frozen execution context.

Publication input is a closed `specificationExecutionBinding` containing only:

- exact specification ref;
- exact implementation ref;
- exact conformance ref;
- available capability names.

The caller cannot supply runtime identity or deployment environment. ADR derives:

- runtime/version/platform/architecture from exact Implementation;
- runtime environment from exact Deployment;
- logical time from exact ContextManifest.

Before publication ADR performs **current** ImplementationConformance validation. Therefore expired, revoked, superseded, out-of-environment, or capability-incomplete conformance cannot enter a new RuntimeBinding.

The publication audit input closure includes exact Specification + Implementation + ImplementationConformance refs.

Historical RuntimeBinding replay validates the exact frozen trio and the frozen execution envelope using historical conformance authority, so a later REVOKE/SUPERSEDE does not rewrite what was actually bound earlier.

Calibration bindings remain forbidden until S04.

## Explicit nonclaims

S03 does not:

- dispatch an executor;
- perform HTTP/network execution;
- create RuntimeResult;
- prove scientific correctness of a Model/Policy/Transformation;
- make an Implementation healthy or reachable;
- make conformance globally valid outside its scope/time/environment;
- implement CalibrationArtifact authority;
- implement D02 Runtime Execution Broker.

## Acceptance

All S03 suites are root-wired.

S03-specific acceptance at the integrated head:

- conformance authorization: 8
- positive relation/replay: 8
- integrity/nonclaim: 9
- lifecycle: 6
- RuntimeBinding integration: 8
- total S03-specific: **39**

The D01 RuntimeBinding suite also remains GREEN with:

- positive: 6
- integrity: 12

### First substantive GREEN

Head:
`b3192930e9936cb8ac9578165bff083fb7770dca`

Run:
`31972850187` — GREEN full root CI.

This proved the standalone S03 relation/lifecycle but was not treated as final because independent review found the missing RuntimeBinding integration acceptance.

### Integrated GREEN

Head:
`b56b6748ca555fba398c46dbb181d9aff63c5869`

Run:
`31973264137` — GREEN full root CI.

This run proves:

- valid exact conformance can enter RuntimeBinding;
- one exact Model can bind separate conforming implementations without Model mutation;
- expired conformance cannot bind;
- revoked conformance cannot bind;
- superseded old conformance cannot bind while successor can;
- unqualified Deployment runtime environment cannot bind;
- missing required capabilities cannot bind;
- historical RuntimeBinding remains replayable after later conformance revocation.

## Unlock

After S03 closes, the hard predecessor chain required for `MTL-D02 — Runtime Execution Broker` is satisfied for an actual executable specification path:

`S01 Specification Authority → S02 Implementation Registry → S03 ImplementationConformance → D02 Runtime Execution`

S04 remains conditional only when calibration is material to the runtime plan.

## Closure rule

This document does not itself close S03. S03 becomes CLOSED only after final feature-head full-root CI, Draft merge-ref full-root CI, independent review, Ready-state exact-candidate CI, exact-head merge, actual-main verification, and exact-main full-root CI are all GREEN.

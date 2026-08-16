# ADR v0.1 — MTL-S01 Specification Authority

Status: IMPLEMENTED CANDIDATE — merge gate not yet closed

Baseline: `main @ e27138ab48e79b7c434bc23327fe1ca4c3349b42`

Task: `MTL-S01 — Transformation / Model / Policy Specification Authority`

## Frozen boundary

S01 establishes immutable specification authority independently from executable implementation availability.

The three authority kinds are:

- `QualifiedTransformation`
- `Model`
- `Policy`

They are semantic/control-plane specifications. They are not `Implementation`, `ImplementationConformance`, `RuntimeBinding`, `RuntimeResult`, `ContextDatum`, or KnowledgeRelease members.

Final Adjudication supersedes older clauses that placed mutable implementation availability inside Model/Policy/Transformation specification semantics. Therefore S01 specifications contain no endpoint, executor, provider-health, implementation list, or conformance claim.

## F03 authorization seam

S01 adds a dedicated scoped permission:

`specification.manage`

Closed resource vocabulary:

- `QUALIFIED_TRANSFORMATION`
- `MODEL`
- `POLICY`

No frozen built-in role receives this permission implicitly.

`knowledge.qualify`, `runtime.profile.manage`, `context.write`, and deployment permissions are not substitutes.

Publication requires exact Principal identity, exact RoleAssignment refs, organization/tenant scope, exact resource type, exact logical resource id, and a replayable `AuthorizationDecisionAudit`. No fake `KnowledgeGovernancePolicy` is introduced for this non-knowledge operation.

## QualifiedTransformation v1

Contract: `adr.qualified-transformation.v1`

Freezes:

- exact semantic input contract;
- exact semantic output contract;
- exact method id + content hash;
- applicability-domain requirements;
- uncertainty consequence;
- explicit limitations;
- epistemic rule.

The minimal S01 transformation rule is `PRESERVE`: input and output epistemic classes must be identical. The transformation may change representation/semantic/unit contract only through its exact governed method; it cannot create missing evidence or silently upgrade epistemic authority.

## Model v1

Contract: `adr.model.v1`

Freezes:

- purpose;
- exact semantic inputs and outputs;
- evidence/state requirements;
- parameter slots;
- accepted knowledge authority kinds;
- measurement conventions;
- applicability domain;
- calibration requirements;
- limitations;
- computational method id + exact definition hash.

Model output must declare exactly one of `DERIVED`, `STATE_ESTIMATE`, `FORECAST`, or `MODEL_PRIOR`. `OBSERVATION` is explicitly forbidden for Model output.

Model semantic identity contains no endpoint or implementation identity. A new executor therefore does not require a fake Model version. A material computational/semantic contract change does.

## Policy v1

Contract: `adr.policy.v1`

Freezes:

- decision type;
- action space;
- required semantic inputs;
- required runtime outputs;
- exact decision-logic definition;
- threshold-authority mode/ref set;
- operational constraints;
- jurisdiction constraints;
- human gate;
- fallback disposition;
- abstention conditions;
- limitations.

Policy is decision logic, not Knowledge. The closed contract rejects KnowledgeRelease embedding, DecisionResult embedding, selected-action outputs, endpoint fields, and implementation lists.

`SPEC_DEFINED` threshold authority is self-contained in the exact Policy definition. `EXTERNAL_AUTHORITY` requires exact immutable authority refs, which are included in publication audit closure and must resolve exactly; S01 does not reinterpret those refs as knowledge or implementation authority.

## Publication and replay

All three specification kinds:

- use exact immutable semantic identity;
- require the exact `specification.manage` authorization;
- bind the exact AuthorizationDecisionAudit and any embedded exact authority refs in publication audit inputs;
- require publication actor = authorized specification manager;
- reject generic-ledger forged specification records lacking the exact publication/authorization audit closure;
- preserve exact historical versions after later versions appear;
- rely on normal AuthorityLedger idempotency so an exact semantic retry does not append a new publication audit or rebind original governance.

## Acceptance

`test:specification` and specification authorization acceptance are wired into root `npm test` from the first substantive S01 run.

Current S01 acceptance surface:

- F03 specification authorization: 8
- positive specification semantics/replay: 9
- integrity/nonclaim: 14
- retry governance: 1
- total S01-specific: 32

Root-wired runs:

- `31950736001` at `5ec7d282861a79545b538c984dad135eacb733ec`: GREEN (31 S01 checks before retry test was added)
- `31950849156` at `10aa1482055341672b2b1439aae38fccd10a6399`: GREEN with retry governance wired into root

## Nonclaims

S01 does not register an executable implementation and does not prove conformance.

Those remain:

- S02 — Implementation Registry
- S03 — ImplementationConformance Qualification

D02 Runtime Execution Broker remains blocked until S03 exists for the specification actually executed. S01 therefore does not create a no-op/fake executor merely to preserve task-line visual continuity.

## Closure rule

This document does not itself close S01. S01 becomes CLOSED only after final feature-head root CI, Draft merge-ref CI, independent review, Ready-state exact candidate CI, exact-head merge, actual-main verification, and exact-main full-root CI are all GREEN.

# ADR v0.1 — MTL-A01 DecisionProblem / Use-Purpose Authority

Status: **IMPLEMENTATION CONTRACT — A01**

Baseline: `main @ 4455a23e3c785137ee8da29938484e416768a666`

Implementation extensions after the original A01 slice:

- the A01 independent review established explicit F03 `decision.problem.create` scoped authorization and superseded the earlier identity-only creation seam;
- the A07 independent review hardened DecisionProblem timestamps against impossible-calendar / JavaScript Date normalization without changing DecisionProblem authority semantics.

## 1. Frozen authority basis

A01 implements the existing Architecture v1.0 authority set without reopening it:

- `ADR-DOMAIN-MODEL-v1.0.md` — DecisionProblem owns decision-scope authority only;
- `ADR-AGRONOMIC-CONTEXT-AND-PUBLIC-RUNTIME-CONTRACT-v1.0.md` — `adr.decision-problem.v1` public contract;
- `ADR-ARCHITECTURE-v1.0-FINAL-ADJUDICATION.md` — DecisionProblem belongs to the Deployment Runtime Plane and `RUNTIME_ONLY` cannot produce a DecisionResult;
- `ADR-CAPABILITY-MAP-01.md` C07;
- `ADR-MASTER-TASK-LINE-01.md` MTL-A01.

No architecture amendment is introduced by this implementation.

## 2. Authority boundary

`DecisionProblem` answers only:

> What exact decision/question is ADR solving, for which target, logical time, horizon, objective, constraints, action space, use semantics and decision-authority mode?

Authority class:

```text
DECISION_SCOPE
```

It does not establish agronomic truth, target-context truth, knowledge applicability, runtime legality, a recommended/selected action, or a DecisionResult.

## 3. v1 semantic payload

The A01 semantic payload contains exactly:

```text
contractVersion = adr.decision-problem.v1
authorityClass = DECISION_SCOPE
decisionType
targetRef
logicalTime
decisionHorizon.duration
objective.code
actionSpace[]
constraints[]
usePurpose
useClass
decisionAuthorityMode
decisionDeadline
```

`targetRef` v1 admits only `organizationId`, optional `tenantId`, `farmId`, `fieldId`, `seasonId`, and `zoneId`. It must not acquire GEOX/customer-specific schema fields.

`logicalTime` and `decisionDeadline` must be explicit RFC3339 timestamps with timezone, at most millisecond fractional precision, real calendar dates/clock values, and timezone offsets within the deterministic RFC3339 bound of ±14:00. Invalid dates such as February 30 are rejected before JavaScript `Date` parsing and may not be silently normalized into a different instant. Valid values are canonicalized to UTC ISO form before hashing.

`decisionHorizon.duration` must be a syntactically valid ISO-8601 duration. Week-form durations are kept distinct and cannot be mixed with date/time components. A01 preserves the exact normalized duration string as decision-scope semantics; it does not silently convert calendar durations into elapsed-hour claims.

`actionSpace` is a non-empty canonical set of action codes. Decision-material action parameters may be represented by explicit constraints and, in later capabilities, governed Policy action contracts. A01 does not create a Policy DSL.

`constraints` is a canonical set of structured constraint objects. A01 preserves them as decision-scope semantics; it does not interpret them as agronomic conclusions. Constraint structure is recursively checked so fields that would carry downstream recommendation, applicability, robustness, runtime-result or final-decision authority cannot be hidden inside a constraint object.

## 4. Semantic identity

Material changes to decision type, target scope, logical time, horizon, objective, action space, constraints, use purpose, use class, authority mode, or deadline create a different semantic hash.

Action-space and constraint ordering are non-semantic because both are sets. Timestamp representation is normalized to UTC ISO form before hashing only after strict calendar/time/offset validation.

Published authority remains immutable under the shared AuthorityLedger. A later version cannot rewrite an earlier exact ref/hash.

## 5. Creation-scope authority

The original A01 minimum identity-only creation seam was superseded by the A01 independent-review F03 extension. Current DecisionProblem creation requires the explicit permission:

```text
decision.problem.create
```

with these invariants:

- no existing built-in role receives the permission implicitly;
- `context.write` is not interchangeable with it;
- publication requires an exact content-addressed `AuthorizationDecisionAudit`;
- the decision must be replayable from exact immutable `RoleAssignment` refs;
- request scope binds exact organization, optional tenant, `resourceType=DECISION_PROBLEM`, and exact DecisionProblem logical id;
- creator organization/tenant must still exactly match target organization/tenant;
- same principal id/type in another tenant contributes no authority;
- scoped DecisionProblem creation does not fabricate a `KnowledgeGovernancePolicy` / `policyRef`;
- publication audit actor must equal the exact creator and must directly bind the exact creation authorization.

See also `ADR-v0.1-MTL-A01-F03-SCOPED-AUTHORIZATION-SEAM.md` and the A01 extension notice in the F03 implementation contract.

## 6. Decision-authority guard

Frozen modes:

```text
ADR_POLICY
EXTERNAL_POLICY
RUNTIME_ONLY
```

A01 exports a downstream authority guard with these invariants:

```text
RUNTIME_ONLY    -> no DecisionResult authority exists
ADR_POLICY      -> ADR_POLICY authority only
EXTERNAL_POLICY -> EXTERNAL_POLICY authority only
```

The guard does not create DecisionResult. It only prevents later runtime layers from laundering or fabricating final-decision authority contrary to the exact DecisionProblem.

## 7. Replay / anti-laundering

Validation requires exact `DecisionProblem` ref/hash, exact frozen v1 semantic shape, `authorityClass = DECISION_SCOPE`, direct publication audit, exact creator actor, exact creator organization/tenant against target scope, and exact replayable `decision.problem.create` RoleAssignment authorization.

A generic AuthorityLedger record using kind `DecisionProblem`, copied audit vocabulary, or forged AuthorizationDecision without exact RoleAssignment authority is not valid DecisionProblem authority.

## 8. Acceptance boundary

A01 acceptance proves positive immutable publication/replay, canonical ordering stability, material identity across every frozen decision-scope dimension, semantic mutation rejection, exact historical replay, cross-org/tenant fail-closed behavior, audit anti-impersonation, top-level and nested conclusion/result laundering rejection, strict horizon syntax, strict RFC3339/calendar/timezone validation, action validation, `RUNTIME_ONLY` final-decision denial, ADR/external authority-mode separation, scoped authorization replay, and generic-ledger anti-laundering.

## 9. Explicit nonclaims

A01 does not implement or claim ContextDatum, AuthorizedContextReference, ResolvedContextDatumReceipt, ContextManifest, KnowledgeRetrievalResult, ApplicabilityAssessment, RuntimeProfile, Deployment, RuntimePlan, RuntimeEligibility, RuntimeBinding, RuntimeAlternativeSet, RuntimeResult, DecisionRobustness, or DecisionResult.

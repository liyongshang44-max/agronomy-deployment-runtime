# ADR v0.1 — MTL-A01 DecisionProblem / Use-Purpose Authority

Status: **IMPLEMENTATION CONTRACT — A01**

Baseline: `main @ 4455a23e3c785137ee8da29938484e416768a666`

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

`actionSpace` is a non-empty canonical set of action codes. Decision-material action parameters may be represented by explicit constraints and, in later capabilities, governed Policy action contracts. A01 does not create a Policy DSL.

`constraints` is a canonical set of structured constraint objects. A01 preserves them as decision-scope semantics; it does not interpret them as agronomic conclusions.

## 4. Semantic identity

Material changes to target scope, logical time, horizon, objective, action space, constraints, use purpose, use class, authority mode, or deadline create a different semantic hash.

Action-space and constraint ordering are non-semantic because both are sets. Timestamp representation is normalized to UTC ISO form before hashing.

Published authority remains immutable under the shared AuthorityLedger. A later version cannot rewrite an earlier exact ref/hash.

## 5. Creation-scope authority

F03 currently has no frozen DecisionProblem-specific mutation permission. A01 therefore does **not** reuse `context.write`, invent a new permission silently, or claim a complete runtime-plane IAM model.

Until a dedicated runtime mutation permission is separately adjudicated, A01 is fail-closed at the existing principal identity boundary:

```text
creator.organizationId == target.organizationId
creator.tenantId       == target.tenantId
```

The exact creator principal and target scope are retained in immutable audit authority. Creation audit actor must equal the creator principal.

This is an A01 minimum authority seam, not a claim that organization/tenant identity alone is the final production authorization model.

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

Validation requires exact `DecisionProblem` ref/hash, exact frozen v1 semantic shape, `authorityClass = DECISION_SCOPE`, direct publication audit, exact creator actor, and exact creator organization/tenant against target scope.

A generic AuthorityLedger record using kind `DecisionProblem` without the A01 publication audit contract is not valid DecisionProblem authority.

## 8. Acceptance boundary

A01 acceptance proves positive immutable publication/replay, canonical ordering stability, material identity changes, semantic mutation rejection, exact historical replay, cross-org/tenant fail-closed behavior, audit anti-impersonation, rejection of agronomic result fields, time/action validation, `RUNTIME_ONLY` final-decision denial, ADR/external authority-mode separation, and generic-ledger anti-laundering.

## 9. Explicit nonclaims

A01 does not implement or claim ContextDatum, AuthorizedContextReference, ResolvedContextDatumReceipt, ContextManifest, KnowledgeRetrievalResult, ApplicabilityAssessment, RuntimeProfile, Deployment, RuntimePlan, RuntimeEligibility, RuntimeBinding, RuntimeAlternativeSet, RuntimeResult, DecisionRobustness, or DecisionResult.

# ADR v0.1 — MTL-D06 DecisionResult / DecisionDisposition

Status: implementation candidate for frozen MTL-D06.

## Purpose

D06 converts an exact D05 `DecisionRobustness` authority into one immutable structured decision result when the exact `DecisionProblem.decisionAuthorityMode` permits decision ownership.

It preserves the permanent boundary:

```text
RuntimeEligibility != DecisionDisposition != DecisionResult
```

and does not convert a decision result into approval or execution authority.

## Publication input

The evidence-backed publisher accepts only:

```text
ledger
logicalId
version
decisionRobustnessRef
decidedAt
audit
```

The caller cannot supply:

- DecisionDisposition;
- selected action;
- ASK InformationRequirement refs;
- WAIT semantics;
- abstention reasons;
- confidence/probability.

Those are reconstructed from exact frozen authority.

## Decision authority modes

`RUNTIME_ONLY` is a permanent stop boundary and cannot publish ADR `DecisionResult`.

`ADR_POLICY` may publish a result when exact D05/Policy/InformationRequirement authority supports it.

`EXTERNAL_POLICY` requires an exact Policy authority. ADR cannot fabricate a decision on behalf of an external policy owner.

## Dispositions

### ACT

ACT is available only when exact `DecisionRobustness = ROBUST` and one exact common Policy authority exists.

ACT carries the full governed `MaterialActionSignature`, including material amount/timing parameters and exact Policy ref. A generic `ACT` label is insufficient.

An action code whose text happens to be `WAIT` remains action semantics. It does not become `DecisionDisposition=WAIT`.

### ASK

ASK is generated from exact decision-material `InformationRequirement` identities frozen in the historical `RuntimeEligibility` behind the exact RuntimeAlternativeSet.

Current R03 semantics make global InformationRequirements non-empty only when no legal runtime exists. In that case there may be no executable Policy binding. For `ADR_POLICY`, exact `DecisionRobustness` therefore serves as the ASK decision-authority reference; Policy evidence is not fabricated.

### WAIT

WAIT is available only from exact Policy fallback `WAIT` for a non-ROBUST result. It freezes:

```text
REEVALUATE_ON_NEW_DECISION_MATERIAL_EVIDENCE_OR_DEADLINE
```

plus the exact DecisionProblem deadline, Policy ref and DecisionRobustness ref.

### ABSTAIN

ABSTAIN carries governed reason authority bound to exact DecisionRobustness and, when applicable, exact Policy fallback.

Policy fallback `EXTERNAL_AUTHORITY` becomes ADR-side ABSTAIN/defer rather than a fabricated external action.

When ADR_POLICY has no exact Policy and no ASK-able InformationRequirement, unresolved DecisionRobustness may directly authorize ABSTAIN.

## Policy-result references

The frozen architecture requires Policy result references but does not define a separate first-class `PolicyResult` authority object.

D05 already freezes each exact action evaluation:

```text
pathId
RuntimeBinding ref
Policy ref
executionEvidenceHash
MaterialActionSignature hash (when available)
```

D06 therefore creates a content-addressed composite `PolicyResultReference` into that exact D05 evaluation. It does not invent a parallel mutable result object.

ACT requires at least one exact Policy-result ref. ASK without a Policy has none by design.

## Human gate and downstream authority

Exact Policy `humanGate` is retained whenever Policy is the decision authority.

It does not turn into ASK; ASK is an information need, not a human approval request.

Every DecisionResult freezes:

```text
humanApprovalAuthority = NONE_DECISION_RESULT_IS_NOT_HUMAN_APPROVAL_AUTHORITY
machineExecutionAuthority = NONE_DECISION_RESULT_IS_NOT_MACHINE_EXECUTION_AUTHORITY
```

Thus a valid ACT DecisionResult still requires later governed approval/execution authority where applicable.

## Time

`decidedAt` must be offset-aware and satisfy:

```text
DecisionProblem.logicalTime <= decidedAt <= DecisionProblem.decisionDeadline
```

## Replay

Validation reconstructs the result from only the frozen `DecisionRobustness` ref and stored `decidedAt`, then replays:

- exact DecisionProblem authority mode/time/action space;
- exact D05 DecisionRobustness;
- exact D04 RuntimeAlternativeSet / historical RuntimeEligibility;
- exact Policy/fallback/human gate when present;
- exact InformationRequirement refs for ASK;
- exact composite Policy-result refs;
- exact runtime binding universe;
- derived disposition and structured action;
- publication audit closure.

A schema-valid, semantic-hash-consistent forged ACT/ASK is rejected if those exact authorities do not reproduce it.

## Nonclaims

D06 does not:

- make `RUNTIME_ONLY` into decision authority;
- treat `SENSITIVE` or `UNRESOLVED` as ACT;
- interpret action-code strings as DecisionDisposition;
- invent Policy authority for INFORMATION_REQUIRED;
- authorize human approval;
- authorize machine execution;
- perform downstream execution.

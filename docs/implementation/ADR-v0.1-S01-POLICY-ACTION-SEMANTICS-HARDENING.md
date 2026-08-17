# ADR v0.1 — S01 Policy Action Semantics Hardening

Status: **IMPLEMENTATION HARDENING CANDIDATE — NOT ARCHITECTURE AUTHORITY**

Predecessor implementation: `MTL-S01 — Transformation / Model / Policy Specification Authority`

Discovered by: `MTL-D05 — DecisionRobustness / MaterialActionSignature`

## 1. Why this hardening exists

The frozen architecture requires `DecisionRobustness` to compare a governed `MaterialActionSignature`, not merely ACT/WAIT labels. Material equivalence is defined by the `DecisionProblem` action space and the exact Policy action-equivalence contract, including decision-material amount, timing and constraints.

The original S01 implementation of `adr.policy.v1` froze only an action-code list plus decision logic/constraints/gates. It did not implement S01's already-planned `parameter/action semantics` deliverable and therefore did not expose the action-equivalence authority D05 requires.

D05 must not repair that omission by inventing local comparison rules.

This change closes the S01 implementation gap without changing frozen architecture.

## 2. Versioning rule

Historical `adr.policy.v1` remains accepted exactly with its original semantics:

- action-space codes;
- decision logic;
- threshold authority;
- required inputs/runtime outputs;
- operational/jurisdiction constraints;
- human gate;
- fallback;
- abstention conditions;
- limitations.

`adr.policy.v1` does **not** retroactively acquire action-equivalence semantics.

Current complete Policy specification contract becomes:

```text
adr.policy.v2
```

This avoids changing the meaning of an existing contract version and preserves historical replay.

## 3. Policy v2 action semantics

Policy v2 retains the existing `actionSpace: string[]` as the closed action-code vocabulary and adds:

```text
actionSemantics:
  equivalenceMode
  actions[]
```

Each action semantic entry binds exactly one declared `actionCode` and zero or more typed parameters.

Each parameter freezes:

- `name`;
- `semanticId`;
- `valueType` from the existing ADR portable value vocabulary;
- `unit`;
- `required`;
- `material`.

The action-semantic set must cover the Policy action space exactly: one semantic contract per action code and no undeclared action code.

## 4. Material equivalence mode

S01 v2 currently recognizes one exact mode:

```text
EXACT_MATERIAL_PARAMETERS
```

Meaning for downstream D05:

- action code itself is decision-material;
- parameters with `material: true` participate in `MaterialActionSignature`;
- parameters with `material: false` remain governed output metadata but cannot make otherwise identical actions materially different;
- typed material values are compared under their declared semantic ID/value type/unit contract;
- D05 may not infer a tolerance, range, probability or semantic equivalence not declared by Policy authority.

Example Policy semantics may declare:

```text
IRRIGATE_NOW
  amount      action.irrigation.amount      DECIMAL   mm       material
  start_time  action.irrigation.start_time  TIMESTAMP iso8601  material
  note        action.note                    STRING    1        non-material
```

This is sufficient for the frozen invariant:

```text
IRRIGATE 10 mm != IRRIGATE 30 mm
```

without placing a hard-coded irrigation rule in D05.

## 5. Permanent nonclaims

Policy action semantics are **specification authority only**.

They do not create:

- a selected action;
- a DecisionDisposition;
- a DecisionResult;
- execution permission;
- human approval;
- machine actuation authority;
- runtime evidence;
- scientific correctness.

Executor endpoint, implementation identity, selected action, RuntimeBinding/RuntimeResult and DecisionResult fields remain forbidden in Policy specification semantics.

## 6. Historical compatibility

`normalizePolicy` accepts both contract versions:

- v1: action semantics absent by definition;
- v2: action semantics required.

Attempting to attach v2 action semantics to a v1 payload fails closed instead of silently changing v1 meaning.

Historical v1 Policy authority must remain replayable after a v2 version of the same logical Policy exists.

D05 will treat a Policy lacking governed v2 material-equivalence semantics as insufficient authority for a positive robustness claim rather than guessing.

## 7. Integrity rules

Policy v2 fails closed when:

- action semantics are absent;
- action semantics omit an action-space code;
- action semantics introduce an unknown action code;
- an action code appears twice;
- parameter names duplicate within one action;
- parameter semantic IDs duplicate within one action;
- parameter value type is outside ADR's portable value vocabulary;
- required/material flags are not boolean;
- equivalence mode is not governed;
- runtime/executor/selected-action metadata is inserted into the semantic contract.

Changing any material action schema field or materiality flag changes Policy semantic identity.

## 8. D05 boundary after closure

Once this hardening is merged and actual-main accepted, D05 may define the runtime `PolicyActionOutput` evidence shape and derive `MaterialActionSignature` only by validating that output against exact Policy v2 action semantics.

D05 still owns:

- action evidence normalization across legal worlds;
- MaterialActionSignature generation;
- ROBUST / SENSITIVE / UNRESOLVED comparison;
- action-changing uncertainty diagnostics.

S01 owns only the semantic/equivalence contract those operations must obey.

## 9. Closure rule

This hardening is not closed by branch tests alone. It requires:

1. exact feature-head full-root CI;
2. Draft synthetic merge-candidate full-root CI;
3. exact review;
4. Ready-state no-drift revalidation;
5. expected-head merge;
6. actual protected-main verification;
7. actual-main full-root CI.

Only then may the D05 branch be rebased/recreated on the corrected S01 baseline.

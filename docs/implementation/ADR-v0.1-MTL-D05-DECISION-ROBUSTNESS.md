# ADR v0.1 — MTL-D05 DecisionRobustness / MaterialActionSignature

Status: implementation candidate for frozen MTL-D05.

## Purpose

D05 determines whether exact runtime alternatives imply the same materially meaningful action. It is not a confidence score and it does not choose or authorize the final decision result.

The authority chain is:

```text
DecisionProblem
+ RuntimeAlternativeSet
+ RuntimeProfile robustnessRequirement
+ exact RuntimeBinding(s)
+ exact Policy v2 actionSemantics
+ retained D02 Policy execution envelope(s)
        ↓
MaterialActionSignature per evaluable world
        ↓
DecisionRobustness
  ROBUST | SENSITIVE | UNRESOLVED
```

## Policy action evidence

D02 output remains opaque execution evidence. D05 recognizes a strict action-evidence payload:

```text
adr.policy-action-output.v1
  actionCode
  parameters[] = { name, typed value }
```

The executor does **not** author `semanticId`, `unit`, `material`, or action-equivalence semantics. Those are reconstructed from the exact `adr.policy.v2` authority bound by the exact RuntimeBinding.

## MaterialActionSignature

The exact Policy v2 action-equivalence mode is currently:

```text
EXACT_MATERIAL_PARAMETERS
```

The signature contains:

- exact Policy ref;
- action code;
- only parameters declared `material: true` by Policy authority;
- exact parameter semantic ID, value type, unit, and canonical typed value;
- deterministic semantic hash.

Therefore:

- `IRRIGATE_NOW amount=10 mm` and `amount=30 mm` are different material actions;
- `WAIT` and `IRRIGATE_NOW` are different material actions;
- changing a parameter declared non-material, such as an audit/display note, does not change the MaterialActionSignature.

No numeric tolerance, confidence weighting, label-only comparison, or probability aggregation is permitted in D05 v1.

## Coverage gate

`RuntimeAlternativeSet` remains the exact D04 coverage authority. D05 does not select a convenient subset.

Positive resolution requires the exact RuntimeAlternativeSet completeness class to satisfy the exact active RuntimeProfile v2 `robustnessRequirement.sufficientCompletenessClasses`.

Consequences:

- `INCOMPLETE` can never yield `ROBUST`;
- RuntimeProfile v1 cannot positively authorize a `ROBUST` conclusion because it has no D05 robustness requirement;
- a profile may require a stronger governed coverage class than the current D04 set provides; the result is then `UNRESOLVED`.

## Robustness classes

### ROBUST

Returned only when:

1. coverage is sufficient under the exact RuntimeProfile requirement;
2. every included runtime world has exact Policy v2 equivalence authority;
3. every included runtime world has exact successful Policy execution evidence;
4. all included worlds use one exact Policy authority for D05 v1 equivalence;
5. all MaterialActionSignatures are identical.

### SENSITIVE

Returned only when the same positive prerequisites hold, but at least two distinct MaterialActionSignatures exist.

### UNRESOLVED

Returned whenever coverage or action-comparison authority is insufficient, including:

- missing RuntimeProfile robustness requirement;
- insufficient RuntimeAlternativeSet coverage;
- no included runtime world;
- non-Policy executable binding;
- Policy without v2 exact material-equivalence authority;
- missing/failed Policy execution evidence;
- multiple exact Policy authorities without a governed cross-policy equivalence contract.

Observed action differences may still appear in diagnostics when available, but insufficient coverage remains `UNRESOLVED` rather than being laundered into `SENSITIVE` or `ROBUST`.

## Action-changing uncertainty diagnostics

Every D04 material uncertainty dimension is retained. D05 maps available per-path MaterialActionSignatures onto that dimension:

- `ACTION_CHANGING` — at least two evaluable paths in the dimension and more than one signature;
- `ACTION_STABLE` — at least two evaluable paths and one signature;
- `NOT_EVALUABLE` — fewer than two evaluable paths.

The diagnostic does not override the global coverage gate.

## Replay

DecisionRobustness stores exact normalized D02 execution envelopes and their evidence hashes. Validation replays:

- RuntimeAlternativeSet authority;
- DecisionProblem;
- RuntimeProfile;
- included RuntimeBinding relations;
- exact Policy authorities;
- retained D02 execution evidence;
- MaterialActionSignature derivation;
- signature groups;
- uncertainty diagnostics;
- final robustness class and unresolved reason set.

A structurally plausible signature or classification is not sufficient authority.

## Public API boundary

The package public API exposes normalizers plus evidence-backed publish/validate operations. The internal `deriveMaterialActionSignature` creator is deliberately not exported from the package index.

## Nonclaims

D05 does not:

- create DecisionResult;
- choose ASK / ABSTAIN / WAIT / action disposition;
- execute an action;
- make RuntimeDatum into ContextDatum;
- make incomplete coverage complete;
- define implementation-variance coverage absent D04 authority;
- convert probability/confidence into robustness authority.

Those boundaries remain for later task-line capabilities, beginning with D06.

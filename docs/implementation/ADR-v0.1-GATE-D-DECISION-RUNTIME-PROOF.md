# ADR v0.1 — Gate D Decision Runtime Proof

Status: implementation acceptance candidate.

Gate D closes the Decision Runtime Proof required by `docs/planning/ADR-MASTER-TASK-LINE-01.md` after MTL-D01 through MTL-D06.

## Proof chain

The Gate D acceptance is intentionally continuous rather than a list of independent unit assertions:

```text
exact DecisionProblem / Deployment / RuntimeProfile / RuntimeEligibility
→ exact Model RuntimeBinding
→ conformant D02 Model execution
→ evidence-backed D03 RuntimeResult / RuntimeDatum
→ exact Policy RuntimeBinding requiring that RuntimeDatum semantic
→ D02 mixed ContextDatum + RuntimeDatum Policy execution
→ D04 RuntimeAlternativeSet with exhaustive legal-path coverage
→ D05 DecisionRobustness over the real Policy execution envelope
→ D06 immutable structured DecisionResult
```

The Policy executor request is captured and inspected. Its runtime entry must retain the exact `runtimeResultSemanticHash`, `executionEvidenceHash`, `runtimeDatumId`, semantic ID and output semantic hash produced by D03. A bare value or caller-authored semantic substitute is not accepted as equivalent evidence.

## Positive proof

The acceptance proves that:

- the upstream Model and final Policy use separate exact RuntimeBinding authorities;
- the Model execution is conformant and yields a `STATE_ESTIMATE` RuntimeDatum with `MODEL` provenance;
- the final Policy actually consumes that evidence-backed RuntimeDatum through the D02 post-D03 mixed-input seam;
- D04 coverage is `EXHAUSTIVE_ENUMERATION` for the frozen final legal policy world;
- D05 returns `ROBUST` only over the exact successful Policy execution evidence;
- D06 returns structured `ACT` carrying exact material action parameters;
- D03, D04, D05 and D06 replay validators can reconstruct the stored proof from exact authority/evidence refs.

## Fail-closed proof

The Gate D integration also proves that:

- a forged RuntimeResult evidence hash cannot enter the Policy execution;
- the legacy ContextDatum-only broker path cannot bypass a Policy `requiredRuntimeOutputs` requirement;
- historical RuntimeDatum evidence cannot bypass current Deployment suspension before Policy execution.

## Nonclaims

Gate D does **not** prove:

- human approval;
- machine execution of the DecisionResult;
- successful agronomic outcome;
- agronomic effectiveness;
- causal benefit or treatment effect.

Those remain downstream concerns. In particular, no `Outcome`, `OutcomeEvaluation` or `EffectAttributionAssessment` authority is created by the Gate D proof.

## Repository impact

This gate adds acceptance and documentation only. It does not modify D01–D06 production contracts or create a new authority type.

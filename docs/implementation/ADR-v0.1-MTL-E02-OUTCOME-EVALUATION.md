# ADR v0.1 — MTL-E02 OutcomeEvaluation

Status: implementation candidate.

E02 turns retained E01 Outcome evidence into replayable, dimensioned post-runtime diagnostics without collapsing all poor or favorable outcomes into one blame/credit score.

## Fixed evaluation dimensions

Every OutcomeEvaluation contains exactly one finding for each frozen dimension:

```text
KNOWLEDGE
TRANSPORT
MODEL
POLICY
EXECUTION
COMMERCIAL
```

A finding contains only:

- dimension;
- governed disposition;
- qualitative evidence-weight class;
- `DESCRIPTIVE` or `ASSOCIATIONAL` interpretation;
- governed diagnostic codes for that dimension;
- exact Outcome evidence refs;
- machine-readable limitation codes.

There is no free-form authoritative conclusion field and no aggregate score.

## Governed dispositions

```text
SUPPORTS_CONCERN
SUPPORTS_CONFORMANCE
INCONCLUSIVE
NOT_EVALUATED
```

Evidence weight is qualitative only:

```text
NONE / LIMITED / MODERATE / STRONG
```

Interpretation class is permanently bounded to:

```text
NONE / DESCRIPTIVE / ASSOCIATIONAL
```

`CAUSAL` is not an E02 interpretation class.

## Diagnostic separation

Each dimension has a controlled diagnostic vocabulary. Codes cannot cross dimensions.

Examples:

- `MODEL_PREDICTION_ERROR_EVIDENCE` can appear only under MODEL;
- `EXECUTION_DEVIATION_EVIDENCE` can appear only under EXECUTION;
- `KNOWLEDGE_SOURCE_FALSEHOOD_NOT_IDENTIFIABLE_FROM_OUTCOME_ALONE` is explicitly INCONCLUSIVE;
- `COMMERCIAL_TARGET_SUPPORT_EVIDENCE` can support the commercial dimension without proving ADR effectiveness.

This is the machine-level barrier against:

```text
yield down => Knowledge false
execution failed => Model failed
yield up => ADR effective
```

## Fixed evaluation method

E02 publishes one content-addressed method identity:

```text
ADR_DIMENSIONED_OUTCOME_EVALUATOR@1
```

The method hash binds:

- the six dimensions;
- dispositions;
- qualitative evidence weights;
- interpretation classes;
- governed diagnostic vocabulary;
- causal claim class `DESCRIPTIVE_OR_ASSOCIATIONAL_ONLY`;
- aggregate scoring `PROHIBITED`;
- direct control mutation `PROHIBITED`.

Callers cannot choose a different method id/hash during publication.

## Evaluation cohort

The publisher accepts exact Outcome refs and findings only. It derives the evaluation cohort from replay-validated Outcomes.

All Outcomes must share:

- exact target scope;
- association mode;
- for `ADR_BOUND`, one exact DecisionProblem world;
- for `EXTERNAL_BOUND`, one exact retained external decision identity.

For ADR cohorts the evaluator also freezes the exact union of DecisionResult and RuntimeBinding refs already present in the Outcome evidence. It does not invent new runtime/decision associations.

## Evaluator authority

E02 adds a separate authorization capability:

```text
permission: outcome.evaluate
built-in role: OUTCOME_EVALUATION_SERVICE
resource type: OUTCOME_EVALUATION
```

`OUTCOME_INGRESS_SERVICE` remains `outcome.write` only. The service that receives facts therefore does not automatically obtain authority to interpret those facts.

OutcomeEvaluation publication requires a recorded, replayable `OUTCOME_EVALUATE` AuthorizationDecisionAudit scoped to the deterministic evaluation id and exact evaluator organization/tenant.

## Deterministic identity and immutable interpretation

Evaluation identity binds:

```text
fixed method
+ evaluator identity
+ target/association cohort
+ exact Outcome refs
```

Findings are deliberately not part of the identity key.

Consequences:

- the same evaluator/method/evidence cohort cannot overwrite its interpretation on retry;
- changed findings under the same identity trigger semantic-mutation protection;
- a new evaluator legitimately creates a distinct evaluation authority;
- new evidence creates a distinct evaluation identity.

## Permanent nonclaims

Every OutcomeEvaluation carries:

```text
NONE_OUTCOME_EVALUATION_IS_NOT_CAUSAL_EFFECT_AUTHORITY
NONE_OUTCOME_EVALUATION_CANNOT_MUTATE_CONTROL_AUTHORITY
NONE_OUTCOME_EVALUATION_HAS_NO_AGGREGATE_SCORE_AUTHORITY
```

OutcomeEvaluation therefore cannot directly:

- qualify/revoke Knowledge;
- change Policy/Model/Deployment authority;
- publish a causal treatment-effect claim;
- hide the six diagnostic dimensions behind one confidence/quality score.

Control-plane changes remain proposals/review work, and causal/effect claims remain gated by E03 EffectAttributionAssessment.

## Acceptance boundary

Positive acceptance proves:

- one exact Outcome can carry STRONG model-error evidence while Knowledge falsehood remains LIMITED/INCONCLUSIVE;
- execution deviation stays in EXECUTION while MODEL remains inconclusive;
- favorable commercial evidence does not become causal/ADR-effectiveness authority;
- multi-Outcome exact cohorts replay with fixed method identity;
- external cohorts do not fabricate ADR refs;
- independent evaluator identities produce independent immutable evaluations.

Fail-closed acceptance proves:

- caller-authored method/id/score/confidence/causal/control fields are rejected;
- missing/duplicate dimensions are rejected;
- diagnostic codes cannot cross dimensions or change their governed disposition;
- arbitrary `KNOWLEDGE_FALSE` conclusions are not valid diagnostics;
- findings cannot cite Outcome evidence outside the frozen cohort;
- ADR/external and cross-DecisionProblem cohorts cannot be collapsed;
- same evidence identity cannot overwrite findings;
- method-hash tampering fails;
- structurally valid direct ledger publication without `outcome.evaluate` authorization fails exact replay.

# ADR v0.1 — MTL-E01 Outcome Ingress

Status: implementation candidate.

This implementation closes the first Evaluation-plane ingress seam: ADR can retain post-decision evidence without converting it into causal proof or silently changing upstream scientific/runtime authority.

## Authority boundary

`Outcome` is a first-class immutable post-decision evidence authority.

It is not a `ContextDatum`, `RuntimeDatum`, `DecisionResult`, `OutcomeEvaluation` or causal-effect assessment.

The frozen nonclaims are carried in every Outcome payload:

```text
causalEffectAuthority = NONE_OUTCOME_IS_NOT_CAUSAL_EFFECT_AUTHORITY
upstreamAuthorityMutation = NONE_OUTCOME_CANNOT_MUTATE_UPSTREAM_AUTHORITY
```

A favorable Outcome therefore cannot auto-qualify Knowledge, revise a Policy, change a Deployment or prove ADR effectiveness.

## Semantic envelope

Outcome preserves the A02 semantic discipline:

- semantic ID;
- typed value and unit;
- epistemic class;
- provenance class;
- effective interval and `availableAt`;
- spatial / vertical / temporal support;
- uncertainty;
- exact retained source identity and content hash;
- exact target identity.

E01 admits post-decision evidence classes `OBSERVATION`, `ASSERTION`, `DERIVED` and `STATE_ESTIMATE`.

`FORECAST` is not Outcome evidence. `MODEL` provenance cannot be relabeled as an observation or assertion.

## Association modes

### ADR_BOUND

The Outcome binds an exact ADR `DecisionProblem` and may additionally bind:

- exact `DecisionResult` when D06 exists;
- exact `RuntimeBinding` for ADR runtime evaluation;
- a distinct content-addressed external execution record.

The external execution identity is deliberately not converted into a RuntimeBinding. A DecisionResult also does not imply that the action was approved or physically executed.

All supplied ADR refs must resolve to the same exact DecisionProblem world, and Outcome target scope must equal the DecisionProblem target.

### EXTERNAL_BOUND

ADR may ingest outcomes for decisions that were not authored by ADR.

This mode requires retained content-addressed external decision evidence and may carry retained external execution evidence. It cannot carry ADR DecisionProblem / DecisionResult / RuntimeBinding refs merely to make the external event look like an ADR decision.

## Post-decision chronology

Outcome evidence must be genuinely post-decision/evaluation evidence:

- `availableAt >= effectiveInterval.end`;
- external execution cannot precede external decision;
- an Outcome effective interval cannot end before the latest exact decision/execution association anchor;
- Outcome cannot be available before that association anchor.

This blocks a pre-decision ContextDatum from being renamed Outcome after the fact.

## Dedicated ingress authorization

E01 introduces:

```text
permission: outcome.write
built-in role: OUTCOME_INGRESS_SERVICE
resource type: OUTCOME
```

The existing `INTEGRATION_SERVICE` remains a `context.write` role and receives no implicit Outcome authority.

Outcome publication requires a recorded, replayable `OUTCOME_WRITE` AuthorizationDecisionAudit whose exact RoleAssignments authorize the deterministic Outcome id under the same organization/tenant scope.

## Deterministic identity and retry behavior

The logical Outcome id is derived from the exact evidence identity:

```text
targetRef
+ semanticId
+ effectiveInterval
+ source(providerId, sourceRef, contentHash)
+ exact association
```

The resulting authority is always immutable version `1`.

Consequences:

- an exact duplicate delivery is idempotent and resolves to the same authority;
- a retry that reuses the same evidence identity but changes value / provenance / availability semantics cannot overwrite history and fails with semantic-mutation protection;
- a genuinely different retained source content hash or association produces a distinct Outcome identity.

Caller-generated UUIDs do not control Outcome semantic identity.

## Replay

`validateOutcomeAuthority()` replays:

- the Outcome semantic hash and deterministic logical id;
- exact ADR association authority where present;
- retained external decision/execution content identities;
- exact `outcome.write` authorization from recorded RoleAssignments;
- direct publication audit closure and ingress principal scope.

Replay classes are explicit:

- `ADR_EXACT_AUTHORITY_REPLAY_WITH_CONTENT_ADDRESSED_EXTERNAL_EXECUTION_IF_PRESENT`;
- `EXTERNAL_CONTENT_ADDRESSED_ASSOCIATION_REPLAY`.

## Acceptance boundary

Positive acceptance covers:

- ADR-bound sensor observations;
- fully external asserted outcomes;
- derived commercial outcomes;
- `RUNTIME_ONLY` ADR worlds without fabricated DecisionResult authority;
- exact duplicate/idempotency behavior;
- preserved time/support/uncertainty and source identity.

Fail-closed acceptance covers:

- `context.write` substitution;
- tenant/scope crossing;
- FORECAST and MODEL→OBSERVATION laundering;
- cross-decision ref splicing;
- external/ADR association mixing;
- impossible decision/execution chronology;
- pre-decision evidence renamed Outcome;
- causal/upstream authority fields supplied by caller;
- structurally valid but unauthorized direct ledger publication;
- favorable outcomes auto-mutating Knowledge/Policy/Deployment authority.

## Next boundary

E01 produces evidence only. Interpretation belongs to MTL-E02 `OutcomeEvaluation`, and causal/effect claims remain gated by MTL-E03 `EffectAttributionAssessment`.

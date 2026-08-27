# DEC-0008 — Governed Agronomic Goal-Condition Compilation

Status: **ACCEPTED**

Date: 2026-08-27

## Context

ADR now has accepted, implemented authority for:

- positive trigger/action agronomic rules;
- temporal and coordination semantics;
- source-bound prohibitions;
- context-only Policy v3;
- hard positive obligations with occurrence cardinality;
- source-semantic normative modality.

The remaining real-source failure exposed by the 2015 KBS LTER Agronomic Protocol is goal- or purpose-conditioned agronomic language.

The concrete unresolved statement is:

`Plots are tilled as needed (2-6 times a year) to prevent plant growth from becoming established.`

DEC-0006 can represent the bounded occurrence cardinality `2-6 times a year`, but correctly refuses to publish the B21 obligation as COMPLETE because `as needed` and the source purpose were unrepresented.

DEC-0007 now represents `AS_NEEDED` as source-semantic normative modality.

That still does not represent:

`to prevent plant growth from becoming established`

The KBS protocol also contains another source-explicit purpose clause:

`If needed an insecticide application can be used to control aphids.`

DEC-0007 represents `PERMITTED + IF_NEEDED`, but `to control aphids` remains a separate semantic relation.

The repository does contain a `DecisionProblem.objective`, but that object describes the current runtime decision problem. It is not authority for what a source document states as the purpose of an agronomic instruction.

Likewise, an existing constraint `when` predicate is not suitable. A source purpose is not automatically a runtime Boolean condition.

Therefore ADR still lacks a governed, inspectable authority for source-explicit agronomic goal/purpose clauses.

## Proposed decision

Introduce a separate source-semantic authority:

`AgronomicGoalConditionCompilation`

Candidate contracts:

`adr.agronomic-goal-condition.v1`

`adr.agronomic-goal-condition-compilation.v1`

This authority records source-explicit agronomic goal/purpose semantics for already source-faithful, scientifically governed knowledge.

It does not itself create or modify:

- Policy;
- DeclarativeAgronomicRule;
- AgronomicPolicyConstraintCompilation;
- AgronomicPolicyObligationCompilation;
- AgronomicNormativeModalityCompilation;
- DecisionProblem;
- Model;
- RuntimeBinding;
- RuntimeEligibility;
- DecisionResult;
- execution truth;
- Outcome.

## Meaning of “goal condition”

The term `goal condition` in this decision means a source-explicit purpose or intended state relation associated with an agronomic proposition.

It does **not** mean an executable predicate.

For example:

`to prevent plant growth from becoming established`

supports a source-semantic goal relation.

It does not, by itself, define:

- how plant establishment is measured;
- a threshold for “established”;
- when the field should be inspected;
- whether establishment is currently occurring;
- whether tillage is currently needed;
- whether tillage is feasible;
- whether the goal has been achieved;
- whether tillage caused the observed outcome.

This distinction is mandatory.

## v1 relation vocabulary

The v1 relation vocabulary is restricted to source-proven forms:

- `PREVENT`
- `CONTROL`

These values are not a severity scale and do not form an ordering.

### PREVENT

Used only when the exact governed source states a purpose of preventing a named state or process.

KBS B21 example:

`to prevent plant growth from becoming established`

### CONTROL

Used only when the exact governed source states a purpose of controlling a named target.

KBS insect-control example:

`to control aphids`

No additional goal-relation vocabulary is accepted by DEC-0008 v1.

Future source material may justify additive versions.

## v1 target scope

The v1 target scope is restricted to the source-proven form:

- `ACTION`

The goal/purpose applies to an agronomic action proposition.

Examples:

- `an insecticide application can be used to control aphids`
- `Plots are tilled as needed (2-6 times a year) to prevent plant growth from becoming established.`

DEC-0008 v1 does not claim that the goal relation semantically modifies the occurrence cardinality itself. In B21, `AS_NEEDED` and `2-6 times a year` remain separate modality and occurrence semantics.

This target scope does not create or mutate the operational authority being described.

## Candidate v1 semantic shape

A candidate goal-condition object should preserve at least:

- contract version;
- stable goal-condition identity;
- exact source expression;
- target scope;
- normalized source relation;
- exact goal-object expression;
- exact source-qualified knowledge authority bindings;
- transformation rationale.

Illustrative shape:

```text
AgronomicGoalCondition {
  contractVersion
  goalConditionId

  sourceExpression

  targetScope:
    ACTION

  relation:
    PREVENT
    | CONTROL

  goalObjectExpression

  authorityBindings[]
  transformationRationale
}
```

The exact implementation shape remains subject to implementation review after architecture acceptance.

## Source-expression preservation

The authority must preserve the actual source meaning.

For B21, the source expressions include:

- instruction: `Plots are tilled as needed (2-6 times a year)`
- purpose: `to prevent plant growth from becoming established`

A v1 normalized object may record:

- relation = `PREVENT`
- targetScope = `ACTION`
- goalObjectExpression = the source-grounded plant-establishment phrase.

It must not invent a thresholded predicate such as:

`plant_growth_established == false`

unless a separate governed source explicitly defines that semantic variable and measurement rule.

## Scientific/source authority closure

The compilation must bind exact active `QualifiedKnowledge` or `DerivedKnowledge` authority for the fixed scientific use:

`AGRONOMIC_POLICY_INPUT`

Every predecessor must replay through existing ADR scientific authority, including:

- Source;
- SourceArtifact;
- Claim;
- SourceContext;
- source-faithful review;
- scientific qualification;
- active allowed use.

Kind-tag spoofing is insufficient.

Historical, superseded, revoked, or unrelated-use knowledge must fail closed.

## Governed semantic review

Goal-condition classification is a source-interpretation act.

The implementation must require an explicit governed semantic review compatible with ADR source-faithful governance.

A classifier or keyword match alone must not be sufficient authority.

In particular, the implementation must not infer a goal merely because text contains:

- `to`;
- `for`;
- `prevent`;
- `control`;
- causal or explanatory prose.

The semantic review must confirm that the expression functions as the purpose/goal of the governed agronomic proposition.

## No causal-effect laundering

A source purpose is not evidence that the action achieves that purpose.

From:

`Plots are tilled ... to prevent plant growth from becoming established`

ADR may preserve that prevention is the protocol-stated purpose.

ADR must not infer:

`tillage prevents plant establishment`

as a measured causal effect unless independent source-qualified evidence supports that claim.

Likewise:

`insecticide application ... to control aphids`

does not prove a treatment effect magnitude, efficacy probability, or successful outcome.

This boundary is mandatory.

## No runtime-condition laundering

A source goal is not automatically a trigger.

B21 must not be transformed into:

`IF plant growth is established THEN till`

or:

`IF plant growth is predicted to become established THEN till`

unless a separate accepted authority explicitly supplies that trigger logic.

The source only says that the as-needed tillage regime is for preventing establishment.

DEC-0008 does not define the runtime decision procedure for determining “needed.”

## No current-state laundering

A source goal does not establish current state.

Therefore:

`to prevent plant growth from becoming established`

does not establish:

- that plant growth is currently established;
- that establishment is imminent;
- that tillage is currently required;
- that a RuntimeEligibility condition is satisfied.

Likewise:

`to control aphids`

does not establish that aphids are currently present or above an action threshold.

## No objective laundering

`DecisionProblem.objective` remains current decision-problem authority.

An `AgronomicGoalConditionCompilation` is source-semantic authority.

The two may eventually be related through a separately governed compilation or applicability step.

DEC-0008 does not authorize copying a source purpose directly into a live DecisionProblem objective.

## No outcome laundering

Goal-condition authority is not Outcome authority.

A source-stated purpose does not establish:

- satisfaction;
- violation;
- success;
- failure;
- realized benefit;
- causal attribution;
- execution quality.

Actual operations and outcomes remain governed by their respective evidence and authority chains.

## Interaction with DEC-0006 obligation authority

DEC-0008 does not mutate `AgronomicPolicyObligationCompilation v1`.

This is important for B21.

After DEC-0007 and DEC-0008:

- `AS_NEEDED` may have COMPLETE modality coverage;
- `2-6 times a year` remains representable as bounded occurrence cardinality;
- `to prevent plant growth from becoming established` may have COMPLETE goal-condition coverage.

However, the existing B21 Obligation v1 still has no accepted field for binding those separate semantic authorities into one COMPLETE goal-conditioned obligation.

Therefore DEC-0008 alone MUST NOT make the existing B21 Obligation v1 candidate publishable as COMPLETE.

A future versioned obligation decision may bind exact modality and goal-condition authority.

That future contract change is not pre-accepted here.

## Interaction with DEC-0007 modality authority

Normative modality and goal condition remain separate.

For B21:

- qualifier = `AS_NEEDED`;
- goal relation = `PREVENT`.

Neither subsumes the other.

`AS_NEEDED` does not mean “needed whenever the prevention goal is unsatisfied.”

`PREVENT` does not define how “needed” is adjudicated.

For insect control:

- force = `PERMITTED`;
- qualifier = `IF_NEEDED`;
- goal relation = `CONTROL`.

These are distinct source semantics.

## Local completeness

`losslessCoverage=COMPLETE` for an `AgronomicGoalConditionCompilation` means only:

the source goal/purpose information targeted by that goal-condition object has been fully represented.

It does not mean:

- the full source statement is operationalized;
- the corresponding obligation is COMPLETE;
- the runtime trigger is known;
- need is established;
- feasibility is established;
- the action is legal;
- the action is deployable;
- the goal has been achieved.

This local-completeness rule must be enforced.

## Content addressing

The normalized goal condition must be content-addressed.

Changing any of the following must change the semantic hash:

- source expression;
- target scope;
- relation;
- goal-object expression;
- exact authority binding.

Stored compilation authority must fail closed if the normalized goal semantic value drifts from its declared hash.

## Planning / execution boundary

The 2015 KBS document is a working agronomic protocol used for planning.

Goal-condition semantics extracted from that protocol remain planning/source authority only.

The source itself instructs users to refer to the agronomic field log for actual field operations.

DEC-0008 does not convert planning purpose into executed fact.

## KBS architecture targets

### A. B21 — PREVENT action goal

Source:

`Plots are tilled as needed (2-6 times a year) to prevent plant growth from becoming established.`

Candidate source-goal semantics:

- relation = `PREVENT`
- targetScope = `ACTION`
- goalObjectExpression = source-grounded plant-growth-establishment expression.

Required boundaries:

- do not create a runtime trigger;
- do not establish current need;
- do not establish current plant state;
- do not claim causal efficacy;
- do not mark the B21 Obligation v1 COMPLETE.

### B. Insect control — CONTROL action goal

Source:

`If needed an insecticide application can be used to control aphids.`

Candidate source-goal semantics:

- relation = `CONTROL`
- targetScope = `ACTION`
- goalObjectExpression = source-grounded aphid-control target.

Required boundaries:

- do not establish current aphid presence;
- do not establish an action threshold;
- do not establish pesticide legality or registration;
- do not assert treatment efficacy;
- preserve DEC-0007 `PERMITTED + IF_NEEDED` separately.

## Mandatory negative cases

Implementation acceptance must include negative tests that prove at least:

1. a source purpose cannot become a runtime trigger;
2. a source purpose cannot become current-state evidence;
3. a source purpose cannot become Outcome or causal-effect authority;
4. a source purpose cannot be published without active source-qualified knowledge authority;
5. a source purpose cannot be published without governed semantic review;
6. a B21 goal-condition authority cannot make Obligation v1 COMPLETE by itself.

At least one negative case must use real KBS source material rather than only synthetic fixtures.

## Runtime boundary

`AgronomicGoalConditionCompilation` is not:

- a sensor observation;
- a ContextAssertion;
- a current-state estimate;
- a trigger;
- a threshold;
- an Applicability result;
- a RuntimeBinding;
- RuntimeEligibility;
- action ranking;
- optimization objective;
- scheduler priority;
- legal permission;
- human approval;
- DecisionResult;
- execution receipt;
- obligation satisfaction;
- obligation violation;
- Outcome;
- causal-effect evidence.

## Rejected alternatives

### Reuse DecisionProblem.objective

Rejected because DecisionProblem describes the current governed decision problem, while DEC-0008 records source-document purpose semantics.

### Encode the goal as a Constraint.when predicate

Rejected because the source does not define a runtime Boolean predicate or measurement method.

### Encode the goal as an Obligation v1 trigger

Rejected because Obligation v1 deliberately excludes trigger semantics and DEC-0008 does not establish a trigger.

### Treat “to prevent” as causal evidence

Rejected because stated purpose and demonstrated causal effect are different scientific claims.

### Make B21 Obligation v1 COMPLETE immediately

Rejected because accepted contracts must not be mutated in place and Obligation v1 has no exact binding for source-goal authority.

### Infer a normalized field-state variable

Rejected because the source phrase does not define an operational measurement semantic for “plant growth becoming established.”

## Explicitly unresolved after DEC-0008

Even if accepted and implemented, ADR still leaves at least:

1. a future goal-conditioned obligation version that can bind modality + occurrence + goal authority;
2. runtime operationalization of source goals into measurable information requirements;
3. action-parameter/material constraints;
4. source protocol inheritance/reference;
5. multi-step prerequisite / restoration workflows;
6. obligation satisfaction/violation authority over execution evidence.

These must not be collapsed into DEC-0008 merely to increase benchmark coverage.

## Acceptance targets

Before implementation is authorized, architecture review must confirm:

1. source purpose is distinct from runtime objective;
2. goal condition is non-executable source semantics, not a Boolean predicate;
3. v1 relations are limited to PREVENT / CONTROL;
4. v1 target scope is limited to ACTION;
5. exact source expression and exact goal-object expression remain inspectable;
6. publication requires active scientific authority for AGRONOMIC_POLICY_INPUT;
7. governed semantic review is mandatory;
8. stated purpose cannot become causal-effect authority;
9. stated purpose cannot become current-state or runtime-trigger authority;
10. local COMPLETE does not imply whole-statement or obligation completeness;
11. B21 remains Obligation-v1 INCOMPLETE after DEC-0008 alone;
12. planning protocol purpose remains distinct from field execution and Outcome.

## Acceptance

Accepted on 2026-08-28 after explicit architecture approval.

Acceptance establishes the source-semantic architecture described by this decision only. It does not authorize runtime predicates, current-state inference, causal-effect claims, execution truth, Outcome authority, or in-place mutation of accepted authority contracts.

The accepted v1 target scope is ACTION only. The B21 goal phrase qualifies the tillage action; it does not establish that the source goal relation semantically modifies the 2–6/year occurrence cardinality.

## Post-acceptance gate

Before this decision is merged as accepted architecture:

1. repository-wide ADR Constitution MUST pass on the exact accepted documentation head;
2. the PR MUST remain docs-only and contain no schema, runtime, workflow, acceptance-test, or existing-contract mutation;
3. the PR base MUST still equal the expected main authority head;
4. the accepted exact head MUST be recorded before merge.

Only after the accepted documentation PR is merged may implementation begin on a separate branch from the resulting main.

Implementation MUST include both real KBS positive cases and mandatory negative tests proving that source purpose does not become runtime trigger, current-state evidence, causal-effect authority, Outcome authority, or B21 Obligation-v1 completeness.

Acceptance of DEC-0008 does not pre-accept any future obligation version that binds modality, occurrence, and goal-condition authorities.

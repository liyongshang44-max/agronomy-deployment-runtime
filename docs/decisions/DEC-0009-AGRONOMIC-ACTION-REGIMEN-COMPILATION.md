# DEC-0009 — Governed Agronomic Action-Regimen Compilation

Status: **ACCEPTED**

Date: 2026-08-28

## Context

ADR now has accepted, implemented source authority for:

- hard positive obligations with exact or bounded occurrence cardinality;
- source-semantic normative modality;
- source-semantic agronomic goal conditions.

The 2015 KBS LTER Agronomic Protocol still exposes one unresolved composition problem:

`Plots are tilled as needed (2-6 times a year) to prevent plant growth from becoming established.`

The source meaning is now partially represented by separate accepted authorities:

- `AS_NEEDED` — `AgronomicNormativeModalityCompilation`;
- `PREVENT plant growth from becoming established` — `AgronomicGoalConditionCompilation`;
- the numeric phrase `2-6 times a year` — structurally representable by the occurrence grammar introduced by DEC-0006.

However, DEC-0006 intentionally restricts `AgronomicPolicyObligationCompilation v1` to hard:

`effect = REQUIRE`

and explicitly says that B21 must not be silently upgraded into an unconditional hard REQUIRE obligation.

That restriction remains correct after DEC-0007 and DEC-0008.

DEC-0007 establishes only a qualifier for B21:

`AS_NEEDED`

It does not establish:

- `REQUIRE`;
- `SHOULD`;
- `BEST_EFFORT`;
- `PERMITTED`;
- any other normative force.

DEC-0008 establishes the source-stated purpose:

`PREVENT plant growth from becoming established`

It does not establish a runtime trigger, current need, current state, causal efficacy, Outcome, or hard obligation.

Therefore the unresolved semantic gap is not merely “Obligation v1 lacks two reference fields.”

The deeper problem is that B21 is a source-level action regimen whose occurrence range is qualified by `AS_NEEDED` and whose purpose is `PREVENT`, without source evidence for a hard REQUIRE force.

A versioned hard-obligation extension would still change the source meaning if it treated the B21 range as mandatory minimum/maximum counts.

## Decision under proposal

Introduce a separate source-semantic authority:

`AgronomicActionRegimenCompilation`

Candidate contracts:

`adr.agronomic-action-regimen.v1`

`adr.agronomic-action-regimen-compilation.v1`

This authority represents a source-stated repeated-action regimen when the source provides:

1. an agronomic action;
2. a source-stated occurrence descriptor;
3. an exact accepted normative-modality authority;
4. an exact accepted goal-condition authority;
5. exact source-qualified scientific authority showing that those semantics belong to the same governed source proposition.

It is not an obligation authority.

It does not add, infer, or normalize a normative force.

## Why a separate authority is required

### Hard obligation is too strong

The phrase:

`Plots are tilled as needed (2-6 times a year)`

does not justify:

`REQUIRE at least 2 tillage events each year`

or:

`PROHIBIT more than 6 tillage events each year`

or:

`the obligation is violated if only one tillage occurs`

or:

`the obligation is satisfied after the sixth tillage event`.

Those meanings are not present in the source.

The parenthetical range is source-described occurrence information inside an `AS_NEEDED` regimen.

### Normative modality alone is too narrow

DEC-0007 can preserve `AS_NEEDED`, but it deliberately does not carry action occurrence range or goal semantics.

### Goal condition alone is too narrow

DEC-0008 can preserve `PREVENT`, but it deliberately does not carry occurrence, modality, trigger, or runtime state.

### DeclarativeAgronomicRule is inappropriate

The source does not define the runtime condition that determines when tillage is “needed.”

Compiling B21 to an IF/THEN rule would invent a trigger.

### Policy is not source-statement composition

Policy remains a governed decision specification.

An action-regimen authority is source-semantic scientific authority.

The two may later be related through separately accepted compilation/applicability/runtime steps.

## Meaning of “action regimen”

For DEC-0009, an action regimen is a source-stated repeated-action pattern that preserves:

- the action identity;
- the exact source expression;
- a non-hard source occurrence descriptor;
- the exact source-semantic modality;
- the exact source-semantic goal.

The term does **not** mean:

- a runtime schedule;
- a recurring job;
- a mandatory minimum count;
- a mandatory maximum count;
- a due-state;
- a completion-state;
- a legal prescription;
- a machine task;
- an execution history.

## v1 source-proven pattern

DEC-0009 v1 is intentionally restricted to the one real-source pattern established by KBS B21:

`AS_NEEDED + SOURCE_STATED_BOUNDED_RANGE + PREVENT + ACTION`

Specifically:

- action target = `ACTION`;
- action code = source-grounded tillage action;
- occurrence mode = `SOURCE_STATED_BOUNDED_RANGE`;
- period kind = `EACH_CALENDAR_YEAR`;
- modality authority = exact accepted qualifier-only `AS_NEEDED`;
- goal-condition authority = exact accepted `PREVENT` action goal;
- no normative force may be introduced by the regimen contract.

No additional regimen shape is accepted by DEC-0009 v1.

Future source material may justify additive versions.

## Source-stated bounded range semantics

Candidate v1 occurrence descriptor:

`SOURCE_STATED_BOUNDED_RANGE`

with:

- `minCount`;
- `maxCount`;
- `period`.

For B21:

- `minCount = 2`;
- `maxCount = 6`;
- `period.kind = EACH_CALENDAR_YEAR`.

These numeric values preserve the literal source range.

They do **not** independently mean:

- hard lower-bound obligation;
- hard upper-bound prohibition;
- expected-value estimate;
- probability distribution;
- schedule;
- target utilization;
- satisfaction threshold;
- violation threshold.

The accepted modality remains semantically controlling for the source instruction.

For B21, that modality is `AS_NEEDED`.

Therefore ADR must not strip the qualifier and interpret `2-6` as hard deontic bounds.

## Candidate semantic shape

An illustrative v1 object may be:

```text
AgronomicActionRegimen {
  contractVersion
  regimenId

  sourceExpression

  actionCode

  occurrenceDescriptor {
    mode:
      SOURCE_STATED_BOUNDED_RANGE

    minCount
    maxCount

    period {
      kind:
        EACH_CALENDAR_YEAR
    }
  }

  modalityCompilationRef
  goalConditionCompilationRef

  authorityBindings[]
  transformationRationale
}
```

The implementation shape remains subject to implementation review after architecture acceptance.

## Required authority closure

Publication must require exact active authority for all of the following:

1. source-qualified scientific knowledge for fixed use `AGRONOMIC_POLICY_INPUT`;
2. the exact `AgronomicNormativeModalityCompilation`;
3. the exact `AgronomicGoalConditionCompilation`;
4. exact Source and SourceArtifact scientific predecessors;
5. governed semantic review proving the action-regimen composition is source-faithful.

Kind tags alone are insufficient.

Historical, superseded, revoked, unrelated-use, or source-mismatched authority must fail closed.

## Same-proposition closure

DEC-0009 must not permit arbitrary composition of unrelated accepted semantic fragments.

For B21, the action, occurrence range, modality, and goal must be provably grounded in the same governed source proposition:

`Plots are tilled as needed (2-6 times a year) to prevent plant growth from becoming established.`

At minimum, implementation must prove exact source-expression closure sufficient to prevent:

- taking `AS_NEEDED` from B21;
- taking `2-6 times a year` from a different source;
- taking `PREVENT` from a different action;
- taking an unrelated action code;
- publishing the artificial combination as one regimen.

Exact implementation mechanics remain an implementation concern, but fail-closed same-proposition closure is architectural.

## Modality authority requirements

The B21 regimen must bind an exact accepted modality authority whose source semantics are:

- qualifier = `AS_NEEDED`;
- target scope compatible with the occurrence/action phrase;
- no source-proven hard force.

A regimen must not synthesize:

- `REQUIRE`;
- `PROHIBIT`;
- `SHOULD`;
- `BEST_EFFORT`;
- `PERMITTED`

when the exact bound modality authority does not contain that force.

This prohibition is mandatory.

## Goal-condition authority requirements

The B21 regimen must bind an exact accepted goal-condition authority whose source semantics include:

- relation = `PREVENT`;
- targetScope = `ACTION`;
- source-grounded goal-object expression for plant growth becoming established.

The regimen must not turn that goal into:

- a runtime trigger;
- current-state evidence;
- a threshold;
- an optimization objective;
- causal-effect evidence;
- Outcome authority.

## No hard-obligation laundering

An `AgronomicActionRegimenCompilation` is not an `AgronomicPolicyObligationCompilation`.

From the B21 regimen ADR must not infer:

- `effect = REQUIRE`;
- an obligation due-state;
- an obligation completion-state;
- an obligation satisfaction event;
- an obligation violation event;
- mandatory minimum count = 2;
- mandatory maximum count = 6.

A future source may separately justify a hard obligation.

That would require its own exact authority.

DEC-0009 does not provide it for B21.

## No need-predicate laundering

`AS_NEEDED` is source-semantic modality.

It does not define the function:

`is_tillage_needed(field, time)`.

The regimen must not invent:

- soil thresholds;
- weed thresholds;
- plant-establishment thresholds;
- scouting thresholds;
- forecast thresholds;
- model scores;
- timing predicates.

If runtime determination of “needed” is later required, that requires separately governed evidence and runtime semantics.

## No frequency-as-schedule laundering

The source phrase:

`2-6 times a year`

does not establish:

- every 60 days;
- every 90 days;
- monthly recurrence;
- evenly spaced tillage;
- a specific next-action date;
- a scheduler cadence.

DEC-0009 must preserve a source-stated annual range without inventing intra-year timing.

## No execution laundering

The KBS source explicitly distinguishes protocol planning from actual field operations and directs users to the agronomic field log for actual operations.

Therefore an action-regimen authority must not create:

- ExecutionReceipt;
- Field Log fact;
- completed occurrence count;
- current-year execution count;
- satisfaction/violation;
- Outcome.

The protocol remains planning/source authority.

## No alternative-action laundering

The same B21 section also states:

`Tillage can be soil finishing, rototilling or any tillage that keeps plant growth from becoming established.`

and:

`Plots can be chisel plowed and soil finished if more aggressive tillage is needed.`

Those sentences raise separate action-option, method, and conditional-selection semantics.

DEC-0009 v1 does not absorb them into the B21 regimen merely because they appear nearby.

The accepted v1 action remains the source-level tillage action represented by the target B21 sentence.

Alternative methods and more-aggressive-tillage selection remain unresolved.

## No causal-effect laundering

The purpose:

`to prevent plant growth from becoming established`

states source intent.

It does not prove that tillage causally prevents establishment.

The regimen must not add treatment-effect magnitude, efficacy probability, or causal attribution.

## Local completeness

`losslessCoverage = COMPLETE` for an `AgronomicActionRegimenCompilation` means only:

the source regimen elements targeted by that regimen object are represented without changing their source meaning.

For B21 v1, the targeted elements are:

- action;
- source-stated bounded occurrence range;
- exact `AS_NEEDED` modality binding;
- exact `PREVENT` goal binding;
- exact source-expression closure.

It does **not** mean:

- the full KBS B21 section is represented;
- alternative tillage methods are represented;
- “needed” is operationalized;
- runtime eligibility is known;
- a hard obligation exists;
- the action is scheduled;
- actual tillage occurred;
- the goal was achieved.

## Interaction with DEC-0006

DEC-0006 remains unchanged.

`AgronomicPolicyObligationCompilation v1` continues to mean hard `REQUIRE`.

B21 continues to be invalid as a COMPLETE hard obligation.

DEC-0009 does not mutate Obligation v1 and does not create Obligation v2.

For B21:

- DEC-0006 occurrence grammar informed the need for count/range representation;
- DEC-0009 uses a non-hard `SOURCE_STATED_BOUNDED_RANGE` descriptor instead of reusing hard obligation semantics.

This separation prevents numeric cardinality from laundering an `AS_NEEDED` regimen into a hard obligation.

## Interaction with DEC-0007

DEC-0007 remains unchanged.

The exact B21 `AS_NEEDED` modality authority is a predecessor of the action regimen.

The regimen does not copy or reinterpret the qualifier.

It binds and replays the exact modality authority.

## Interaction with DEC-0008

DEC-0008 remains unchanged.

The exact B21 `PREVENT` goal-condition authority is a predecessor of the action regimen.

The regimen does not convert the source goal into runtime trigger, objective, current state, causal effect, or Outcome.

## Why not a generic semantic-composition container

A generic object such as:

```text
SourceSemanticComposition {
  refs[]
}
```

is rejected for v1.

It would be too weak to state:

- which action is governed;
- what the occurrence range means;
- which composition shapes are source-proven;
- what semantic combinations are forbidden.

DEC-0009 instead proposes a narrow agronomic action-regimen authority driven by an exact real-source failure.

## Why not Obligation v2

Rejected for B21.

Adding `modalityRef` and `goalRef` to a new hard-obligation contract does not solve the absence of source evidence for hard `REQUIRE`.

It would merely make the laundering more structured.

A future Obligation v2 may still be justified by other sources, but DEC-0009 does not pre-accept it and B21 is not evidence for it.

## Why not reuse DeclarativeAgronomicRule

Rejected because `AS_NEEDED` does not define a runtime predicate.

A rule would require invented trigger semantics.

## Why not treat 2-6 as a hard constraint

Rejected because the source presents the numeric range inside an `AS_NEEDED` regimen and DEC-0006 already forbids that upgrade.

## Why not treat 2-6 as an average or forecast

Rejected because the source does not define a probability model, expectation, confidence interval, or forecast.

## KBS architecture target

### B21 action regimen

Source:

`Plots are tilled as needed (2-6 times a year) to prevent plant growth from becoming established.`

Candidate source-regimen semantics:

- action = `TILL`;
- occurrence mode = `SOURCE_STATED_BOUNDED_RANGE`;
- minCount = 2;
- maxCount = 6;
- period = `EACH_CALENDAR_YEAR`;
- exact modality predecessor = B21 `AS_NEEDED`;
- exact goal predecessor = B21 `PREVENT plant growth from becoming established`;
- normative force = **ABSENT**.

Required negative assertions:

- no hard REQUIRE authority;
- no hard minimum-count obligation;
- no hard maximum-count prohibition;
- no need predicate;
- no schedule;
- no current-state fact;
- no runtime eligibility;
- no causal effect;
- no execution truth;
- no satisfaction/violation;
- no Outcome.

## Mandatory implementation acceptance cases

If DEC-0009 is accepted, implementation acceptance must prove at least:

1. exact B21 action-regimen publication succeeds with source-grounded TILL + 2-6/year + exact AS_NEEDED + exact PREVENT;
2. the published regimen contains no normative force field;
3. adding `effect=REQUIRE` or equivalent hard-force field fails closed;
4. treating minCount/maxCount as obligation satisfaction/violation semantics fails closed;
5. inventing a runtime `needed` predicate fails closed;
6. inventing a fixed cadence from 2-6/year fails closed;
7. binding modality from a different source proposition fails closed;
8. binding goal from a different source proposition fails closed;
9. source-qualified knowledge with the wrong scientific use fails closed;
10. source-expression mismatch fails closed;
11. local COMPLETE does not imply B21 section completeness;
12. no runtime/execution/Outcome authority is created.

At least one fail-closed case must use exact real KBS B21 source material.

## Runtime boundary

`AgronomicActionRegimenCompilation` is not:

- Policy;
- DeclarativeAgronomicRule;
- AgronomicPolicyConstraintCompilation;
- AgronomicPolicyObligationCompilation;
- Applicability;
- ContextAssertion;
- current-state estimate;
- InformationRequirement;
- RuntimeBinding;
- RuntimeEligibility;
- DecisionProblem objective;
- action ranking;
- scheduler input;
- legal permission;
- human approval;
- DecisionResult;
- ExecutionReceipt;
- Field Log;
- obligation satisfaction;
- obligation violation;
- Outcome;
- causal-effect authority.

## Content addressing

The normalized regimen must be content-addressed.

Changing any of the following must change the semantic hash:

- exact source expression;
- action code;
- occurrence mode;
- minCount;
- maxCount;
- period;
- exact modality compilation ref;
- exact goal-condition compilation ref;
- exact source-qualified scientific authority binding.

Stored authority must fail closed if any normalized semantic value drifts from its declared hash.

## Explicitly unresolved after DEC-0009

Even if accepted and implemented, ADR still leaves at least:

1. runtime operationalization of `AS_NEEDED` into measurable need criteria;
2. action-option/method semantics for soil finishing, rototilling, chisel plowing, and more-aggressive tillage;
3. source protocol inheritance/reference;
4. ordered prerequisite/restoration workflows;
5. runtime conversion from source regimen to information requirements and decision eligibility;
6. hard obligation satisfaction/violation authority for sources that truly establish hard obligations;
7. actual Field Log / execution reconciliation.

These must not be collapsed into DEC-0009 merely to make B21 appear operationally complete.

## Acceptance targets

Before implementation is authorized, architecture review must confirm:

1. B21 does not establish hard REQUIRE;
2. `SOURCE_STATED_BOUNDED_RANGE` preserves a literal range without hard obligation semantics;
3. `AS_NEEDED` remains an exact predecessor authority, not a runtime predicate;
4. `PREVENT` remains an exact predecessor authority, not a trigger or causal-effect claim;
5. v1 is limited to the B21-proven AS_NEEDED + bounded-range + PREVENT action-regimen pattern;
6. no normative force is introduced by the regimen contract;
7. exact same-proposition source closure is mandatory;
8. local COMPLETE does not imply runtime or section completeness;
9. DEC-0006 Obligation v1 remains unchanged and B21 remains invalid as COMPLETE hard obligation;
10. no schedule is inferred from annual range;
11. planning protocol remains distinct from Field Log execution;
12. implementation must be additive and versioned.

## Acceptance

Accepted on 2026-08-28 after explicit architecture approval.

Acceptance establishes the source-semantic architecture described by this decision only.

In particular, acceptance does **not** establish a hard REQUIRE for KBS B21 and does not reinterpret the literal `2-6 times a year` range as mandatory minimum/maximum obligation semantics.

The accepted v1 architecture is restricted to the exact real-source pattern:

`AS_NEEDED + SOURCE_STATED_BOUNDED_RANGE + PREVENT + ACTION`

with normative force absent.

## Post-acceptance gate

Before this decision is merged as accepted architecture:

1. repository-wide ADR Constitution MUST pass on the exact accepted documentation head;
2. the PR MUST remain docs-only;
3. no runtime, schema, workflow, acceptance-test, or existing authority-contract mutation may be included;
4. the PR base MUST still equal the expected main authority head;
5. the accepted exact head MUST be recorded before merge.

Only after the accepted documentation PR is merged may implementation begin on a separate branch created from the resulting main.

Implementation MUST include exact real-source KBS B21 positive and negative acceptance evidence proving at least:

- no hard REQUIRE laundering;
- no mandatory min/max obligation semantics;
- no runtime need predicate;
- no inferred schedule;
- no cross-proposition modality/goal composition;
- no runtime/execution/Outcome authority;
- local COMPLETE does not mean full B21 operational completeness.

Acceptance of DEC-0009 does not pre-accept Obligation v2, action-option semantics, runtime operationalization of AS_NEEDED, or Field Log reconciliation.

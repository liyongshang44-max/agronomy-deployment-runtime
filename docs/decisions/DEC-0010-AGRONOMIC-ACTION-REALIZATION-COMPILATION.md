# DEC-0010 — Governed Agronomic Action-Realization Compilation

Status: **PROPOSED**

Date: 2026-08-28

## Context

ADR now has accepted and implemented source-semantic authority for:

- hard positive obligations;
- normative modality;
- agronomic goal conditions;
- source-level repeated-action regimens.

KBS Treatment B21 now has a governed action regimen for the source proposition:

`Plots are tilled as needed (2-6 times a year) to prevent plant growth from becoming established.`

That regimen correctly preserves:

- action = `TILL`;
- source-stated annual range = `2-6`;
- qualifier = `AS_NEEDED`;
- source goal = `PREVENT plant growth from becoming established`;
- no hard REQUIRE;
- no runtime need predicate;
- no schedule;
- no execution truth.

The next source sentence states:

`Tillage can be soil finishing, rototilling or any tillage that keeps plant growth from becoming established.`

This sentence introduces a different semantic problem.

It does not state a new runtime decision.

It does not define a RuntimeAlternativeSet.

It does not define a Policy actionSpace.

It does not establish that one method is preferred, currently available, executable, equivalent, or optimal.

It states how the source describes possible realizations of the already-governed abstract B21 tillage action.

The following sentence is materially different again:

`Plots can be chisel plowed and soil finished if more aggressive tillage is needed.`

That sentence contains an additional conditional-selection problem.

DEC-0010 intentionally does **not** absorb that second sentence into v1.

## Decision under proposal

Introduce a separate source-semantic authority:

`AgronomicActionRealizationCompilation`

Candidate contracts:

`adr.agronomic-action-realization.v1`

`adr.agronomic-action-realization-compilation.v1`

This authority represents source-stated realizations of an already governed agronomic action.

For DEC-0010 v1, the authority is intentionally restricted to the exact KBS B21 pattern:

`TILL -> { soil finishing, rototilling, source-defined open tillage class }`

where the source-defined open class is:

`any tillage that keeps plant growth from becoming established`.

## Why this is a separate authority

### It is not RuntimeAlternativeSet

The existing `RuntimeAlternativeSet` is a runtime coverage authority.

It depends on exact runtime lineage including:

- DecisionProblem;
- RuntimePlan;
- RuntimeEligibility;
- RuntimeBinding;
- ApplicabilityAssessment;
- runtime path coverage.

It answers a runtime question about which already-adjudicated runtime paths were represented.

KBS B21 is source semantics upstream of all of that.

Using RuntimeAlternativeSet for B21 would launder source text into runtime eligibility/coverage authority.

### It is not Policy actionSemantics

Policy action semantics describe governed decision-specification action codes and material parameters.

They are part of the decision specification layer.

The B21 sentence instead states how a source-level agronomic action may be realized in the protocol.

Source action realization must remain scientific/source authority until a separately governed compilation relates it to a Policy or runtime action space.

### It is not a new Action Regimen

DEC-0009 represents the repeated-action regimen itself.

DEC-0010 refines the action in that regimen by preserving source-stated ways of realizing `TILL`.

It does not change:

- the AS_NEEDED modality;
- the 2-6/year source range;
- the PREVENT goal;
- the regimen completeness claim.

### It is not normative-modality inference

The token sequence `can be` must not be automatically mapped to `PERMITTED`.

DEC-0007 explicitly rejects lexical modality classification.

For DEC-0010, `can be` is interpreted only through governed semantic review as a source action-realization relation.

No normative force is introduced by the action-realization authority.

If a future source independently establishes a governed PERMITTED modality for one method, that requires its own modality authority.

## v1 source-proven realization structure

The exact KBS source expression is:

`Tillage can be soil finishing, rototilling or any tillage that keeps plant growth from becoming established.`

DEC-0010 v1 recognizes one source-proven parent action:

`TILL`

and one source-proven realization-set shape:

1. named method:
   `soil finishing`;
2. named method:
   `rototilling`;
3. source-defined open class:
   `any tillage that keeps plant growth from becoming established`.

This is not a closed three-member enumeration.

The third alternative is explicitly open.

Therefore a v1 realization set must preserve the fact that the source leaves the method class open.

## Candidate semantic shape

An illustrative object may be:

```text
AgronomicActionRealization {
  contractVersion
  realizationId

  sourceExpression

  parentRegimenCompilationRef
  targetActionCode:
    TILL

  realizationSet {
    closure:
      OPEN_SOURCE_DEFINED

    alternatives: [
      {
        kind:
          NAMED_METHOD
        methodCode:
          SOIL_FINISHING
        sourceExpression:
          "soil finishing"
      },
      {
        kind:
          NAMED_METHOD
        methodCode:
          ROTOTILLING
        sourceExpression:
          "rototilling"
      },
      {
        kind:
          SOURCE_DEFINED_OPEN_CLASS
        classExpression:
          "any tillage that keeps plant growth from becoming established"
        membershipCriterionExpression:
          "keeps plant growth from becoming established"
      }
    ]
  }

  authorityBindings[]
  transformationRationale
}
```

The exact implementation shape remains subject to implementation review after architecture acceptance.

## Parent-regimen closure

DEC-0010 v1 requires an exact accepted:

`AgronomicActionRegimenCompilation`

as parent authority.

For B21, the exact parent regimen must establish:

`actionCode = TILL`.

The realization authority must not attach B21 tillage methods to an unrelated action.

Publication must fail closed if:

- parent regimen actionCode is not TILL;
- parent regimen Source authority differs from the realization source;
- parent regimen SourceArtifact lineage is incompatible;
- the semantic review does not establish that the sentence-level term `Tillage` refers to the governed parent action in the B21 source context.

The parent and realization do not need to be the same Claim because they are distinct source propositions.

They must, however, close to the exact governed source context sufficient to establish the refinement relation.

## Source-qualified scientific authority

Publication must require exact active source-qualified scientific knowledge for fixed use:

`AGRONOMIC_POLICY_INPUT`.

The realization source Claim must contain the exact realization source expression.

The source Claim must be independently reviewable and retain exact SourceArtifact lineage.

Wrong scientific use, historical authority, superseded authority, unrelated source, or source-expression mismatch must fail closed.

## Named methods

DEC-0010 v1 recognizes only the two named method expressions explicitly present in the target source sentence:

- `soil finishing`;
- `rototilling`.

Canonical source-local method identifiers may be:

- `SOIL_FINISHING`;
- `ROTOTILLING`.

Those identifiers are semantic normalization of the exact source expressions.

They do not establish:

- machine implementation identity;
- equipment identity;
- implement configuration;
- operating depth;
- operating speed;
- cost;
- duration;
- availability;
- legality;
- suitability;
- agronomic equivalence.

## Source-defined open class

The third realization alternative is not a named method.

It is the source expression:

`any tillage that keeps plant growth from becoming established`.

DEC-0010 v1 therefore requires an explicit open-class representation.

The source-defined open class preserves that the protocol admits tillage methods beyond the two named methods.

It must **not** be normalized to:

`OTHER`

without retaining the exact source class expression and source membership criterion.

It must also not be converted into a closed list.

## Meaning of membershipCriterionExpression

For B21 the source-defined criterion is:

`keeps plant growth from becoming established`.

This criterion is source semantic text.

It is not, by itself:

- a runtime predicate;
- a current field-state test;
- a machine-verifiable capability;
- experimental evidence of causal efficacy;
- a treatment-effect estimate;
- a guarantee that a candidate method works;
- a certification condition;
- an Outcome.

DEC-0010 preserves the criterion as the source's class-membership description only.

A later authority may evaluate whether a concrete method satisfies such a criterion, but DEC-0010 does not pre-accept that authority.

## No causal-effect laundering

The phrase:

`keeps plant growth from becoming established`

must not be compiled into:

`method X causally prevents plant establishment`

for any concrete method.

The source defines an open class using that description.

It does not provide comparative causal evidence, effect magnitude, uncertainty, or measured efficacy for every member.

## No equivalence laundering

The realization alternatives must not be treated as materially equivalent merely because they realize the same abstract action.

DEC-0010 does not establish that:

`SOIL_FINISHING == ROTOTILLING`

or that either is equivalent to every member of the source-defined open class.

No action-equivalence authority is created.

## No exclusivity or disjointness laundering

The source connective `or` does not establish exclusive-or semantics.

DEC-0010 must not assert that:

- exactly one realization category can apply;
- named methods are disjoint from the source-defined open class;
- `SOIL_FINISHING` cannot also satisfy the source-defined class criterion;
- `ROTOTILLING` cannot also satisfy the source-defined class criterion.

The named methods are source-mentioned realizations.

The open class is a source-defined class expression.

These representations may overlap semantically.

DEC-0010 records source realization structure; it does not partition the method universe into mutually exclusive buckets.

## No preference/ranking laundering

The source sentence does not rank:

- soil finishing;
- rototilling;
- other qualifying tillage.

DEC-0010 must not introduce:

- preferred method;
- default method;
- fallback method;
- ranking score;
- utility;
- expected benefit;
- cost preference.

## No current availability laundering

A source-stated realization option is not evidence that the method is currently available in a field deployment.

DEC-0010 must not establish:

- machine availability;
- implement attachment availability;
- operator availability;
- service availability;
- current legal availability;
- current inventory.

## No runtime eligibility laundering

The realization set is upstream source authority.

It must not create:

- RuntimePlan;
- RuntimeEligibility;
- RuntimeBinding;
- RuntimeAlternativeSet;
- DecisionResult.

A later governed runtime process may decide which source-stated realization is usable in a concrete situation.

DEC-0010 does not answer that question.

## No Policy actionSpace laundering

The presence of a source realization option does not automatically add a code to a Policy actionSpace.

No Policy mutation is authorized by DEC-0010.

A source realization may later be mapped to a decision-specification or implementation action through separately governed authority.

## No PERMITTED laundering from “can be”

The phrase:

`Tillage can be...`

must not create:

`force = PERMITTED`

or a legal/current permission authority.

DEC-0010 is action-realization semantics, not normative modality.

This negative case is mandatory.

## No closed-set laundering

The source says:

`soil finishing, rototilling or any tillage that ...`

The realization domain is therefore source-open.

DEC-0010 must fail closed if an implementation represents the source as exactly:

`{SOIL_FINISHING, ROTOTILLING}`

with no retained open-class alternative.

Likewise it must fail closed if it claims:

`realizationSet.closure = CLOSED`.

## No inference from neighboring sentence

The next source sentence is:

`Plots can be chisel plowed and soil finished if more aggressive tillage is needed.`

DEC-0010 v1 does not use this sentence to add:

- `CHISEL_PLOW`;
- a `CHISEL_PLOW + SOIL_FINISH` bundle;
- `IF_NEEDED`;
- `more aggressive tillage` condition;
- method sequencing;
- conditional method selection.

Those semantics are explicitly unresolved.

The target v1 realization set is built only from:

`Tillage can be soil finishing, rototilling or any tillage that keeps plant growth from becoming established.`

## Why the next sentence is excluded

The second sentence contains at least three semantic questions not resolved by DEC-0010:

1. conditional selection:
   `if more aggressive tillage is needed`;
2. a potentially compound method realization:
   `chisel plowed and soil finished`;
3. possible relation between “more aggressive” and method capability/classification.

Treating that sentence as merely another realization alternative would erase the condition.

Treating it as a runtime rule would invent the predicate that determines when more aggressive tillage is needed.

Therefore it remains a separate architecture frontier.

## No ordered-sequence inference

The phrase:

`chisel plowed and soil finished`

does not occur in the DEC-0010 target sentence and is excluded from v1.

More generally, DEC-0010 does not establish ordered workflows.

No sequence such as:

`CHISEL_PLOW -> SOIL_FINISH`

may be inferred under this decision.

## No equipment-class inference

The protocol names agronomic tillage methods.

DEC-0010 does not infer specific:

- tractor class;
- chisel plow model;
- rototiller model;
- soil finisher model;
- power requirement;
- implement compatibility.

Those are implementation/deployment facts, not source action-realization semantics.

## No execution laundering

The protocol states that it is a working planning protocol and directs users to the agronomic field log for actual operations.

Therefore an `AgronomicActionRealizationCompilation` must not create:

- ExecutionReceipt;
- actual method used;
- machine task;
- completed operation;
- Field Log record;
- Outcome.

## Local completeness

`losslessCoverage = COMPLETE` for DEC-0010 means only:

the targeted realization semantics of the exact first method sentence are represented without changing source meaning.

For KBS B21 v1 that includes:

- exact parent TILL action refinement;
- named method `soil finishing`;
- named method `rototilling`;
- source-defined open class;
- exact open-class criterion expression;
- source openness.

It does **not** mean:

- the B21 section is complete;
- the next conditional sentence is represented;
- runtime method selection is known;
- every possible tillage method has been enumerated;
- candidate methods have been proven effective;
- methods are equivalent;
- methods are available;
- actual method execution is known.

## Interaction with DEC-0007

DEC-0007 remains unchanged.

DEC-0010 does not infer a `PERMITTED` modality from `can be`.

If semantic review of a future source independently establishes a normative modality, that authority remains separate.

## Interaction with DEC-0008

DEC-0008 remains unchanged.

The source-defined open-class criterion resembles a prevention purpose but is not automatically converted into a new GoalCondition authority.

DEC-0010 preserves it as a membership criterion expression only.

Any independent goal-condition compilation must pass DEC-0008's own source-semantic review.

## Interaction with DEC-0009

DEC-0009 remains unchanged.

DEC-0010 v1 requires an exact `AgronomicActionRegimenCompilation` parent.

The parent action must be `TILL`.

DEC-0010 refines how that source-level action may be realized without changing the regimen's:

- occurrence semantics;
- modality;
- goal;
- completeness boundary.

## Why not extend AgronomicActionRegimen v1

Rejected.

Adding method alternatives directly to Regimen v1 would mutate an accepted contract in place and conflate:

- repeated-action regimen semantics;
- action realization semantics.

The realization set is independently source-reviewable and should be separately versioned.

## Why not create Regimen v2

Rejected for this source frontier.

No existing Regimen semantics need to change.

A separate refinement authority preserves compositionality and keeps the already accepted Regimen authority stable.

## Why not use RuntimeAlternativeSet

Rejected because RuntimeAlternativeSet is downstream runtime coverage authority over exact RuntimeEligibility/RuntimeBinding paths.

B21 method alternatives are source semantics and exist before runtime adjudication.

## Why not use Policy actionSpace

Rejected because Policy actionSpace belongs to governed decision specification.

The source statement does not itself define a deployed Policy.

## Why not use a generic “options” array

Rejected because it would fail to preserve:

- parent action identity;
- named-method versus open-class distinction;
- source-open closure;
- exact membership criterion;
- lineage to the parent regimen.

## KBS architecture target

### B21 action realization

Source:

`Tillage can be soil finishing, rototilling or any tillage that keeps plant growth from becoming established.`

Candidate semantics:

```text
parentRegimen.actionCode = TILL

realizationSet.closure =
  OPEN_SOURCE_DEFINED

realizationSet.alternatives =
  NAMED_METHOD(SOIL_FINISHING, "soil finishing")
  NAMED_METHOD(ROTOTILLING, "rototilling")
  SOURCE_DEFINED_OPEN_CLASS(
    "any tillage that keeps plant growth from becoming established",
    criterion =
      "keeps plant growth from becoming established"
  )
```

Normative force:

`ABSENT`.

Runtime eligibility:

`NOT ESTABLISHED`.

Method preference:

`NOT ESTABLISHED`.

Method equivalence:

`NOT ESTABLISHED`.

Concrete implementation:

`NOT ESTABLISHED`.

Execution:

`NOT ESTABLISHED`.

## Mandatory implementation acceptance cases

If DEC-0010 is accepted, implementation acceptance must prove at least:

1. exact KBS B21 first method sentence publishes as one action-realization authority;
2. parent exact `AgronomicActionRegimenCompilation` actionCode is TILL;
3. `SOIL_FINISHING` and `ROTOTILLING` are retained as named source methods;
4. the source-defined open class is retained explicitly;
5. the realization set is OPEN_SOURCE_DEFINED, not CLOSED;
6. adding `force=PERMITTED` or equivalent normative field fails closed;
7. creating runtime eligibility/availability/ranking/equivalence fields fails closed;
8. treating the open-class criterion as proven causal efficacy fails closed;
9. asserting mutually exclusive/disjoint alternatives fails closed;
10. binding the realization set to an unrelated parent regimen fails closed;
11. wrong scientific use fails closed;
12. source-expression mismatch fails closed;
13. adding `CHISEL_PLOW` from the next conditional sentence to the v1 realization set fails closed;
14. local COMPLETE does not mean B21 section completeness;
15. no RuntimeAlternativeSet, RuntimeBinding, DecisionResult, execution, or Outcome authority is created.

At least one negative test must use the exact real KBS source sentence.

## Runtime boundary

`AgronomicActionRealizationCompilation` is not:

- Policy actionSpace;
- Policy actionSemantics;
- DeclarativeAgronomicRule;
- AgronomicPolicyConstraintCompilation;
- AgronomicPolicyObligationCompilation;
- AgronomicNormativeModalityCompilation;
- AgronomicGoalConditionCompilation;
- AgronomicActionRegimenCompilation;
- RuntimePlan;
- RuntimeEligibility;
- RuntimeBinding;
- RuntimeAlternativeSet;
- implementation registry;
- equipment capability registry;
- current availability authority;
- ranking;
- optimization;
- scheduler;
- DecisionResult;
- ExecutionReceipt;
- Field Log;
- Outcome;
- causal-effect authority.

## Content addressing

The normalized action realization must be content-addressed.

Changing any of the following must change its semantic hash:

- exact source expression;
- exact parent regimen ref;
- target action code;
- realization-set closure;
- named method code;
- named method source expression;
- open-class source expression;
- open-class membership criterion expression;
- exact scientific authority bindings.

Stored authority must fail closed if normalized semantics drift from the declared hash.

## Explicitly unresolved after DEC-0010

Even if accepted and implemented, ADR still leaves at least:

1. conditional method selection from:
   `if more aggressive tillage is needed`;
2. compound method semantics for:
   `chisel plowed and soil finished`;
3. whether any compound method is ordered;
4. runtime operationalization of “more aggressive tillage is needed”;
5. runtime operationalization of the source-defined open-class membership criterion;
6. mapping source methods to concrete machine implementations;
7. method availability and equipment compatibility;
8. method ranking/cost/optimization;
9. runtime conversion to legal alternatives;
10. Field Log / execution reconciliation.

These must not be collapsed into DEC-0010 merely to make B21 operationally complete.

## Acceptance targets

Before implementation is authorized, architecture review must confirm:

1. source action realization is distinct from RuntimeAlternativeSet;
2. source action realization is distinct from Policy actionSpace/actionSemantics;
3. `can be` does not automatically establish PERMITTED;
4. parent exact Regimen authority is mandatory in v1;
5. target parent action is TILL;
6. realization set is source-open, not closed;
7. named methods and source-defined open class remain distinct;
8. source-defined membership criterion is not causal-effect or runtime predicate authority;
9. no preference, ranking, equivalence, availability, or eligibility is inferred;
10. named methods and the open class are not assumed mutually exclusive or disjoint;
11. the next conditional chisel-plow sentence remains out of scope;
12. local COMPLETE remains local to the first method sentence;
13. implementation is additive and does not mutate accepted contracts.

## Acceptance gate

DEC-0010 remains **PROPOSED** until explicit architecture acceptance.

No implementation, runtime mutation, workflow mutation, existing accepted contract mutation, or Policy/actionSpace mutation is authorized by this draft.

If accepted, implementation must occur on a separate branch created from the resulting accepted main and must include exact real KBS B21 positive and negative acceptance evidence.

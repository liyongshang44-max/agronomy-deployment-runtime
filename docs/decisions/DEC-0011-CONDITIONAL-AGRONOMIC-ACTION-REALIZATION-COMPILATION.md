# DEC-0011 — Governed Conditional Agronomic Action-Realization Compilation

Status: **PROPOSED**

Date: 2026-08-28

## Context

ADR now has accepted and implemented source-semantic authority for:

- hard positive obligations;
- normative modality;
- agronomic goal conditions;
- source-level repeated-action regimens;
- source-level action realization sets.

For KBS Treatment B21, ADR can now represent:

`Plots are tilled as needed (2-6 times a year) to prevent plant growth from becoming established.`

as an `AgronomicActionRegimenCompilation`, and:

`Tillage can be soil finishing, rototilling or any tillage that keeps plant growth from becoming established.`

as an `AgronomicActionRealizationCompilation`.

The next source sentence states:

`Plots can be chisel plowed and soil finished if more aggressive tillage is needed.`

DEC-0010 explicitly left this sentence unresolved because it contains semantics not safely represented by Action Realization v1.

The sentence combines at least three distinct source-semantic elements:

1. a compound realization phrase:
   `chisel plowed and soil finished`;
2. a conditional qualifier:
   `if ... is needed`;
3. a source-stated condition object:
   `more aggressive tillage`.

The sentence does **not** provide a machine-evaluable predicate for deciding whether more aggressive tillage is needed.

It also does not explicitly state execution order between chisel plowing and soil finishing.

Therefore ADR needs a source-level representation that preserves the conditional compound realization without laundering it into runtime predicates, ordered workflows, permission, rankings, or execution truth.

## Existing authorities are insufficient

### DEC-0007 IF_NEEDED is necessary but not sufficient

DEC-0007 accepts:

`IF_NEEDED`

as a source qualifier.

Its purpose is to preserve source normative structure without converting the qualifier into a Boolean runtime condition.

For the target B21 sentence, a qualifier-only modality can correctly preserve:

`IF_NEEDED`

with no normative force.

However DEC-0007 does not have a field for the specific condition object:

`more aggressive tillage`.

If ADR represented the sentence only as:

`qualifier = IF_NEEDED`

then the source would lose the fact that the need concerns **more aggressive tillage**.

That is not lossless enough for the targeted source semantics.

### DeclarativeAgronomicRule trigger is too strong

Existing DeclarativeAgronomicRule trigger predicates require inspectable fields such as:

- semanticId;
- comparator;
- value.

Using that grammar for:

`more aggressive tillage is needed`

would require ADR to invent one or more of:

- an aggressiveness semantic variable;
- a comparison baseline;
- an aggressiveness scale;
- a threshold;
- a current field value;
- a Boolean current-need state.

The source supplies none of those.

Therefore this sentence must not be compiled directly into a runtime-evaluable rule trigger.

### DEC-0010 Action Realization v1 is intentionally too narrow

DEC-0010 v1 accepts the exact first method sentence as an open source-defined realization set.

Its v1 alternatives are:

- SOIL_FINISHING;
- ROTOTILLING;
- one SOURCE_DEFINED_OPEN_CLASS.

DEC-0010 intentionally rejects the neighboring chisel-plow sentence because adding it directly would erase:

- the `if ... needed` condition;
- the compound `and` structure;
- the unresolved ordering question.

DEC-0011 must therefore be additive rather than mutate DEC-0010 v1.

## Decision under proposal

Introduce a separate source-semantic authority:

`AgronomicConditionalActionRealizationCompilation`

Candidate contracts:

`adr.agronomic-conditional-action-realization.v1`

`adr.agronomic-conditional-action-realization-compilation.v1`

This authority represents a source-stated conditional realization of an already governed agronomic action.

For DEC-0011 v1, the architecture is intentionally restricted to the exact real-source pattern:

`TILL -> [CHISEL_PLOWING AND SOIL_FINISHING] IF_NEEDED("more aggressive tillage")`

with:

- no normative force;
- no runtime need predicate;
- no execution order;
- no aggressiveness scale;
- no current need state.

## Required parent authorities

DEC-0011 v1 requires exact accepted parent authorities.

### Parent regimen

The candidate must reference one exact:

`AgronomicActionRegimenCompilation`

whose actionCode is:

`TILL`.

This preserves the abstract source action being refined.

### Parent action-realization authority

The candidate must also reference one exact:

`AgronomicActionRealizationCompilation`

for the same governed source context.

For the target B21 case, that parent realization authority establishes the existing source-local named method:

`SOIL_FINISHING`.

The conditional sentence uses the inflected source wording:

`soil finished`.

A future implementation may normalize that phrase to the already governed source-local method code:

`SOIL_FINISHING`

only through explicit governed semantic review.

Lexical stemming alone is insufficient authority.

### IF_NEEDED modality authority

The candidate must reference an exact:

`AgronomicNormativeModalityCompilation`

derived from the target conditional source proposition.

For DEC-0011 v1 that modality must establish:

- qualifiers = [`IF_NEEDED`];
- targetScope = `ACTION`;
- no normative force.

This reuses DEC-0007 rather than inventing a second qualifier vocabulary.

The new authority then binds that qualifier to the specific conditional compound realization.

## Source-proven v1 structure

The exact target sentence is:

`Plots can be chisel plowed and soil finished if more aggressive tillage is needed.`

DEC-0011 v1 preserves the following source structure.

### Parent action

`TILL`

### Compound realization

Two source-conjoined components:

1. `chisel plowed`
   -> source-local method code:
   `CHISEL_PLOWING`;

2. `soil finished`
   -> exact previously governed source-local method:
   `SOIL_FINISHING`.

### Composition semantics

The connective:

`and`

means both components are textually conjoined within the same source realization phrase.

DEC-0011 v1 therefore proposes a composition marker equivalent to:

`SOURCE_CONJUNCTION_NO_ORDER_ASSERTED`.

This means:

- both components belong to the same source-stated compound realization;
- no execution order is established.

It does **not** mean:

`CHISEL_PLOWING -> SOIL_FINISHING`

in a temporal or workflow sense.

### Conditional qualifier

`IF_NEEDED`

### Source condition expression

`more aggressive tillage is needed`

### Source condition object

`more aggressive tillage`

The condition object is retained as source semantic text only.

## Candidate semantic shape

An illustrative candidate may be:

```text
AgronomicConditionalActionRealization {
  contractVersion
  conditionalRealizationId

  sourceExpression:
    "Plots can be chisel plowed and soil finished if more aggressive tillage is needed."

  parentRegimenCompilationRef
  parentActionRealizationCompilationRef

  targetActionCode:
    TILL

  compoundRealization {
    composition:
      SOURCE_CONJUNCTION_NO_ORDER_ASSERTED

    components: [
      {
        kind:
          SOURCE_NAMED_METHOD
        methodCode:
          CHISEL_PLOWING
        sourceExpression:
          "chisel plowed"
      },
      {
        kind:
          EXISTING_SOURCE_METHOD
        methodCode:
          SOIL_FINISHING
        sourceExpression:
          "soil finished"
      }
    ]
  }

  modalityCompilationRef

  sourceCondition {
    expression:
      "more aggressive tillage is needed"

    objectExpression:
      "more aggressive tillage"
  }

  authorityBindings[]
  transformationRationale
}
```

The exact implementation shape remains subject to implementation review after architecture acceptance.

## Why a separate conditional-realization authority

The target sentence is not merely another unconditional option.

The condition materially limits when the source says the compound realization can be considered.

If ADR added:

`CHISEL_PLOWING + SOIL_FINISHING`

directly to the DEC-0010 open realization set, it would lose:

`if more aggressive tillage is needed`.

That would make the source appear less conditional than it is.

A separate authority preserves the condition without pretending to evaluate it.

## No PERMITTED laundering from “can be”

The phrase:

`Plots can be...`

must not automatically establish:

`force = PERMITTED`.

DEC-0007 already requires semantic review rather than lexical force inference.

For DEC-0011 v1 the target modality is qualifier-only:

`IF_NEEDED`

with force absent.

The conditional-realization authority must not add permission semantics.

## Meaning of IF_NEEDED here

`IF_NEEDED` means only that the source realization is conditional on a source-stated need.

It does not establish:

- that the need currently exists;
- how the need is measured;
- who determines the need;
- when the determination is made;
- a threshold;
- a runtime Boolean condition.

DEC-0011 preserves conditional source structure only.

## Meaning of “more aggressive tillage”

The phrase:

`more aggressive tillage`

contains a comparative adjective.

DEC-0011 must not convert it into an ordinal or numeric aggressiveness model.

It does not establish:

- `aggressivenessScore`;
- a ranking of tillage methods;
- a baseline aggressiveness value;
- a threshold;
- a comparator;
- a machine capability class;
- a soil-disturbance metric.

The comparison baseline is not explicitly defined in the target sentence.

Therefore `more aggressive tillage` remains an exact source condition-object expression.

## No runtime predicate laundering

The source condition:

`more aggressive tillage is needed`

must not become a runtime predicate such as:

```text
semanticId = tillage.aggressiveness_need
comparator = EQUALS
value = true
```

without separately governed operationalization authority.

Likewise DEC-0011 must not introduce:

- `currentNeed = true`;
- `needDetectedAt`;
- `needThreshold`;
- `aggressiveness >= X`;
- `weedPressure >= X`;
- `plantEstablishment = true`.

Those would require evidence not present in the source sentence.

## No condition satisfaction authority

DEC-0011 does not establish whether the source condition is currently satisfied.

No status such as:

- CONDITION_MET;
- CONDITION_NOT_MET;
- NEED_ESTABLISHED;
- NEED_NOT_ESTABLISHED

belongs in v1.

The authority says only what the source condition is.

## Compound realization semantics

The phrase:

`chisel plowed and soil finished`

is represented as one source-stated compound realization.

The architecture preserves both components.

It must fail closed if either component is silently dropped.

For example:

`CHISEL_PLOWING`

alone is not a lossless representation of the targeted phrase.

Likewise:

`SOIL_FINISHING`

alone is not a lossless representation.

## No ordered-workflow inference

The textual order:

`chisel plowed and soil finished`

does not by itself establish a governed temporal relation.

DEC-0011 must not create:

- BEFORE;
- AFTER;
- NEXT;
- THEN;
- FIRST;
- SECOND;
- step numbers;
- execution DAG edges.

If future source evidence explicitly establishes order, that requires separate temporal/workflow authority.

## No temporal-rule reuse

DEC-0003 supports explicit temporal relations such as before/after and event offsets.

The target sentence contains no explicit before/after temporal relation.

Therefore DEC-0011 must not use DEC-0003 merely because two method phrases appear in textual order.

## Existing SOIL_FINISHING identity

DEC-0010 already establishes a source-local named method:

`SOIL_FINISHING`

from the expression:

`soil finishing`.

DEC-0011's target sentence contains:

`soil finished`.

The new conditional-realization authority may bind that inflected expression to the existing source-local method only when semantic review explicitly establishes that identity within the exact source context.

The architecture must fail closed if an implementation maps:

`soil finished`

to an unrelated method solely by lexical similarity.

## New CHISEL_PLOWING identity

The target sentence newly introduces:

`chisel plowed`.

DEC-0011 v1 may normalize this source expression to:

`CHISEL_PLOWING`.

That identifier remains source-local agronomic method semantics.

It does not establish:

- a concrete implement;
- a machine model;
- implement width;
- working depth;
- power requirement;
- current equipment availability.

## No source-open-class membership inference

DEC-0010 contains the source-defined open class:

`any tillage that keeps plant growth from becoming established`.

The target DEC-0011 sentence does not explicitly state that the compound:

`chisel plowed and soil finished`

satisfies that open-class criterion.

Therefore DEC-0011 must not automatically claim:

`compoundRealization memberOf parentOpenClass`.

The two sentences are contextually related, but class membership remains unestablished unless separately reviewed from sufficient source evidence.

## No causal-efficacy inference

DEC-0011 does not establish that:

- chisel plowing prevents plant establishment;
- soil finishing prevents plant establishment;
- the compound is more effective than other methods;
- the compound causally achieves the B21 goal.

No effect magnitude, comparison, uncertainty, or causal estimate is created.

## No aggressiveness ranking inference

The phrase:

`more aggressive tillage`

must not be used to rank:

- CHISEL_PLOWING;
- SOIL_FINISHING;
- ROTOTILLING;
- any open-class method.

The source does not provide an explicit total or partial order.

DEC-0011 must not assert:

`CHISEL_PLOWING > ROTOTILLING`

or any similar relation.

## No equivalence inference

The compound realization does not establish equivalence between components or alternatives.

DEC-0011 must not assert that:

- CHISEL_PLOWING is equivalent to SOIL_FINISHING;
- the compound is equivalent to ROTOTILLING;
- the compound is equivalent to all TILL realizations.

## No current availability inference

The source sentence does not establish that chisel-plowing equipment or soil-finishing equipment is currently available.

No current:

- implement availability;
- tractor compatibility;
- operator availability;
- service availability;
- field accessibility

is established.

## No runtime eligibility

DEC-0011 is upstream source authority.

It must not create:

- RuntimePlan;
- RuntimeEligibility;
- RuntimeBinding;
- RuntimeAlternativeSet;
- DecisionResult.

A later runtime process may determine whether the conditional compound realization is usable for a concrete field state.

DEC-0011 does not answer that question.

## No automatic Policy mutation

DEC-0011 does not add:

- CHISEL_PLOWING;
- compound realization codes;
- aggressiveness conditions

to a deployed Policy actionSpace or actionSemantics.

Mapping source methods to decision-specification actions requires separately governed compilation.

## No execution authority

The source protocol is planning authority, not actual operation evidence.

DEC-0011 must not create:

- an executed chisel-plow operation;
- an executed soil-finishing operation;
- machine tasks;
- ExecutionReceipt;
- Field Log truth;
- Outcome.

## Scientific authority lineage

Publication must require exact active source-qualified knowledge for fixed use:

`AGRONOMIC_POLICY_INPUT`.

For the real B21 Gold implementation, the source lineage should retain three independently reviewable propositions under the same exact Source/SourceArtifact:

### Claim A

`Plots are tilled as needed (2-6 times a year) to prevent plant growth from becoming established.`

Supports the exact parent Regimen authority.

### Claim B

`Tillage can be soil finishing, rototilling or any tillage that keeps plant growth from becoming established.`

Supports the exact parent Action Realization authority.

### Claim C

`Plots can be chisel plowed and soil finished if more aggressive tillage is needed.`

Supports the new conditional realization and its IF_NEEDED modality.

Claim C must not be collapsed into Claim A or Claim B merely for implementation convenience.

## Source/Artifact closure

The exact parent Regimen, parent Action Realization, target IF_NEEDED modality, and Conditional Action Realization must close to compatible governed source context.

For the target B21 case:

- Source must be the same governed protocol source;
- SourceArtifact must be the same exact curated artifact or exact compatible artifact lineage;
- parent and child propositions remain distinct Claims.

Publication must fail closed for unrelated source context.

## Conditional modality closure

The exact modality predecessor used by DEC-0011 must satisfy all of:

- kind = `AgronomicNormativeModalityCompilation`;
- qualifier = `IF_NEEDED`;
- targetScope = `ACTION`;
- force absent;
- sourceExpression equals the exact conditional source sentence;
- scientific predecessor lineage includes the exact qualified Claim C authority.

A modality with:

- AS_NEEDED;
- IF_POSSIBLE;
- PERMITTED force;
- another source expression

must not authorize the target v1 conditional realization.

## Parent action-realization closure

The exact DEC-0010 parent must establish:

- targetActionCode = TILL;
- source-local named method SOIL_FINISHING.

The conditional semantic review must explicitly establish that source expression:

`soil finished`

maps to that exact existing method identity.

## Parent regimen closure

The exact DEC-0009 parent must establish:

`actionCode = TILL`.

The conditional realization must fail closed against an unrelated parent action.

## Local completeness

`losslessCoverage = COMPLETE` for DEC-0011 means only:

the targeted conditional compound-realization semantics of the exact sentence are represented without changing source meaning.

For B21 v1 this includes:

- parent TILL action;
- CHISEL_PLOWING component;
- SOIL_FINISHING component;
- source conjunction;
- no-order-asserted composition;
- IF_NEEDED qualifier;
- exact condition expression;
- exact condition-object expression.

It does **not** mean:

- the need is operationalized;
- the condition is currently true;
- aggressiveness is measurable;
- a method ranking exists;
- the compound belongs to the DEC-0010 open class;
- component execution order is known;
- equipment is available;
- runtime eligibility exists;
- execution occurred;
- the B21 section is globally complete.

## Interaction with DEC-0007

DEC-0007 remains unchanged.

DEC-0011 reuses exact qualifier authority:

`IF_NEEDED`.

DEC-0011 adds the missing source condition object and binds the qualifier to one exact compound realization.

It does not mutate the Modality v1 contract.

## Interaction with DEC-0009

DEC-0009 remains unchanged.

DEC-0011 references the exact parent TILL Regimen.

It does not change:

- occurrence range;
- AS_NEEDED regimen modality;
- PREVENT goal.

## Interaction with DEC-0010

DEC-0010 remains unchanged.

DEC-0011 references the exact parent Action Realization authority.

It does not mutate the existing open realization set.

The conditional compound realization is represented separately so its source condition is not lost.

## Why not Action Realization v2

Rejected for the current source frontier.

A generic Action Realization v2 with optional condition fields would mix:

- unconditional source realization sets;
- conditional source realization;
- condition-object semantics;
- compound realization semantics.

The current source supports a narrower separately governed authority.

Keeping it separate preserves already accepted DEC-0010 semantics.

## Why not extend Modality v1

Rejected.

Adding `conditionObjectExpression` to Modality v1 would mutate an accepted contract and overload normative modality with source-condition semantics.

The qualifier and condition object are separate semantic dimensions.

## Why not use DeclarativeAgronomicRule

Rejected because the source does not provide a machine-evaluable trigger predicate.

Rule trigger grammar would require invented runtime semantics.

## Why not create a RuntimeAlternativeSet

Rejected because RuntimeAlternativeSet is downstream runtime coverage authority over adjudicated runtime paths.

The target sentence is source semantics.

## Why not represent CHISEL_PLOWING as another unconditional DEC-0010 alternative

Rejected because that deletes:

`if more aggressive tillage is needed`.

## Why not infer an ordered two-step workflow

Rejected because the source uses conjunction, not an explicit ordering relation.

## Why not use a free-text limitation only

Rejected because the condition is decision-material source semantics and should remain inspectable, content-addressed, reviewable authority rather than hidden in a limitation string.

## Candidate content addressing

The normalized conditional action realization must be content-addressed.

Changing any of the following must change its semantic hash:

- exact source expression;
- parent Regimen ref;
- parent Action Realization ref;
- target action code;
- composition mode;
- CHISEL_PLOWING source expression;
- SOIL_FINISHING source expression;
- exact IF_NEEDED modality ref;
- exact source condition expression;
- exact source condition-object expression;
- scientific authority bindings.

Stored authority must fail closed if normalized semantics drift from the declared hash.

## Mandatory implementation acceptance cases

If DEC-0011 is accepted, implementation acceptance must prove at least:

1. exact real B21 Claim C publishes one conditional-action-realization authority;
2. exact parent Regimen actionCode = TILL;
3. exact parent Action Realization establishes SOIL_FINISHING;
4. `soil finished` maps to exact existing SOIL_FINISHING only through governed semantic review;
5. `chisel plowed` is retained as CHISEL_PLOWING source-local method semantics;
6. both compound components are retained;
7. composition is SOURCE_CONJUNCTION_NO_ORDER_ASSERTED;
8. no BEFORE/AFTER/sequence/order authority is created;
9. exact qualifier predecessor is IF_NEEDED/ACTION with no force;
10. exact condition expression `more aggressive tillage is needed` is retained;
11. exact condition object `more aggressive tillage` is retained;
12. no runtime predicate/comparator/threshold/current-need state is created;
13. adding force=PERMITTED fails closed;
14. adding aggressivenessScore/rank/baseline/threshold fails closed;
15. adding runtimeEligibility/availability/equivalence fields fails closed;
16. asserting membership in the DEC-0010 source-defined open class fails closed;
17. dropping either compound component fails local completeness;
18. using an unrelated parent Regimen fails closed;
19. using an unrelated parent Action Realization fails closed;
20. wrong scientific use fails closed;
21. source-expression mismatch fails closed;
22. modality qualifier mismatch fails closed;
23. no Policy, RuntimeAlternativeSet, RuntimeBinding, DecisionResult, execution, Field Log, or Outcome authority is created.

At least one negative test must use the exact real KBS conditional source sentence.

## Runtime boundary

`AgronomicConditionalActionRealizationCompilation` is not:

- DeclarativeAgronomicRule;
- runtime condition evaluator;
- Policy actionSpace;
- Policy actionSemantics;
- AgronomicPolicyConstraintCompilation;
- AgronomicPolicyObligationCompilation;
- AgronomicNormativeModalityCompilation;
- AgronomicGoalConditionCompilation;
- AgronomicActionRegimenCompilation;
- AgronomicActionRealizationCompilation;
- action ranking authority;
- causal-effect authority;
- equipment capability authority;
- RuntimePlan;
- RuntimeEligibility;
- RuntimeBinding;
- RuntimeAlternativeSet;
- scheduler;
- workflow engine;
- DecisionResult;
- ExecutionReceipt;
- Field Log;
- Outcome.

## Explicitly unresolved after DEC-0011

Even if accepted and implemented, ADR still leaves at least:

1. operationalization of `more aggressive tillage is needed`;
2. definition of any measurable tillage-aggressiveness concept;
3. who or what adjudicates current need;
4. mapping CHISEL_PLOWING to concrete equipment implementations;
5. mapping SOIL_FINISHING to concrete equipment implementations;
6. equipment compatibility and availability;
7. whether the compound should be ordered under additional evidence;
8. whether the compound satisfies the DEC-0010 open-class membership criterion;
9. method ranking, cost and optimization;
10. runtime conversion to legal action alternatives;
11. Field Log / actual execution reconciliation.

These must not be collapsed into DEC-0011 simply to make the source operational.

## Acceptance targets

Before implementation is authorized, architecture review must confirm:

1. IF_NEEDED qualifier alone is insufficient because the source condition object must be retained;
2. rule trigger grammar is too strong because no machine-evaluable predicate is source-established;
3. parent exact Regimen is required;
4. parent exact Action Realization is required;
5. exact IF_NEEDED modality predecessor is required;
6. compound realization retains both CHISEL_PLOWING and SOIL_FINISHING;
7. conjunction does not imply execution order;
8. `more aggressive tillage` remains source text, not a measurable scale;
9. no current need state is inferred;
10. no PERMITTED force is inferred from `can be`;
11. no open-class membership, causal effect, ranking, equivalence, availability, or runtime eligibility is inferred;
12. local COMPLETE remains local to the target conditional sentence;
13. implementation is additive and does not mutate accepted contracts.

## Acceptance gate

DEC-0011 remains **PROPOSED** until explicit architecture acceptance.

No contract implementation, runtime mutation, workflow mutation, Policy mutation, accepted authority mutation, or equipment/runtime operationalization is authorized by this draft.

If accepted, implementation must occur on a separate branch created from the resulting accepted main and must include exact real KBS three-Claim positive and negative acceptance evidence.

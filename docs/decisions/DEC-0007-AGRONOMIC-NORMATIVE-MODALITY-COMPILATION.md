# DEC-0007 — Governed Agronomic Normative Modality Compilation

Status: **PROPOSED**

Date: 2026-08-27

## Context

ADR now has accepted, implemented authority for:
- positive trigger/action agronomic rules;
- temporal and coordination semantics;
- source-bound prohibitions;
- context-only Policy v3;
- hard positive obligations with occurrence cardinality.

The 2015 KBS LTER Agronomic Protocol contains operational statements whose source meaning cannot be preserved by treating every instruction as a hard REQUIRE or PROHIBIT.

Examples include:
- `The amount on nitrogen applied to treatment 3 should be 3/5 of the total amount applied to treatment 1.`
- `Try to have the micro-plot area of treatment 7 tilled within the same week that tillage in treatment 1 is completed.`
- fertilizer timing qualified by `if possible`;
- `If needed an insecticide application can be used to control aphids.`
- Treatment B21: `Plots are tilled as needed (2-6 times a year)...`

The same document also contains lexical lookalikes that are not normative instructions. For example, Treatment 6 states that superphosphate `may need to be specially ordered from the fertilizer dealer`. That `may` expresses logistical possibility, not permission to perform an agronomic action.

Therefore ADR must not implement normative modality as a keyword-to-strength lookup.

## Proposed decision

Introduce a separate source-semantic authority:

`AgronomicNormativeModalityCompilation`

Candidate contracts:

`adr.agronomic-normative-modality.v1`

`adr.agronomic-normative-modality-compilation.v1`

This authority records machine-readable source modality for already source-faithful, scientifically governed agronomic knowledge.

It does not itself publish a Policy, Rule, Constraint, Obligation, RuntimeEligibility, schedule, or action.

## Two-dimensional v1 model

Normative force and conditional qualifier are distinct dimensions.

### Force

Candidate v1 force values:

- `SHOULD`
- `BEST_EFFORT`
- `PERMITTED`

Force is optional if the source only establishes a qualifier.

No `HARD_REQUIRE` or `HARD_PROHIBIT` value is introduced here. Hard requirement/prohibition semantics already have accepted authority classes and must not be redefined by DEC-0007.

### Qualifiers

Candidate v1 qualifier values:

- `AS_NEEDED`
- `IF_NEEDED`
- `IF_POSSIBLE`

A modality object MUST contain at least one force or at least one qualifier.

Qualifiers are not silently converted into Boolean runtime conditions. They preserve source normative structure only.

## No total ordering

DEC-0007 does not define numeric strength and does not claim:

`SHOULD > BEST_EFFORT > PERMITTED`

or any other total ordering.

The values represent different source semantics, not one scalar confidence or command-strength axis.

A downstream system MUST NOT choose actions by assigning arbitrary numeric weights to these modality classes merely because they are machine-readable.

## Target scope

Each modality annotation identifies the semantic element being qualified.

The v1 target scopes are restricted to source-proven forms:

- `ACTION`
- `TIMING_RELATION`
- `PARAMETER_VALUE`
- `OCCURRENCE`

The target scope does not create or modify the target operational authority. It only states what part of the source proposition the modality qualifies.

## Source expression preservation

Each modality must preserve:
- exact source-qualified knowledge ref;
- exact source expression or evidence phrase;
- exact target scope;
- normalized force, if any;
- normalized qualifiers, if any;
- transformation rationale;
- lossless-coverage declaration.

The normalized modality must be content-addressed.

Keyword presence alone is not sufficient authority.

## Scientific/source authority closure

The compilation must bind exact active `QualifiedKnowledge` or `DerivedKnowledge` authority for the fixed use `AGRONOMIC_POLICY_INPUT`.

Every source-qualified predecessor must continue to replay through:
- exact Source;
- exact SourceArtifact;
- Claim;
- SourceContext;
- source-faithful review;
- scientific qualification;
- current allowed use.

A record with a matching kind label is not sufficient.

## Source-faithful semantic review

Normative modality classification is a source-interpretation act.

The implementation must require explicit governed semantic review. It must not:
- infer PERMITTED merely because the token `may` or `can` appears;
- infer SHOULD from general descriptive language;
- infer AS_NEEDED from an agronomist's external knowledge when the source does not say so;
- upgrade a soft expression into hard REQUIRE;
- delete a source qualifier merely because the rest of the statement can already be represented.

The exact authorization mechanism for modality review must remain compatible with ADR source-faithful governance and must be finalized in implementation review before merge.

## KBS architecture targets

### A. Treatment 3 — SHOULD parameter value

Source:

`The amount on nitrogen applied to treatment 3 should be 3/5 of the total amount applied to treatment 1.`

Candidate modality:

- force = `SHOULD`
- qualifiers = []
- targetScope = `PARAMETER_VALUE`

This authority does not calculate 3/5. Calculation remains Model authority.

It does not upgrade the source to a hard parameter requirement.

### B. Treatment 7 — BEST_EFFORT timing relation

Source:

`Try to have the micro-plot area of treatment 7 tilled within the same week that tillage in treatment 1 is completed.`

Candidate modality:

- force = `BEST_EFFORT`
- qualifiers = []
- targetScope = `TIMING_RELATION`

DEC-0007 must preserve `try to`.

It must not convert the instruction into mandatory temporal eligibility.

It also must not redefine `within the same week` as an exact seven-day duration. The accepted temporal-semantics boundary remains unchanged.

### C. Treatment 1 / Treatment 3 — IF_POSSIBLE timing qualifier

Source pattern:

fertilizer is described as applied `before chisel plowing, if possible`.

Candidate modality:

- force = absent
- qualifiers = [`IF_POSSIBLE`]
- targetScope = `TIMING_RELATION`

The qualifier means the source does not make that timing relation unconditional.

DEC-0007 does not define how runtime feasibility is measured.

### D. Insect control — PERMITTED + IF_NEEDED

Source:

`If needed an insecticide application can be used to control aphids.`

Candidate modality:

- force = `PERMITTED`
- qualifiers = [`IF_NEEDED`]
- targetScope = `ACTION`

This proves that force and qualifier can coexist in one source proposition.

It does not mean the insecticide is currently needed, legal, product-qualified, or RuntimeEligible.

### E. Treatment B21 — AS_NEEDED occurrence qualifier

Source:

`Plots are tilled as needed (2-6 times a year) to prevent plant growth from becoming established.`

Candidate modality:

- force = absent
- qualifiers = [`AS_NEEDED`]
- targetScope = `OCCURRENCE`

This closes only the previously unrepresented `NORMATIVE_MODALITY_AS_NEEDED` element from DEC-0006.

It does not close the separate source purpose/goal condition:

`to prevent plant growth from becoming established`

Therefore DEC-0007 alone MUST NOT make the existing B21 obligation candidate publishable as COMPLETE.

### F. Mandatory negative case — non-normative MAY

Source:

`superphosphate, which may need to be specially ordered from the fertilizer dealer`

The token `may` is not agronomic permission.

The benchmark must reject any candidate that classifies this phrase as:
- force = PERMITTED;
- an agronomic ACTION modality;
- or any other normative operational authority.

This negative case is mandatory.

## Completeness semantics

`losslessCoverage=COMPLETE` for a modality compilation means only:

the source normative force/qualifier information targeted by this modality object has been fully represented.

It does not mean the entire agronomic source statement has been operationalized.

For example:
- B21 modality may be COMPLETE for `AS_NEEDED`;
- the B21 obligation remains INCOMPLETE because the goal condition is still unrepresented.

This distinction is mandatory.

## Interaction with existing authority

DEC-0007 does not mutate accepted contracts in place.

Existing authorities remain:

`AgronomicPolicyCompilation`

`AgronomicPolicyConstraintCompilation`

`AgronomicPolicyObligationCompilation`

A future version of one of those authorities may require an exact `AgronomicNormativeModalityCompilation` predecessor when source soft modality is decision-material.

DEC-0007 does not pre-accept such version changes.

## Runtime boundary

`AgronomicNormativeModalityCompilation`

is not:
- current need;
- current feasibility;
- current preference score;
- current action eligibility;
- action ranking;
- scheduler priority;
- confidence;
- probability;
- legal permission;
- product registration;
- human approval;
- RuntimeBinding;
- RuntimeEligibility;
- DecisionResult;
- execution truth;
- Field Log truth;
- Outcome.

In particular:

`PERMITTED` in source modality does not mean legally permitted or currently deployable.

`IF_NEEDED` does not mean runtime need has been established.

`IF_POSSIBLE` does not mean feasibility has been evaluated.

## Planning / execution boundary

The governed KBS document remains a planning protocol.

Normative modality extracted from that protocol is planning/source authority only.

Actual 2015 operations remain authoritative only through the agronomic field log or other execution evidence.

## Rejected alternatives

### Add a numeric normative-strength score

Rejected because the source classes are not proven to form one total order and such a score would create semantics not asserted by the protocol.

### Add soft values directly to Obligation v1

Rejected because modality cuts across action, timing, parameter, and occurrence semantics and should not be hidden inside one authority class.

### Treat AS_NEEDED as hard REQUIRE with a missing runtime condition

Rejected because this launders conditional source language into a hard obligation.

### Treat IF_POSSIBLE as an executable feasibility predicate

Rejected because the source does not define the feasibility measurement or decision procedure.

### Treat every `can` or `may` as PERMITTED

Rejected because lexical modality can be epistemic, descriptive, logistical, or capability-related rather than normative.

### Resolve B21 completely in DEC-0007

Rejected because B21 also contains a goal condition that remains outside this decision.

## Acceptance targets

Before implementation is authorized, architecture review must confirm:

1. force and qualifier remain separate dimensions;
2. no numeric or total ordering is introduced;
3. v1 force remains limited to SHOULD / BEST_EFFORT / PERMITTED;
4. v1 qualifiers remain limited to AS_NEEDED / IF_NEEDED / IF_POSSIBLE;
5. target scopes remain limited to ACTION / TIMING_RELATION / PARAMETER_VALUE / OCCURRENCE;
6. T3 `should` is not upgraded to hard REQUIRE;
7. T7 `try to` is not upgraded to mandatory timing;
8. IF_POSSIBLE is preserved without inventing a runtime feasibility predicate;
9. insect-control `if needed ... can be used` preserves both PERMITTED and IF_NEEDED;
10. B21 gains source modality coverage but remains operationally incomplete because its goal condition remains unresolved;
11. the Treatment 6 `may need to be specially ordered` lookalike is rejected as non-normative;
12. planning protocol authority remains distinct from actual field execution.

## Acceptance gate

DEC-0007 remains **PROPOSED** until explicit architecture acceptance.

No implementation, contract mutation, runtime change, or existing authority version change is authorized by this draft.

If accepted, implementation must occur on a separate branch and must include real KBS positive and negative semantic-classification acceptance before merge.

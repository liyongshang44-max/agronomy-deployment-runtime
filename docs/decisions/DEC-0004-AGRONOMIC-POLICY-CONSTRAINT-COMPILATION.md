# DEC-0004 — Governed Agronomic Policy Constraint Compilation

Status: **PROPOSED**

Date: 2026-08-27

## Context

DEC-0002 established governed `AgronomicPolicyCompilation`. DEC-0003 accepted declarative agronomic rule v2 with source-bound temporal constraints and coordination-coordinator semantics.

A wider scan of the governed 2015 KBS LTER Agronomic Protocol establishes explicit negative agronomic instructions that cannot be represented losslessly by deleting an action from `Policy.actionSpace`, by hiding the instruction in free-text limitations, or by forcing the source into the positive-action declarative-rule shape.

Representative source forms include:

- Treatment 6: `Do not add any nitrogen to treatment 6.`
- Treatment 7: `No mowing or tillage within any treatment 7 plot at any time, except for the micro-plot area.`
- Treatment 8nt: `DO NOT TILL.`
- Nitrogen Rate Study: if a Roundup application is within seven days of planting, `do not use 2,4-D in the tank mix.`

These are constraints on candidate actions. They do not inherently assert an evaluation cadence, a positive recommended action, or a trigger event. Requiring those fields merely to fit `DeclarativeAgronomicRule` would invent source semantics.

## Proposed decision

Introduce a separate governed authority:

```text
AgronomicPolicyConstraintCompilation
```

with contracts:

```text
adr.agronomic-policy-constraint.v1
adr.agronomic-policy-constraint-compilation.v1
```

The first version supports exactly one effect:

```text
PROHIBIT
```

No REQUIRE, FORCE, LIMIT, or parameter-level effect is inferred until governed source evidence demonstrates the need.

The constraint shape is:

```text
constraintId
decisionType
effect = PROHIBIT
actionCode

when?:
  logic: ALL | ANY
  predicates:
    semanticId
    comparator
    typed value
    authorityBindings

exceptions?:
  - logic: ALL | ANY
    predicates:
      semanticId
      comparator
      typed value
      authorityBindings

authorityBindings
```

When an exact compatible Policy exists, the compilation binds:

```text
exact Protocol Source
+ exact SourceArtifact
+ active QualifiedKnowledge / DerivedKnowledge
+ exact governed Policy
+ exact content hash of the constraint
+ exact Policy-management authorization
+ lossless-coverage declaration
+ direct audit
```

The first real KBS benchmark additionally exposed a predecessor schema limitation: accepted `adr.policy.v2` requires non-empty `requiredRuntimeOutputs`. The KBS prohibitions on Treatment 6, Treatment 7, Treatment 8nt and the 2,4-D tank mix can be source-bounded entirely by ContextManifest/configuration or derived temporal context; the source does not establish a runtime model output merely to make those constraints valid.

ADR must not relabel static context as `requiredRuntimeOutputs` to satisfy the Policy contract. Until a compatible Policy authority exists, real-source KBS operational binding remains `INCOMPLETE` even though the constraint grammar and publication authority can be tested independently.

## Why this is not DeclarativeAgronomicRule v3

A positive declarative agronomic rule currently models a decision path containing trigger semantics, action semantics, fallback, and evaluation cadence.

A source assertion such as:

```text
DO NOT TILL
```

does not itself establish:

```text
how often to evaluate
what positive action to take
what trigger causes evaluation
what fallback to emit
```

Inventing those values would make the database dictate the agronomy rather than preserve it. Therefore a prohibition is modeled as an independently governed Policy constraint.

## Policy/action semantics

The prohibited `actionCode` MUST remain a member of the exact bound `Policy.actionSpace`.

That preserves the distinction:

```text
action is generally representable by this Policy
!=
action is eligible under this governed agronomic constraint
```

Deleting the action from `actionSpace` would erase why, where, and under what source authority the action is unavailable.

## Conditions

If `when` is absent, the prohibition applies whenever the bound Policy and its source-qualified knowledge are applicable.

If `when` is present, all semantic dependencies must be declared by the bound Policy as required input or runtime output.

The predicate grammar reuses the accepted agronomic comparator and typed-literal semantics. This decision does not introduce a general rules DSL.

## Exceptions

An explicit source exception remains first-class.

A matching exception releases only this prohibition. It does NOT by itself recommend, schedule, authorize, or execute the formerly prohibited action.

A source statement with an exception MUST NOT be compiled as an unconditional prohibition.

## Authority closure

Every main prohibition binding and every condition/exception predicate binding must:

1. be listed in enclosing `knowledgeRefs`;
2. resolve exactly;
3. independently remain active for `AGRONOMIC_POLICY_INPUT`;
4. preserve direct Source/Claim/qualification provenance through existing scientific authority validation.

The exact Policy-management authorization that published the bound Policy is reused as the compilation approval authority.

## Fail-closed requirements

1. Every Source must have at least one exact SourceArtifact predecessor.
2. Every sourceProtocolRef must be `sourceType=PROTOCOL`.
3. Every knowledge predecessor must remain active for `AGRONOMIC_POLICY_INPUT`.
4. Every constraint authority binding must be declared in `knowledgeRefs`.
5. Every condition/exception predicate requires non-empty source authority bindings.
6. `constraint.decisionType` must equal the exact Policy decisionType.
7. The prohibited `actionCode` must remain in the exact Policy `actionSpace`.
8. Every condition/exception semanticId must be declared in Policy inputs/runtime outputs.
9. `constraintHash` must exactly match the normalized constraint.
10. `COMPLETE` coverage cannot declare unrepresented elements.
11. The compilation approver must equal the exact principal authorized to manage the bound Policy.
12. Direct audit must cover all exact predecessors.

## KBS acceptance targets

The governed real-source benchmark must cover at least these shapes at the source-faithful Claim / QualifiedKnowledge / normalized Constraint level.

Publication of a real KBS `AgronomicPolicyConstraintCompilation` additionally requires a compatible exact Policy. Under accepted Policy v2, a context-only Policy with `requiredRuntimeOutputs=[]` fails closed. Therefore the current benchmark must report:

```text
constraint candidates = source-faithful / normalized
operational constraint compilation = INCOMPLETE
blocker = POLICY_V2_REQUIRED_RUNTIME_OUTPUTS_NON_EMPTY
```

A synthetic authority fixture may publish a constraint against a genuinely runtime-output-bearing Policy solely to test exact authority closure and negative cases. That synthetic publication is not evidence that the real KBS source has an operationally bindable Policy.

The real source shapes are:

### Treatment 6 — nitrogen prohibition

```text
context.is_treatment_6 == true
=> prohibit APPLY_NITROGEN
```

Source basis: `Do not add any nitrogen to treatment 6.`

### Treatment 8nt — tillage prohibition

```text
context.is_treatment_8nt == true
=> prohibit TILL
```

Source basis: `Tillage: No-till. DO NOT TILL.`

### Treatment 7 — explicit exception

The source prohibits both mowing and tillage except in the micro-plot area. Complete source coverage therefore requires separate action constraints rather than silently dropping one branch:

```text
context.is_treatment_7 == true
=> prohibit TILL
except context.is_microplot == true

context.is_treatment_7 == true
=> prohibit MOW
except context.is_microplot == true
```

### Nitrogen Rate Study — conditional material/action prohibition

```text
derived.days_before_planting < 7
=> prohibit INCLUDE_2_4_D_IN_TANK_MIX
```

The protocol states that 2,4-D must be applied seven days before planting and that, when the Roundup application is within seven days of planting, 2,4-D is not to be used in the tank mix.

The operationalized comparator must preserve the source boundary. It must not silently change from `< 7` to `<= 7`.

## Boundary

```text
AgronomicPolicyConstraintCompilation
  != source applicability to the current field
  != RuntimeEligibility
  != runtime machine safety interlock
  != regulatory/legal prohibition
  != proof an action was blocked
  != proof an action was not executed
  != Field Log
  != Outcome
```

The source protocol itself states that it is a planning document and directs users to the agronomic field log for actual field operations.

## Source-material boundary

The initial KBS benchmark may retain curated exact excerpt bytes as a SourceArtifact for semantic/provenance acceptance. That does not claim retention of the original PDF byte stream or completion of production rights qualification.

## Rejected alternatives

### Add `prohibitions[]` to DeclarativeAgronomicRule

Rejected for pure constraints because it would force source statements such as `DO NOT TILL` into a schema that requires unrelated positive-rule semantics.

### Delete actions from Policy.actionSpace

Rejected because it destroys the negative authority and its context/provenance.

### Encode prohibition as WAIT/fallback

Rejected because WAIT does not identify which action is forbidden, under which source condition, or with what exception.

### Put prohibition in limitations text

Rejected because decision-material negative authority must be structured, source-bound, content-addressed, and machine-inspectable.

### Treat it as a runtime/device interlock

Rejected because agronomic planning authority and machine safety authority are different governance classes.

## Discovered predecessor gap

The real KBS benchmark proves that negative agronomic authority can be decision-material without requiring any runtime model output.

Accepted `adr.policy.v2` currently rejects an otherwise valid context-only Policy because `requiredRuntimeOutputs` cannot be empty.

Using a ContextDatum/configuration semantic as a fake runtime output is rejected by this decision. The correct fix must be handled by a separate versioned Policy architecture decision so accepted Policy v1/v2 replay remains immutable.

This is a predecessor capability gap, not a reason to weaken the ConstraintCompilation authority.

## Acceptance gate

DEC-0004 remains **PROPOSED** until explicitly accepted.

Candidate implementation may exist on a Draft PR, but the new authority must not merge into main until:

1. real KBS source acceptance proves unconditional, conditional, and exception-bearing prohibition shapes without invented runtime semantics;
2. the current Policy-v2 context-only blocker is explicitly recorded and not bypassed;
3. synthetic authority acceptance proves publication fail-closed behavior when a compatible exact Policy exists;
4. existing DEC-0002/DEC-0003 replay and acceptance remain intact;
5. dedicated Agronomic Policy Compilation acceptance succeeds on the exact candidate head;
6. repository-wide ADR Constitution succeeds on the same exact head;
7. DEC-0004 receives explicit architecture acceptance.

A later Policy contract extension may close the real-source operational binding gap. DEC-0004 does not pre-accept that extension.

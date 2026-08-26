# DEC-0003 — Declarative Agronomic Rule v2: Source-Bound Temporal Constraints and Coordination Coordinator

Status: **PROPOSED**

Date: 2026-08-27

## Context

`DEC-0002` introduced the accepted `AgronomicPolicyCompilation` authority and declarative agronomic rule v1. The first real-source benchmark against the 2015 KBS LTER Resource Gradient Experiment irrigation protocol is correctly classified `losslessCoverage=INCOMPLETE` under rule v1.

The page-23 irrigation rule exposed two source-explicit, decision-material elements that v1 cannot represent structurally:

1. daily rainfall and irrigation recording starts on May 1;
2. communication of scheduled irrigation events is coordinated by Joe Simmons.

An initial v2 candidate represented the first element with a dedicated `evaluationStart` field. A wider scan of the same 23-page protocol showed that this was too narrow and risked overfitting rule v2 to one irrigation example. The same governed protocol repeatedly uses materially different temporal expressions, including:

- `Starting on May 1`;
- `after May 5th`;
- `7 days before planting`;
- `after harvest` / `before planting`;
- bounded temporal relations between operations.

The wider scan also exposed explicit prohibition / NO-GO semantics such as `Do not add any nitrogen` and `DO NOT TILL`. Those are a separate unresolved primitive and are intentionally not added by this decision.

Temporal boundaries, named coordinators, prohibitions and execution facts must not be laundered into free-text limitations, unrelated Policy fields, `Outcome`, `ExecutionReceipt`, or runtime state merely to make a benchmark appear complete.

## Proposed decision

Keep the accepted outer `adr.agronomic-policy-compilation.v1` authority contract unchanged and add a new nested declarative rule contract:

```text
adr.declarative-agronomic-rule.v2
```

Rule v1 remains immutable and replayable. Rule v2 is additive and inherits all accepted v1 semantics while adding exactly two optional source-governed structures:

1. `temporalConstraints`;
2. `coordination.coordinator`.

### 1. `temporalConstraints`

```text
temporalConstraints:
  - target: RULE_EVALUATION | RULE_ACTION
    relation:
      ON_OR_AFTER_DATE
      AFTER_DATE
      ON_OR_BEFORE_DATE
      BEFORE_DATE
      BEFORE_EVENT
      AFTER_EVENT
      MIN_OFFSET_BEFORE_EVENT
      MIN_OFFSET_AFTER_EVENT
      WITHIN_PERIOD_OF_EVENT
    date: YYYY-MM-DD                    # calendar relations only
    eventSemanticId: <semantic id>      # event relations only
    duration: <ISO-8601 duration>       # offset/within relations only
    authorityBindings:
      - QualifiedKnowledge | DerivedKnowledge
```

Semantics:

- `target` identifies whether the governed temporal constraint applies to rule evaluation or to the rule action;
- calendar relations preserve boundary inclusivity/exclusivity rather than collapsing `after May 5` into an on-or-after interpretation;
- event relations govern the rule target relative to another semantically identified operation/event;
- offset relations require a non-zero ISO-8601 duration;
- every temporal constraint requires at least one exact source-qualified knowledge authority binding;
- the structure represents protocol semantics only. It does not create runtime `logicalTime`, an observation timestamp, deployment activation, proof that the referenced event occurred, or proof that an action was executed.

Examples justified by the governed KBS evidence set:

```text
Starting on May 1
=> target=RULE_EVALUATION
   relation=ON_OR_AFTER_DATE
   date=2015-05-01

after May 5th
=> target=RULE_ACTION
   relation=AFTER_DATE
   date=2015-05-05

7 days before planting
=> target=RULE_ACTION
   relation=MIN_OFFSET_BEFORE_EVENT
   eventSemanticId=operation.planting
   duration=P7D
```

The vocabulary is intentionally finite. It is not a general workflow DSL, calendar engine, phenology language, thermal-time language, recurrence scheduler, or natural-language temporal parser. Vague phrases such as `late April or early May`, `if needed`, and `as needed` must remain source-faithful and require separate adjudication rather than invented precision.

`WITHIN_PERIOD_OF_EVENT` expresses a duration-bounded relation only. It must not silently convert a phrase such as `within the same calendar week` into `within seven days` unless the governed source or an explicit adjudication establishes that equivalence.

### 2. `coordination.coordinator`

```text
coordination:
  mode: NOTIFY | APPROVAL_REQUIRED
  channel: ...
  participants: [...]
  coordinator:
    sourceLabel: <source-faithful human/role label>
    authorityBindings:
      - QualifiedKnowledge | DerivedKnowledge
```

Semantics:

- `sourceLabel` preserves the coordinator identity or role as represented by the governed source;
- it does not resolve that label to an ADR IAM `Principal`;
- coordinator is distinct from notification recipients and distinct from an approver;
- coordinator does not create a human gate;
- a coordinator is illegal under `coordination.mode=NONE`;
- a source authority binding is mandatory whenever a coordinator is present.

## Compatibility

The outer `AgronomicPolicyCompilation` authority kind and `adr.agronomic-policy-compilation.v1` payload remain unchanged.

Historical rule v1 records continue to normalize and hash under the exact accepted v1 implementation preserved in `extended-contract-v1.mjs`. Rule v1 continues to reject v2-only fields.

Rule v2 normalization may reuse the accepted v1 semantic core, but the normalized v2 rule retains its own `contractVersion`, `temporalConstraints`, coordinator content and exact semantic hash. `Policy.decisionLogic.definitionHash` therefore binds the exact v2 rule body rather than a downgraded v1 representation.

## Fail-closed requirements

1. v1 must reject `temporalConstraints` and `coordination.coordinator` as unknown fields.
2. v2 must reject unsupported temporal targets and relations.
3. calendar relations must carry a valid `YYYY-MM-DD` date and must not carry event or duration fields.
4. `BEFORE_EVENT` and `AFTER_EVENT` require `eventSemanticId` and must not carry a duration.
5. offset / within relations require `eventSemanticId` plus a non-zero ISO-8601 duration.
6. every temporal constraint must carry at least one exact knowledge authority binding.
7. v2 `coordination.coordinator` must have a non-empty source label and at least one exact knowledge authority binding.
8. coordinator is forbidden when coordination mode is `NONE`.
9. all v2-specific authority bindings must be present in the enclosing `knowledgeRefs` and independently pass active `AGRONOMIC_POLICY_INPUT` scientific authority validation.
10. v2 does not alter the existing trigger, persistence, exception, action, amount, fallback or human-gate semantics.
11. `losslessCoverage=COMPLETE` remains invalid if the represented protocol rule still has a declared unrepresented element.
12. neither temporal constraints nor coordinator metadata may be interpreted as evidence of actual field execution.

## KBS acceptance target

The same governed KBS page-23 irrigation source chain must represent:

```text
May 1 evaluation/data boundary
+ daily cadence
+ PAW < 0 for two consecutive days
+ restorative rainfall override
+ next-day irrigation
+ prior-day deficit amount basis
+ e-mail recipients
+ Joe Simmons as communication coordinator
```

without using free-text limitations for the two previously missing page-23 elements.

For that page-23 rule, rule v1 remains the immutable `INCOMPLETE` regression benchmark and rule v2 must reach `COMPLETE` only if there are no remaining declared unrepresented elements.

Separately, protocol-neutral contract tests must prove that the temporal vocabulary can distinguish inclusive versus exclusive calendar boundaries and can validate an event-relative minimum offset such as seven days before another operation. Those contract tests are grammar tests, not substitutes for source qualification.

The protocol's separate source limitation remains unchanged: it does not publish the full water-budget spreadsheet recurrence or initial state. Rule v2 must not invent those missing model details merely to claim completeness.

## Authority boundary

This proposal does not change:

```text
Protocol planning
  != current field applicability
  != RuntimeBinding
  != DecisionResult
  != execution
  != Outcome
```

It also does not turn a named source coordinator into an ADR approver or authenticated identity, and it does not treat a temporal relation as proof that its referenced event exists in runtime data.

## Explicitly unresolved after DEC-0003

The wider KBS protocol establishes at least one additional recurring primitive that remains unrepresented:

```text
explicit prohibition / NO-GO authority
```

Examples include source statements equivalent to:

- do not add a specified input in an exact treatment context;
- do not till in an exact area/context;
- do not use a material combination when a temporal condition holds.

This decision does not represent those semantics by deleting actions from `actionSpace`, because doing so would lose the source assertion, scope, exception structure and provenance. A separate architecture decision is required before ADR may claim general agronomic-protocol coverage.

## Rejected alternatives

### Mutate rule v1 in place

Rejected because accepted authority contracts must remain replayable and immutable.

### Keep `evaluationStart` as the general temporal solution

Rejected after the wider same-protocol scan showed multiple action-level and event-relative temporal relationships. A field dedicated to one page-23 start date would overfit the first benchmark.

### Collapse `after DATE` into `on or after DATE`

Rejected because it changes the source boundary. Rule v2 must preserve inclusive versus exclusive calendar semantics when the source distinguishes them.

### Put temporal boundaries into free-text limitations

Rejected because decision-material temporal boundaries should be inspectable, source-bound and content-addressed when the governed source explicitly states them.

### Treat the named coordinator as a notification recipient or IAM approver

Rejected because coordinator, recipient and approval authority are different semantics.

### Introduce a general agronomic scheduling/workflow DSL

Rejected because the evidence supports a small finite temporal relation vocabulary, not unrestricted workflow execution semantics.

### Add NO-GO/prohibition semantics to this same decision

Rejected to keep the amendment narrow and independently testable. The source proves that prohibition is needed, but it is a separate semantic primitive with its own scope, exception and runtime-safety implications.

## Acceptance gate

This DEC remains **PROPOSED** until explicitly accepted. Candidate implementation and tests may exist on a Draft PR, but rule v2 must not become normative repository authority or be merged into `main` until:

1. this decision is explicitly accepted;
2. the exact accepted head passes dedicated Agronomic Policy Compilation acceptance;
3. the same exact head passes repository-wide ADR Constitution acceptance.

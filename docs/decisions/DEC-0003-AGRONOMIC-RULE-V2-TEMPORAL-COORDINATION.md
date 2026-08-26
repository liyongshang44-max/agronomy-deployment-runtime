# DEC-0003 — Declarative Agronomic Rule v2: Evaluation Start and Coordination Coordinator

Status: **PROPOSED**

Date: 2026-08-27

## Context

`DEC-0002` introduced the accepted `AgronomicPolicyCompilation` authority and declarative agronomic rule v1. The first real-source benchmark against the 2015 KBS LTER Resource Gradient Experiment irrigation protocol passes the existing ADR Constitution but is correctly classified `losslessCoverage=INCOMPLETE`.

Two source-explicit, decision-material protocol elements cannot be represented structurally by v1:

1. the protocol states that daily rainfall and irrigation recording starts on May 1;
2. the protocol states that communication of scheduled irrigation events is coordinated by Joe Simmons.

Rule v1 has `evaluationCadence`, but no source-bound calendar start for that evaluation/data schedule. Its coordination object has `mode`, `channel`, `participants` and authority bindings, but no distinct coordinator role.

These are not execution facts and must not be pushed into `Outcome`, `ExecutionReceipt`, runtime state, free-text limitations, or unrelated Policy fields merely to make a benchmark appear complete.

## Proposed decision

Keep the accepted outer `adr.agronomic-policy-compilation.v1` authority contract unchanged and add a new nested declarative rule contract:

```text
adr.declarative-agronomic-rule.v2
```

Rule v1 remains immutable and replayable. Rule v2 is additive and inherits all v1 semantics while adding exactly two optional source-governed structures.

### 1. `evaluationStart`

```text
evaluationStart:
  date: YYYY-MM-DD
  authorityBindings: [QualifiedKnowledge | DerivedKnowledge ...]
```

Semantics:

- the date is a source-governed calendar boundary for when the rule's declared evaluation/data cadence begins in the represented protocol;
- it does not create a runtime `logicalTime`, observation timestamp, deployment activation, or proof that evaluation actually occurred;
- a source authority binding is mandatory whenever `evaluationStart` is present.

The v2 field is intentionally narrow. It does not attempt to standardize all possible agronomic temporal expressions such as annual recurring dates, relative-to-planting windows, phenology-triggered windows, thermal-time windows, or jurisdiction-local calendar rules. Those require separate evidence before extension.

### 2. `coordination.coordinator`

```text
coordination:
  mode: NOTIFY | APPROVAL_REQUIRED
  channel: ...
  participants: [...]
  coordinator:
    sourceLabel: <source-faithful human/role label>
    authorityBindings: [QualifiedKnowledge | DerivedKnowledge ...]
```

Semantics:

- `sourceLabel` preserves the coordinator identity/role exactly as represented by the governed source;
- it does not resolve that label to an ADR IAM `Principal`;
- coordinator is distinct from notification recipients and distinct from an approver;
- coordinator does not create a human gate;
- a coordinator is illegal under `coordination.mode=NONE`;
- a source authority binding is mandatory whenever a coordinator is present.

## Compatibility

The outer `AgronomicPolicyCompilation` authority kind and `adr.agronomic-policy-compilation.v1` payload remain unchanged.

Historical rule v1 records continue to normalize and hash under the exact accepted v1 implementation. v2 normalization may internally reuse the v1 semantic core, but the v2 rule retains its own `contractVersion` and full content hash, so `Policy.decisionLogic.definitionHash` binds the exact v2 body rather than a downgraded representation.

## Fail-closed requirements

1. v1 must continue to reject `evaluationStart` and `coordination.coordinator` as unknown fields.
2. v2 `evaluationStart.date` must be a valid calendar date in `YYYY-MM-DD` form.
3. v2 `evaluationStart` must have at least one exact knowledge authority binding.
4. v2 `coordination.coordinator` must have a non-empty source label and at least one exact knowledge authority binding.
5. coordinator is forbidden when coordination mode is `NONE`.
6. all v2-specific authority bindings must be present in the enclosing `knowledgeRefs` and must independently pass the existing active `AGRONOMIC_POLICY_INPUT` scientific authority validation.
7. v2 does not alter the existing rule trigger, temporal persistence, exception, action, amount, fallback or human-gate semantics.
8. `losslessCoverage=COMPLETE` remains illegal when any declared protocol element is unrepresented.
9. Neither field may be interpreted as evidence of actual field execution.

## KBS acceptance target

After implementation, the same KBS 2015 irrigation protocol must be capable of representing:

```text
May 1 evaluation/data start
+ daily cadence
+ PAW < 0 for two consecutive days
+ restorative rainfall override
+ next-day irrigation
+ prior-day deficit amount basis
+ e-mail recipients
+ Joe Simmons as communication coordinator
```

without using free-text limitations for the two previously missing elements.

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

It also does not turn a named source coordinator into an ADR approver or authenticated identity.

## Rejected alternatives

### Mutate rule v1 in place

Rejected because accepted authority contracts must remain replayable and immutable.

### Put May 1 into a free-text limitation

Rejected because a decision-material temporal boundary should be inspectable and content-addressed when the source explicitly states it.

### Treat Joe Simmons as a notification recipient or IAM approver

Rejected because coordinator, recipient and approval authority are different semantics.

### Introduce a general agronomic calendar DSL now

Rejected because one real protocol proves the need for a source-bound start date, not an unrestricted temporal language.

## Acceptance gate

This DEC remains **PROPOSED** until explicitly accepted. Candidate implementation and tests may exist on a Draft PR, but rule v2 must not become normative repository authority or be merged into `main` until this decision is accepted and exact-head constitutional acceptance succeeds.

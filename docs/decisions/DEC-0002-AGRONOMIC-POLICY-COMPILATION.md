# DEC-0002 — Governed Agronomic Policy Compilation

Status: **PROPOSED**

Date: 2026-08-26

## Context

ADR v1.0 correctly separates `Source`, `Claim`, `QualifiedKnowledge`, `DerivedKnowledge`, `Model`, `Policy`, runtime composition, execution and `Outcome` authority. Real agronomic protocols expose an additional provenance question that the current frozen Policy contract does not make directly inspectable:

> How were exact qualified agronomic knowledge authorities operationalized into the thresholds, temporal persistence, exceptions, action timing and action-parameter expressions of a deployable Policy?

The existing Policy contract records a `decisionLogic` method identity/hash and `thresholdAuthority`, but a method hash alone cannot make the operational rule inspectable without resolving implementation-specific material. A real protocol may require, for example, a threshold that persists for a number of consecutive periods, an override when a restorative event occurs, a delayed action, and an action amount derived from a prior state deficit.

This is not a reason to collapse protocol documents, scientific knowledge, models and policies into one object.

## Decision proposal

Introduce an additive `AgronomicPolicyCompilation` authority in the Knowledge Control Plane.

It does **not** replace `Policy`. `Policy` remains the decision-logic specification authority. The compilation object records the governed operationalization provenance that binds:

- exact `Source` references whose `sourceType` is `PROTOCOL`;
- exact `QualifiedKnowledge` / `DerivedKnowledge` predecessors;
- exact governed `Model` specifications referenced as computational dependencies;
- one exact governed `Policy` specification;
- one content-addressed declarative agronomic rule;
- transformation rationale;
- explicit lossless-coverage status;
- the exact Policy management authorization and approver.

The declarative rule v1 covers:

- semantic input identifiers;
- trigger predicates;
- comparators and typed literals;
- temporal modes including consecutive-period, trailing-window and forecast-window semantics;
- exceptions/overrides;
- action code;
- immediate or offset action timing;
- action parameter expressions;
- knowledge authority binding/rationale for rule elements;
- fallback;
- human gate;
- limitations.

## Authority boundary

Permanent separations remain:

```text
Source/Protocol Document
  != Claim / QualifiedKnowledge / DerivedKnowledge
  != Model
  != Policy
  != AgronomicPolicyCompilation
  != RuntimeBinding / DecisionResult
  != execution / Outcome
```

`AgronomicPolicyCompilation` may establish only that a particular operationalization was explicitly governed and bound to exact predecessor authorities. It must not:

- create scientific truth;
- upgrade a Claim to QualifiedKnowledge;
- determine Source-to-Target applicability;
- calculate current target state;
- select a current field action;
- assert that execution occurred;
- assert that an Outcome was caused by the Policy.

## Fail-closed requirements

1. Every rule-level knowledge authority binding must be present in the compilation `knowledgeRefs`.
2. Every Policy threshold authority must be present in the compilation `knowledgeRefs`.
3. Every rule semantic dependency must be declared by the bound Policy as a required input or required runtime output.
4. The rule action must be a legal member of the Policy action space.
5. For Policy versions with structured action semantics, supplied parameters must be declared and all required parameters must be present.
6. `sourceProtocolRefs` must resolve to exact `Source` authority with `sourceType=PROTOCOL`.
7. Model references must resolve through normal Specification authority validation.
8. The compilation approval must reuse the exact `SPECIFICATION_MANAGE` authorization that published the bound Policy in v1; a future architecture revision may introduce a narrower agronomic-compilation permission.
9. `losslessCoverage=COMPLETE` is illegal when any protocol element is declared unrepresented.
10. An incomplete representation must remain explicitly `INCOMPLETE`; it cannot silently become executable authority.

## Compatibility with v1.0 freeze

This DEC is **PROPOSED** and therefore does not amend the frozen v1.0 architecture by itself. The implementation in the same draft change set is an experimental candidate used to test the schema gap. It must not be merged into protected `main` as normative product authority until this decision is explicitly accepted or the implementation is reworked to fit an already-frozen authority object.

## Rejected alternatives

### Put everything into a single AgronomicProtocol table

Rejected because it collapses protocol provenance, scientific knowledge, computation, decision logic, execution and outcome authority.

### Keep only `methodId + definitionHash`

Rejected for protocol-grade audit because it does not make threshold, temporal, exception and action semantics directly inspectable at the specification/provenance layer.

### Rewrite source Claims into operational rules

Rejected because a Claim must remain source-faithful. Operationalization is a new governed judgment and must retain lineage rather than mutate source authority.

### Treat actual field logs as the protocol

Rejected because planned policy and actual execution are different authorities.

## Consequences

Positive:

- real agronomic protocols can be represented without dropping decision-material temporal/exception/action semantics;
- provenance from knowledge authority to deployable Policy becomes inspectable;
- ADR can distinguish scientific qualification from operationalization;
- protocol-to-Policy loss can be benchmarked explicitly.

Costs:

- one new proposed authority type;
- additional governance/audit validation;
- architecture acceptance is required before merge because v1.0 is frozen.

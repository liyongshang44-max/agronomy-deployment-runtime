# DEC-0002 — Governed Agronomic Policy Compilation

Status: **PROPOSED**

Date: 2026-08-26

## Context

ADR v1.0 correctly separates `Source`, `SourceArtifact`, `Claim`, `QualifiedKnowledge`, `DerivedKnowledge`, `Model`, `Policy`, runtime composition, execution and `Outcome` authority. Real agronomic protocols expose one additional provenance question that the frozen Policy contract does not make directly inspectable:

> How were exact source materials and qualified agronomic knowledge operationalized into the state calculation, thresholds, temporal persistence, exceptions, timing, amount and coordination semantics of a deployable Policy?

The existing Policy contract records `decisionLogic.methodId + definitionHash` and `thresholdAuthority`, but the referenced definition is not itself a first-class inspectable protocol-to-policy provenance object. A real protocol can require daily evaluation, a two-consecutive-period trigger, a restorative-event override, a next-day action, an amount derived from a prior state deficit, and communication to designated staff.

This gap is not a reason to collapse protocol documents, scientific knowledge, models, policies, execution and outcomes into one object.

## Decision proposal

Introduce an additive `AgronomicPolicyCompilation` authority in the Knowledge Control Plane.

It does **not** replace `Policy` or `Model`. The compilation records the governed operationalization provenance that binds:

- exact logical `Source` refs with `sourceType=PROTOCOL`;
- exact `SourceArtifact` refs for the protocol material actually interpreted;
- exact `QualifiedKnowledge` / `DerivedKnowledge` predecessors;
- exact governed `Model` specifications plus content-addressed inspectable model definitions;
- one exact governed `Policy` specification;
- one content-addressed declarative agronomic rule;
- transformation rationale;
- explicit lossless-coverage status;
- the exact Policy management authorization and approver.

The scientific-use semantics of this proposed v1 authority are intentionally fixed rather than caller-selectable:

```text
required knowledge use = AGRONOMIC_POLICY_INPUT
```

A `knowledgeRef` is therefore not accepted merely because its authority kind is named `QualifiedKnowledge` or `DerivedKnowledge`. Every predecessor must replay through the existing ADR scientific authority validator and must be current, non-superseded/non-revoked authority for `AGRONOMIC_POLICY_INPUT`. This prevents an unrelated scientific qualification, a historical authority, or a forged kind-tagged ledger record from being laundered into Policy authority.

The declarative rule v1 experimental vocabulary covers:

- semantic input identifiers;
- evaluation cadence;
- trigger predicates;
- comparators and typed literals;
- temporal modes including consecutive-period, trailing-window and forecast-window semantics;
- exceptions/overrides;
- action code;
- immediate or offset action timing;
- action-parameter expressions;
- coordination semantics (`NONE`, `NOTIFY`, `APPROVAL_REQUIRED`);
- exact knowledge-authority binding/rationale for rule elements;
- fallback;
- human gate;
- limitations.

Model definitions are separately content-addressed and must close exactly over the bound `Model.computation.methodId/definitionHash`. The declarative rule must close exactly over the bound `Policy.decisionLogic.methodId/definitionHash`.

## Authority boundary

Permanent separations remain:

```text
Source
  != SourceArtifact
  != Claim / QualifiedKnowledge / DerivedKnowledge
  != Model
  != Policy
  != AgronomicPolicyCompilation
  != RuntimeBinding / DecisionResult
  != execution / Outcome
```

`AgronomicPolicyCompilation` may establish only that one operationalization was explicitly governed and bound to exact predecessor authorities. It must not:

- create scientific truth;
- upgrade a Claim to QualifiedKnowledge;
- re-label knowledge qualified for some other scientific use as Policy input authority;
- determine Source-to-Target applicability;
- calculate current target state;
- select a current field action;
- assert that execution occurred;
- assert that an Outcome was caused by the Policy.

Notification is not approval. `NOTIFY` must not silently create a human gate. `APPROVAL_REQUIRED` must bind a required human gate.

## Fail-closed requirements

1. Every protocol `Source` must have at least one exact bound `SourceArtifact`; every bound artifact must point back to one exact listed protocol Source.
2. Every rule-level and model-definition knowledge authority binding must be present in `knowledgeRefs`.
3. Every Policy threshold authority must be present in `knowledgeRefs`.
4. Every rule semantic dependency must be declared by the bound Policy as a required input or required runtime output.
5. The rule action must be a legal member of the Policy action space.
6. For Policy versions with structured action semantics, supplied parameters must be declared and all required parameters must be present.
7. `Policy.decisionLogic.methodId` must equal the declarative rule ID and `Policy.decisionLogic.definitionHash` must equal its content hash.
8. Each model definition must have exactly one bound Model; method ID, definition hash and declared semantic ports must agree with the governed Model specification.
9. `sourceProtocolRefs` must resolve to exact `Source` authority with `sourceType=PROTOCOL`.
10. Model and Policy refs must pass the existing Specification authority validation chain.
11. The v1 compilation approval reuses the exact `SPECIFICATION_MANAGE` authorization that published the bound Policy; a future accepted architecture may introduce a narrower compilation permission.
12. `losslessCoverage=COMPLETE` is illegal when any protocol element is declared unrepresented.
13. Incomplete representation remains explicitly `INCOMPLETE`; it cannot silently masquerade as complete deployable provenance.
14. Every `QualifiedKnowledge` predecessor must pass `validateQualifiedKnowledgeAuthority` for the active scientific-use target `AGRONOMIC_POLICY_INPUT`; kind-tag spoofing, superseded authority, revoked authority and unrelated-use qualification are rejected.
15. Every `DerivedKnowledge` predecessor must pass `validateDerivedKnowledgeAuthority` for the same active scientific-use target and therefore retain its governed derivation, input-qualified-knowledge and origin-context authority chain.

## Compatibility with v1.0 freeze

This DEC is **PROPOSED**. It does not amend the frozen v1.0 architecture by itself. The implementation in the same Draft PR is an experimental schema-gap candidate. It must not be merged into protected `main` as normative product authority until this decision is explicitly accepted, or the implementation is reworked to fit an already-frozen authority object.

## Rejected alternatives

### One `AgronomicProtocol` mega-table

Rejected because it collapses provenance, science, computation, decision logic, execution and outcome authority.

### Keep only opaque `methodId + definitionHash`

Rejected for protocol-grade audit because threshold, temporal, exception, amount and coordination semantics cannot be inspected without an external definition body.

### Trust `kind=QualifiedKnowledge`

Rejected because a ledger record can carry the right kind label without satisfying source-faithful review, scientific qualification, active-use, lineage and authorization invariants. Operationalization must invoke the existing scientific authority validators rather than reimplementing or bypassing them.

### Let the caller choose any knowledge use

Rejected for the proposed v1 contract. `AgronomicPolicyCompilation` has one fixed purpose, so its predecessor knowledge must be qualified for `AGRONOMIC_POLICY_INPUT`; allowing arbitrary caller-selected use labels would make it easier to launder unrelated scientific authority into a Policy.

### Rewrite source Claims into operational rules

Rejected because Claims must remain source-faithful. Operationalization is a new governed judgment with lineage.

### Treat actual field logs as the protocol

Rejected because planned decision logic and actual execution are different authorities.

## Consequences

Positive:

- real agronomic protocols can be represented without silently dropping decision-material semantics;
- exact source material, active scientific authority, model calculation and policy rule remain separately auditable;
- scientific qualification is distinguishable from operationalization;
- a valid scientific authority for another use cannot silently become agronomic Policy authority;
- protocol-to-Policy loss becomes measurable through explicit `losslessCoverage`.

Costs:

- one proposed authority type and declarative vocabulary;
- additional governance/audit validation;
- every compilation publication and replay now traverses the full scientific authority chain for its knowledge predecessors;
- architecture acceptance is required before merge because v1.0 is frozen.

# DEC-0012 — Governed Agronomic Source-Authority Routing

Status: **ACCEPTED**

Date: 2026-08-28

## Context

ADR now has accepted source-semantic authorities for:

- hard obligations;
- normative modality;
- agronomic goal conditions;
- repeated-action regimens;
- source-defined action realizations;
- conditional compound action realizations.

The current KBS 2015 B21 source frontier has therefore reached a different kind of source statement.

Immediately after Treatment B21, the protocol states:

`This is a working protocol used for planning purposes. Due to potential changes in chemicals, fertilizer, varieties planted, planting dates etc… please refer to the agronomic field log for actual field operations that take place during 2015.`

The KBS protocol catalog independently states that the agronomic protocol is planned management and that actual field operations may differ and are recorded in the ag log.

The KBS Agronomic Field Log catalog describes the log as a narrative log of agronomic activities or observations made on MCSE treatments.

These statements establish an explicit source-authority boundary:

- the protocol remains a planning source;
- the field log is the source to consult for actual field operations.

ADR currently preserves Source and SourceArtifact identity, scientific claims and downstream Outcome evidence, but does not have a source-semantic authority that represents this scoped routing rule.

## Why this is the next source-driven frontier

DEC-0011 explicitly preserved the distinction:

`source protocol is planning authority, not actual operation evidence`.

Until now that distinction was enforced mainly as a negative boundary.

The KBS source now gives positive source evidence for how authority should be routed:

`planned management -> protocol`

`actual field operations -> agronomic field log`.

This relation is decision-material because ADR must not answer the question:

`what actually happened in the field?`

by replaying protocol intent as though it were execution history.

## Existing SourceRegistry is insufficient

The current SourceRegistry can:

- register Source authorities;
- materialize exact SourceArtifact bytes;
- link one Source as globally `supersedes` another Source.

It does not represent semantic-scope-specific source authority.

Using:

`field log supersedes protocol`

would be incorrect.

The field log does not globally invalidate or replace the protocol.

The protocol remains the relevant planning source.

The field log is authoritative only for a different semantic question:

`actual field operation occurrence`.

Therefore DEC-0012 must not reuse whole-source `supersedes` for this case.

## Existing Outcome authority is insufficient

Outcome can retain post-decision evidence and can bind content-addressed external execution evidence.

That is useful downstream.

However Outcome does not establish the source-governance relation:

`for actual field operation occurrence, consult this field-log source rather than planned protocol intent`.

Outcome also does not convert a protocol into planning-only authority.

DEC-0012 therefore belongs upstream of event-level execution/outcome ingestion.

## Decision under proposal

Introduce a separate source-semantic authority:

`AgronomicSourceAuthorityRoutingCompilation`

Candidate contracts:

`adr.agronomic-source-authority-routing.v1`

`adr.agronomic-source-authority-routing-compilation.v1`

This authority represents a governed, scoped relation between:

1. a source used as planning guidance; and
2. a source used as the record source for actual field-operation occurrence.

## v1 source-proven pattern

DEC-0012 v1 is intentionally restricted to the source pattern proven by the KBS 2015 protocol and field-log catalog:

```text
planning source:
  PROTOCOL

planning semantic role:
  PLANNED_MANAGEMENT_GUIDANCE

actual-operation record source:
  AGRONOMIC_FIELD_LOG

actual semantic role:
  ACTUAL_FIELD_OPERATION_RECORD

subject scope:
  FIELD_OPERATION_OCCURRENCE

routing relation:
  ACTUAL_OCCURRENCE_DEFER_TO_RECORD_SOURCE

temporal scope:
  CALENDAR_YEAR 2015
```

The exact implementation identifiers may be refined after architecture acceptance, but the semantic boundaries are fixed by this decision.

## Candidate semantic shape

An illustrative shape is:

```text
AgronomicSourceAuthorityRouting {
  contractVersion
  routingId

  sourceExpression:
    "This is a working protocol used for planning purposes...
     please refer to the agronomic field log for actual field operations
     that take place during 2015."

  planningSourceRef
  actualOperationRecordSourceRef

  subjectScope:
    FIELD_OPERATION_OCCURRENCE

  planningRole:
    PLANNED_MANAGEMENT_GUIDANCE

  actualOperationRole:
    ACTUAL_FIELD_OPERATION_RECORD

  routingRelation:
    ACTUAL_OCCURRENCE_DEFER_TO_RECORD_SOURCE

  temporalScope {
    kind:
      CALENDAR_YEAR
    year:
      2015
  }

  authorityBindings[]
  transformationRationale
}
```

## Meaning of the planning role

`PLANNED_MANAGEMENT_GUIDANCE` means:

the exact source is authoritative for what was planned, intended, recommended or described as management guidance within its governed source context.

It does not mean:

- the planned action actually occurred;
- the planned date was the actual date;
- the planned material was actually applied;
- the planned rate was actually used;
- the plan was approved;
- the plan was executed;
- the plan became Field Log truth.

## Meaning of the actual-operation record role

`ACTUAL_FIELD_OPERATION_RECORD` means:

the source is the designated record source to inspect when determining whether and how actual field operations were recorded for the governed subject and period.

It does not mean:

- every row is automatically true without normal source-faithful review;
- every operation is complete;
- absence of a row proves non-execution;
- a field-log record is automatically an ADR ExecutionReceipt;
- a field-log record is automatically Outcome;
- the record source is globally more authoritative than the protocol for all scientific or planning questions.

## Scoped routing, not total source precedence

DEC-0012 does not introduce a global source ranking.

There is no relation:

`FIELD_LOG > PROTOCOL`

in the abstract.

Instead the relation is scoped by semantic question.

For example:

```text
question:
  what was planned?
route:
  protocol

question:
  what actual field operation was recorded?
route:
  field log
```

Both sources may remain valid simultaneously.

## No whole-source supersession

The current SourceRegistry `supersedes` relation is a whole-source lineage relation.

DEC-0012 must not implement the KBS relation as:

`field log supersedes protocol`.

That would incorrectly imply that the protocol is obsolete for planning semantics.

The new routing authority is therefore additive.

## No contradiction laundering

If the protocol says:

`apply X`

and the field log later records:

`applied Y`

DEC-0012 does not rewrite the protocol.

Instead ADR may retain both:

- planned fact: X;
- actual-operation record fact: Y.

The two claims answer different semantic questions.

A downstream process may compare them, but DEC-0012 does not collapse them into one mutable fact.

## No execution event synthesis

DEC-0012 routes authority to a field-log source.

It does not create any operation event.

It must not synthesize:

- operationId;
- actionCode;
- start time;
- end time;
- product;
- rate;
- equipment;
- operator;
- execution status;
- ExecutionReceipt.

Those require event-level extraction and qualification from exact record evidence.

## No absence-equals-nonexecution inference

A missing field-log row or inaccessible record does not prove:

`operation did not occur`.

Without sufficient record evidence the correct state remains unknown or unresolved.

DEC-0012 must not create negative execution facts from missing data.

## No protocol-as-execution laundering

A planned protocol statement must never be accepted as actual-operation evidence solely because:

- the calendar date has passed;
- the planned operation is specific;
- no conflicting field-log row was found;
- the plan appears operationally plausible.

Actual operation occurrence requires actual-operation record evidence.

## No automatic Outcome creation

A field-log source may later contribute external execution evidence or Outcome association.

DEC-0012 itself does not create Outcome.

It also does not claim causal effect.

## No automatic DecisionResult or RuntimeBinding

Source authority routing is not runtime authority.

DEC-0012 must not create:

- DecisionResult;
- RuntimeBinding;
- RuntimeEligibility;
- RuntimeAlternativeSet;
- RuntimePlan.

## No Policy mutation

DEC-0012 does not add any action to deployed Policy actionSpace or actionSemantics.

It only governs source roles and routing.

## No source-type mutation required

Current SourceRegistry source types do not include a dedicated `FIELD_LOG` source type.

DEC-0012 does not require mutating the existing SourceRegistry enum in place.

Source operational role is a separate semantic dimension from generic source type.

An implementation may register the public field-log catalog or retained field-log artifact under an existing compatible Source type and then bind the exact Source through DEC-0012 semantic review.

A future SourceRegistry version may introduce more specific source types separately.

## Scientific/source authority lineage

Publication must require exact reviewed evidence for both sides of the routing relation.

### Planning-side evidence

Exact source evidence must establish that the protocol is used for planning.

For the KBS 2015 case, the exact protocol statement includes:

`This is a working protocol used for planning purposes.`

### Routing evidence

The same exact protocol statement must establish:

`please refer to the agronomic field log for actual field operations that take place during 2015.`

### Record-source evidence

A separately governed field-log source must establish that it is an agronomic activity/operation record source.

For KBS, the public Agronomic Field Log catalog describes the table as a narrative log of agronomic activities or observations made on MCSE treatments.

The source catalog relation may be used as exact metadata evidence without ingesting restricted field-log rows.

## Two-source closure

Unlike DEC-0009 through DEC-0011, DEC-0012 necessarily relates two different source authorities.

The routing compilation therefore must close over:

- exact planning Source;
- exact planning SourceArtifact;
- exact planning QualifiedKnowledge/DerivedKnowledge;
- exact actual-operation-record Source;
- exact actual-operation-record SourceArtifact or retained catalog metadata artifact;
- exact actual-operation-record QualifiedKnowledge/DerivedKnowledge;
- exact governed semantic review that binds the two roles.

The two source identities must not be silently collapsed.

## No requirement to ingest restricted field-log data rows

KBS public catalog metadata is sufficient to prove that the referenced source is an agronomic field-log record source.

DEC-0012 does not require copying or republishing restricted field-log rows.

Event-level ingestion remains a later task subject to data rights and exact retained evidence.

## Temporal scope

The exact 2015 protocol disclaimer states:

`actual field operations that take place during 2015`.

Therefore the KBS Gold routing authority must preserve temporal scope:

`CALENDAR_YEAR = 2015`.

It must not silently generalize the PDF statement to all years.

The KBS protocol catalog may provide broader current documentation, but the Gold assertion derived from the exact 2015 PDF remains year-scoped.

## Subject scope

DEC-0012 v1 subject scope is:

`FIELD_OPERATION_OCCURRENCE`.

This scope is deliberately narrow.

It does not automatically govern:

- crop yield truth;
- soil analysis truth;
- scientific causal claims;
- treatment-definition authority;
- regulatory legality;
- product-label authority;
- recommendation quality;
- field-state estimates.

Separate evidence authorities may govern those questions.

## Planning-source preservation

Even when actual operation differs from plan, the planning Source remains useful evidence for:

- intended operation;
- planned management design;
- planned timing;
- planned input;
- protocol rationale.

DEC-0012 therefore must not deactivate or supersede planning scientific knowledge merely because execution differed.

## Record-source preservation

The field-log source is likewise not transformed into planning guidance.

A record that an operation occurred does not by itself establish that the operation was recommended, optimal, required or permitted.

## No normative-force inference

The routing statement does not introduce REQUIRE, PROHIBIT, SHOULD, BEST_EFFORT or PERMITTED over agronomic actions.

The phrase:

`please refer to`

is a source-authority instruction, not an agronomic normative modality over field operations.

## No direct runtime query behavior in v1

DEC-0012 establishes authority metadata.

It does not yet define a runtime API such as:

`resolveSourceForQuestion()`.

A later routing/query layer may consume this authority.

The v1 acceptance target is content-addressed, replayable source-governance authority.

## No automatic conflict-resolution result

If both planning and field-log evidence exist, DEC-0012 gives a scoped routing relation.

It does not produce a conflict-resolution object or rewrite prior claims.

A later reconciliation authority may compare planned versus actual.

## No planned-versus-actual performance judgment

DEC-0012 does not evaluate:

- plan adherence;
- operator compliance;
- execution quality;
- deviation severity;
- commercial impact;
- agronomic success.

Those require separate evaluation semantics.

## No inferred record completeness

The field log may contain activities and observations.

DEC-0012 does not infer that it contains every possible operation.

The routing role means it is the designated actual-operation record source according to the governing protocol, not that the dataset is proven exhaustive.

## No execution chronology from source role alone

The presence of an actual-operation record source does not establish operation timestamps.

Chronology must come from event-level record content.

## Content addressing

The normalized routing semantics must be content-addressed.

Changing any of the following must change the semantic hash:

- exact routing source expression;
- planning Source ref;
- actual-operation-record Source ref;
- subject scope;
- planning role;
- actual-operation role;
- routing relation;
- calendar-year scope;
- exact scientific/source authority bindings.

Stored authority must fail closed on hash drift.

## Candidate local completeness

`losslessCoverage = COMPLETE` means only that the targeted source-authority routing semantics are represented.

For the KBS 2015 case this includes:

- planning source identified;
- actual-operation record source identified;
- planning role;
- actual-operation record role;
- FIELD_OPERATION_OCCURRENCE subject scope;
- ACTUAL_OCCURRENCE_DEFER_TO_RECORD_SOURCE routing relation;
- calendar year 2015;
- exact source statement provenance.

It does not mean:

- any field-log operation row has been ingested;
- actual 2015 operations are known;
- record completeness is established;
- planned-versus-actual reconciliation is complete;
- execution occurred;
- Outcome exists.

## Required semantic review

Publication must require a governed semantic review that explicitly confirms:

1. the exact protocol source is planning guidance;
2. the exact protocol statement routes actual-operation questions to the field log;
3. the exact actual-record source is the referenced agronomic field-log source;
4. the route is limited to FIELD_OPERATION_OCCURRENCE;
5. the temporal scope is 2015;
6. no global source precedence or supersession is asserted;
7. no operation event is synthesized.

Keyword matching on:

`field log`

is insufficient authority.

## Why not SourceRegistry supersedes

Rejected.

It is too broad because the protocol remains valid for planning semantics.

## Why not Source type FIELD_LOG in place

Rejected for DEC-0012.

Mutating accepted SourceRegistry v1 solely to encode semantic routing would conflate generic source classification with relation-specific authority.

## Why not Outcome

Rejected.

Outcome is post-decision/evaluation evidence and does not establish document-role routing.

## Why not ExecutionReceipt

Rejected.

A source routing relation is not evidence that a specific operation occurred.

## Why not a free-text limitation

Rejected.

The planning-versus-actual distinction is source-authority semantics that materially changes how future facts must be interpreted.

It should be inspectable and replayable authority.

## Why not hard-code KBS behavior

Rejected.

The core contract must be generic.

KBS-specific names, URLs and excerpts belong only in Gold acceptance fixtures.

## Mandatory implementation acceptance cases

If DEC-0012 is accepted, implementation acceptance must prove at least:

1. exact real 2015 protocol disclaimer is retained;
2. exact planning Source and SourceArtifact are content-addressed;
3. exact field-log catalog Source and metadata artifact are separately content-addressed;
4. planning and field-log Sources remain distinct;
5. planningRole = PLANNED_MANAGEMENT_GUIDANCE;
6. actualOperationRole = ACTUAL_FIELD_OPERATION_RECORD;
7. subjectScope = FIELD_OPERATION_OCCURRENCE;
8. routingRelation = ACTUAL_OCCURRENCE_DEFER_TO_RECORD_SOURCE;
9. temporalScope = CALENDAR_YEAR 2015;
10. no SourceRegistry supersedes lineage is required or created;
11. protocol is not labeled actual-operation record authority;
12. field log is not labeled planning guidance merely by inversion;
13. changing subject scope fails closed;
14. changing year fails hash/review closure;
15. unrelated field-log source fails closed;
16. unrelated planning source fails closed;
17. missing planning statement evidence fails closed;
18. missing field-log catalog evidence fails closed;
19. wrong scientific use fails closed;
20. source-expression mismatch fails closed;
21. absence of field-log event data does not create non-execution facts;
22. no operation event, ExecutionReceipt, DecisionResult, RuntimeBinding, RuntimeAlternativeSet, Policy or Outcome authority is created;
23. no protocol scientific/planning authority is globally superseded.

At least one negative case must use the exact KBS 2015 disclaimer.

## Real-source Gold target

The implementation Gold should use public evidence from:

### Source A — 2015 Agronomic Protocol

Public PDF:

`https://lter.kbs.msu.edu/docs/agronomic_protocols/current_agronomic_protocol.pdf`

Exact source statement:

`This is a working protocol used for planning purposes. Due to potential changes in chemicals, fertilizer, varieties planted, planting dates etc… please refer to the agronomic field log for actual field operations that take place during 2015.`

### Source B — MCSE Agronomic Protocol catalog

Public protocol metadata states that the protocol contains planned management and actual field operations may differ and are recorded in the ag log.

### Source C — Agronomic Field Log catalog

Public datatable metadata:

`https://lter.kbs.msu.edu/datatables/16`

The catalog describes the Agronomic Field Log as a narrative log of agronomic activities or observations made on MCSE treatments.

Gold acceptance should retain only public source/catalog metadata needed to prove the routing relation.

It must not copy restricted data rows.

## Runtime boundary

`AgronomicSourceAuthorityRoutingCompilation` is not:

- Source;
- SourceArtifact;
- source supersession;
- Claim;
- QualifiedKnowledge;
- AgronomicActionRegimenCompilation;
- AgronomicActionRealizationCompilation;
- AgronomicConditionalActionRealizationCompilation;
- Policy;
- RuntimePlan;
- RuntimeEligibility;
- RuntimeBinding;
- RuntimeAlternativeSet;
- DecisionResult;
- ExecutionReceipt;
- field-operation event;
- Field Log row;
- Outcome;
- causal-effect authority.

## Explicitly unresolved after DEC-0012

Even if accepted and implemented, ADR still leaves at least:

1. event-level field-log ingestion;
2. exact operation-event schema for external agronomic logs;
3. field-log row source-faithful extraction;
4. planned-versus-actual reconciliation;
5. missing-log completeness semantics;
6. execution identity across multiple log tables;
7. equipment/material/rate normalization;
8. integration with Outcome externalExecutionRef;
9. data-rights enforcement for restricted rows;
10. operationalization of `more aggressive tillage is needed`;
11. equipment capability mapping for CHISEL_PLOWING and SOIL_FINISHING.

These must not be collapsed into DEC-0012.

## Acceptance targets

Before implementation is authorized, architecture review must confirm:

1. the KBS disclaimer positively establishes a planning-versus-actual source-role boundary;
2. the relation is semantic-scope-specific, not global source precedence;
3. SourceRegistry `supersedes` is too broad;
4. Outcome is downstream and insufficient for source-role routing;
5. planning source remains valid after actual operations differ;
6. actual-operation record source does not itself create execution events;
7. field-log absence does not prove non-execution;
8. temporal scope is preserved as 2015 for the exact PDF statement;
9. subject scope is FIELD_OPERATION_OCCURRENCE only;
10. actual-operation record source identity requires independent governed evidence;
11. implementation remains additive;
12. no accepted SourceRegistry, Outcome, Policy or runtime contract is mutated in place.

## Acceptance

Accepted on 2026-08-28 after explicit architecture approval.

Acceptance establishes the scoped source-authority routing architecture described by this decision only.

In particular, acceptance does **not** establish:

- global precedence of field logs over protocols;
- whole-source supersession;
- event-level field-log ingestion;
- operation occurrence merely from planning statements;
- non-execution merely from absent log rows;
- operation identifiers, timestamps, rates, materials, equipment or operators;
- ExecutionReceipt, DecisionResult, RuntimeBinding, RuntimeAlternativeSet, Policy or Outcome authority;
- record completeness;
- planned-versus-actual reconciliation;
- causal or performance evaluation.

The accepted v1 semantic routing is restricted to:

```text
subjectScope =
  FIELD_OPERATION_OCCURRENCE

planningRole =
  PLANNED_MANAGEMENT_GUIDANCE

actualOperationRole =
  ACTUAL_FIELD_OPERATION_RECORD

routingRelation =
  ACTUAL_OCCURRENCE_DEFER_TO_RECORD_SOURCE

temporalScope =
  CALENDAR_YEAR 2015
```

The planning source remains valid for planning semantics while the actual-operation record source is the governed source to inspect for recorded actual field-operation occurrence.

## Post-acceptance gate

Before this decision is merged as accepted architecture:

1. repository-wide ADR Constitution MUST pass on the exact accepted documentation head;
2. the PR MUST remain docs-only;
3. no SourceRegistry, Outcome, Policy, runtime, schema, workflow, field-log row, event or existing authority-contract mutation may be included;
4. the PR base MUST still equal the expected main authority head;
5. the accepted exact head MUST be recorded before merge.

Only after the accepted documentation PR is merged may implementation begin on a separate branch created from the resulting main.

Implementation MUST include exact real-source positive and negative evidence proving at least:

- exact planning-source statement and exact record-source catalog evidence are separately retained;
- planning and record Sources remain distinct;
- routing is scoped to FIELD_OPERATION_OCCURRENCE and CALENDAR_YEAR 2015;
- no whole-source supersedes relation is created;
- no planning statement is accepted as actual-operation occurrence;
- missing record rows do not produce non-execution facts;
- no operation event, ExecutionReceipt, DecisionResult, RuntimeBinding, RuntimeAlternativeSet, Policy or Outcome authority is created;
- core contracts remain source-generic and KBS-specific names remain in Gold acceptance only.

Acceptance of DEC-0012 does not pre-accept event-level field-log extraction, actual-operation event schemas, completeness semantics, planned-versus-actual reconciliation, equipment/material normalization, restricted-row ingestion or Outcome external-execution integration.

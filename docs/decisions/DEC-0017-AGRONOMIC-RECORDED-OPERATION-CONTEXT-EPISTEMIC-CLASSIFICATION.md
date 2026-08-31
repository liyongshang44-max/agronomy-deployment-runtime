# DEC-0017 — Governed Recorded-Operation Context Epistemic Classification

Status: **ACCEPTED**

Date: 2026-08-31

## Context

DEC-0013 established exact source-recorded operation occurrence authority.

The first real occurrence remains:

```text
siteid = SERF
sourceOperationCode = plant_corn
date = 2011-05-03
precision = DAY
recordSemanticRole = ACTUAL_FIELD_OPERATION_RECORD
occurrenceClass = SOURCE_RECORDED_OPERATION_OCCURRENCE
```

DEC-0014 established source-scoped operation semantic normalization:

```text
plant_corn -> PLANT / CROP:CORN
```

DEC-0016 established exact context semantic/value mapping:

```text
PLANT / CROP:CORN
CALENDAR_DATE 2011-05-03 / DAY
  ->
crop.planting_date
DATE 2011-05-03
```

That chain still does not answer:

> what epistemic class may the eventual ContextDatum carry for this mapped source-recorded planting date?

The Frozen Context Contract defines the orthogonal EpistemicClass vocabulary:

```text
OBSERVATION
ASSERTION
DERIVED
STATE_ESTIMATE
FORECAST
CONFIGURATION
MODEL_PRIOR
```

and explicitly distinguishes:

```text
OBSERVATION
= direct measurement, sensing, counting or recording of an event/state
  with observation semantics

ASSERTION
= a statement made by a person or external source about reality
  without direct-measurement semantics
```

Examples in the Frozen Context Contract include:

```text
planter telemetry records planting event
  -> OBSERVATION / MACHINERY

grower manually states planting date
  -> ASSERTION / USER

customer FMIS stores a grower-entered planting date
  -> ASSERTION / CUSTOMER_SYSTEM
```

The current Sustainable Corn occurrence is a persisted external source record.

The accepted predecessor chain does **not** establish direct planter telemetry, sensor measurement, independent execution verification, or another direct-observation channel.

Therefore the source record must not be silently upgraded to OBSERVATION merely because its source role says ACTUAL_FIELD_OPERATION_RECORD.

## Decision

Introduce a distinct content-addressed authority:

`AgronomicRecordedOperationContextEpistemicClassificationCompilation`

Its narrow purpose is:

> classify the exact accepted DEC-0016 context semantic/value mapping under the Frozen Context EpistemicClass vocabulary, using the exact accepted predecessor occurrence semantics, without creating provenance, ContextDatum, temporal, spatial, unit, uncertainty, runtime, execution or Outcome authority.

For the first real Gold, the only accepted classification candidate is:

```text
exact DEC-0016 mapping:
  crop.planting_date
  DATE 2011-05-03

exact predecessor occurrence:
  recordSemanticRole = ACTUAL_FIELD_OPERATION_RECORD
  occurrenceClass = SOURCE_RECORDED_OPERATION_OCCURRENCE

direct-measurement/telemetry authority:
  NOT ESTABLISHED

  -> epistemicClass = ASSERTION
```

## Why ASSERTION

The Frozen Context Contract defines ASSERTION as:

> a statement made by a person or external source about reality without direct-measurement semantics.

That is the authority level currently established by the accepted Sustainable Corn chain.

DEC-0013 proves that the source records the operation occurrence.

It explicitly does not prove independent execution verification.

The retained notebook/table is source evidence about reality.

It is not direct planter telemetry.

Therefore the first mapping is:

```text
source-recorded planting occurrence
without direct-measurement/telemetry authority
  ->
ASSERTION
```

This does not mean the source is untrustworthy.

It means epistemic class is determined by the kind of knowing established by authority, not by confidence or source reputation.

## Why not OBSERVATION

Rejected for the first Gold.

OBSERVATION requires observation semantics such as direct measurement, sensing, counting, or direct event recording.

The Frozen Context Contract gives planter telemetry as the planting-event example.

The current predecessor chain contains no accepted authority proving:

- planter telemetry;
- machine CAN/ISOBUS event;
- sensor event;
- direct observation protocol;
- independent execution receipt;
- independently verified operation occurrence.

Therefore DEC-0017 must fail closed if a caller attempts:

```text
epistemicClass = OBSERVATION
```

for the first Sustainable Corn mapping.

A future source with explicit direct-observation/telemetry authority may legitimately classify differently under a separate reviewed authority.

## Orthogonality with provenance

DEC-0017 does not assign ProvenanceClass.

The Frozen Context Contract states:

```text
provenance channel and epistemic status are orthogonal
```

Therefore this decision must not simultaneously decide whether the eventual provenance is:

- EXTERNAL_PROVIDER;
- CUSTOMER_SYSTEM;
- MACHINERY;
- PLATFORM;
- USER;
- any other provenance class.

A later provenance-projection authority must decide that independently.

## Mandatory predecessor closure

Publication must require the exact accepted:

`AgronomicRecordedOperationContextSemanticMappingCompilation`

The DEC-0016 authority must be fully revalidated through its own validator.

The classifier must also inspect the exact parent occurrence closed through DEC-0016 and require that its source occurrence semantics remain exact.

For the first Gold:

```text
recordSemanticRole = ACTUAL_FIELD_OPERATION_RECORD
occurrenceClass = SOURCE_RECORDED_OPERATION_OCCURRENCE
sourceOperationCode = plant_corn
date = 2011-05-03
precision = DAY
```

A caller cannot combine one context semantic mapping with the occurrence world of another mapping.

## Exact first classification vocabulary

The first implementation slice must keep the accepted mapping finite:

```text
DEC-0016 first mapping
+
source-recorded occurrence without direct-observation authority
  ->
ASSERTION
```

No generic rule such as:

```text
all external sources -> ASSERTION
```

is accepted.

No generic rule such as:

```text
all ACTUAL_FIELD_OPERATION_RECORD -> OBSERVATION
```

is accepted.

## Proposed authority shape

Conceptually:

```text
AgronomicRecordedOperationContextEpistemicClassification {
  contractVersion

  classificationId

  contextSemanticMappingCompilationRef

  predecessorOccurrenceSemantics {
    recordSemanticRole
    occurrenceClass
  }

  targetContextSemantic {
    semanticId
    value
  }

  epistemicClass

  classificationRationale
}
```

Publication compilation should additionally contain:

- classification hash;
- epistemic review ref;
- local lossless coverage;
- explicit limitations.

Exact field names remain implementation-level after architecture acceptance.

## No provenance authority

DEC-0017 must not assign or infer:

- USER;
- AGRONOMIST;
- SENSOR;
- MACHINERY;
- REMOTE_SENSING;
- EXTERNAL_PROVIDER;
- CUSTOMER_SYSTEM;
- LABORATORY;
- MODEL;
- PLATFORM.

## No source-reputation upgrade

A public research repository, university affiliation, reviewed source, or exact source hash does not automatically make the datum OBSERVATION.

Rights, provenance lineage and epistemic class answer different questions.

## No source-field-name inference

The presence of source labels such as:

```text
actual
operation
field operation
record
```

does not by itself authorize OBSERVATION.

The accepted classification depends on the whole reviewed predecessor authority.

## No ContextDatum publication

DEC-0017 must not create:

- ContextDatum;
- ContextManifest;
- AuthorizedContextReference;
- ResolvedContextDatumReceipt.

It establishes only one epistemic-class projection for the exact mapped semantic/value world.

## No effectiveInterval authority

DEC-0017 creates no:

- effectiveInterval.start;
- effectiveInterval.end;
- timezone;
- UTC offset;
- local-day boundary;
- RFC3339 day interval.

## No availableAt authority

DEC-0017 does not decide ContextDatum `availableAt`.

The following remain distinct clocks and must not be substituted silently:

- event date;
- source materialization time;
- source publication time;
- ADR acquisition time;
- review time;
- classification publication time.

## No spatial/target authority

DEC-0017 does not project DEC-0015 target identity into:

- spatialSupport;
- geometryRef;
- fieldId;
- farmId;
- DecisionProblem targetRef.

## No unit authority

DEC-0017 does not decide the ContextDatum unit representation for a DATE-valued semantic.

## No uncertainty authority

DEC-0017 does not set:

```text
uncertainty = NONE
```

or any other uncertainty form.

Classifying a source statement as ASSERTION is not equivalent to assigning a quantified uncertainty model.

## No temporalSupport projection

DEC-0017 does not convert DEC-0013 DAY precision into ContextDatum temporalSupport vocabulary.

## No source wire projection

DEC-0017 does not decide:

- providerId;
- sourceRef;
- contentHash

for the eventual ContextDatum source object.

## No current-state inference

```text
crop.planting_date = DATE 2011-05-03
epistemicClass = ASSERTION
```

does not establish:

- crop currently present;
- crop currently corn;
- current phenology;
- active season;
- current farm/field status.

## No truth upgrade

ASSERTION is not a scientific-truth or execution-verification label.

DEC-0017 must not transform the accepted occurrence into:

- independently verified execution;
- ground truth;
- confirmed machine action;
- Outcome.

## No DecisionProblem authority

DEC-0017 creates no:

- DecisionProblem;
- targetRef;
- logicalTime;
- decisionDeadline;
- actionSpace;
- constraints.

## No Policy/runtime authority

DEC-0017 creates no:

- Policy;
- RuntimePlan;
- RuntimeEligibility;
- RuntimeBinding;
- DecisionResult.

## No execution or Outcome authority

DEC-0017 creates no:

- ExecutionReceipt;
- actual machine execution;
- agronomic Outcome;
- causal attribution.

## No inverse classification rule

Acceptance of:

```text
this exact mapped source-recorded planting date
  -> ASSERTION
```

does not authorize:

```text
ASSERTION
  -> source-recorded planting occurrence
```

or any source reconstruction.

## No completeness claim

The first accepted classification does not mean:

- all planting-date context is ASSERTION;
- all source-recorded operations are ASSERTION;
- all external sources are ASSERTION;
- OBSERVATION is unavailable for planting events;
- all Sustainable Corn records share one epistemic class.

Only the exact reviewed first mapping is covered.

## Reviewer authority

Publication requires an explicit:

`AgronomicRecordedOperationContextEpistemicClassificationReviewDecision`

or equivalent governed review authority.

The review must bind the exact:

- DEC-0016 mapping compilation;
- exact parent occurrence world;
- recordSemanticRole;
- occurrenceClass;
- target semantic/value;
- proposed epistemicClass.

## Proposed mandatory review checks

An accepted review should confirm at least:

1. `CONTEXT_SEMANTIC_MAPPING_AUTHORITY_VERIFIED`;
2. `EXACT_PARENT_OCCURRENCE_CLOSURE_VERIFIED`;
3. `EXACT_RECORD_SEMANTIC_ROLE_VERIFIED`;
4. `EXACT_OCCURRENCE_CLASS_VERIFIED`;
5. `TARGET_CONTEXT_SEMANTIC_VERIFIED`;
6. `TARGET_CONTEXT_VALUE_VERIFIED`;
7. `ASSERTION_CLASS_SUPPORTED`;
8. `NO_DIRECT_MEASUREMENT_AUTHORITY_ESTABLISHED`;
9. `NO_TELEMETRY_AUTHORITY_ESTABLISHED`;
10. `NO_OBSERVATION_UPGRADE`;
11. `NO_PROVENANCE_CLASS_INFERENCE`;
12. `NO_SOURCE_REPUTATION_UPGRADE`;
13. `NO_CONTEXT_DATUM_PUBLICATION`;
14. `NO_EFFECTIVE_INTERVAL_OR_AVAILABLE_AT_INFERENCE`;
15. `NO_TARGET_OR_SPATIAL_PROJECTION`;
16. `NO_UNIT_OR_UNCERTAINTY_INFERENCE`;
17. `NO_CURRENT_STATE_OR_SEASON_INFERENCE`;
18. `NO_DECISION_PROBLEM_OR_POLICY_INFERENCE`;
19. `NO_RUNTIME_EXECUTION_OR_OUTCOME_INFERENCE`;
20. `NO_INVERSE_OR_COMPLETENESS_INFERENCE`.

All mandatory checks are required for accepted publication.

## Proposed review dispositions

At minimum:

- `ACCEPT_RECORDED_OPERATION_CONTEXT_EPISTEMIC_CLASSIFICATION`;
- `REJECT_RECORDED_OPERATION_CONTEXT_EPISTEMIC_CLASSIFICATION`.

Rejected review cannot authorize classification publication.

## Content addressing

Changing any material classification element must change semantic identity or fail review closure, including:

- DEC-0016 mapping ref;
- recordSemanticRole;
- occurrenceClass;
- target semanticId;
- target typed value;
- epistemicClass;
- review ref;
- classification rationale;
- limitations.

## Local completeness

For DEC-0017:

`losslessCoverage = COMPLETE`

means only:

> the targeted epistemic classification for the exact accepted DEC-0016 mapping is represented without inventing another ContextDatum field.

It does not mean ContextDatum is complete.

## First real-source Gold

The first Gold must reuse the exact accepted Sustainable Corn chain:

```text
DEC-0013
SERF / plant_corn / 2011-05-03 / DAY
recordSemanticRole = ACTUAL_FIELD_OPERATION_RECORD

DEC-0014
plant_corn -> PLANT / CROP:CORN

DEC-0016
crop.planting_date = DATE 2011-05-03
```

Accepted classification candidate:

```text
epistemicClass = ASSERTION
```

The Gold must prove that OBSERVATION cannot be published from the same predecessor world.

## Mandatory implementation acceptance cases

If DEC-0017 is accepted, implementation must prove at least:

1. exact DEC-0016 mapping authority is mandatory;
2. exact parent occurrence closure is mandatory;
3. first Gold parent occurrence retains `ACTUAL_FIELD_OPERATION_RECORD`;
4. first Gold parent occurrence retains `SOURCE_RECORDED_OPERATION_OCCURRENCE`;
5. target semantic remains `crop.planting_date`;
6. target value remains `DATE 2011-05-03`;
7. first real-source classification can publish as ASSERTION;
8. OBSERVATION fails closed for the same predecessor world;
9. DERIVED fails closed;
10. STATE_ESTIMATE fails closed;
11. FORECAST fails closed;
12. CONFIGURATION fails closed;
13. MODEL_PRIOR fails closed;
14. parent occurrence drift fails closed;
15. DEC-0016 mapping drift fails closed;
16. arbitrary target semantic drift fails closed through predecessor closure;
17. incomplete review cannot publish;
18. unauthorized reviewer cannot publish;
19. rejected review cannot publish;
20. no provenanceClass is created;
21. no ContextDatum/ContextManifest authority is created;
22. no effectiveInterval/availableAt/timezone authority is created;
23. no spatial/target/geometry authority is created;
24. no unit/uncertainty authority is created;
25. no DecisionProblem/Policy/runtime authority is created;
26. no ExecutionReceipt/Outcome authority is created;
27. no inverse classification is created;
28. no completeness claim is created.

At least one positive case must use the exact real Sustainable Corn predecessor chain.

## Proposed first implementation slice

Only after explicit acceptance and accepted documentation merge may implementation begin.

The first implementation slice should contain only:

1. recorded-operation context epistemic classification contract;
2. exact DEC-0016 predecessor closure;
3. exact parent occurrence closure;
4. review authority;
5. content-addressed publication/validation;
6. first finite classification to ASSERTION;
7. real Sustainable Corn Gold;
8. mandatory fail-closed cases;
9. focused workflow wiring if required.

It must not contain:

- provenanceClass;
- ContextDatum publication;
- effectiveInterval;
- availableAt;
- timezone;
- spatialSupport;
- geometry;
- unit;
- uncertainty;
- temporalSupport projection;
- source wire projection;
- DecisionProblem;
- Policy;
- runtime;
- execution;
- Outcome.

## Future authority chain

If accepted and implemented:

```text
DEC-0013 occurrence
      +
DEC-0014 operation semantic
      |
      v
DEC-0016 context semantic/value mapping
      |
      v
DEC-0017 epistemic classification
      |
      +---- future provenance projection
      +---- future temporal projection
      +---- future target/spatial projection
      +---- future unit/uncertainty/source projection
      |
      v
future governed ContextDatum projection
```

No downstream arrow is pre-accepted by DEC-0017.

## Explicitly unresolved after DEC-0017

Even if accepted and implemented, the following remain unresolved:

1. provenanceClass;
2. effectiveInterval;
3. availableAt;
4. timezone / UTC offset;
5. DAY -> RFC3339 interval interpretation;
6. unit for DATE semantic;
7. uncertainty;
8. temporalSupport projection;
9. ContextDatum source wire projection;
10. DEC-0015 target identity -> spatialSupport;
11. ContextDatum publication;
12. ContextManifest inclusion;
13. field/plot/zone/season identity;
14. cross-provider canonical identity;
15. planned-versus-actual reconciliation;
16. execution reconciliation;
17. Outcome linkage.

## Acceptance targets

Before this architecture may be accepted, review must confirm:

1. EpistemicClass and ProvenanceClass remain orthogonal;
2. exact DEC-0016 mapping closure is mandatory;
3. exact source occurrence semantics remain material;
4. the first current source world supports ASSERTION;
5. the first current source world does not establish OBSERVATION;
6. no direct telemetry/measurement authority is invented;
7. no provenance class is implied;
8. no ContextDatum publication is implied;
9. no temporal/spatial/unit/uncertainty projection is implied;
10. no DecisionProblem/Policy/runtime/execution/Outcome authority is created;
11. implementation remains additive and does not weaken DEC-0013/0014/0016.

## Post-acceptance gate

Before accepted DEC-0017 documentation may merge:

1. repository-wide ADR Constitution MUST pass on the exact accepted documentation head;
2. PR MUST remain docs-only;
3. no package/runtime/schema/workflow/acceptance mutation may be included;
4. no existing accepted contract may be changed;
5. PR base MUST remain the expected protected `main`;
6. accepted exact head MUST be recorded before merge.

Only after accepted documentation merge and post-merge Constitution success may implementation begin.

## Acceptance

**ACCEPTED — 2026-08-31.**

Explicit architecture approval was provided by the user by instructing continuation under the proposed plan.

The accepted boundary is the decision exactly as written above: the exact accepted DEC-0016 Sustainable Corn context semantic/value mapping, when closed to its exact source-recorded occurrence world and absent direct measurement/telemetry authority, may classify only as `ASSERTION`. No `OBSERVATION` upgrade, provenance class, ContextDatum publication, effectiveInterval, availableAt, timezone, spatial/target projection, unit, uncertainty, DecisionProblem, Policy, runtime, execution, Outcome, inverse classification, or completeness authority is accepted.

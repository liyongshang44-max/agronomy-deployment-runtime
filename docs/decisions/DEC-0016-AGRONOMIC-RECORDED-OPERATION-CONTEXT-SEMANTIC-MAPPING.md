# DEC-0016 — Governed Recorded-Operation Context Semantic Mapping

Status: **ACCEPTED**

Date: 2026-08-31

## Context

DEC-0013 established governed source-recorded operation occurrence authority.

The first real occurrence is:

```text
siteid = SERF
sourceOperationCode = plant_corn
date = 2011-05-03
precision = DAY
```

DEC-0014 established governed source-scoped operation semantic normalization:

```text
plant_corn
  -> family = PLANT
  -> subject = CROP:CORN
```

DEC-0015 established governed source-backed target identity:

```text
Sustainable Corn source namespace
siteid = SERF
  -> source-backed target identity
  -> granularity = FARM
```

Those three authorities answer three different questions:

1. did the source record an occurrence?
2. what does the source operation code mean?
3. what source-backed target identity does the source-native subject denote?

They still do **not** answer:

> which ADR context semantic, if any, may be formed from the exact recorded operation and its exact source date?

The Frozen Context Contract already defines the semantic identifier:

```text
crop.planting_date
```

and the ContextDatum value vocabulary already admits:

```text
DATE
```

But no accepted authority currently permits the transformation:

```text
source-recorded PLANT / CROP:CORN occurrence
with source date 2011-05-03
  ->
crop.planting_date = DATE 2011-05-03
```

Doing this in an adapter would be an ungoverned semantic projection.

## Why this is a separate authority

A recorded operation and a Context semantic are not equivalent by string similarity.

Examples:

```text
PLANT / CROP:CORN
```

could potentially participate in several downstream meanings:

- planting event;
- planting date;
- crop establishment state;
- crop presence;
- season start;
- management history.

Only one of those may be intended for a specific projection.

Likewise, an occurrence date may mean:

- exact event date;
- reporting date;
- schedule date;
- source extraction date;
- billing date;
- observation date.

DEC-0013 and DEC-0014 intentionally do not decide that mapping.

Therefore the transformation must be explicit, reviewed and content-addressed.

## Existing frozen semantic target

The Frozen Context Contract lists:

```text
crop.planting_date
```

as a stable ADR semantic identifier.

The same frozen architecture distinguishes planting-date epistemic examples, but it does not establish that every source-recorded PLANT occurrence automatically becomes a ContextDatum.

DEC-0016 proposes only a semantic/value mapping authority.

It does **not** create ContextDatum authority.

## Decision

Introduce a distinct content-addressed authority:

`AgronomicRecordedOperationContextSemanticMappingCompilation`

Its purpose is narrowly:

> map an exact accepted recorded-operation occurrence plus an exact accepted operation semantic normalization to an exact ADR context semantic identifier and exact typed context value, without creating ContextDatum or inventing any temporal, spatial, epistemic, provenance, uncertainty, unit or runtime authority that is not already established.

For the first Gold, the authority means only:

```text
exact parent occurrence:
  sourceOperationCode = plant_corn
  temporalSupport:
    kind = CALENDAR_DATE
    date = 2011-05-03
    precision = DAY

exact semantic normalization:
  family = PLANT
  subject = CROP:CORN

maps to:

contextSemanticId = crop.planting_date

contextValue:
  type = DATE
  date = 2011-05-03
```

## Why DATE rather than TIMESTAMP

The source occurrence contains only:

```text
2011-05-03
precision = DAY
```

ADR ContextDatum supports a typed `DATE` value.

Therefore the first mapping must preserve:

```text
DATE 2011-05-03
```

and must not fabricate:

```text
2011-05-03T00:00:00Z
```

or any other timestamp.

No timezone is required to preserve the source date as a typed DATE value.

This does **not** solve ContextDatum `effectiveInterval` or `availableAt`.

Those remain separate blockers because ContextDatum requires explicit RFC3339 timestamps for those fields.

## Proposed authority shape

Conceptually:

```text
AgronomicRecordedOperationContextSemanticMapping {
  contractVersion

  mappingId

  parentOccurrenceCompilationRef
  semanticNormalizationCompilationRef

  sourceOperationSemantic {
    family
    subject {
      kind
      code
    }
  }

  sourceTemporalSupport {
    kind
    date
    precision
  }

  targetContextSemantic {
    semanticId
    value {
      type
      date
    }
  }

  transformationRationale
}
```

The publication compilation should additionally contain:

- mapping hash;
- semantic review ref;
- local lossless coverage;
- explicit limitations.

Exact field names remain implementation-level after architecture acceptance.

## Mandatory predecessor closure

Publication must require the exact accepted:

`AgronomicRecordedOperationOccurrenceCompilation`

and the exact accepted:

`AgronomicRecordedOperationSemanticNormalizationCompilation`.

Both predecessors must be fully revalidated through their own authority validators.

The mapping must fail closed unless the semantic normalization closes to the same exact parent occurrence.

A caller cannot combine:

```text
occurrence A
```

with:

```text
normalization for occurrence B
```

even if both contain the same literal source operation code.

## Exact source operation semantic closure

For the first Gold, the mapping must require exactly:

```text
family = PLANT
subject.kind = CROP
subject.code = CORN
```

Changing any material normalized semantic must change mapping identity or fail review.

Examples that must not silently continue to map to `crop.planting_date`:

```text
HARVEST / CROP:CORN
PLANT / CROP:SOYBEAN
IRRIGATE / WATER
```

Future mapping rules for other operations require their own reviewed authority.

## Exact source temporal closure

The exact DEC-0013 source occurrence temporal support must be preserved.

For the first Gold:

```text
kind = CALENDAR_DATE
date = 2011-05-03
precision = DAY
```

The target typed DATE value must equal the exact source date:

```text
targetContextSemantic.value.date
=
parentOccurrence.temporalSupport.date
```

If the mapping changes the date, it must fail closed.

DEC-0016 is not a timezone converter.

## Target context semantic

The first accepted target semantic is proposed to be exactly:

```text
crop.planting_date
```

with:

```text
value.type = DATE
```

The mapping authority must not use an arbitrary caller-supplied semantic id.

The first implementation should keep the accepted mapping vocabulary finite:

```text
PLANT / CROP:CORN
  ->
crop.planting_date / DATE
```

Other context semantics remain unresolved.

## Why operation date may map to planting date

The accepted DEC-0014 source semantic evidence establishes the source operation as Cash Crop Planting and normalizes `plant_corn` to `PLANT / CROP:CORN`.

The accepted DEC-0013 parent records the exact date of that source-recorded operation occurrence.

The Frozen Context Contract defines `crop.planting_date` as an ADR semantic dimension.

DEC-0016 proposes the explicit governed bridge between those already-established semantics.

The bridge exists because architecture explicitly accepts it.

It is not inferred later by lexical matching.

## No lexical-only semantic inference

The system must not publish this mapping merely because:

```text
operation code contains "plant"
```

or:

```text
semantic id contains "planting"
```

String similarity may generate a review candidate.

It cannot authorize publication.

## No ContextDatum publication

DEC-0016 must not create:

- ContextDatum;
- ContextManifest;
- AuthorizedContextReference;
- ResolvedContextDatumReceipt.

It establishes only:

```text
context semantic id + typed semantic value
```

for the exact accepted predecessor world.

## No effectiveInterval authority

DEC-0016 must not create or infer:

- `effectiveInterval.start`;
- `effectiveInterval.end`;
- local day boundary;
- UTC day boundary;
- timezone;
- UTC offset;
- DST rule.

The exact source date remains a typed DATE.

A later temporal-projection authority must decide whether enough evidence exists to construct ContextDatum effective-time support.

## No availableAt authority

The following must not be silently substituted for ContextDatum `availableAt`:

- source event date;
- SourceArtifact acquisition time;
- ADR materialization time;
- review time;
- publication audit time;
- Git commit time.

Those are different clocks.

A later authority must define which timestamp, if any, is legally the ContextDatum availability timestamp for this source-derived datum.

## No timezone authority

DEC-0016 must not infer:

```text
Iowa
  ->
America/Chicago
```

or any other timezone mapping.

Even if external geographic knowledge makes a timezone seem obvious, that is not part of the current accepted source authority chain.

## No target identity projection

DEC-0015 remains the source-backed target identity authority.

DEC-0016 does not copy the FARM target id into:

- ContextDatum spatialSupport;
- DecisionProblem targetRef;
- farmId;
- fieldId;
- geometryRef.

The semantic mapping is valid independently of whether target projection has been accepted.

## No geometry authority

DEC-0016 creates no:

- point;
- polygon;
- farm boundary;
- field boundary;
- geometryRef;
- CRS;
- centroid;
- area;
- containment.

## No epistemic-class authority

DEC-0016 must not decide:

```text
OBSERVATION
ASSERTION
DERIVED
STATE_ESTIMATE
FORECAST
CONFIGURATION
MODEL_PRIOR
```

for the eventual ContextDatum.

A source-recorded operation is not automatically allowed to become `OBSERVATION` merely because it is called an actual operation record.

Epistemic classification remains a separate projection question unless explicit authority is added later.

## No provenance-class authority

DEC-0016 must not decide:

```text
USER
AGRONOMIST
SENSOR
MACHINERY
REMOTE_SENSING
EXTERNAL_PROVIDER
CUSTOMER_SYSTEM
LABORATORY
MODEL
PLATFORM
```

for the eventual ContextDatum.

Source registry provenance and ContextDatum ProvenanceClass are not silently interchangeable.

## No unit authority

DEC-0016 does not assign a ContextDatum unit.

The Frozen ContextDatum contract requires a non-empty `unit`, but the correct representation for a DATE-valued planting semantic is not established by DEC-0013, DEC-0014 or DEC-0015.

That remains unresolved for final ContextDatum projection.

## No uncertainty authority

DEC-0016 must not automatically set:

```text
uncertainty = NONE
```

or any other uncertainty form.

An exact source-recorded date value is not the same thing as an explicit statement that the underlying agronomic event has zero uncertainty.

## No temporalSupport projection

DEC-0016 must not silently convert:

```text
precision = DAY
```

into a ContextDatum:

```text
temporalSupport.type = INTERVAL
```

or another support vocabulary.

That projection remains separate.

## No source-field projection

DEC-0016 does not establish how the eventual ContextDatum `source` object should encode:

- providerId;
- sourceRef;
- contentHash.

The predecessor Source / SourceArtifact authorities remain exact lineage.

A later ContextDatum projection authority must explicitly define the wire projection.

## No DecisionProblem mutation

DEC-0016 must not create or mutate:

- DecisionProblem;
- targetRef;
- logicalTime;
- decisionDeadline;
- decisionHorizon;
- actionSpace;
- constraints.

## No Policy authority

DEC-0016 does not create or mutate:

- Policy;
- actionSpace;
- actionSemantics;
- obligation;
- prohibition;
- modality.

Mapping a historical event into a context semantic is not a normative policy action.

## No current-state inference

Acceptance of:

```text
crop.planting_date = 2011-05-03
```

does not establish:

- crop is currently present;
- crop is currently corn;
- crop is currently growing;
- field/farm is currently active;
- 2011 is an active season;
- any present phenological state.

Historical event context is not current state.

## No season inference

DEC-0016 must not infer:

```text
seasonId = 2011
```

from the planting date or source crop year.

## No planned-versus-actual reconciliation

The mapping consumes an exact accepted source-recorded operation occurrence.

It does not compare the occurrence with:

- a planned operation;
- a recommendation;
- a schedule;
- a Policy obligation;
- an execution order.

## No execution authority

DEC-0016 does not create ExecutionReceipt or claim independent execution verification beyond the existing DEC-0013 occurrence semantics.

## No Outcome authority

A planting-date semantic does not establish agronomic effect, yield response, crop establishment success or Outcome.

## No inverse mapping

Acceptance of:

```text
PLANT / CROP:CORN + DATE
  ->
crop.planting_date
```

does not authorize:

```text
crop.planting_date
  ->
source operation plant_corn
```

for write-back or source reconstruction.

The first authority is one-way semantic projection only.

## No mapping completeness claim

One accepted mapping does not prove that:

- all planting sources can map;
- all operation codes are mapped;
- all crop planting semantics are known;
- an unmapped operation has no context meaning;
- every `crop.planting_date` originated from a recorded operation.

## Source-version and predecessor drift

The mapping is content-addressed through exact predecessor refs.

If the DEC-0013 occurrence changes, a new mapping review is required.

If the DEC-0014 semantic normalization changes, a new mapping review is required.

The previous mapping remains historically valid for its exact predecessors.

## Reviewer authority

Publication requires an explicit:

`AgronomicRecordedOperationContextSemanticMappingReviewDecision`

or equivalent governed review authority.

The review must bind the exact:

- parent occurrence compilation;
- semantic normalization compilation;
- source operation semantic;
- source temporal support;
- target context semantic id;
- target typed value.

## Proposed mandatory review checks

An accepted review should confirm at least:

1. `PARENT_OCCURRENCE_AUTHORITY_VERIFIED`;
2. `SEMANTIC_NORMALIZATION_AUTHORITY_VERIFIED`;
3. `NORMALIZATION_PARENT_CLOSURE_VERIFIED`;
4. `EXACT_SOURCE_OPERATION_SEMANTIC_VERIFIED`;
5. `EXACT_SOURCE_DATE_VERIFIED`;
6. `TARGET_CONTEXT_SEMANTIC_VERIFIED`;
7. `TARGET_VALUE_TYPE_DATE_VERIFIED`;
8. `SOURCE_DATE_PRESERVED_EXACTLY`;
9. `NO_LEXICAL_ONLY_MAPPING`;
10. `NO_TIMESTAMP_OR_TIMEZONE_INFERENCE`;
11. `NO_EFFECTIVE_INTERVAL_INFERENCE`;
12. `NO_AVAILABLE_AT_INFERENCE`;
13. `NO_TARGET_IDENTITY_OR_GEOMETRY_PROJECTION`;
14. `NO_EPISTEMIC_OR_PROVENANCE_INFERENCE`;
15. `NO_UNIT_OR_UNCERTAINTY_INFERENCE`;
16. `NO_CONTEXT_DATUM_PUBLICATION`;
17. `NO_DECISION_PROBLEM_INFERENCE`;
18. `NO_CURRENT_STATE_OR_SEASON_INFERENCE`;
19. `NO_RUNTIME_EXECUTION_OR_OUTCOME_INFERENCE`;
20. `NO_INVERSE_OR_COMPLETENESS_INFERENCE`.

All mandatory checks are required for accepted publication.

## Proposed review dispositions

At minimum:

- `ACCEPT_RECORDED_OPERATION_CONTEXT_SEMANTIC_MAPPING`;
- `REJECT_RECORDED_OPERATION_CONTEXT_SEMANTIC_MAPPING`.

Rejected review cannot authorize mapping publication.

## Content addressing

Changing any material mapping element must change semantic identity or fail review closure, including:

- parent occurrence compilation ref;
- semantic normalization compilation ref;
- source operation family;
- source subject kind;
- source subject code;
- source temporal kind;
- source date;
- source precision;
- target context semantic id;
- target value type;
- target DATE value;
- semantic review ref;
- transformation rationale;
- limitations.

## Local completeness

For DEC-0016:

`losslessCoverage = COMPLETE`

means only:

> the targeted predecessor operation/date -> context semantic/value mapping is represented exactly and without inventing downstream ContextDatum fields.

For the first Gold:

```text
PLANT / CROP:CORN
date = 2011-05-03 / DAY
  ->
crop.planting_date
DATE 2011-05-03
```

It does not mean ContextDatum is complete or publishable.

## Why not create ContextDatum now

Rejected.

ContextDatum requires additional authority for at least:

- effectiveInterval;
- availableAt;
- unit;
- epistemicClass;
- provenanceClass;
- spatialSupport projection;
- temporalSupport projection;
- uncertainty;
- source wire projection;
- context-write publication.

Those are not all established by the current predecessor chain.

Creating a ContextDatum now would force arbitrary choices into authority-critical fields.

## Why not solve timezone first

Rejected as the immediate next step.

The source date can already be preserved losslessly as Context value type `DATE`.

A timezone is not required to state:

```text
crop.planting_date = DATE 2011-05-03
```

Timezone becomes necessary only if a later projection attempts to construct RFC3339 effective-time bounds or other timestamp-bearing semantics.

Therefore DEC-0016 should first close the semantic/value mapping independently.

## Why not mutate DEC-0014

Rejected.

DEC-0014 answers:

> what does the source operation code mean?

It should remain valid without any Context semantic projection.

DEC-0016 consumes DEC-0014.

## Why not mutate DEC-0013

Rejected.

DEC-0013 preserves the exact source-recorded occurrence and exact source date.

It should not acquire ADR Context semantic vocabulary.

DEC-0016 consumes DEC-0013.

## Why DEC-0015 is not mandatory for this mapping

Target identity and context semantic mapping are orthogonal.

The proposition:

```text
PLANT / CROP:CORN on 2011-05-03
  ->
crop.planting_date = DATE 2011-05-03
```

does not itself require a decision about which farm/field target receives that datum.

DEC-0015 will become mandatory when a later authority projects the mapped semantic onto a target-specific ContextDatum.

Keeping DEC-0015 out of the DEC-0016 semantic identity avoids making target identity part of operation semantic meaning.

## First real-source Gold

The first Gold should reuse the exact accepted Sustainable Corn chain.

Parent occurrence:

```text
siteid = SERF
sourceOperationCode = plant_corn
date = 2011-05-03
precision = DAY
```

Semantic normalization:

```text
plant_corn
  -> PLANT / CROP:CORN
```

Accepted mapping candidate:

```text
semanticId = crop.planting_date

value:
  type = DATE
  date = 2011-05-03
```

The Gold must not fabricate any timestamp.

## Mandatory implementation acceptance cases

If DEC-0016 is accepted, implementation must prove at least:

1. exact DEC-0013 parent occurrence authority is mandatory;
2. exact DEC-0014 semantic normalization authority is mandatory;
3. DEC-0014 normalization must close to the exact same DEC-0013 parent;
4. exact source semantic `PLANT / CROP:CORN` is mandatory for first mapping;
5. exact source temporal support `CALENDAR_DATE / 2011-05-03 / DAY` is preserved;
6. `crop.planting_date` is the only first-slice target semantic;
7. target value type is exactly `DATE`;
8. target date equals source occurrence date exactly;
9. positive real-source Sustainable Corn mapping can publish;
10. changing source date without changing target value fails closed;
11. changing target date fails closed;
12. changing operation family fails closed;
13. changing operation subject kind fails closed;
14. changing operation subject code fails closed;
15. binding normalization to a different parent occurrence fails closed;
16. arbitrary semanticId fails closed;
17. TIMESTAMP target value fails closed;
18. lexical-only mapping cannot authorize publication;
19. incomplete review cannot publish;
20. unauthorized reviewer cannot publish;
21. rejected review cannot publish;
22. no timezone authority is created;
23. no effectiveInterval authority is created;
24. no availableAt authority is created;
25. no ContextDatum / ContextManifest authority is created;
26. no target identity / spatialSupport / geometry authority is created;
27. no epistemic/provenance authority is created;
28. no unit/uncertainty authority is created;
29. no DecisionProblem authority is created;
30. no Policy/runtime/ExecutionReceipt/Outcome authority is created;
31. no inverse mapping is created;
32. no completeness claim is created.

At least one positive case must use the exact real Sustainable Corn predecessor chain.

## Proposed first implementation slice

Only after explicit acceptance and accepted documentation merge may implementation begin.

The first implementation slice should contain only:

1. recorded-operation context semantic mapping contract;
2. exact DEC-0013 parent closure;
3. exact DEC-0014 normalization closure;
4. mapping review authority;
5. content-addressed publication/validation;
6. first finite mapping:
   `PLANT / CROP:CORN + CALENDAR_DATE/DAY -> crop.planting_date / DATE`;
7. real Sustainable Corn Gold;
8. mandatory fail-closed cases;
9. focused package/workflow wiring if required.

It must not contain:

- ContextDatum publication;
- ContextManifest publication;
- AuthorizedContextReference;
- ResolvedContextDatumReceipt;
- effectiveInterval construction;
- availableAt construction;
- timezone;
- spatialSupport;
- geometry;
- DecisionProblem;
- epistemic/provenance classification;
- unit mapping;
- uncertainty mapping;
- season identity;
- field/plot/zone identity;
- cross-provider reconciliation;
- Policy/runtime/execution/Outcome authority.

## Future authority chain

If DEC-0016 is later accepted and implemented, the chain may become:

```text
DEC-0013
recorded occurrence
  |
  +--------------------+
  |                    |
  v                    v
DEC-0014            DEC-0015
operation semantic  target identity
  |
  v
DEC-0016
context semantic/value mapping
  |
  +---- future temporal projection
  +---- future epistemic/provenance projection
  +---- future target/spatial projection
  +---- future unit/uncertainty/source projection
  |
  v
future governed ContextDatum projection
```

No downstream arrow is pre-accepted by DEC-0016.

## Explicitly unresolved after DEC-0016

Even if accepted and implemented, the following remain unresolved:

1. ContextDatum effectiveInterval;
2. ContextDatum availableAt;
3. exact timezone authority;
4. DAY -> RFC3339 interval interpretation;
5. epistemicClass;
6. provenanceClass;
7. DATE semantic unit representation;
8. uncertainty;
9. temporalSupport projection;
10. ContextDatum source wire projection;
11. DEC-0015 target identity -> spatialSupport;
12. source-backed FARM id -> DecisionProblem targetRef;
13. ContextDatum publication;
14. ContextManifest inclusion;
15. field/plot/zone/season identity;
16. cross-provider canonical identity;
17. planned-versus-actual reconciliation;
18. execution reconciliation;
19. Outcome linkage.

## Acceptance targets

Before this architecture may be accepted, review must confirm:

1. operation semantic -> context semantic is a separate authority dimension;
2. exact DEC-0013 occurrence closure is mandatory;
3. exact DEC-0014 normalization closure is mandatory;
4. DEC-0014 must reference the exact same parent occurrence;
5. source date remains DATE-level support;
6. `crop.planting_date` is an existing frozen semantic target;
7. first mapping preserves source date exactly;
8. no timestamp/timezone inference occurs;
9. no effectiveInterval or availableAt authority is implied;
10. no ContextDatum publication is implied;
11. no target identity/spatial projection is implied;
12. no epistemic/provenance/unit/uncertainty authority is implied;
13. no current-state or season inference occurs;
14. no DecisionProblem/Policy/runtime/execution/Outcome authority is created;
15. implementation remains additive and does not weaken DEC-0013/0014/0015.

## Post-acceptance gate

Before an accepted DEC-0016 documentation PR may merge:

1. repository-wide ADR Constitution MUST pass on the exact accepted documentation head;
2. PR MUST remain docs-only;
3. no package/runtime/schema/workflow/acceptance mutation may be included;
4. no existing accepted contract may be changed;
5. PR base MUST remain the expected protected `main`;
6. accepted exact head MUST be recorded before merge.

Only after accepted documentation merge and post-merge Constitution success may implementation begin from the resulting exact `main`.

## Acceptance

**ACCEPTED — 2026-08-31.**

Explicit architecture approval was provided by the user to proceed with the proposed plan.

The accepted boundary is the decision exactly as written above: exact DEC-0013 occurrence plus exact DEC-0014 semantic normalization may map only to the first finite context semantic/value pair `crop.planting_date / DATE`, preserving the exact source date; no ContextDatum publication, effectiveInterval, availableAt, timezone, target/spatial projection, epistemic/provenance classification, unit/uncertainty mapping, DecisionProblem, Policy, runtime, execution, Outcome, inverse mapping, or completeness authority is accepted.

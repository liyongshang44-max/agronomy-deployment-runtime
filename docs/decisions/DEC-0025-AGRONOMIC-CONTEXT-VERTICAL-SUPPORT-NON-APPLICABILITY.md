# DEC-0025 — Agronomic Context Vertical-Support Non-Applicability

Status: **ACCEPTED**

Date: 2026-09-01

## Context

The Frozen Agronomic Context & Public Runtime Contract v1.0 requires every
`ContextDatum` to carry an explicit `verticalSupport` field.

The executable frozen contract currently accepts exactly two representation families:

```text
verticalSupport = {
  fromMm,
  toMm
}
```

or:

```text
verticalSupport = null
```

and the public materializer preserves the latter explicitly as:

```text
vertical_support: null
```

DEC-0016 established the exact first planting-date context semantic/value:

```text
semanticId = crop.planting_date
value.type = DATE
value.date = 2011-05-03
```

DEC-0024 subsequently established only the non-quantitative unit representation:

```text
unit = NOT_APPLICABLE
```

Neither decision established vertical-support semantics.

The current Sustainable Corn planting-date context therefore still lacks explicit
authority for the frozen `verticalSupport` field.

## Problem

A planting date is a calendar-date semantic about when a planting occurrence was
recorded.

Nothing in the accepted DEC-0016 predecessor world establishes a physical vertical
measurement interval such as:

```text
fromMm = 0
toMm = 50
```

and assigning such a range would invent depth support.

Likewise:

```text
fromMm = 0
toMm = 0
```

would not mean “not applicable”; it would assert a zero-thickness vertical support at
an exact vertical position.

Omitting the field would violate the frozen ContextDatum shape.

ADR therefore needs a reviewed meaning for the already-supported explicit
`verticalSupport = null` representation in this exact semantic/value world.

## Decision

For the first accepted mapping only, establish:

```text
crop.planting_date
DATE 2011-05-03
  ->
verticalSupport = null
```

with the exact meaning:

> no physical vertical support interval applies to this accepted planting-date
> semantic/value projection.

This is a semantic non-applicability assertion.

It is not a statement that vertical metadata was missing, unknown, unavailable or
unreported by the source.

## Exact predecessor authority

DEC-0025 requires the exact accepted DEC-0016
`AgronomicRecordedOperationContextSemanticMappingCompilation`.

The predecessor must be fully revalidated through its own authority validator.

For the first Gold it must close exactly to:

```text
semanticId = crop.planting_date
value.type = DATE
value.date = 2011-05-03
```

A caller cannot substitute another semantic/value pair merely because it appears
non-spatial or non-quantitative.

## Why `null`

The executable frozen ContextDatum contract already distinguishes:

```text
verticalSupport = null
```

from a concrete vertical interval object.

The public materializer also preserves that distinction as:

```text
vertical_support: null
```

DEC-0025 therefore does not relax or revise the frozen ContextDatum wire shape.

It assigns a governed semantic meaning to the existing null branch for this exact
accepted projection.

## Why not a zero-depth interval

The following is forbidden:

```text
verticalSupport = {
  fromMm = 0
  toMm = 0
}
```

A concrete interval, including a zero-thickness interval, asserts a vertical
coordinate/support fact.

The accepted predecessor provides no authority for such a fact.

## Why not an arbitrary depth range

The source operation record and DEC-0016 semantic mapping do not establish planting
depth, rooting depth, sensor depth, sampling depth or any other vertical extent.

DEC-0025 therefore must not invent:

- planting depth;
- seed placement depth;
- soil depth;
- root-zone depth;
- measurement depth;
- sampled horizon;
- profile interval.

## Why not omission

The frozen ContextDatum contract requires the `verticalSupport` key.

DEC-0025 establishes explicit `null`, not omission.

Omission would conflate contract incompleteness with intentional semantic
non-applicability.

## No missing-data substitution

`verticalSupport = null` under DEC-0025 must not be used to represent:

- source vertical support not reported;
- unknown vertical support;
- failed vertical-support parsing;
- unavailable geometry/depth data;
- unresolved vertical support;
- unsupported depth units;
- missing sensor metadata.

Those conditions remain distinguishable and require their own authority if they
become relevant.

## No generic type-only inference

DEC-0025 must not establish an unrestricted rule such as:

```text
if value.type == DATE:
  verticalSupport = null
```

or:

```text
if semantic is non-quantitative:
  verticalSupport = null
```

The first vocabulary is finite:

```text
crop.planting_date / DATE
  -> verticalSupport = null
```

and only under exact DEC-0016 predecessor closure.

Future semantic/value families require explicit reviewed expansion.

## Authority shape

Introduce a content-addressed authority:

`AgronomicContextVerticalSupportNonApplicabilityCompilation`

Conceptually:

```text
AgronomicContextVerticalSupportNonApplicabilityCompilation {
  contractVersion

  compilationId
  parentContextSemanticMappingCompilationRef

  targetContextSemantic {
    semanticId
    value
  }

  verticalSupportRepresentation {
    kind = NOT_APPLICABLE
    wireValue = null
  }

  rationale
  semanticReviewRef
  compilationHash
  limitations
}
```

Exact implementation field names remain implementation-level after architecture
acceptance.

The conceptual `kind = NOT_APPLICABLE` is governance metadata for the authority.
The frozen ContextDatum wire value remains exactly `null`; DEC-0025 does not insert
a new object into `ContextDatum.verticalSupport`.

## Reviewer authority

Publication requires an explicit
`AgronomicContextVerticalSupportNonApplicabilityReviewDecision`, or equivalent
governed review authority.

The review must bind the exact:

- DEC-0016 compilation ref;
- semantic ID;
- typed value;
- non-applicability classification;
- frozen wire representation `null`.

## Mandatory review checks

An accepted review should confirm at least:

1. `PARENT_CONTEXT_SEMANTIC_MAPPING_AUTHORITY_VERIFIED`;
2. `EXACT_TARGET_CONTEXT_SEMANTIC_VERIFIED`;
3. `EXACT_TARGET_VALUE_VERIFIED`;
4. `VERTICAL_SUPPORT_NON_APPLICABILITY_VERIFIED`;
5. `EXPLICIT_NULL_WIRE_REPRESENTATION_VERIFIED`;
6. `NO_ZERO_DEPTH_SUBSTITUTION`;
7. `NO_ARBITRARY_DEPTH_RANGE_INFERENCE`;
8. `NO_PLANTING_DEPTH_INFERENCE`;
9. `NO_ROOT_ZONE_OR_SOIL_PROFILE_INFERENCE`;
10. `NO_OMITTED_VERTICAL_SUPPORT`;
11. `NO_GENERIC_TYPE_ONLY_INFERENCE`;
12. `NO_MISSING_DATA_SUBSTITUTION`;
13. `NO_CONTEXT_DATUM_PUBLICATION`;
14. `NO_UNCERTAINTY_INFERENCE`;
15. `NO_EFFECTIVE_INTERVAL_OR_AVAILABLE_AT_INFERENCE`;
16. `NO_TEMPORAL_OR_TIMEZONE_MUTATION`;
17. `NO_SPATIAL_SUPPORT_TARGET_OR_GEOMETRY_MUTATION`;
18. `NO_UNIT_MUTATION`;
19. `NO_EPISTEMIC_PROVENANCE_OR_SOURCE_MUTATION`;
20. `NO_POLICY_RUNTIME_EXECUTION_OR_OUTCOME_INFERENCE`.

All mandatory checks are required for accepted publication.

## Review dispositions

At minimum:

- `ACCEPT_CONTEXT_VERTICAL_SUPPORT_NON_APPLICABILITY`;
- `REJECT_CONTEXT_VERTICAL_SUPPORT_NON_APPLICABILITY`.

Rejected review cannot authorize publication.

## Content addressing

Changing any material authority element must change semantic identity or fail review
closure, including:

- parent DEC-0016 compilation ref;
- semantic ID;
- typed value;
- non-applicability classification;
- wire representation;
- rationale;
- semantic review decision.

## No ContextDatum publication

DEC-0025 must not create:

- `ContextDatum`;
- `ContextManifest`;
- `AuthorizedContextReference`;
- `ResolvedContextDatumReceipt`.

It establishes only one field-level representation authority for later ContextDatum
assembly.

## No uncertainty authority

DEC-0025 says nothing about the epistemic uncertainty of the planting-date assertion.

It must not create or infer:

```text
uncertainty = NONE
```

or any other uncertainty form.

## No effectiveInterval authority

DEC-0025 does not create or infer:

- local civil-day interpretation;
- historical UTC offset;
- DST state;
- TZDB basis;
- `effectiveInterval.start`;
- `effectiveInterval.end`.

## No availableAt authority

DEC-0025 does not establish `availableAt`.

It must not substitute:

- source event date;
- source acquisition time;
- ADR materialization time;
- review time;
- publication time;
- Git commit time.

## No temporal or timezone mutation

DEC-0021 remains temporal-support classification authority.

DEC-0022 remains source-native timezone identity authority.

DEC-0025 does not mutate either and does not derive timestamp bounds.

## No spatial-support, target-instance or geometry mutation

DEC-0023 remains the spatial-support class authority:

```text
spatialSupport.type = FARM
```

DEC-0025 does not:

- add or remove `geometryRef`;
- identify an exact public target instance;
- infer FIELD/PLOT/ZONE support;
- create geometry;
- alter DEC-0023.

Vertical support and horizontal/spatial support remain orthogonal.

## No unit mutation

DEC-0024 remains the non-quantitative unit representation authority.

DEC-0025 does not alter:

```text
unit = NOT_APPLICABLE
```

and must not use vertical-support nullability as unit authority.

## No epistemic, provenance or source mutation

DEC-0017 through DEC-0020 remain the accepted epistemic/provenance/source lineage
authorities.

DEC-0025 must not upgrade, downgrade or rewrite them.

## First Gold

The first Gold should replay the exact accepted Sustainable Corn DEC-0016 predecessor
world and prove only:

```text
crop.planting_date
DATE 2011-05-03
  ->
verticalSupport = null
```

The Gold must fail closed for at least:

- wrong predecessor authority;
- predecessor ref drift;
- wrong semantic ID;
- wrong value type;
- wrong DATE value;
- `{ fromMm: 0, toMm: 0 }`;
- arbitrary non-zero depth interval;
- omitted vertical support;
- generic DATE type-only inference;
- missing/not-reported substitution;
- incomplete review;
- unauthorized reviewer;
- rejected review;
- review/publication mismatch.

## Consequences

Positive:

- closes the frozen ContextDatum vertical-support seam without changing wire shape;
- prevents fabricated planting/soil/root-zone depth;
- distinguishes explicit semantic non-applicability from missing metadata;
- preserves horizontal spatial support as a separate authority;
- remains finite, reviewed and content-addressed.

Costs:

- the meaning of `verticalSupport = null` is accepted only for an explicit finite
  semantic/value family;
- future non-applicable semantics still require reviewed expansion;
- this does not make the Sustainable Corn planting-date ContextDatum publishable.

## Explicit remaining blockers after acceptance

Even if DEC-0025 is accepted and implemented, final planting-date ContextDatum
projection still requires independent closure for at least:

- uncertainty representation;
- `availableAt` authority;
- effective-interval timestamp projection;
- target-instance/public spatial binding;
- datum logical identity;
- final ContextDatum assembly/publication authority;
- ContextManifest inclusion.

The unresolved local-civil-day / historical timezone-rule seam remains a hard blocker
for concrete `effectiveInterval` bounds and must not be bypassed by DEC-0025.

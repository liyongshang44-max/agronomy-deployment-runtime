# DEC-0023 — Governed Agronomic Context Spatial-Support Classification

Status: **ACCEPTED**

Date: 2026-09-01

## Context

The first Sustainable Corn context chain now establishes several orthogonal authority
dimensions for the exact recorded operation:

```text
DEC-0013
  exact source-recorded occurrence:
    siteid = SERF
    operation = plant_corn
    date = 2011-05-03
    temporal kind = CALENDAR_DATE
    precision = DAY

DEC-0014
  plant_corn -> PLANT / CROP:CORN

DEC-0015
  siteid = SERF
  -> source-backed target identity
  -> granularity = FARM

DEC-0016
  crop.planting_date = DATE 2011-05-03

DEC-0017
  epistemicClass = ASSERTION

DEC-0018
  provenanceClass = EXTERNAL_PROVIDER

DEC-0019
  providerId = github.com/isudatateam/datateam

DEC-0020
  exact public sourceRef + exact row-level contentHash

DEC-0021
  temporalSupport.type = INTERVAL

DEC-0022
  SERF source-native timezone identity
  = IANA America/Chicago
```

DEC-0015 explicitly stopped before projecting target identity into
`ContextDatum.spatialSupport`.

That decision states that the source evidence supports FARM granularity but does not
support FIELD, PLOT, ZONE or geometry.

The Frozen Context contract defines:

```yaml
spatial_support:
  type: ...
  geometry_ref: ...
```

and the A02 implementation accepts a non-empty `spatialSupport.type` plus an
optional `geometryRef`.

However, A02 is not architecture authority and does not define a frozen enum for
`spatialSupport.type`.

Therefore ADR still lacks an authority that answers:

> for this exact `crop.planting_date` predecessor world, what spatial-support
> classification may be published without inventing geometry or finer target
> granularity?

## Why this seam is actionable now

The currently blocked temporal question is:

> whether the source-recorded date `2011-05-03` may consume the SERF
> `America/Chicago` timezone as a local civil-day frame.

Repository and public dataset audits do not currently provide sufficiently direct
source evidence to authorize that temporal-frame bridge.

DEC-0023 does not weaken that blocker.

Spatial-support classification is independent.

DEC-0015 already contains exact reviewed source evidence that:

```text
SERF
=
Southeast Research and Demonstration Farm
=
source-backed target granularity FARM
```

and DEC-0016 already establishes the exact context semantic/value:

```text
crop.planting_date
=
DATE 2011-05-03
```

The remaining spatial question can therefore be isolated without inventing temporal
authority.

## Decision

Introduce a distinct content-addressed authority:

`AgronomicRecordedOperationContextSpatialSupportClassificationCompilation`

Its narrow purpose is:

> bind the exact first Sustainable Corn context semantic/value and exact
> source-backed FARM target identity to a governed spatial-support classification
> `type = FARM`, while explicitly creating no geometry reference and no finer
> spatial identity.

For the first finite slice:

```text
context semantic/value:
  semanticId = crop.planting_date
  value:
    type = DATE
    date = 2011-05-03

source-backed target identity:
  sourceNativeSubject = siteid / SERF
  granularity = FARM

        ->

Context spatial support:
  type = FARM
```

No `geometryRef` is created.

## Meaning of `spatialSupport.type = FARM`

For DEC-0023, the accepted statement would mean only:

> the highest reviewed target granularity associated with this exact
> source-recorded planting-date context is FARM.

It does **not** mean:

> the planting date is proven to apply uniformly to every square meter of the farm.

It does not mean:

> ADR has a farm polygon.

It does not mean:

> every field or plot inside SERF shares the same planting date.

It does not mean:

> source-backed target identity and geometric support are the same authority.

The first classification is a target-granularity support classification, not a
geometric footprint claim.

## Exact co-predecessor closure

The first DEC-0023 authority must require two exact accepted co-predecessors:

1. DEC-0016
   `AgronomicRecordedOperationContextSemanticMappingCompilation`;
2. DEC-0015
   `AgronomicRecordedOperationTargetIdentityBindingCompilation`.

Both must be fully revalidated through their existing authority validators.

### DEC-0016 branch

The context-semantic branch must recover at least:

```text
semanticId = crop.planting_date

value:
  type = DATE
  date = 2011-05-03

source temporal support:
  kind = CALENDAR_DATE
  date = 2011-05-03
  precision = DAY

parent occurrence:
  siteid = SERF
  operation = plant_corn
  date = 2011-05-03
```

### DEC-0015 branch

The target-identity branch must recover:

```text
sourceNativeSubject:
  name = siteid
  value = SERF

sourceBackedTargetIdentity:
  granularity = FARM
  targetId = target_src_<content-addressed-id>

parent occurrence:
  exact DEC-0013 occurrence ref
```

## Exact cross-predecessor convergence

The two branches must converge on the same exact DEC-0013 parent occurrence
authority ref.

Conceptually:

```text
DEC-0016.parentOccurrenceCompilationRef
==
DEC-0015.parentOccurrenceCompilationRef
```

The exact source-native subject must also agree:

```text
siteid = SERF
```

Copied strings alone are insufficient.

Where authority refs exist, exact ref equality is mandatory.

Semantic values must use canonical semantic equality rather than JSON property-order
equality.

## Exact first spatial-support classification

The only accepted first-slice classification is:

```text
spatialSupport:
  type = FARM
```

The following must fail closed for the same first world:

```text
FIELD
PLOT
ZONE
POINT
POLYGON
REGION
SEASON
SITE
UNKNOWN
```

The accepted token is deliberately finite.

DEC-0023 does not create a global enum for all future ContextDatum values.

## DEC-0023 is the normative source of the first FARM support token

The Frozen Context document illustrates `spatial_support.type` but does not freeze
a normative enum.

A02 accepts any non-empty string and is explicitly non-architecture authority.

Therefore the first binding:

```text
SERF / source-backed FARM target
->
spatialSupport.type = FARM
```

is established by DEC-0023 itself for this exact finite predecessor world.

It must not be justified by saying that A02 already recognizes FARM.

## No generic FARM -> spatialSupport rule

DEC-0023 does not establish:

```text
every FARM identity
->
spatialSupport.type = FARM
```

for arbitrary providers, sources or semantics.

The first authority is finite to the exact Sustainable Corn predecessor world.

Later architecture may generalize target-granularity projection only after separate
review.

## No geometryRef

This is a mandatory boundary.

DEC-0023 must not publish:

```text
geometryRef = SERF
```

or:

```text
geometryRef = target_src_<...>
```

A source-backed target identity is not a geometry authority.

The first output contains no `geometryRef`.

## No geometry inference

DEC-0023 creates or derives none of:

- latitude;
- longitude;
- point geometry;
- farm polygon;
- field polygon;
- plot polygon;
- centroid;
- area;
- CRS;
- containment graph;
- map-link dereference;
- geometry hash;
- spatial index.

Even if upstream metadata contains map links or coordinates elsewhere, those facts
are not part of this decision.

## No FIELD / PLOT / ZONE inference

The exact DEC-0015 evidence says:

```text
Southeast Research and Demonstration Farm
```

not:

```text
field
plot
zone
```

Therefore DEC-0023 cannot refine FARM into a smaller target unit.

A site may contain multiple fields or research plots.

No child identity is inferred.

## No uniform-coverage claim

`spatialSupport.type = FARM` is not a statement that the datum is spatially uniform
across the farm.

The source occurrence is associated with the source-native FARM-level subject.

DEC-0023 does not infer within-farm spatial homogeneity.

## No targetId-as-public-spatial-support substitution

The DEC-0015 source-backed target id is material predecessor authority.

It may be retained internally in the DEC-0023 binding/review lineage.

It must not be copied into `geometryRef` or otherwise represented as geometric
content.

## Support classification does not identify the target instance

This is a mandatory architectural limitation.

The public Frozen ContextDatum shape contains:

```text
spatialSupport.type
spatialSupport.geometryRef?
```

but no non-geometric target-identity ref.

Therefore:

```text
spatialSupport.type = FARM
```

answers only:

> what reviewed target granularity is associated with this datum?

It does **not** answer:

> which exact FARM instance is the datum bound to?

DEC-0023 must preserve the exact DEC-0015 source-backed target identity in its
internal predecessor lineage and review bindings, but that identity is not silently
encoded into the public `spatialSupport` object.

A later authority is still required to bind the exact source-backed FARM identity
into the target-instance layer used by ContextManifest / TargetContext / decision
scope.

Therefore DEC-0023 must not be used as evidence that the public ContextDatum is
already spatially self-identifying or independently portable without its governed
target lineage.

## No lineage erasure at later publication

A future ContextDatum publication authority must not discard the exact DEC-0015
target-identity lineage merely because the public materialization contains only:

```text
spatial_support:
  type: FARM
```

The public field is a classification surface, not the complete target-identity
authority.

If a later ContextManifest or target-binding authority associates this datum with a
specific FARM target, that association must be content-addressed and independently
reviewable.

## No DecisionProblem targetRef projection

DEC-0023 creates no:

- `farmId`;
- `fieldId`;
- `seasonId`;
- `zoneId`;
- DecisionProblem;
- decision scope.

A later authority may project source-backed identity into decision scope.

This decision does not pre-authorize that bridge.

## No ContextDatum publication

DEC-0023 creates no ContextDatum.

The first ContextDatum remains incomplete because unresolved dimensions still include
at least:

- concrete effectiveInterval;
- availableAt;
- DATE unit representation;
- uncertainty;
- verticalSupport;
- datum_id;
- final publication authorization.

DEC-0023 creates only one governed predecessor dimension.

## No temporal authority

DEC-0023 does not decide:

- whether `2011-05-03` is an America/Chicago local civil day;
- UTC offset;
- DST state;
- TZDB version;
- local midnight;
- effectiveInterval;
- availableAt.

DEC-0021 and DEC-0022 remain separate temporal authorities.

The temporal-frame blocker remains unresolved.

## No unit authority

DEC-0023 does not decide the `unit` field for a DATE-valued ContextDatum.

## No uncertainty authority

DEC-0023 does not decide whether uncertainty is:

- NONE;
- UNKNOWN;
- interval;
- categorical;
- distribution-backed.

Source silence is not silently converted into `NONE`.

## No vertical-support authority

DEC-0023 does not decide whether `verticalSupport` is:

- null;
- not applicable;
- unknown;
- represented by a future structured value.

## No policy/runtime/execution/outcome authority

DEC-0023 creates no:

- Policy;
- DecisionProblem;
- RuntimeProfile;
- RuntimePlan;
- RuntimeEligibility;
- RuntimeBinding;
- DecisionResult;
- ExecutionReceipt;
- Outcome.

## Proposed authority shape

Conceptually:

```text
AgronomicRecordedOperationContextSpatialSupportClassification {
  contractVersion

  classificationId

  contextSemanticMappingCompilationRef
  targetIdentityBindingCompilationRef

  targetContextSemantic {
    semanticId
    value
  }

  sourceNativeSubject {
    name
    value
  }

  sourceBackedTargetIdentity {
    granularity
    targetId
  }

  spatialSupport {
    type
  }

  classificationRationale
}
```

Publication compilation should additionally bind:

- classification hash;
- spatial-support review ref;
- exact predecessor refs;
- exact shared parent occurrence ref;
- local lossless coverage;
- limitations.

Exact implementation field names remain implementation-level after architecture
acceptance.

## Reviewer authority

Publication requires an explicit:

`AgronomicRecordedOperationContextSpatialSupportClassificationReviewDecision`

or equivalent governed review authority.

The review must bind at least:

- exact DEC-0016 context-semantic predecessor ref;
- exact DEC-0015 target-identity predecessor ref;
- exact shared DEC-0013 parent occurrence ref;
- exact `crop.planting_date = DATE 2011-05-03`;
- exact `siteid = SERF`;
- exact source-backed target granularity `FARM`;
- exact source-backed target id;
- exact `spatialSupport.type = FARM`;
- explicit no-geometry and no-finer-granularity limitations.

## Proposed mandatory review checks

An accepted review should confirm at least:

1. `CONTEXT_SEMANTIC_MAPPING_AUTHORITY_VERIFIED`;
2. `TARGET_IDENTITY_BINDING_AUTHORITY_VERIFIED`;
3. `CO_PREDECESSOR_PARENT_OCCURRENCE_REF_EQUAL`;
4. `CO_PREDECESSOR_SOURCE_NATIVE_SUBJECT_EQUAL`;
5. `EXACT_CONTEXT_SEMANTIC_CROP_PLANTING_DATE`;
6. `EXACT_CONTEXT_VALUE_DATE_2011_05_03`;
7. `EXACT_SOURCE_NATIVE_SUBJECT_SERF`;
8. `EXACT_SOURCE_BACKED_TARGET_GRANULARITY_FARM`;
9. `EXACT_SOURCE_BACKED_TARGET_ID_VERIFIED`;
10. `SPATIAL_SUPPORT_TYPE_FARM_VERIFIED`;
11. `NO_GEOMETRY_REF`;
12. `NO_GEOMETRY_INFERENCE`;
13. `NO_FIELD_PLOT_ZONE_INFERENCE`;
14. `NO_UNIFORM_WITHIN_FARM_COVERAGE_INFERENCE`;
15. `NO_TARGET_ID_AS_GEOMETRY_SUBSTITUTION`;
16. `NO_GENERIC_FARM_SPATIAL_SUPPORT_RULE`;
17. `SUPPORT_TYPE_NOT_TARGET_INSTANCE_IDENTITY`;
18. `EXACT_TARGET_IDENTITY_LINEAGE_PRESERVED`;
19. `NO_CONTEXT_DATUM_PUBLICATION`;
20. `NO_DECISION_PROBLEM_TARGET_REF_PROJECTION`;
21. `NO_TEMPORAL_FRAME_OFFSET_DST_TZDB_EFFECTIVE_TIME_INFERENCE`;
22. `NO_UNIT_UNCERTAINTY_VERTICAL_SUPPORT_INFERENCE`;
23. `NO_POLICY_RUNTIME_EXECUTION_OUTCOME_INFERENCE`;
24. `NO_INVERSE_OR_COMPLETENESS_INFERENCE`.

All checks are required for accepted publication.

## Proposed review dispositions

At minimum:

- `ACCEPT_RECORDED_OPERATION_CONTEXT_SPATIAL_SUPPORT_CLASSIFICATION`;
- `REJECT_RECORDED_OPERATION_CONTEXT_SPATIAL_SUPPORT_CLASSIFICATION`.

Rejected review cannot authorize publication.

## Content addressing

Changing any material element must change semantic identity or fail closure,
including:

- DEC-0016 predecessor ref;
- DEC-0015 predecessor ref;
- shared DEC-0013 parent occurrence ref;
- semanticId;
- DATE value;
- source-native subject;
- target granularity;
- source-backed target id;
- spatialSupport.type;
- review ref;
- rationale;
- limitations.

## Local completeness

For DEC-0023:

`losslessCoverage = COMPLETE`

would mean only:

> the exact first target-granularity spatial-support classification is represented as
> `FARM` without inventing geometry or finer target identity.

It does not mean the overall ContextDatum is complete.

## First real-source Gold

The first Gold must reuse the exact accepted Sustainable Corn source artifacts and
predecessor authorities required to reproduce DEC-0015 and DEC-0016.

Positive classification:

```text
targetContextSemantic:
  semanticId = crop.planting_date
  value = DATE 2011-05-03

sourceNativeSubject:
  siteid = SERF

sourceBackedTargetIdentity:
  granularity = FARM

spatialSupport:
  type = FARM
```

The Gold must prove that:

- FIELD/PLOT/ZONE/POINT/POLYGON substitution fails;
- target identity drift fails;
- co-predecessor parent-ref divergence fails;
- copied targetId without valid DEC-0015 authority fails;
- geometryRef injection fails;
- incomplete review fails;
- unauthorized review fails;
- rejected review fails;
- no ContextDatum is published.

## Mandatory implementation acceptance cases

If DEC-0023 is accepted, implementation must prove at least:

1. exact DEC-0016 authority is mandatory;
2. exact DEC-0015 authority is independently mandatory;
3. both predecessors converge on the same exact DEC-0013 occurrence ref;
4. both predecessors converge on `siteid = SERF`;
5. exact `crop.planting_date` semantic is mandatory;
6. exact DATE `2011-05-03` is mandatory;
7. exact FARM target granularity is mandatory;
8. exact source-backed target id is replayed from DEC-0015;
9. only `spatialSupport.type = FARM` can publish in v1;
10. FIELD fails closed;
11. PLOT fails closed;
12. ZONE fails closed;
13. POINT fails closed;
14. POLYGON fails closed;
15. geometryRef injection fails closed;
16. copied/fabricated target id fails closed;
17. co-predecessor parent-ref divergence fails closed;
18. context semantic/value drift fails closed;
19. incomplete review cannot publish;
20. unauthorized reviewer cannot publish;
21. rejected review cannot publish;
22. no geometry authority is created;
23. no uniform-within-farm coverage authority is created;
24. `spatialSupport.type = FARM` does not identify the exact FARM instance;
25. exact DEC-0015 target-identity lineage remains material;
26. no DecisionProblem targetRef authority is created;
27. no temporal-frame/offset/DST/TZDB/effective-time authority is created;
28. no unit/uncertainty/vertical-support authority is created;
29. no ContextDatum/ContextManifest authority is created;
30. no Policy/runtime/execution/Outcome authority is created;
31. no inverse/global completeness rule is created.

## Proposed first implementation slice

Only after explicit architecture acceptance and accepted documentation merge may
implementation begin.

The first implementation slice should contain only:

1. spatial-support classification contract;
2. exact DEC-0016 context-semantic predecessor closure;
3. exact DEC-0015 target-identity predecessor closure;
4. exact co-predecessor convergence on one DEC-0013 occurrence;
5. exact `crop.planting_date = DATE 2011-05-03` binding;
6. exact `siteid = SERF / FARM` binding;
7. exact `spatialSupport.type = FARM`;
8. review authority;
9. content-addressed publication/validation;
10. real Sustainable Corn Gold;
11. mandatory fail-closed cases;
12. focused workflow wiring if required.

It must not contain:

- geometryRef;
- geometry;
- FIELD/PLOT/ZONE identity;
- DecisionProblem targetRef;
- local-civil date interpretation;
- UTC offset;
- DST;
- TZDB version;
- effectiveInterval;
- availableAt;
- unit;
- uncertainty;
- verticalSupport;
- ContextDatum;
- ContextManifest;
- Policy;
- runtime;
- execution;
- Outcome.

## Remaining seams after DEC-0023

Even if accepted and implemented, at least the following remain unresolved:

1. planting-date local civil-time frame;
2. UTC offset / DST / TZDB-rule basis;
3. DAY -> concrete RFC3339 effectiveInterval;
4. availableAt;
5. DATE semantic unit representation;
6. uncertainty;
7. verticalSupport null/applicability;
8. datum_id;
9. ContextDatum publication authority;
10. exact target-instance binding for ContextManifest / TargetContext;
11. ContextManifest inclusion;
12. geometry / geometryRef;
13. field/plot/zone/season identity;
14. DecisionProblem target projection;
15. planned-versus-actual reconciliation;
16. execution reconciliation;
17. Outcome linkage.

## Acceptance targets

Before this architecture may be accepted, review must confirm:

1. DEC-0015 explicitly leaves spatial-support projection to a later authority;
2. DEC-0016 supplies the exact context semantic/value branch;
3. DEC-0015 supplies the exact source-backed FARM target branch;
4. both branches converge on the same exact DEC-0013 occurrence;
5. DEC-0023 itself, not A02 implementation behavior, establishes
   `spatialSupport.type = FARM` for this finite first world;
6. FARM is a target-granularity support classification only;
7. no geometryRef is created;
8. no geometry or within-farm uniformity is inferred;
9. no FIELD/PLOT/ZONE refinement is inferred;
10. no generic FARM-to-support rule is created;
11. `spatialSupport.type = FARM` is not treated as exact target-instance identity;
12. exact DEC-0015 target lineage remains mandatory for later publication;
13. no temporal blocker is bypassed;
14. no ContextDatum/ContextManifest publication is created;
15. no DecisionProblem/Policy/runtime/execution/Outcome authority is created;
16. implementation remains additive and does not weaken accepted DEC-0013 through
    DEC-0022 boundaries.

## Post-acceptance gate

Before accepted DEC-0023 documentation may merge:

1. repository-wide ADR Constitution MUST pass on the exact accepted documentation head;
2. PR MUST remain docs-only;
3. no package/runtime/schema/workflow/acceptance mutation may be included;
4. no existing accepted contract may be changed;
5. PR base MUST remain the expected protected `main`;
6. accepted exact head MUST be recorded before merge.

Only after accepted documentation merge and post-merge Constitution success may
implementation begin.


## Architecture acceptance

**ACCEPTED — 2026-09-01.**

Explicit architecture approval was provided by the user.

The accepted boundary is the decision exactly as written above: for the exact first Sustainable Corn predecessor world, the exact DEC-0016 context semantic/value branch and exact DEC-0015 source-backed target-identity branch may jointly establish `spatialSupport.type = FARM` only after exact co-predecessor convergence on the same DEC-0013 occurrence and `siteid = SERF` subject.

This acceptance does not authorize `geometryRef`, geometry, FIELD/PLOT/ZONE refinement, target-instance identity in the public spatial-support field, within-farm uniformity, DecisionProblem target projection, local-civil-time interpretation, UTC offset, DST, TZDB version, effectiveInterval, availableAt, unit, uncertainty, verticalSupport, ContextDatum, ContextManifest, Policy, runtime, execution, Outcome, inverse mapping, or completeness claims. The exact DEC-0015 target identity remains material lineage and must not be erased by the support classification.

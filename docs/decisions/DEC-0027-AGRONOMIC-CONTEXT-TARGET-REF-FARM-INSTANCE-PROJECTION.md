# DEC-0027 — Agronomic Context TargetRef FARM Instance Projection

Status: **ACCEPTED**

Date: 2026-09-02

## Context

The frozen Agronomic Context & Public Runtime Contract v1.0 defines a target-instance
layer for both `DecisionProblem` and `ContextManifest`.

The public shape includes:

```yaml
target_ref:
  organization_id: ...
  tenant_id: ...
  farm_id: ...
  field_id: ...
  season_id: ...
  zone_id: ...
```

The executable A01 DecisionProblem contract accepts:

```text
targetRef.organizationId
targetRef.tenantId?
targetRef.farmId?
targetRef.fieldId?
targetRef.seasonId?
targetRef.zoneId?
```

A04 ContextManifest does not independently invent another target. It derives its
`targetRef` exactly from the validated DecisionProblem.

The first Sustainable Corn source-backed target identity was established by DEC-0015.

DEC-0015 proved only:

```text
source namespace = exact Sustainable Corn Source authority
siteid = SERF
granularity = FARM
        ->
sourceBackedTargetIdentity.targetId =
  target_src_<content-addressed-id>
```

The target id is derived from:

- exact source namespace authority ref;
- source-native identifier name;
- source-native identifier value;
- target granularity;
- DEC-0015 identity contract version.

DEC-0015 explicitly did not authorize copying `SERF` directly into a public
`farmId`, did not establish a global canonical farm identifier, and did not create
a DecisionProblem or ContextManifest.

DEC-0023 subsequently established, for the exact first planting-date context world:

```text
spatialSupport.type = FARM
```

while preserving the exact DEC-0015 target identity as material lineage.

DEC-0023 explicitly states that `spatialSupport.type = FARM` does not identify the
exact FARM instance and that a later target-instance / ContextManifest binding
authority remains required.

## Problem

ADR now has two distinct facts:

1. exact source-backed FARM identity:
   `target_src_<64hex>`;
2. context spatial-support class:
   `FARM`.

But the frozen target-instance layer still has no governed rule establishing which
value, if any, may occupy:

```text
targetRef.farmId
```

for this first context world.

The following shortcuts are not acceptable:

```text
farmId = "SERF"
```

because `SERF` is a source-native identifier and DEC-0015 intentionally namespaced
it into a source-backed target identity.

Likewise, the following is invalid:

```text
farmId = "Southeast Research and Demonstration Farm"
```

because a display name is not the content-addressed target identity.

And:

```text
farmId = spatialSupport.type
```

would confuse target identity with support classification.

A separate reviewed projection authority is therefore required.

## Decision

For the exact first accepted Sustainable Corn context world only, authorize:

```text
targetRef.farmId =
  exact DEC-0015 sourceBackedTargetIdentity.targetId
```

where that exact DEC-0015 identity is recovered and revalidated through the accepted
DEC-0023 context spatial-support classification predecessor.

Conceptually:

```text
DEC-0023
  crop.planting_date / DATE 2011-05-03
  source-backed target granularity = FARM
  exact source-backed targetId = target_src_<64hex>
  spatialSupport.type = FARM
        ->
TargetRef FARM component projection
  field = farmId
  value = exact target_src_<64hex>
```

The projection establishes only one target-ref component.

It does not establish a complete targetRef object.

## Exact first predecessor

The first publication requires the exact accepted
`AgronomicRecordedOperationContextSpatialSupportClassificationCompilation`
established by DEC-0023.

That predecessor must be fully revalidated through its own authority validator.

The revalidated predecessor must close exactly to:

```text
semanticId = crop.planting_date
value.type = DATE
value.date = 2011-05-03

sourceBackedTargetIdentity.granularity = FARM
sourceBackedTargetIdentity.targetId = target_src_<64hex>

spatialSupport.type = FARM
geometryRef = absent
```

The implementation must not accept a caller-provided farm id independently of the
validated predecessor.

## Why DEC-0023 is the direct predecessor

DEC-0015 is the normative source-backed target-identity authority.

DEC-0023 is the first context authority that already proves exact convergence between:

- the planting-date semantic branch;
- the exact DEC-0015 source-backed FARM target branch.

Using DEC-0023 as the direct predecessor keeps DEC-0027 finite to the exact first
context world and avoids inventing a generic rule:

```text
every DEC-0015 FARM identity -> targetRef.farmId
```

DEC-0027 must still recover and preserve the exact underlying DEC-0015 target identity
through DEC-0023 validation.

## Exact projected value

The projected value is exactly:

```text
sourceBackedTargetIdentity.targetId
```

which has the frozen DEC-0015 form:

```text
target_src_<64 lowercase hex>
```

The projection must not:

- regenerate the target id using a different contract version;
- strip the `target_src_` namespace;
- copy the source-native identifier `SERF`;
- copy a display name;
- use a Git blob hash as farmId;
- use a ContextDatum semantic hash as farmId;
- use a geometryRef as farmId.

## Why not `SERF`

`SERF` is the source-native subject:

```text
siteid = SERF
```

DEC-0015 deliberately created a source-backed identity that includes source namespace
and granularity in semantic identity.

Using raw `SERF` would erase that material provenance and would allow accidental
cross-provider identity collisions.

Therefore the first accepted projection is:

```text
farmId = target_src_<...>
```

not:

```text
farmId = SERF
```

## Why not the display name

The retained source identifies SERF as:

```text
Southeast Research and Demonstration Farm
```

The display name is evidence supporting FARM granularity and identity meaning.

It is not the target identity token.

DEC-0027 must not treat display-name equality as target-instance identity.

## No complete targetRef authority

DEC-0027 does not establish:

```text
organizationId
tenantId
fieldId
seasonId
zoneId
```

These remain separate scopes.

In particular:

- `organizationId` is deployment/customer authority;
- `tenantId` is tenancy authority;
- `fieldId` would assert a finer spatial target not established by source evidence;
- `seasonId` is not established by DEC-0015/0023;
- `zoneId` is not established.

DEC-0027 outputs only the FARM component eligible for later insertion into an already
authorized target scope.

## No DecisionProblem creation authority

DEC-0027 does not create or publish a `DecisionProblem`.

It does not establish:

- decision type;
- logical time;
- horizon;
- objective;
- action space;
- use class;
- decision authority mode;
- deadline;
- decision-problem create authorization.

A later DecisionProblem publication may consume this FARM component under its own
authority, but DEC-0027 alone cannot authorize such publication.

## No ContextManifest creation authority

DEC-0027 does not create or publish a `ContextManifest`.

A04 requires ContextManifest targetRef to derive exactly from an already validated
DecisionProblem.

DEC-0027 does not bypass that relationship.

It establishes only the FARM identity component that a separately authorized
DecisionProblem targetRef may later carry.

## No organization / tenant inference

The Sustainable Corn source does not establish an ADR deployment organization or
tenant.

The implementation must not infer:

```text
organizationId = Iowa State University
```

or any other ADR principal/scope identity from source identity evidence.

Source institution identity and ADR deployment authorization are different authority
domains.

## No finer target inference

DEC-0027 must not publish:

```text
fieldId
plotId
zoneId
seasonId
```

from the FARM-level target identity.

The source site may contain many fields or plots.

DEC-0015 and DEC-0023 explicitly stop at FARM granularity.

## No geometry authority

DEC-0027 does not establish:

- farm polygon;
- point geometry;
- centroid;
- CRS;
- area;
- containment;
- geometry hash;
- geometryRef.

The target id must not be copied into `geometryRef`.

Target identity and geometry remain separate authority classes.

## No spatial-support mutation

DEC-0023 remains the authority for:

```text
spatialSupport.type = FARM
```

DEC-0027 does not alter that value.

It only projects the exact target instance into the target-ref identity layer.

## No within-farm uniformity claim

Binding a Context/Decision target to one FARM instance does not assert that the
planting-date fact is spatially uniform across every location inside that farm.

The first context still has only FARM-level support classification.

## No cross-provider canonical identity

The projected farmId remains source-backed.

It does not assert that:

- John Deere farm object X;
- a GEOX farm;
- an FMIS farm;
- a KBS site;
- any other provider farm

is the same entity.

Cross-provider reconciliation requires separate authority.

## No inverse/write-back authority

DEC-0027 must not authorize:

```text
targetRef.farmId -> source siteid
```

for outbound writes or source mutation.

The projection is one-way authority for ADR target-reference construction only.

## No ContextDatum publication authority

DEC-0027 does not create or publish ContextDatum.

It does not fill:

- effectiveInterval;
- availableAt;
- unit;
- uncertainty;
- verticalSupport;
- source;
- epistemicClass;
- provenanceClass.

Existing field-level authorities remain independent.

## No temporal authority

DEC-0027 does not resolve:

- local civil-day interpretation;
- historical UTC offset;
- DST state;
- TZDB basis/version;
- effectiveInterval start/end;
- availableAt.

## Authority shape

Introduce a content-addressed authority:

`AgronomicContextTargetRefFarmInstanceProjectionCompilation`

Conceptually:

```text
AgronomicContextTargetRefFarmInstanceProjectionCompilation {
  contractVersion

  projectionId

  parentContextSpatialSupportClassificationCompilationRef

  targetContextSemantic {
    semanticId
    value
  }

  sourceBackedTargetIdentity {
    namespaceRef
    granularity = FARM
    targetId = target_src_<64hex>
  }

  targetRefProjection {
    field = farmId
    value = exact sourceBackedTargetIdentity.targetId
  }

  rationale
  semanticReviewRef
  compilationHash
  limitations
}
```

Exact implementation field names remain implementation-level after architecture
acceptance.

## Reviewer authority

Publication requires an explicit:

`AgronomicContextTargetRefFarmInstanceProjectionReviewDecision`

or equivalent governed review authority.

The review must bind the exact:

- DEC-0023 predecessor ref;
- target semantic/value;
- underlying DEC-0015 source-backed target identity;
- FARM granularity;
- exact targetId;
- targetRef field name `farmId`;
- projected farmId value.

## Mandatory review checks

An accepted review should confirm at least:

1. `PARENT_CONTEXT_SPATIAL_SUPPORT_AUTHORITY_VERIFIED`;
2. `UNDERLYING_TARGET_IDENTITY_AUTHORITY_VERIFIED`;
3. `EXACT_TARGET_CONTEXT_SEMANTIC_VERIFIED`;
4. `EXACT_SOURCE_BACKED_TARGET_GRANULARITY_FARM`;
5. `EXACT_SOURCE_BACKED_TARGET_ID_VERIFIED`;
6. `TARGET_REF_FIELD_FARM_ID_VERIFIED`;
7. `PROJECTED_VALUE_EQUALS_EXACT_TARGET_ID`;
8. `NO_RAW_SERF_IDENTIFIER_SUBSTITUTION`;
9. `NO_DISPLAY_NAME_SUBSTITUTION`;
10. `NO_GLOBAL_CANONICAL_TARGET_CLAIM`;
11. `NO_ORGANIZATION_OR_TENANT_INFERENCE`;
12. `NO_FIELD_SEASON_OR_ZONE_INFERENCE`;
13. `NO_GEOMETRY_OR_GEOMETRY_REF_INFERENCE`;
14. `NO_TARGET_ID_AS_GEOMETRY_SUBSTITUTION`;
15. `NO_SPATIAL_SUPPORT_MUTATION`;
16. `NO_WITHIN_FARM_UNIFORMITY_INFERENCE`;
17. `NO_DECISION_PROBLEM_PUBLICATION`;
18. `NO_CONTEXT_MANIFEST_PUBLICATION`;
19. `NO_CONTEXT_DATUM_PUBLICATION`;
20. `NO_INVERSE_OR_WRITE_BACK_AUTHORITY`;
21. `NO_TEMPORAL_OR_AVAILABLE_AT_INFERENCE`;
22. `NO_CROSS_PROVIDER_IDENTITY_EQUIVALENCE`;
23. `NO_POLICY_RUNTIME_EXECUTION_OR_OUTCOME_INFERENCE`.

All mandatory checks are required for accepted publication.

## Review dispositions

At minimum:

- `ACCEPT_CONTEXT_TARGET_REF_FARM_INSTANCE_PROJECTION`;
- `REJECT_CONTEXT_TARGET_REF_FARM_INSTANCE_PROJECTION`.

Rejected review cannot authorize publication.

## Content addressing

Changing any material authority element must change semantic identity or fail review
closure, including:

- DEC-0023 predecessor ref;
- target semantic/value;
- source namespace ref;
- source-backed target granularity;
- source-backed target id;
- targetRef field;
- projected value;
- rationale;
- semantic review decision.

## First Gold

The first Gold should replay the exact accepted Sustainable Corn DEC-0023 predecessor
world and prove only:

```text
crop.planting_date
DATE 2011-05-03

source-backed target:
  granularity = FARM
  targetId = target_src_<exact>

spatialSupport.type = FARM

        ->

targetRef FARM component:
  farmId = same exact target_src_<exact>
```

The Gold must fail closed for at least:

- wrong predecessor authority;
- predecessor ref drift;
- wrong semantic ID/value;
- non-FARM target granularity;
- targetId drift;
- caller-supplied arbitrary farmId;
- raw `SERF` substitution;
- display-name substitution;
- wrong targetRef field;
- fieldId/seasonId/zoneId injection;
- organizationId/tenantId inference;
- geometryRef injection;
- targetId-as-geometry substitution;
- generic FARM-to-farmId inference;
- cross-provider equivalence claim;
- incomplete review;
- unauthorized reviewer;
- rejected review;
- review/publication mismatch.

## Consequences

Positive:

- closes the exact FARM target-instance identity seam left open by DEC-0023;
- preserves source namespace in target identity;
- gives later A01/A04 authority a governed FARM component instead of raw caller text;
- keeps target identity distinct from geometry and spatial-support classification;
- does not invent deployment scope or finer target levels;
- remains content-addressed and fail-closed.

Costs:

- the projected FARM id is source-backed, not globally canonical;
- organization/tenant scope remains separately required;
- a complete DecisionProblem targetRef is still not established;
- ContextManifest cannot be created from DEC-0027 alone;
- later cross-provider reconciliation may require a successor identity layer.

## Remaining blockers after acceptance

Even if DEC-0027 is accepted and implemented, the first planting-date ContextDatum /
target-world path still has independent unresolved seams.

For bare ContextDatum publication:

- effectiveInterval timestamp authority;
- availableAt authority;
- publication/assembly authority using the accepted field-level predecessors;
- chosen opaque logicalId/version and scoped CONTEXT_WRITE authorization at
  publication time.

For target-world use:

- deployment organization/tenant scope;
- an authorized DecisionProblem targetRef consuming the FARM component;
- ContextManifest inclusion.

The temporal blocker remains hard:

```text
2011-05-03 + America/Chicago
```

is still insufficient to produce RFC3339 interval bounds without a separately
accepted local-civil-time interpretation and historical timezone-rule basis.

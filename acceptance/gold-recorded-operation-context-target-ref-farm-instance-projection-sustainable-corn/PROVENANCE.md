# DEC-0027 Sustainable Corn TargetRef FARM Instance Projection Gold Provenance

Status: **PUBLIC REAL-SOURCE CUMULATIVE GOLD**

This Gold replays the exact already accepted Sustainable Corn source world through
DEC-0023 and adds only the DEC-0027 target-ref FARM instance projection authority.

## Exact predecessor world

The cumulative predecessor closes through:

```text
DEC-0013
  siteid = SERF
  operation = plant_corn
  date = 2011-05-03
  precision = DAY

DEC-0015
  siteid = SERF
  -> source-backed target identity
  -> granularity = FARM
  -> targetId = target_src_<64hex>

DEC-0016
  crop.planting_date = DATE 2011-05-03

DEC-0023
  exact DEC-0015 target lineage
  + exact DEC-0016 semantic/value
  -> spatialSupport.type = FARM
```

No new external source fact is introduced by DEC-0027.

DEC-0027 revalidates the exact
`AgronomicRecordedOperationContextSpatialSupportClassificationCompilation`
predecessor. That validator in turn revalidates the exact DEC-0015 target-identity
authority and its retained public source evidence.

## Accepted projection

The first accepted projection is exactly:

```text
targetContextSemantic:
  semanticId = crop.planting_date
  value.type = DATE
  value.date = 2011-05-03

sourceBackedTargetIdentity:
  namespaceRef = exact DEC-0015 Source authority
  granularity = FARM
  targetId = exact target_src_<64hex>

        ->

targetRefProjection:
  field = farmId
  value = same exact target_src_<64hex>
```

The projected farm id is the exact source-backed target identity already established
by DEC-0015.

## Why not raw SERF

`SERF` is the source-native identifier:

```text
siteid = SERF
```

It is not the public targetRef farm identity token.

DEC-0015 deliberately content-addresses the source namespace, identifier,
granularity and identity contract version into:

```text
target_src_<64hex>
```

The Gold rejects:

```text
targetRef.farmId = SERF
```

because that would erase source namespace and permit accidental cross-provider
identity collisions.

## Why not the display name

The retained identity evidence identifies SERF as:

```text
Southeast Research and Demonstration Farm
```

That display name supports target-identity meaning and FARM granularity.

It is not the target identity token.

The Gold rejects the display name as `farmId`.

## Only one targetRef component

DEC-0027 does not establish a complete targetRef.

It establishes only:

```text
farmId = exact target_src_<64hex>
```

It does not establish:

- organizationId;
- tenantId;
- fieldId;
- seasonId;
- zoneId.

Organization/tenant are deployment authorization scope, not source identity.

FIELD/SEASON/ZONE would assert unsupported finer or different target semantics.

## No geometry authority

The exact target id is not geometry.

The Gold creates no:

- geometryRef;
- point;
- polygon;
- centroid;
- area;
- CRS;
- containment relation;
- geometry hash.

It explicitly rejects targetId-as-geometry substitution.

## No DecisionProblem or ContextManifest publication

The Gold does not publish a DecisionProblem.

It therefore does not authorize decision type, logical time, horizon, objective,
action space, use class, authority mode or deadline.

The Gold also does not publish ContextManifest.

A04 remains unchanged: ContextManifest targetRef must derive exactly from an already
validated DecisionProblem.

DEC-0027 only establishes an eligible FARM target-ref component for later governed
consumption.

## No ContextDatum publication

DEC-0027 does not create ContextDatum and does not fill any unresolved ContextDatum
time field.

It creates no authority for:

- effectiveInterval;
- availableAt;
- local civil-day interpretation;
- historical UTC offset;
- DST;
- TZDB version.

## No cross-provider canonical identity

The target id remains source-backed.

The Gold does not assert equivalence with any John Deere, GEOX, FMIS, KBS or other
provider target object.

## No inverse/write-back

The Gold does not authorize:

```text
targetRef.farmId -> source siteid
```

for source mutation or outbound provider writes.

## Negative acceptance

The Gold fails closed for at least:

- wrong predecessor authority kind;
- predecessor ref drift;
- target semantic/value drift;
- non-FARM target granularity;
- targetId drift;
- raw `SERF` as farmId;
- display name as farmId;
- arbitrary farmId;
- wrong targetRef field;
- organization/tenant/field/season/zone widening;
- geometry/geometryRef widening;
- cross-provider equivalence claims;
- incomplete review;
- unauthorized reviewer;
- rejected review;
- review/publication mismatch.

Passing this Gold means only that the exact DEC-0023 Sustainable Corn planting-date
context world may project its exact DEC-0015 source-backed FARM target identity into:

```text
targetRef.farmId = exact target_src_<64hex>
```

under explicit reviewed authority.

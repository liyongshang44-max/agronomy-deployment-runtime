# DEC-0023 Sustainable Corn Spatial-Support Classification Gold Provenance

This Gold is a public real-source cumulative acceptance fixture for the first
`AgronomicRecordedOperationContextSpatialSupportClassificationCompilation`.

## Exact predecessor world

The Gold replays the already accepted Sustainable Corn source world and requires two
independent exact predecessors:

```text
DEC-0016
  crop.planting_date = DATE 2011-05-03
  -> exact DEC-0013 occurrence

DEC-0015
  siteid = SERF
  -> source-backed FARM identity
  -> exact same DEC-0013 occurrence
```

DEC-0023 publication succeeds only when both branches converge on the same exact
DEC-0013 authority ref and the same exact source-native subject:

```text
siteid = SERF
```

The exact DEC-0015 source-backed target id is replayed and retained in DEC-0023
lineage.

## Source evidence

No new external source fact is introduced by DEC-0023.

The Gold reuses the content-addressed artifacts already retained by the accepted
predecessor Golds:

- exact Sustainable Corn operations notebook / DEC-0013 occurrence evidence;
- exact `mantable.py` operation-semantic evidence used by DEC-0014/DEC-0016;
- exact `sites.html` identity evidence used by DEC-0015;
- cumulative accepted DEC-0022 timezone evidence remains replayable in this fixture,
  but DEC-0023 does not depend on timezone identity to establish spatial support.

The new authority is a governed projection over already qualified predecessor facts,
not a new data-source extraction.

## Accepted Gold meaning

The DEC-0023 positive classification is only:

```text
targetContextSemantic:
  semanticId = crop.planting_date
  value:
    type = DATE
    date = 2011-05-03

sourceNativeSubject:
  name = siteid
  value = SERF

sourceBackedTargetIdentity:
  granularity = FARM
  targetId = exact DEC-0015 target id

spatialSupport:
  type = FARM
```

The meaning is:

> the highest reviewed source-backed target granularity associated with this exact
> planting-date context is FARM.

## Target identity remains lineage

`spatialSupport.type = FARM` does not identify which exact farm instance is meant.

The exact DEC-0015 target id remains material authority lineage but is not inserted
into `geometryRef` and is not represented as geometry.

A later target-instance / ContextManifest binding remains required.

## Explicit nonclaims

This Gold does not establish:

- `geometryRef`;
- point, polygon, centroid, area, CRS or containment geometry;
- FIELD;
- PLOT;
- ZONE;
- within-farm spatial homogeneity;
- a generic FARM-to-spatial-support rule;
- ContextDatum;
- ContextManifest;
- DecisionProblem targetRef;
- local-civil interpretation of `2011-05-03`;
- UTC offset;
- DST state;
- TZDB version;
- effectiveInterval;
- availableAt;
- unit;
- uncertainty;
- verticalSupport;
- Policy;
- runtime;
- execution;
- Outcome.

## Negative acceptance

The Gold fails closed for at least:

- FIELD/PLOT/ZONE/POINT/POLYGON/REGION/SEASON/SITE/UNKNOWN support substitution;
- `geometryRef` injection;
- fabricated/copied target id not backed by exact DEC-0015;
- context semantic/value drift;
- incomplete review;
- unauthorized reviewer;
- rejected review;
- exact co-predecessor parent-ref divergence.

Passing this Gold means only that the exact first Sustainable Corn
`crop.planting_date` context may carry governed spatial support classification
`type = FARM`, while exact target identity remains separately governed lineage.

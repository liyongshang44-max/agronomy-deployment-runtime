# Sustainable Corn Recorded-Operation Context Epistemic Classification Gold — Provenance

Status: **PUBLIC REAL-SOURCE GOLD**

This Gold reuses the exact retained real-source authority chain already established by DEC-0013, DEC-0014 and DEC-0016.

## Accepted predecessor world

Parent occurrence:

```text
siteid = SERF
sourceOperationCode = plant_corn
date = 2011-05-03
precision = DAY
recordSemanticRole = ACTUAL_FIELD_OPERATION_RECORD
occurrenceClass = SOURCE_RECORDED_OPERATION_OCCURRENCE
```

Operation semantic normalization:

```text
plant_corn -> PLANT / CROP:CORN
```

Context semantic/value mapping:

```text
crop.planting_date
DATE 2011-05-03
```

The underlying real-source artifacts remain the exact retained Sustainable Corn notebook and `mantable.py` evidence used by the accepted predecessor Golds.

## DEC-0017 classification

The Frozen Context Contract distinguishes epistemic status from provenance channel.

For the accepted predecessor chain, ADR has authority that an external source records the planting occurrence, but it has no accepted direct planter telemetry, direct-measurement semantics, sensor event, or independent execution-verification authority.

Therefore the first DEC-0017 Gold publishes only:

```text
epistemicClass = ASSERTION
```

This is an authority classification, not a confidence score and not a statement that the source is unreliable.

## Why not OBSERVATION

The Frozen Context Contract gives direct measurement/sensing/counting/event recording with observation semantics as OBSERVATION examples, including planter telemetry.

No such direct-observation channel is established by the current predecessor chain.

The exact same predecessor world must therefore fail closed if a caller attempts:

```text
epistemicClass = OBSERVATION
```

## Explicit non-claims

This Gold does not establish or publish:

- ProvenanceClass;
- ContextDatum or ContextManifest;
- direct telemetry or direct measurement authority;
- independent execution verification;
- effectiveInterval or availableAt;
- timezone, UTC offset or DST semantics;
- target/spatial projection or geometry;
- unit or uncertainty;
- temporalSupport projection;
- ContextDatum source wire projection;
- DecisionProblem;
- Policy or runtime legality;
- ExecutionReceipt;
- Outcome;
- inverse classification;
- classification completeness beyond the exact first source world.

A future source with accepted direct telemetry/measurement authority may legitimately receive a different epistemic classification under a separate reviewed authority.

# DEC-0028 Sustainable Corn Source-Acquisition Availability Projection Gold Provenance

Status: **PUBLIC REAL-SOURCE CUMULATIVE GOLD**

This Gold replays the exact accepted Sustainable Corn source-reference/hash world
through DEC-0020 and adds only the DEC-0028 availability projection authority.

## Exact predecessor world

The cumulative predecessor closes through:

```text
DEC-0013
  siteid = SERF
  operation = plant_corn
  date = 2011-05-03
  precision = DAY
  exact retained SourceArtifact

DEC-0016
  crop.planting_date = DATE 2011-05-03

DEC-0019
  providerId = github.com/isudatateam/datateam

DEC-0020
  exact valueSource.sourceRef
  exact valueSource.sourceArtifactRef
  exact valueSource.sourceArtifactContentHash
  exact public sourceRef
  exact row evidence contentHash
```

No new external source fact is introduced by DEC-0028.

DEC-0028 revalidates the exact
`AgronomicRecordedOperationContextSourceReferenceHashProjectionCompilation`.
That validator closes back through the exact occurrence authority and retained
value-bearing SourceArtifact.

## Exact value-source artifact acquisition

The exact retained operations-notebook SourceArtifact has:

```text
acquisition.method =
  REPOSITORY_RETAINED_PUBLIC_GOLD

acquisition.acquiredAt =
  2026-08-30T13:00:00.000Z
```

This timestamp is already semantic payload of the exact SourceArtifact authority.

It is not introduced by DEC-0028 Gold as a free-form timestamp.

## Accepted projection

The first accepted projection is exactly:

```text
targetContextSemantic:
  semanticId = crop.planting_date
  value.type = DATE
  value.date = 2011-05-03

valueSource:
  sourceRef = exact DEC-0020 Source ref
  sourceArtifactRef = exact DEC-0020 SourceArtifact ref
  sourceArtifactContentHash = exact retained artifact hash

sourceArtifactAcquisition:
  method = REPOSITORY_RETAINED_PUBLIC_GOLD
  acquiredAt = 2026-08-30T13:00:00.000Z

        ->

availableAtProjection:
  basis = VALUE_SOURCE_ARTIFACT_ACQUISITION
  availableAt = 2026-08-30T13:00:00.000Z
```

## Meaning

The projected timestamp means:

> this exact ADR authority world has the value-bearing retained evidence no later
> than the exact SourceArtifact acquisition timestamp.

It is an ADR evidence-availability boundary.

It is intentionally conservative.

## Not the planting/event date

`2011-05-03` remains the accepted planting-date value.

It is not evidence availability.

The Gold rejects attempts to use a timestamp constructed from the planting date as
`availableAt`.

## Not upstream first publication

The Gold makes no claim that:

```text
2026-08-30T13:00:00.000Z
```

was the first moment the upstream source or fact existed or was public.

The upstream material may have existed earlier.

No historical first-publication authority is created.

## Not Git time

The exact Git blob is material source identity.

Git author/committer time is not used as ContextDatum availability.

No repository-history timestamp authority is created.

## Not review/publication/current time

The Gold does not use:

- semantic review time;
- DEC acceptance time;
- PR time;
- merge time;
- CI time;
- current wall clock

as datum availability.

These are governance/execution timestamps, not the exact value-source acquisition
authority.

## No max-dependency rule

The exact context semantic interpretation uses additional source artifacts.

DEC-0028 does not compute:

```text
max(all predecessor artifact acquisition times)
```

The first mapping is explicitly finite to the value-bearing artifact selected by
DEC-0020.

A future composite dependency-availability authority would require a separate DEC.

## No generic SourceArtifact mapping

Passing this Gold does not establish:

```text
every ContextDatum.availableAt =
  every SourceArtifact.acquisition.acquiredAt
```

Other source/runtime forms can have different availability semantics.

## No effectiveInterval authority

The Gold creates no concrete `effectiveInterval`.

It does not infer:

- local civil-day meaning;
- historical UTC offset;
- DST;
- TZDB version;
- interval bounds.

The source-native timezone identity from DEC-0022 remains independent.

## No ContextDatum publication

The Gold does not publish ContextDatum, ContextManifest or DecisionProblem.

It establishes only the exact availability field authority eligible for later
assembly.

## Negative acceptance

The Gold fails closed for at least:

- wrong predecessor kind;
- predecessor ref drift;
- target semantic/value drift;
- valueSource Source ref drift;
- valueSource SourceArtifact ref drift;
- SourceArtifact content-hash drift;
- planting-date-as-availability substitution;
- Git-time substitution;
- review/current-time substitution;
- arbitrary availableAt;
- upstream-publication basis substitution;
- effectiveInterval/timezone widening;
- incomplete review;
- unauthorized reviewer;
- rejected review;
- review/publication mismatch.

Passing this Gold means only that the exact DEC-0020 Sustainable Corn value-source
artifact may contribute:

```text
availableAt =
  exact SourceArtifact.acquisition.acquiredAt
```

under explicit reviewed DEC-0028 authority.

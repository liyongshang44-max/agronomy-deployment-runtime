# DEC-0021 Sustainable Corn Temporal-Support Classification Gold Provenance

This Gold is a public real-source acceptance fixture for the first
`AgronomicRecordedOperationContextTemporalSupportClassificationCompilation`.

## Exact predecessor chain

The Gold reuses and revalidates the exact accepted Sustainable Corn authority chain:

```text
DEC-0013 recorded occurrence
  siteid = SERF
  operation = plant_corn
  date = 2011-05-03
  temporal kind = CALENDAR_DATE
  precision = DAY

DEC-0014 semantic normalization
  plant_corn -> PLANT / CROP:CORN

DEC-0015 source-backed target identity
  SERF -> FARM

DEC-0016 target Context semantic/value
  crop.planting_date = DATE 2011-05-03

DEC-0017
  epistemicClass = ASSERTION

DEC-0018
  provenanceClass = EXTERNAL_PROVIDER

DEC-0019
  providerId = github.com/isudatateam/datateam

DEC-0020
  exact public sourceRef + exact row-level contentHash
```

DEC-0021 does not bypass or copy those semantics. Its authority validator revalidates
the exact DEC-0020 compilation and follows that authority back to the exact DEC-0013
parent occurrence.

## Original value-bearing source

- upstream repository: `isudatateam/datateam`
- path: `scripts/cscap/chicago.ipynb`
- exact Git blob: `4847e7b3b4aad42193de3f5f0da6f81f6b62dc50`
- retained SourceArtifact content hash:
  `sha256:ac468265be5d527403de90262a92157cd098cf18483e9ac0f1227b8e797efdce`
- exact occurrence evidence hash:
  `sha256:d27e8539ed45115419093d563cf44f0f364568efb4633781ea8120aaa2bb819f`
- locator scheme: `JUPYTER_OUTPUT_TABLE_ROW_V1`
- cellIndex: `3`
- outputIndex: `0`
- mimeType: `text/plain`
- headerLineIndex: `0`
- rowIndex: `33`

The exact retained row establishes:

```text
siteid = SERF
operation = plant_corn
date = 2011-05-03
```

The accepted DEC-0013 occurrence preserves the source temporal support as:

```text
kind = CALENDAR_DATE
date = 2011-05-03
precision = DAY
```

## Accepted Gold meaning

The first DEC-0021 Gold supports only:

```text
CALENDAR_DATE / 2011-05-03 / precision = DAY
        ->
Context temporalSupport.type = INTERVAL
```

`INTERVAL` here is a support classification only. It means the source evidence
does not establish an exact instantaneous clock reading.

It does not construct timestamp bounds.

## Explicit nonclaims

The Gold does not establish:

- `effectiveInterval.start`;
- `effectiveInterval.end`;
- `America/Chicago` or any other timezone;
- UTC offset;
- DST interpretation;
- `availableAt`;
- DATE-to-TIMESTAMP conversion;
- DATE unit representation;
- uncertainty;
- spatialSupport;
- geometry;
- verticalSupport;
- ContextDatum;
- ContextManifest;
- DecisionProblem;
- Policy;
- runtime;
- execution;
- Outcome;
- a generic rule that every `precision = DAY` maps to `INTERVAL`.

The source repository does contain separate source-native timezone behavior for SERF,
but that evidence is deliberately not consumed by DEC-0021. Any timezone authority is
a later, independently reviewed seam.

## Negative acceptance

The Gold fails closed for at least:

- temporal kind drift;
- source date drift;
- source precision drift;
- target temporal-support type other than `INTERVAL`;
- attempted timezone/effectiveInterval/availableAt contract widening;
- incomplete review;
- unauthorized reviewer;
- rejected review.

Passing this Gold means only that the exact first Sustainable Corn DAY-precision
predecessor world has an explicitly governed Context temporal-support class without
inventing downstream timestamp semantics.

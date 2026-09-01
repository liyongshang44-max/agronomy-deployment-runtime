# DEC-0026 Sustainable Corn Uncertainty Unknown Representation Gold Provenance

Status: **PUBLIC REAL-SOURCE CUMULATIVE GOLD**

This Gold replays the exact already accepted Sustainable Corn source world through
DEC-0016 and adds only the DEC-0026 uncertainty representation authority.

## Exact predecessor world

The retained public source chain remains:

```text
siteid = SERF
operation = plant_corn
date = 2011-05-03
precision = DAY
  ->
PLANT / CROP:CORN
  ->
crop.planting_date
DATE 2011-05-03
```

DEC-0026 revalidates the exact
`AgronomicRecordedOperationContextSemanticMappingCompilation` predecessor and its
accepted source-inspection world.

No new external source or source fact is introduced.

## Accepted representation

The first accepted mapping is exactly:

```text
semanticId = crop.planting_date
value.type = DATE
value.date = 2011-05-03
  ->
uncertainty.type = UNKNOWN
uncertainty.reasonCode =
  ACCEPTED_EVIDENCE_UNCERTAINTY_NOT_ESTABLISHED
```

The date value remains known.

Only the uncertainty characterization is unknown.

The reason means that the current accepted evidence/authority chain does not
establish a supported uncertainty characterization eligible for `NONE`,
`INTERVAL`, `CATEGORICAL_SET` or `DISTRIBUTION_REFERENCE`.

## Why not NONE

A single precise source date does not establish that uncertainty is absent.

The Gold rejects:

```text
uncertainty.type = NONE
```

because that would make a stronger positive assertion than the accepted evidence
supports.

## Why not an interval

DAY precision is not uncertainty authority.

The Gold does not manufacture:

- plus/minus day bounds;
- adjacent calendar dates;
- probability intervals;
- timestamp windows;
- agronomic tolerance intervals.

## Why not a categorical set

The accepted source evidence does not establish multiple candidate planting dates or
a finite alternative set.

## Why not a distribution reference

The accepted evidence does not establish a distribution provider, statistical
artifact, model distribution or immutable distribution reference.

## Value is not UNKNOWN

The accepted value remains:

```text
DATE 2011-05-03
```

The Gold rejects replacing it with a value-level `UNKNOWN`.

Uncertainty characterization and value identity are independent semantic axes.

## No source-global negative claim

This Gold does not assert:

```text
SOURCE_UNCERTAINTY_NOT_REPORTED
```

for the entire Sustainable Corn dataset/provider.

The retained accepted evidence is narrower: it establishes the planting-date value
without establishing an uncertainty characterization.

A future preferred workbook row or other accepted source artifact may carry
additional information without retroactively changing this historical authority.

## No generic inference

DEC-0026 does not establish either:

```text
DATE -> uncertainty UNKNOWN
```

or:

```text
ASSERTION -> uncertainty UNKNOWN
```

The mapping is finite to the exact revalidated DEC-0016 planting-date world.

## Explicit nonclaims

DEC-0026 does not create or infer:

- ContextDatum;
- ContextManifest;
- AuthorizedContextReference;
- ResolvedContextDatumReceipt;
- effectiveInterval;
- availableAt;
- local civil-day bounds;
- historical UTC offset;
- DST state;
- TZDB basis/version;
- spatialSupport mutation;
- verticalSupport mutation;
- geometryRef;
- public target-instance binding;
- unit mutation;
- epistemicClass mutation;
- provenanceClass mutation;
- source lineage mutation;
- Policy;
- runtime;
- execution;
- Outcome.

## Negative acceptance

The Gold fails closed for at least:

- wrong predecessor authority kind;
- predecessor ref drift;
- wrong semantic ID;
- wrong value type;
- wrong DATE value;
- `uncertainty.type = NONE`;
- fabricated numeric interval;
- fabricated categorical set;
- fabricated distribution reference;
- wrong reasonCode;
- empty/null/omitted reasonCode;
- value-level UNKNOWN substitution;
- generic DATE inference;
- generic ASSERTION inference;
- source-global NOT_REPORTED substitution;
- incomplete review;
- unauthorized reviewer;
- rejected review;
- review/publication mismatch.

Passing this Gold means only that the exact accepted Sustainable Corn
`crop.planting_date / DATE 2011-05-03` predecessor world carries the fail-closed
uncertainty representation:

```text
UNKNOWN / ACCEPTED_EVIDENCE_UNCERTAINTY_NOT_ESTABLISHED
```

under explicit reviewed authority.

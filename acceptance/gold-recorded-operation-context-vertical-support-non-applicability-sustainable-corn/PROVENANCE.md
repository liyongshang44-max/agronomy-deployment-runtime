# DEC-0025 Sustainable Corn Vertical-Support Non-Applicability Gold Provenance

Status: **PUBLIC REAL-SOURCE CUMULATIVE GOLD**

This Gold replays the exact already accepted Sustainable Corn source world through
DEC-0016 and adds only the DEC-0025 vertical-support non-applicability authority.

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

DEC-0025 revalidates the exact
`AgronomicRecordedOperationContextSemanticMappingCompilation` predecessor.

No new external source or source fact is introduced.

## Accepted representation

The first accepted mapping is exactly:

```text
semanticId = crop.planting_date
value.type = DATE
value.date = 2011-05-03
  ->
verticalSupportRepresentation.kind = NOT_APPLICABLE
verticalSupportRepresentation.wireValue = null
```

The governance object is not inserted into ContextDatum. Its accepted frozen
ContextDatum wire meaning is only:

```text
verticalSupport = null
```

meaning no physical vertical support interval applies to this exact planting-date
semantic/value.

## Not a depth fact

The Gold rejects:

```text
{ fromMm: 0, toMm: 0 }
```

and arbitrary non-zero depth ranges.

Those would assert physical vertical coordinates/support. The predecessor establishes
no planting depth, seed placement depth, soil depth, root-zone depth, sensor depth,
sampling depth or profile interval.

## Not missing data

The accepted null must not encode:

- not reported;
- unknown;
- unavailable;
- parsing failure;
- unsupported depth units;
- unresolved vertical support;
- missing sensor metadata.

Those are different semantic states.

## No type-only rule

The Gold rejects another DATE semantic such as `crop.emergence_date`.

DEC-0025 does not establish:

```text
if value.type == DATE:
  verticalSupport = null
```

## Explicit nonclaims

DEC-0025 does not create or infer:

- ContextDatum;
- ContextManifest;
- AuthorizedContextReference;
- ResolvedContextDatumReceipt;
- uncertainty;
- effectiveInterval;
- availableAt;
- timezone offset/DST/TZDB;
- horizontal spatialSupport mutation;
- geometryRef;
- public target-instance binding;
- unit mutation;
- epistemic/provenance/source mutation;
- Policy;
- runtime;
- execution;
- Outcome.

## Negative acceptance

The Gold fails closed for at least:

- wrong predecessor authority kind;
- predecessor ref drift;
- wrong semantic id;
- wrong value type;
- wrong DATE value;
- zero-depth substitution;
- arbitrary depth interval;
- omitted vertical-support representation;
- generic DATE type-only inference;
- missing/not-reported substitution;
- incomplete review;
- unauthorized reviewer;
- rejected review;
- review/publication mismatch.

Passing this Gold means only that the exact accepted Sustainable Corn
`crop.planting_date / DATE 2011-05-03` predecessor world may carry explicit
vertical-support non-applicability with frozen wire value `null`.

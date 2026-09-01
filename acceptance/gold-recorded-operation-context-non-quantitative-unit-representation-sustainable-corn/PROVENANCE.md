# DEC-0024 Sustainable Corn Non-Quantitative Unit Representation Gold Provenance

Status: **PUBLIC REAL-SOURCE CUMULATIVE GOLD**

This Gold replays the exact already accepted Sustainable Corn source world through
DEC-0016 and adds only the DEC-0024 unit-representation authority.

## Exact predecessor world

The retained public source chain is unchanged:

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

The DEC-0024 authority must revalidate the exact
`AgronomicRecordedOperationContextSemanticMappingCompilation` predecessor.

No new external data source or new source fact is introduced by DEC-0024.

## Accepted unit representation

The first accepted mapping is exactly:

```text
semanticId = crop.planting_date
value.type = DATE
value.date = 2011-05-03
  ->
unitRepresentation.kind = NOT_APPLICABLE
unitRepresentation.wireValue = NOT_APPLICABLE
```

The meaning is narrow:

> this accepted typed semantic value is intentionally non-quantitative, therefore
> no measurement unit applies.

## Why this is not `day`

`2011-05-03` is a calendar date value. It is not a duration magnitude measured in
days. The Gold therefore rejects `day`.

## Why this is not `unitless`

A unitless or dimensionless quantitative value is a different semantic category from
a non-quantitative value for which a measurement unit does not apply. The Gold
therefore rejects `unitless`.

## No type-only rule

The Gold explicitly rejects another DATE-valued semantic such as
`crop.emergence_date`.

DEC-0024 does not establish:

```text
if value.type == DATE:
  unit = NOT_APPLICABLE
```

The authority is finite to the reviewed semantic/value family.

## No missing-data substitution

`NOT_APPLICABLE` cannot encode:

- unknown unit;
- missing unit metadata;
- source unit not reported;
- parsing failure;
- unsupported unit;
- conversion failure;
- unresolved semantic mapping.

The Gold rejects attempts to add missing-data state to this authority shape.

## Explicit nonclaims

DEC-0024 does not create or infer:

- ContextDatum;
- ContextManifest;
- AuthorizedContextReference;
- ResolvedContextDatumReceipt;
- uncertainty;
- effectiveInterval;
- availableAt;
- local civil-day bounds;
- UTC offset;
- DST state;
- TZDB basis;
- temporalSupport mutation;
- spatialSupport mutation;
- geometryRef;
- target-instance binding;
- epistemicClass mutation;
- provenanceClass mutation;
- source lineage mutation;
- a general UCUM registry;
- dimensional analysis;
- unit conversion;
- a canonical dimensionless numeric unit;
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
- generic DATE type-only inference;
- `day`;
- `unitless`;
- empty, null or omitted unit wire value;
- missing-data substitution;
- incomplete review;
- unauthorized reviewer;
- rejected review;
- review/publication mismatch.

Passing this Gold means only that the exact accepted Sustainable Corn
`crop.planting_date / DATE 2011-05-03` predecessor world may carry the canonical
wire unit token `NOT_APPLICABLE` under explicit reviewed authority.

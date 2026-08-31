# Sustainable Corn Recorded-Operation Context Semantic Mapping Gold — Provenance

Status: **PUBLIC REAL-SOURCE GOLD**

This Gold reuses the exact retained real-source predecessor world already established by DEC-0013 and DEC-0014.

## Parent recorded occurrence

Upstream repository:

`isudatateam/datateam`

Retained source artifact:

`scripts/cscap/chicago.ipynb`

Exact observed Git blob:

`4847e7b3b4aad42193de3f5f0da6f81f6b62dc50`

Exact governed occurrence used by the Gold:

```text
siteid = SERF
sourceOperationCode = plant_corn
date = 2011-05-03
precision = DAY
```

The retained notebook row is a public persisted query output used as the current real-source occurrence bootstrap. It is not represented as the preferred published XLSX row and must not be described as such.

## Semantic normalization source

Upstream repository:

`isudatateam/datateam`

Retained source artifact:

`src/isudatateam/cscap/mantable.py`

Exact observed Git blob:

`689a5c6c4bdc8bc242cd09673f0063fea177c6bb`

The exact retained source ranges used by DEC-0014 establish the reviewed source-scoped normalization:

```text
plant_corn -> PLANT / CROP:CORN
```

## DEC-0016 mapping

The DEC-0016 Gold consumes the exact accepted DEC-0013 occurrence authority and exact accepted DEC-0014 normalization authority and publishes only:

```text
PLANT / CROP:CORN
CALENDAR_DATE 2011-05-03 / DAY
  ->
crop.planting_date
DATE 2011-05-03
```

No new external source evidence is introduced by DEC-0016.

## Explicit non-claims

This Gold does not establish or publish:

- ContextDatum or ContextManifest;
- RFC3339 timestamps;
- timezone, UTC offset or DST semantics;
- effectiveInterval or availableAt;
- target identity, spatialSupport or geometry;
- epistemicClass or provenanceClass;
- unit or uncertainty;
- DecisionProblem;
- Policy or runtime legality;
- execution authority;
- Outcome;
- inverse mapping;
- mapping completeness beyond the exact first mapping.

The source date is preserved as a typed `DATE`; it is not converted to midnight UTC or any other timestamp.

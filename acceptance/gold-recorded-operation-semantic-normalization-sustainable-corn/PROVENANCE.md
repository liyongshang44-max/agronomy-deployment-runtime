# Sustainable Corn recorded-operation semantic-normalization Gold provenance

This directory contains the first public real-source Gold evidence for DEC-0014.

## Exact semantic source artifact

Upstream repository:

`isudatateam/datateam`

Upstream path:

`src/isudatateam/cscap/mantable.py`

Exact upstream Git blob:

`689a5c6c4bdc8bc242cd09673f0063fea177c6bb`

The retained `upstream/mantable.py` file has the same Git blob SHA and is therefore byte-for-byte identical to the public upstream object.

The retained `upstream/LICENSE` file has exact blob:

`5c60615bfae390b40fe6fa096942c65b5b074ca7`

and preserves the upstream MIT license notice.

## Parent occurrence

The parent is the existing DEC-0013 Sustainable Corn bootstrap Gold occurrence:

- source-native subject: `siteid=SERF`
- source operation code: `plant_corn`
- source-supported date: `2011-05-03`
- temporal precision: `DAY`

The parent continues to use the exact retained public notebook artifact:

`scripts/cscap/chicago.ipynb`

upstream Git blob:

`4847e7b3b4aad42193de3f5f0da6f81f6b62dc50`

DEC-0014 does not rewrite that occurrence.

## Exact semantic evidence set

DEC-0014 requires two non-contiguous BYTE_RANGE evidence items from the exact retained `mantable.py` bytes.

### SOURCE_CODE_NAMESPACE_CONTEXT

UTF-8 byte range:

`8251:8442`

Exact retained text:

```python
        for yr in ["2011", "2012", "2013", "2014", "2015"]:
            for op in ["plant_corn", "plant_soy"]:
                table4 += "<td>%s</td>" % (data[site].get(yr, {}).get(op, ""),)
```

This establishes the ordered source operation-code context used to render the paired cash-crop planting values.

### NORMALIZED_OPERATION_MEANING

UTF-8 byte range:

`12995:13445`

The exact retained range contains:

- heading `Cash Crop Planting`;
- paired column labels `Corn` and `Soybean`;
- the same repeated pair for crop years 2011–2015.

Together with the first range, this is the reviewed source-system evidence set for the first mapping.

## Gold normalization

The only positive mapping accepted by this Gold is:

```text
plant_corn
  -> family = PLANT
  -> subject.kind = CROP
  -> subject.code = CORN
```

This is source-scoped to the exact DEC-0013 parent occurrence Source and the reviewed Sustainable Corn code namespace.

## Deliberate non-authorities

This Gold does not establish:

- Policy actionSpace;
- normative force;
- runtime action eligibility or selection;
- ExecutionReceipt;
- machine or operator identity;
- Outcome;
- ContextDatum;
- current crop state;
- canonical ADR field identity;
- source vocabulary completeness;
- cross-provider/global code equivalence;
- inverse/write-back mapping;
- planned-versus-actual reconciliation.

The semantic subject `CROP:CORN` does not replace the occurrence source-native site subject `siteid=SERF`.

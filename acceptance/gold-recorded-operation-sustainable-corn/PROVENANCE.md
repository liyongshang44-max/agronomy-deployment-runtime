# Sustainable Corn recorded-operation bootstrap Gold provenance

This directory contains one public real-source positive recorded-operation event for DEC-0013 implementation acceptance.

## Exact retained source artifact

Upstream repository:

`isudatateam/datateam`

Upstream path:

`scripts/cscap/chicago.ipynb`

Exact upstream Git blob:

`4847e7b3b4aad42193de3f5f0da6f81f6b62dc50`

The retained `chicago.ipynb` file in this directory has the same Git blob SHA. Therefore the repository fixture is byte-for-byte identical to the public upstream notebook object.

The upstream repository is public. Its retained LICENSE is also copied byte-for-byte in this directory.

Exact upstream LICENSE blob:

`5c60615bfae390b40fe6fa096942c65b5b074ca7`

That license is the MIT license and permits copying and redistribution subject to its notice requirements.

## Underlying Sustainable Corn dataset

The notebook queries the Sustainable Corn CAP database.

Dataset:

`Sustainable Corn CAP Research Data (USDA-NIFA Award No. 2011-68002-30190)`

DOI:

`10.15482/USDA.ADC/1411953`

Figshare article:

`https://figshare.com/articles/dataset/Sustainable_Corn_CAP_Research_Data_USDA-NIFA_Award_No_2011-68002-30190_/24851877`

The Figshare publication identifies the dataset as Public and CC0. It states that the main workbook includes `Field Operations` and that field-management information includes planting, harvesting, tillage and fertilizer-application dates.

## Exact persisted operation evidence

Notebook cell 0 executes the database query:

```sql
SELECT uniqueid, operation, to_char(valid, 'Mon dd,YYYY'), cropyear, valid
from operations
ORDER by valid ASC
```

The persisted output reports 634 rows loaded from the database.

Notebook cell 3 filters:

```python
df2 = df[df.operation == 'plant_corn']
df2[['date', 'operation', 'siteid', 'year']]
```

Its persisted `text/plain` output contains DataFrame row index `33`:

```text
33   2011-05-03  plant_corn           SERF  2011
```

DEC-0013 Gold therefore compiles only this positive source-recorded occurrence:

- source-native subject: `siteid=SERF`
- source operation code: `plant_corn`
- source-supported calendar date: `2011-05-03`

No normalized ADR action code is published by this Gold.

## Deliberate limitation

This is a bootstrap real-source Gold artifact from the official public Sustainable Corn data-team repository.

It is **not** the preferred final Gold artifact described by DEC-0013. The preferred artifact remains the published CC0 `Sustainable_Corn_Research_Data_2011-2015.xlsx` workbook and its exact `Field Operations` row.

The current execution environment could resolve the Figshare download endpoint but could not transport the binary ZIP/workbook bytes. This bootstrap fixture therefore does not claim:

- that notebook row index `33` is an XLSX workbook row number;
- that the notebook is the published Figshare workbook;
- that the notebook output proves any additional operation fields not shown in the selected persisted row;
- that the recorded event is an ADR ExecutionReceipt;
- that the recorded event is an Outcome;
- that the recorded event is a runtime field state;
- that absence of another row means nonoccurrence;
- that `SERF` is already reconciled to an ADR target identity.

When the exact published workbook bytes become transportable, a later additive Gold should replay the equivalent event from those bytes without changing this bootstrap artifact's historical provenance.

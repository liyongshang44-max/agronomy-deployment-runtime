# Sustainable Corn Context Source Reference and Content Hash Projection Gold — Provenance

Status: **PUBLIC REAL-SOURCE GOLD**

This Gold reuses the exact retained real-source authority chain established by DEC-0013 through DEC-0019.

## Exact public source wire projection

The accepted provider namespace remains:

```text
providerId = github.com/isudatateam/datateam
```

For the exact first Sustainable Corn planting-date value:

```text
crop.planting_date = DATE 2011-05-03
epistemicClass = ASSERTION
provenanceClass = EXTERNAL_PROVIDER
```

the public source wire is:

```text
sourceRef =
  blob/4847e7b3b4aad42193de3f5f0da6f81f6b62dc50/scripts/cscap/chicago.ipynb#adr:JUPYTER_OUTPUT_TABLE_ROW_V1:cellIndex=3;outputIndex=0;mimeType=text%2Fplain;headerLineIndex=0;rowIndex=33

contentHash =
  exact DEC-0013 sourceLocator.evidenceHash
```

## Fact-level source reference

The sourceRef identifies the exact value-bearing persisted notebook row, not merely the notebook file or repository.

It preserves:

- exact Git blob identity;
- exact notebook path;
- JUPYTER_OUTPUT_TABLE_ROW_V1 scheme;
- cell index;
- output index;
- MIME type;
- header-line index;
- row index.

Changing any of those coordinates is a different source record and fails the first finite projection.

## Row-level public content hash

The public `contentHash` is the exact DEC-0013 row-level `sourceLocator.evidenceHash`.

The retained `SourceArtifact.contentHash` remains mandatory predecessor closure evidence for the whole notebook artifact, but is deliberately not projected as the public value content hash.

Likewise, the occurrenceHash and ADR compilation semantic hashes are authority identities, not public source-content hashes.

## No generic formatter

This Gold does not establish a generic GitHub/notebook locator formatter or a generic rule that all ContextDatum content hashes must use ADR evidenceHash.

The first projection is finite and exact to this accepted source world.

## Explicit non-claims

This Gold does not establish or publish:

- ContextDatum or ContextManifest;
- source-resolution service;
- availableAt;
- effectiveInterval;
- timezone, UTC offset or DST semantics;
- spatialSupport or geometry;
- verticalSupport applicability;
- unit;
- uncertainty;
- temporalSupport projection;
- DecisionProblem;
- Policy or runtime legality;
- ExecutionReceipt;
- Outcome;
- inverse source-wire reconstruction;
- a global sourceRef formatter;
- a global evidenceHash projection rule.

The exact providerId, epistemicClass and provenanceClass remain preserved from DEC-0019/0018/0017.

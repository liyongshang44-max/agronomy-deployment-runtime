# Sustainable Corn Context Source Provider Identity Binding Gold — Provenance

Status: **PUBLIC REAL-SOURCE GOLD**

This Gold reuses the exact retained real-source authority chain established by DEC-0013, DEC-0014, DEC-0016, DEC-0017 and DEC-0018.

## Exact predecessor world

The governed context world remains:

```text
crop.planting_date = DATE 2011-05-03
epistemicClass = ASSERTION
provenanceClass = EXTERNAL_PROVIDER
```

DEC-0018 already routes the value to the exact DEC-0013 occurrence:

```text
Source
SourceArtifact
SourceArtifact.contentHash
```

The value Source exact origin locator is:

```text
https://github.com/isudatateam/datateam/blob/4847e7b3b4aad42193de3f5f0da6f81f6b62dc50/scripts/cscap/chicago.ipynb
```

## DEC-0019 provider identity

For this exact reviewed first value-source world, the accepted repository-level provider namespace is:

```text
providerId = github.com/isudatateam/datateam
```

This identifier names the reviewed repository-level source/provider namespace.

It does not claim that GitHub authored the agronomic assertion.

It does not perform institutional entity resolution to Iowa State University, ISU Data Team, Sustainable Corn, or another organization identity.

## Why not host-only or institutional labels

The Gold explicitly rejects provider identities such as:

```text
github.com
isudatateam
github.com/isudatateam
github.com/other/datateam
ISU
IOWA_STATE_UNIVERSITY
GITHUB
org-a
ADR Source logicalId
```

Those alternatives either lose source namespace precision or invent a different identity abstraction.

## No generic URL parser

This first Gold does not create a repository-wide rule:

```text
GitHub URL -> providerId
```

The exact first Source origin is individually governed.

Future provider namespaces require their own accepted authority or a separately governed generic normalization policy.

## Explicit non-claims

This Gold does not establish or publish:

- institutional provider/master-entity identity;
- ContextDatum;
- ContextManifest;
- ContextDatum `source.sourceRef`;
- ContextDatum `source.contentHash`;
- the final source-wire hash granularity;
- availableAt;
- effectiveInterval;
- timezone, UTC offset or DST semantics;
- target/spatial projection or geometry;
- unit or uncertainty;
- temporalSupport projection;
- current crop/season state;
- DecisionProblem;
- Policy or runtime legality;
- ExecutionReceipt;
- Outcome;
- inverse provider mapping;
- global URL/host/repository normalization rules.

The existing `ASSERTION` and `EXTERNAL_PROVIDER` classifications are preserved unchanged.

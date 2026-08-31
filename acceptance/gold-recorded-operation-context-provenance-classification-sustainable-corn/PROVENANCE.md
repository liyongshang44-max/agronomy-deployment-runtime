# Sustainable Corn Recorded-Operation Context Provenance Classification Gold — Provenance

Status: **PUBLIC REAL-SOURCE GOLD**

This Gold reuses the exact retained real-source authority chain established by DEC-0013, DEC-0014, DEC-0016 and DEC-0017.

## Exact value-source routing

The mapped context value is:

```text
crop.planting_date
DATE 2011-05-03
epistemicClass = ASSERTION
```

Its value is supplied by the exact DEC-0013 parent occurrence Source and SourceArtifact:

```text
sourceOperationCode = plant_corn
date = 2011-05-03
siteid = SERF
```

The SourceArtifact exact content hash remains part of the DEC-0018 classification identity.

## Semantic interpretation source is not value provenance

DEC-0014 additionally uses the retained `mantable.py` source to establish:

```text
plant_corn -> PLANT / CROP:CORN
```

That source contributes semantic interpretation only.

It is not the source from which the mapped date value entered ADR.

The Gold explicitly proves that substituting the DEC-0014 semantic Source/SourceArtifact as the value source fails closed.

## First accepted ProvenanceClass

For this exact reviewed first source world:

```text
provenanceClass = EXTERNAL_PROVIDER
```

This is an explicit governed classification of the exact value ingress channel.

It is not derived from a repository-wide lexical rule.

The following are not generic provenance mappings:

```text
sourceType = OTHER
github.com
public repository
REPOSITORY_RETAINED_PUBLIC_GOLD
ownership.organizationId
```

## Explicit non-claims

This Gold does not establish or publish:

- ContextDatum or ContextManifest;
- ContextDatum source.providerId;
- ContextDatum source.sourceRef;
- ContextDatum source.contentHash wire projection;
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
- inverse provenance mapping;
- global SourceType/origin/acquisition-method -> ProvenanceClass rules.

`EXTERNAL_PROVIDER` is an origin/channel classification, not a confidence score and not an execution-verification claim.

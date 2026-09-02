# DEC-0028 — Agronomic Context Source-Acquisition Availability Projection

Status: **ACCEPTED**

Date: 2026-09-02

## Context

The frozen Agronomic Context & Public Runtime Contract v1.0 requires every
`ContextDatum` to carry an explicit RFC3339 `availableAt` timestamp.

A04 ContextManifest gives this field operational meaning through the immutable
evidence cutoff:

```text
datum.availableAt <= evidenceCutoff
```

A04 also states explicitly that event/effective time must not be reinterpreted as
availability.

For the first accepted Sustainable Corn planting-date world, ADR already has an
exact value-bearing source-artifact authority.

DEC-0020 establishes the exact first public source projection and materially
retains:

```text
valueSource.sourceRef
valueSource.sourceArtifactRef
valueSource.sourceArtifactContentHash
```

The exact value-bearing predecessor is the retained Sustainable Corn operations
notebook SourceArtifact.

That SourceArtifact is a content-addressed AuthorityLedger record. Its semantic
payload includes required acquisition metadata:

```text
acquisition {
  method
  acquiredAt
  locator?
  metadata
}
```

For the first exact retained Gold world:

```text
SourceArtifact.acquisition.method =
  REPOSITORY_RETAINED_PUBLIC_GOLD

SourceArtifact.acquisition.acquiredAt =
  2026-08-30T13:00:00.000Z
```

DEC-0020 deliberately creates no `availableAt` authority.

Therefore the exact value-source artifact acquisition timestamp is available as
qualified predecessor evidence, but a separate semantic projection authority is
still required before it may become ContextDatum `availableAt`.

## Problem

The first planting-date ContextDatum cannot be published without an explicit
`availableAt`.

Several tempting timestamps are semantically invalid:

```text
2011-05-03
```

is the accepted planting-date value / occurrence date. It is not an availability
timestamp.

The source Git blob/commit time, repository history, notebook execution time,
review time, ADR publication time and current wall clock are also not established
as the datum availability boundary.

ADR also does not currently possess evidence establishing when the original source
was first publicly released in 2011 or when every upstream consumer could first
observe the fact.

The exact authority chain does, however, establish when ADR's retained evidence
world acquired the exact value-bearing artifact.

A04's chronology semantics require a conservative, replayable availability boundary
that prevents a ContextManifest from consuming the datum before ADR held its exact
evidence.

## Decision

For the exact first accepted Sustainable Corn planting-date source world only,
establish:

```text
availableAt =
  exact DEC-0020 value-source SourceArtifact.acquisition.acquiredAt
```

For the first Gold this resolves exactly to:

```text
availableAt = 2026-08-30T13:00:00.000Z
```

The semantic meaning is:

> the earliest availability boundary established by the current ADR authority world
> for this exact value-bearing evidence is the acquisition time of the exact retained
> SourceArtifact.

This is an ADR-evidence availability boundary.

It is not an assertion about the first historical publication or public availability
of the upstream fact.

## Exact predecessor authority

The direct predecessor is the exact accepted DEC-0020
`AgronomicRecordedOperationContextSourceReferenceHashProjectionCompilation`.

That predecessor must be fully revalidated through its existing authority validator.

The revalidated DEC-0020 world must close to the exact first Sustainable Corn
planting-date source projection, including:

```text
targetContextSemantic:
  semanticId = crop.planting_date
  value.type = DATE
  value.date = 2011-05-03

providerId = github.com/isudatateam/datateam

valueSource.sourceRef = exact Source authority ref
valueSource.sourceArtifactRef = exact value-bearing SourceArtifact authority ref
valueSource.sourceArtifactContentHash = exact retained notebook artifact hash

projectedSource.sourceRef = exact DEC-0020 fact-level sourceRef
projectedSource.contentHash = exact DEC-0013 row evidenceHash
```

DEC-0028 must resolve the exact predecessor `valueSource.sourceArtifactRef` from
the ledger and require that it equals the exact SourceArtifact returned by the
revalidated DEC-0013/DEC-0020 chain.

Caller-supplied timestamps are not authority.

## Exact first timestamp

The first accepted timestamp is exactly:

```text
2026-08-30T13:00:00.000Z
```

It is obtained from:

```text
exact value-bearing SourceArtifact
  .semanticPayload
  .acquisition
  .acquiredAt
```

The implementation must not hard-code this timestamp independently of predecessor
validation.

The exact first Gold should assert the expected value only after replaying and
validating the exact SourceArtifact authority.

## Availability semantics

DEC-0028 defines the first `availableAt` projection as:

```text
ADR_EVIDENCE_ACQUISITION_AVAILABILITY
```

Conceptually:

```text
exact source evidence acquired by ADR at T
        ->
datum cannot be considered available before T
```

This gives A04's evidence cutoff a conservative replay meaning.

A ContextManifest with:

```text
evidenceCutoff < availableAt
```

must remain unable to include the datum under the existing A04 contract.

DEC-0028 does not modify A04.

## Why not the planting date

The accepted value:

```text
crop.planting_date = 2011-05-03
```

is event/effective semantics.

It is not evidence availability.

A04 explicitly forbids reinterpretation of event/effective time as availability.

Therefore DEC-0028 must not construct:

```text
availableAt = 2011-05-03T...
```

from the planting date.

## Why not source publication time

The retained source world does not establish the first historical publication time
of the exact source fact.

DEC-0028 must not claim:

```text
UPSTREAM_FIRST_PUBLIC_AVAILABILITY =
  2026-08-30T13:00:00.000Z
```

The SourceArtifact acquisition timestamp says when this ADR evidence authority
acquired/materialized the retained artifact.

The upstream artifact may have existed earlier.

No negative global historical claim is authorized.

## Why not Git commit time

Git blob identity is material source identity for several accepted predecessors.

A Git blob does not itself provide an accepted ContextDatum availability timestamp.

DEC-0028 must not derive `availableAt` from:

- Git commit author time;
- Git commit committer time;
- repository branch history;
- GitHub API response time;
- blob creation assumptions.

## Why not review/publication time

The semantic review and compilation publication occur after evidence acquisition.

Those times describe governance actions, not when the underlying value-bearing
evidence entered the retained source world.

DEC-0028 must not use:

- reviewer audit timestamp;
- DEC acceptance time;
- compilation publication time;
- PR merge time;
- CI run time;
- current wall clock.

## Why not the semantic-source acquisition time

The exact planting-date semantic world also uses a retained semantic-normalization
artifact such as `mantable.py`.

DEC-0028 is specifically the first value-bearing datum availability projection.

The value-source artifact is the exact operations notebook bound through DEC-0020.

The semantic-normalization artifact may be required for interpretation, but its
acquisition timestamp is not silently substituted for the value-source availability
timestamp by this DEC.

If a future product requires "all interpretation dependencies available" chronology,
that is a separate composite availability authority.

## No maximum-of-dependencies inference

DEC-0028 does not establish:

```text
availableAt = max(all predecessor artifact acquisition times)
```

Although such a rule could be useful for a fully assembled datum, it would be a
different semantic contract.

The first DEC remains finite to exact value-bearing SourceArtifact acquisition.

## No generic SourceArtifact rule

DEC-0028 must not establish:

```text
for every ContextDatum:
  availableAt = sourceArtifact.acquisition.acquiredAt
```

Different context facts may have:

- live provider availability semantics;
- snapshot resolution timestamps;
- event-stream arrival times;
- customer-state version times;
- explicit provider publication times;
- multiple evidence dependencies.

The first mapping is exact and source-scoped.

## No effectiveInterval authority

DEC-0028 creates no `effectiveInterval`.

It does not establish:

- local civil-day interpretation;
- historical UTC offset;
- DST state;
- TZDB basis/version;
- interval start;
- interval end.

The existing temporal blocker remains independent.

## No timezone mutation

DEC-0022 remains the source-native timezone identity authority.

DEC-0028 does not use `America/Chicago` to compute availability.

The acquisition timestamp is already an explicit RFC3339 UTC timestamp.

## No source projection mutation

DEC-0020 remains the authority for:

```text
source.providerId
source.sourceRef
source.contentHash
```

DEC-0028 does not modify those fields.

It consumes DEC-0020 only to identify and revalidate the exact value-source
SourceArtifact.

## No semantic/value mutation

DEC-0016 remains the authority for:

```text
semanticId = crop.planting_date
value = DATE 2011-05-03
```

DEC-0028 does not alter the value.

## No unit / support / uncertainty mutation

DEC-0024 remains unit authority.

DEC-0025 remains vertical-support authority.

DEC-0026 remains uncertainty authority.

DEC-0021/DEC-0023 remain temporal/spatial support authorities.

DEC-0028 does not depend on or mutate these field-level decisions.

## No targetRef mutation

DEC-0027 remains the FARM target-ref component authority.

DEC-0028 does not create or alter targetRef.

## No ContextDatum publication

DEC-0028 does not create or publish a `ContextDatum`.

It establishes only an availability field authority eligible for later assembly.

No `ContextManifest`, `DecisionProblem`, `AuthorizedContextReference` or
`ResolvedContextDatumReceipt` is created.

## Authority shape

Introduce a content-addressed authority:

`AgronomicContextSourceAcquisitionAvailabilityProjectionCompilation`

Conceptually:

```text
AgronomicContextSourceAcquisitionAvailabilityProjectionCompilation {
  contractVersion

  projectionId

  parentSourceReferenceHashProjectionCompilationRef

  targetContextSemantic {
    semanticId
    value
  }

  valueSource {
    sourceRef
    sourceArtifactRef
    sourceArtifactContentHash
  }

  sourceArtifactAcquisition {
    method
    acquiredAt
  }

  availableAtProjection {
    basis = VALUE_SOURCE_ARTIFACT_ACQUISITION
    availableAt
  }

  rationale
  semanticReviewRef
  compilationHash
  limitations
}
```

Exact implementation field names remain implementation-level after architecture
acceptance.

## Reviewer authority

Publication requires an explicit:

`AgronomicContextSourceAcquisitionAvailabilityProjectionReviewDecision`

or equivalent governed review authority.

The review must bind the exact:

- DEC-0020 predecessor ref;
- target semantic/value;
- valueSource Source ref;
- valueSource SourceArtifact ref;
- valueSource SourceArtifact content hash;
- SourceArtifact acquisition method;
- SourceArtifact acquisition timestamp;
- projected `availableAt`;
- availability basis.

## Mandatory review checks

An accepted review should confirm at least:

1. `PARENT_SOURCE_REFERENCE_HASH_AUTHORITY_VERIFIED`;
2. `VALUE_SOURCE_ARTIFACT_AUTHORITY_VERIFIED`;
3. `VALUE_SOURCE_ARTIFACT_REF_EXACT`;
4. `VALUE_SOURCE_ARTIFACT_CONTENT_HASH_EXACT`;
5. `EXACT_TARGET_CONTEXT_SEMANTIC_VERIFIED`;
6. `EXACT_SOURCE_ARTIFACT_ACQUISITION_TIMESTAMP_VERIFIED`;
7. `AVAILABLE_AT_EQUALS_VALUE_SOURCE_ACQUIRED_AT`;
8. `AVAILABILITY_BASIS_VALUE_SOURCE_ARTIFACT_ACQUISITION`;
9. `NO_OCCURRENCE_DATE_AS_AVAILABILITY`;
10. `NO_EFFECTIVE_TIME_AS_AVAILABILITY`;
11. `NO_UPSTREAM_FIRST_PUBLICATION_TIME_CLAIM`;
12. `NO_GIT_COMMIT_TIME_INFERENCE`;
13. `NO_REVIEW_OR_PUBLICATION_TIME_SUBSTITUTION`;
14. `NO_CURRENT_WALL_CLOCK_SUBSTITUTION`;
15. `NO_SEMANTIC_ARTIFACT_TIME_SUBSTITUTION`;
16. `NO_MAX_DEPENDENCY_TIME_INFERENCE`;
17. `NO_GENERIC_SOURCE_ARTIFACT_AVAILABILITY_RULE`;
18. `NO_EFFECTIVE_INTERVAL_INFERENCE`;
19. `NO_TIMEZONE_OFFSET_DST_TZDB_INFERENCE`;
20. `NO_SOURCE_PROJECTION_MUTATION`;
21. `NO_CONTEXT_DATUM_PUBLICATION`;
22. `NO_CONTEXT_MANIFEST_OR_DECISION_PROBLEM_PUBLICATION`;
23. `NO_POLICY_RUNTIME_EXECUTION_OR_OUTCOME_INFERENCE`.

All mandatory checks are required for accepted publication.

## Review dispositions

At minimum:

- `ACCEPT_CONTEXT_SOURCE_ACQUISITION_AVAILABILITY_PROJECTION`;
- `REJECT_CONTEXT_SOURCE_ACQUISITION_AVAILABILITY_PROJECTION`.

Rejected review cannot authorize publication.

## Content addressing

Changing any material element must change semantic identity or fail review closure,
including:

- DEC-0020 predecessor ref;
- target semantic/value;
- valueSource source ref;
- valueSource SourceArtifact ref;
- SourceArtifact content hash;
- acquisition method;
- acquisition timestamp;
- availability basis;
- projected availableAt;
- rationale;
- semantic review decision.

## First Gold

The first Gold should replay the exact accepted Sustainable Corn DEC-0020 world and
prove only:

```text
crop.planting_date = DATE 2011-05-03

exact DEC-0020 valueSource
  -> exact retained operations-notebook SourceArtifact
  -> acquisition.method = REPOSITORY_RETAINED_PUBLIC_GOLD
  -> acquisition.acquiredAt = 2026-08-30T13:00:00.000Z

        ->

availableAt =
  2026-08-30T13:00:00.000Z

basis =
  VALUE_SOURCE_ARTIFACT_ACQUISITION
```

The Gold must fail closed for at least:

- wrong predecessor authority;
- predecessor ref drift;
- wrong target semantic/value;
- valueSource source ref drift;
- valueSource SourceArtifact ref drift;
- SourceArtifact content-hash drift;
- acquisition timestamp drift;
- arbitrary caller-supplied availableAt;
- planting-date timestamp substitution;
- Git commit timestamp substitution;
- review/publication timestamp substitution;
- semantic-source artifact timestamp substitution;
- generic SourceArtifact mapping;
- incomplete review;
- unauthorized reviewer;
- rejected review;
- review/publication mismatch.

## Consequences

Positive:

- fills `availableAt` with a direct, replayable authority instead of a guessed
  historical timestamp;
- aligns directly with A04 evidence-cutoff semantics;
- prevents retrospective evidence from being consumed before ADR actually held the
  exact retained evidence in this authority world;
- preserves strict distinction between occurrence/effective time and availability;
- avoids false claims about upstream first publication;
- remains content-addressed, finite and fail-closed.

Costs:

- the timestamp is conservative and ADR-relative, not the earliest time the fact may
  have existed upstream;
- a later integration with native provider publication/arrival semantics may use a
  different availability authority;
- this does not solve effectiveInterval;
- this still does not make the final ContextDatum publishable until remaining
  assembly prerequisites are closed.

## Remaining blockers after acceptance

Even if DEC-0028 is accepted and implemented, the exact first planting-date
ContextDatum still lacks concrete `effectiveInterval` bounds.

That blocker remains:

```text
2011-05-03
+ source-native timezone identity America/Chicago
!=
authorized RFC3339 interval bounds
```

without separately governed:

- local-civil-day interpretation;
- historical UTC offset / DST rule;
- TZDB basis/version or equivalent exact historical timezone authority.

After that temporal seam is closed, ADR can audit whether all required
field-level predecessors are sufficient for a dedicated final ContextDatum assembly
and publication authority.

DEC-0028 does not pre-authorize that assembly.

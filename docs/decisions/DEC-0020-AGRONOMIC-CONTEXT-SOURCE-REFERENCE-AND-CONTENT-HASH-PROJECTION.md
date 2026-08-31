# DEC-0020 — Governed Agronomic Context Source Reference and Content Hash Projection

Status: **ACCEPTED**

Date: 2026-09-01

## Context

DEC-0019 established the first governed public ContextDatum provider namespace for the exact Sustainable Corn value-source world:

```text
providerId = github.com/isudatateam/datateam
```

DEC-0019 deliberately did not decide the remaining public ContextDatum source-wire fields:

```text
source:
  provider_id
  source_ref
  content_hash
```

The first real value source already has two different content-addressed layers:

1. whole retained artifact identity:

```text
SourceArtifact.contentHash
```

2. exact event-level structured-row evidence identity:

```text
AgronomicRecordedOperationOccurrence.sourceLocator.evidenceHash
```

These hashes are not semantically interchangeable.

The first occurrence also already contains an exact structured source locator:

```text
scheme = JUPYTER_OUTPUT_TABLE_ROW_V1

coordinates:
  cellIndex = 3
  outputIndex = 0
  mimeType = text/plain
  headerLineIndex = 0
  rowIndex = 33
```

The exact retained upstream Git blob is:

```text
4847e7b3b4aad42193de3f5f0da6f81f6b62dc50
```

and the exact notebook path is:

```text
scripts/cscap/chicago.ipynb
```

The mapped context value:

```text
crop.planting_date = DATE 2011-05-03
```

is supported by the exact persisted table row, not by every byte in the notebook.

Therefore the public source wire should preserve fact-level traceability rather than collapse to artifact-level traceability.

## Existing comparison: GEOX

The current GEOX adapter publishes ContextDatum source fields at fact-level granularity:

```text
provider_id = GEOX

source_ref =
  geox:facts/<fact-id>
  or
  geox:device-observation/<fact-id>

content_hash =
  source snapshot hash
  or
  sha256(exact observation row)
```

DEC-0020 does not copy GEOX identifiers.

It preserves the same architectural principle:

> public source_ref should identify the exact value-bearing source record, and public content_hash should identify the exact value-bearing content snapshot at the same semantic granularity.

## Decision

Introduce a distinct content-addressed authority:

`AgronomicRecordedOperationContextSourceReferenceHashProjectionCompilation`

Its narrow purpose is:

> bind the exact accepted DEC-0019 provider-identity world to one exact public `sourceRef` and one exact public `contentHash` for the first value-bearing source record, without publishing a ContextDatum or inventing temporal, spatial, unit, uncertainty, runtime, execution or Outcome authority.

For the first real Gold, the accepted source wire is:

```text
providerId:
  github.com/isudatateam/datateam

sourceRef:
  blob/4847e7b3b4aad42193de3f5f0da6f81f6b62dc50/scripts/cscap/chicago.ipynb#adr:JUPYTER_OUTPUT_TABLE_ROW_V1:cellIndex=3;outputIndex=0;mimeType=text%2Fplain;headerLineIndex=0;rowIndex=33

contentHash:
  exact DEC-0013 sourceLocator.evidenceHash
```

DEC-0020 itself publishes only:

```text
sourceRef
contentHash
```

while requiring exact predecessor closure to DEC-0019 `providerId`.

## Why provider-scoped sourceRef

DEC-0019 already fixes:

```text
providerId = github.com/isudatateam/datateam
```

Therefore `sourceRef` does not need to repeat the provider namespace as a second global identity.

The first `sourceRef` is provider-scoped:

```text
blob/<exact-git-blob>/<path>#<exact-row-locator>
```

This is more precise than:

```text
scripts/cscap/chicago.ipynb
```

and avoids inventing an ADR-internal ledger reference as a public source identifier.

## Why exact Git blob is included

A path alone can drift over repository history.

The exact Git blob identity is already accepted predecessor evidence.

Including the exact blob in `sourceRef` prevents:

```text
same path / different bytes
```

from silently resolving to the same public source reference.

## Why exact row locator is included

The notebook contains many rows and other content.

The planting-date context value comes from one persisted table row.

A notebook-level sourceRef would be too coarse.

The first sourceRef must therefore preserve the exact row locator:

```text
JUPYTER_OUTPUT_TABLE_ROW_V1
cellIndex = 3
outputIndex = 0
mimeType = text/plain
headerLineIndex = 0
rowIndex = 33
```

Changing any locating coordinate requires a different public sourceRef or fails closure.

## Why contentHash is evidenceHash

The DEC-0013 `sourceLocator.evidenceHash` is the canonical SHA-256 semantic hash of the exact replayed structured row evidence.

That evidence contains the selected source cells supporting:

- source-native subject;
- source operation code;
- temporal support.

For the first mapped planting-date value, that is the correct value-bearing content granularity.

Therefore:

```text
public source.contentHash
=
exact DEC-0013 sourceLocator.evidenceHash
```

## Why not SourceArtifact.contentHash

Rejected for public `source.contentHash` in the first source-wire projection.

`SourceArtifact.contentHash` identifies the entire retained notebook bytes.

It remains mandatory predecessor closure evidence.

But it is broader than the exact row that supplies the mapped value.

Using the whole-notebook hash as public value content hash would make unrelated notebook changes appear to change the context datum source content even if the exact value-bearing row were semantically unchanged.

DEC-0020 therefore keeps:

```text
SourceArtifact.contentHash
```

inside the authority chain while projecting:

```text
sourceLocator.evidenceHash
```

as public source content hash.

## Why not occurrenceHash

Rejected.

`AgronomicRecordedOperationOccurrence.occurrenceHash` hashes the normalized ADR occurrence contract.

It is an ADR semantic-authority identity.

It is not the hash of the public source content itself.

The public source content hash must remain source-evidence-oriented.

## Why not compilation semanticHash

Rejected.

The semanticHash of an ADR compilation identifies the authority record.

It does not identify source content.

## Public sourceRef is not an ADR authority ref

DEC-0020 does not serialize:

- Source ref;
- SourceArtifact ref;
- occurrence compilation ref;
- DEC-0019 provider binding ref

into public `sourceRef`.

Those refs remain internal authority lineage.

The public sourceRef must remain an inspectable source-record reference.

## Proposed authority shape

Conceptually:

```text
AgronomicRecordedOperationContextSourceReferenceHashProjection {
  contractVersion

  projectionId

  sourceProviderIdentityBindingCompilationRef

  providerId

  valueSource {
    sourceRef
    sourceArtifactRef
    sourceArtifactContentHash
  }

  sourceLocator {
    kind
    scheme
    coordinates
    evidenceHash
  }

  projectedSource {
    sourceRef
    contentHash
  }

  targetContextSemantic
  epistemicClass
  provenanceClass

  projectionRationale
}
```

Publication compilation should additionally contain:

- projection hash;
- source-reference review ref;
- local lossless coverage;
- explicit limitations.

Exact implementation field names remain implementation-level after architecture acceptance.

## Mandatory predecessor closure

Publication must require the exact accepted:

`AgronomicRecordedOperationContextSourceProviderIdentityBindingCompilation`

That authority must be fully revalidated.

The validator must close through:

```text
DEC-0019
  ->
DEC-0018
  ->
DEC-0017
  ->
DEC-0016
  ->
DEC-0013
```

and recover the exact:

- providerId;
- value Source ref;
- value SourceArtifact ref;
- SourceArtifact content hash;
- Source origin locator;
- occurrence source locator;
- occurrence evidenceHash;
- target semantic/value;
- epistemicClass;
- provenanceClass.

No caller may supply an unrelated locator or hash.

## Exact first providerId is preserved

DEC-0020 must preserve:

```text
providerId = github.com/isudatateam/datateam
```

Provider identity cannot drift while sourceRef/contentHash remain unchanged.

## Exact first sourceRef

The first accepted sourceRef is exactly:

```text
blob/4847e7b3b4aad42193de3f5f0da6f81f6b62dc50/scripts/cscap/chicago.ipynb#adr:JUPYTER_OUTPUT_TABLE_ROW_V1:cellIndex=3;outputIndex=0;mimeType=text%2Fplain;headerLineIndex=0;rowIndex=33
```

This first string is finite and explicitly reviewed.

DEC-0020 does not establish a repository-wide generic formatter.

## Exact first contentHash

The first accepted public contentHash is exactly the accepted predecessor:

```text
DEC-0013 occurrence.sourceLocator.evidenceHash
```

No alternative hash authority is accepted.

## No generic locator formatter

DEC-0020 does not establish:

```text
any GitHub origin + any ADR locator
  ->
public sourceRef
```

Only the exact first source world is accepted.

A generic source-reference formatter would require a separate governed policy with cross-source Golds.

## No generic evidenceHash projection rule

DEC-0020 does not establish that every future ContextDatum must use an ADR evidenceHash.

Other provider integrations may already expose their own exact source snapshot hash.

The first projection is source-specific and authority-reviewed.

## No source resolution service

DEC-0020 does not create an API that dereferences sourceRef.

It defines identity/provenance wire values only.

## No ContextDatum publication

DEC-0020 creates no:

- ContextDatum;
- ContextManifest;
- AuthorizedContextReference;
- ResolvedContextDatumReceipt.

After DEC-0020, the first public source object can be fully specified, but the containing ContextDatum remains incomplete.

## No availableAt authority

The SourceArtifact acquisition time remains distinct from ContextDatum availability time.

DEC-0020 creates no `availableAt`.

## No effectiveInterval authority

DEC-0020 creates no effective interval, timezone, UTC offset or DAY-to-RFC3339 interpretation.

## No target/spatial authority

DEC-0020 does not project DEC-0015 target identity into spatialSupport.

## No unit authority

DEC-0020 does not decide the unit string for a DATE-valued ContextDatum.

## No uncertainty authority

DEC-0020 creates no uncertainty projection.

## No temporalSupport projection

DEC-0020 does not convert DEC-0013 DAY precision into ContextDatum temporalSupport.

## No verticalSupport decision

DEC-0020 does not decide whether ContextDatum verticalSupport is null or another shape.

## No DecisionProblem authority

DEC-0020 creates no DecisionProblem or targetRef.

## No Policy/runtime authority

DEC-0020 creates no:

- Policy;
- RuntimePlan;
- RuntimeEligibility;
- RuntimeBinding;
- DecisionResult.

## No execution or Outcome authority

DEC-0020 creates no ExecutionReceipt or Outcome authority.

## No inverse projection

Acceptance of the exact first sourceRef/contentHash does not allow reconstructing arbitrary ADR Source, SourceArtifact or occurrence authority from an arbitrary public source wire.

## No completeness claim

The first projection does not mean:

- all data from the repository uses this locator format;
- all notebook rows use evidenceHash as public contentHash;
- all external providers use fact-level sourceRef in the same form;
- every future ContextDatum source object is now publishable.

Only the exact reviewed first value-bearing source world is covered.

## Reviewer authority

Publication requires an explicit:

`AgronomicRecordedOperationContextSourceReferenceHashProjectionReviewDecision`

or equivalent governed review authority.

The review must bind the exact:

- DEC-0019 provider identity binding ref;
- providerId;
- value Source ref;
- value SourceArtifact ref;
- SourceArtifact content hash;
- source origin locator;
- occurrence sourceLocator;
- occurrence evidenceHash;
- projected sourceRef;
- projected contentHash;
- target semantic/value;
- epistemicClass;
- provenanceClass.

## Proposed mandatory review checks

An accepted review should confirm at least:

1. `SOURCE_PROVIDER_IDENTITY_BINDING_AUTHORITY_VERIFIED`;
2. `EXACT_PROVIDER_ID_PRESERVED`;
3. `EXACT_VALUE_SOURCE_VERIFIED`;
4. `EXACT_VALUE_SOURCE_ARTIFACT_VERIFIED`;
5. `EXACT_VALUE_SOURCE_ARTIFACT_HASH_VERIFIED`;
6. `EXACT_OCCURRENCE_SOURCE_LOCATOR_VERIFIED`;
7. `EXACT_OCCURRENCE_EVIDENCE_HASH_VERIFIED`;
8. `FACT_LEVEL_SOURCE_REFERENCE_GRANULARITY_VERIFIED`;
9. `EXACT_GIT_BLOB_IDENTITY_VERIFIED`;
10. `EXACT_SOURCE_PATH_VERIFIED`;
11. `EXACT_JUPYTER_CELL_INDEX_VERIFIED`;
12. `EXACT_JUPYTER_OUTPUT_INDEX_VERIFIED`;
13. `EXACT_JUPYTER_MIME_TYPE_VERIFIED`;
14. `EXACT_JUPYTER_HEADER_LINE_INDEX_VERIFIED`;
15. `EXACT_JUPYTER_ROW_INDEX_VERIFIED`;
16. `PUBLIC_SOURCE_REF_EXACTLY_VERIFIED`;
17. `PUBLIC_CONTENT_HASH_EQUALS_EVIDENCE_HASH`;
18. `SOURCE_ARTIFACT_HASH_NOT_SUBSTITUTED_AS_PUBLIC_CONTENT_HASH`;
19. `OCCURRENCE_HASH_NOT_SUBSTITUTED_AS_PUBLIC_CONTENT_HASH`;
20. `ADR_AUTHORITY_REF_NOT_PUBLISHED_AS_SOURCE_REF`;
21. `NO_GENERIC_LOCATOR_FORMATTER`;
22. `NO_GENERIC_EVIDENCE_HASH_PROJECTION_RULE`;
23. `TARGET_CONTEXT_SEMANTIC_VERIFIED`;
24. `TARGET_CONTEXT_VALUE_VERIFIED`;
25. `EPISTEMIC_CLASS_ASSERTION_PRESERVED`;
26. `PROVENANCE_CLASS_EXTERNAL_PROVIDER_PRESERVED`;
27. `NO_CONTEXT_DATUM_PUBLICATION`;
28. `NO_AVAILABLE_AT_OR_EFFECTIVE_INTERVAL_INFERENCE`;
29. `NO_TARGET_OR_SPATIAL_PROJECTION`;
30. `NO_UNIT_UNCERTAINTY_OR_TEMPORAL_SUPPORT_INFERENCE`;
31. `NO_DECISION_PROBLEM_OR_POLICY_INFERENCE`;
32. `NO_RUNTIME_EXECUTION_OR_OUTCOME_INFERENCE`;
33. `NO_INVERSE_OR_COMPLETENESS_INFERENCE`.

All mandatory checks are required for accepted publication.

## Proposed review dispositions

At minimum:

- `ACCEPT_RECORDED_OPERATION_CONTEXT_SOURCE_REFERENCE_HASH_PROJECTION`;
- `REJECT_RECORDED_OPERATION_CONTEXT_SOURCE_REFERENCE_HASH_PROJECTION`.

Rejected review cannot authorize publication.

## Content addressing

Changing any material projection element must change semantic identity or fail closure, including:

- DEC-0019 predecessor ref;
- providerId;
- value Source ref;
- SourceArtifact ref;
- SourceArtifact content hash;
- origin locator;
- sourceLocator scheme;
- sourceLocator coordinates;
- evidenceHash;
- projected sourceRef;
- projected contentHash;
- target semantic/value;
- epistemicClass;
- provenanceClass;
- review ref;
- rationale;
- limitations.

## Local completeness

For DEC-0020:

`losslessCoverage = COMPLETE`

means only:

> providerId predecessor closure plus exact first public sourceRef/contentHash projection are represented without inventing another ContextDatum field.

It does not mean ContextDatum is complete.

## First real-source Gold

The first Gold must reuse the exact accepted chain:

```text
DEC-0013 occurrence
  exact notebook artifact
  exact persisted row
  exact evidenceHash

DEC-0016
  crop.planting_date = DATE 2011-05-03

DEC-0017
  epistemicClass = ASSERTION

DEC-0018
  provenanceClass = EXTERNAL_PROVIDER
  exact occurrence value source

DEC-0019
  providerId = github.com/isudatateam/datateam
```

Positive public projection:

```text
sourceRef =
  blob/4847e7b3b4aad42193de3f5f0da6f81f6b62dc50/scripts/cscap/chicago.ipynb#adr:JUPYTER_OUTPUT_TABLE_ROW_V1:cellIndex=3;outputIndex=0;mimeType=text%2Fplain;headerLineIndex=0;rowIndex=33

contentHash =
  exact DEC-0013 evidenceHash
```

## Mandatory implementation acceptance cases

If DEC-0020 is accepted, implementation must prove at least:

1. exact DEC-0019 authority is mandatory;
2. exact providerId is preserved;
3. exact DEC-0018 value-source closure is mandatory;
4. exact DEC-0013 occurrence closure is mandatory;
5. exact Source ref is mandatory;
6. exact SourceArtifact ref is mandatory;
7. exact SourceArtifact content hash is mandatory;
8. exact source origin locator is mandatory;
9. exact sourceLocator scheme is mandatory;
10. exact sourceLocator coordinates are mandatory;
11. exact evidenceHash is mandatory;
12. first public sourceRef can publish only as the exact accepted string;
13. first public contentHash equals exact evidenceHash;
14. artifact content hash substitution fails closed;
15. occurrenceHash substitution fails closed;
16. arbitrary hash substitution fails closed;
17. sourceRef missing row locator fails closed;
18. sourceRef rowIndex drift fails closed;
19. sourceRef blob drift fails closed;
20. sourceRef path drift fails closed;
21. providerId drift fails closed;
22. Source ref drift fails closed;
23. SourceArtifact ref drift fails closed;
24. evidenceHash drift fails closed;
25. target semantic/value drift fails closed;
26. incomplete review cannot publish;
27. unauthorized reviewer cannot publish;
28. rejected review cannot publish;
29. no ContextDatum/ContextManifest authority is created;
30. no availableAt/effectiveInterval/timezone authority is created;
31. no target/spatial authority is created;
32. no unit/uncertainty/temporalSupport authority is created;
33. no DecisionProblem/Policy/runtime authority is created;
34. no ExecutionReceipt/Outcome authority is created;
35. no inverse/global formatter rule is created.

At least one positive case must use the exact real Sustainable Corn predecessor chain.

## Proposed first implementation slice

Only after explicit acceptance and accepted documentation merge may implementation begin.

The first implementation slice should contain only:

1. source reference/hash projection contract;
2. exact DEC-0019 predecessor closure;
3. exact DEC-0013 sourceLocator/evidence closure;
4. exact projected sourceRef;
5. exact projected contentHash;
6. review authority;
7. content-addressed publication/validation;
8. real Sustainable Corn Gold;
9. mandatory fail-closed cases;
10. focused workflow wiring if required.

It must not contain:

- ContextDatum publication;
- availableAt;
- effectiveInterval;
- timezone;
- spatialSupport;
- geometry;
- verticalSupport decision;
- unit;
- uncertainty;
- temporalSupport projection;
- DecisionProblem;
- Policy;
- runtime;
- execution;
- Outcome.

## Future authority chain

If accepted and implemented:

```text
DEC-0013 occurrence
      +
DEC-0014 operation semantic
      |
      v
DEC-0016 context semantic/value
      |
      v
DEC-0017 epistemic classification
      |
      v
DEC-0018 provenance classification
      |
      v
DEC-0019 provider identity
      |
      v
DEC-0020 sourceRef + contentHash projection
      |
      +---- future temporal/availability projection
      +---- future target/spatial projection
      +---- future unit/uncertainty/support projection
      |
      v
future governed ContextDatum projection
```

No downstream arrow is pre-accepted by DEC-0020.

## Explicitly unresolved after DEC-0020

Even if accepted and implemented, the following remain unresolved:

1. effectiveInterval;
2. availableAt;
3. timezone / UTC offset;
4. DAY -> RFC3339 interval interpretation;
5. unit for DATE semantic;
6. uncertainty;
7. ContextDatum temporalSupport projection;
8. verticalSupport null/applicability authority;
9. DEC-0015 target identity -> spatialSupport;
10. ContextDatum datum_id;
11. ContextDatum publication;
12. ContextManifest inclusion;
13. field/plot/zone/season identity;
14. cross-provider canonical identity;
15. institutional/provider entity resolution;
16. planned-versus-actual reconciliation;
17. execution reconciliation;
18. Outcome linkage.

## Acceptance targets

Before this architecture may be accepted, review must confirm:

1. sourceRef is fact-level, not notebook-level;
2. public contentHash uses exact row evidenceHash, not SourceArtifact content hash;
3. whole-artifact hash remains mandatory predecessor closure evidence;
4. occurrenceHash/authority semanticHash are not public source content hashes;
5. providerId from DEC-0019 is preserved;
6. exact row locator coordinates are material;
7. no generic sourceRef formatter is accepted;
8. no generic evidenceHash projection rule is accepted;
9. no ADR authority ref is published as public sourceRef;
10. no ContextDatum publication is implied;
11. no temporal/spatial/unit/uncertainty projection is implied;
12. no DecisionProblem/Policy/runtime/execution/Outcome authority is created;
13. implementation remains additive and does not weaken DEC-0013 through DEC-0019.

## Post-acceptance gate

Before accepted DEC-0020 documentation may merge:

1. repository-wide ADR Constitution MUST pass on the exact accepted documentation head;
2. PR MUST remain docs-only;
3. no package/runtime/schema/workflow/acceptance mutation may be included;
4. no existing accepted contract may be changed;
5. PR base MUST remain the expected protected `main`;
6. accepted exact head MUST be recorded before merge.

Only after accepted documentation merge and post-merge Constitution success may implementation begin.

## Acceptance

**ACCEPTED — 2026-09-01.**

Explicit architecture approval was provided by the user by instructing continuation under the accepted project plan.

The accepted boundary is the decision exactly as written above: for the exact first DEC-0019 Sustainable Corn provider/value-source world, public `sourceRef` must identify the exact persisted notebook row at the accepted Git blob/path and JUPYTER_OUTPUT_TABLE_ROW_V1 coordinates, while public `contentHash` must equal the exact DEC-0013 row-level `sourceLocator.evidenceHash`. Whole-artifact `SourceArtifact.contentHash` remains mandatory predecessor closure evidence but is not the public value content hash. No generic locator formatter, generic evidence-hash rule, ADR authority-ref projection, ContextDatum publication, temporal/spatial/unit/uncertainty projection, DecisionProblem, Policy, runtime, execution, Outcome, inverse mapping, or completeness authority is accepted.

# DEC-0031 — Agronomic ContextDatum Assembly and Publication Binding

Status: **PROPOSED**

Date: 2026-09-02

## Context

The exact first Sustainable Corn planting-date context world now has accepted and
implemented field-level authority through DEC-0030.

The current protected/default main at proposal creation is:

```text
9267fbebaaedadc692dd478809b8d25b1b6aff70
```

The accepted first-world field values are now:

```text
semanticId =
  crop.planting_date

value =
  DATE 2011-05-03

unit =
  NOT_APPLICABLE

epistemicClass =
  ASSERTION

provenanceClass =
  EXTERNAL_PROVIDER

effectiveInterval.start =
  2011-05-03T05:00:00.000Z

effectiveInterval.end =
  2011-05-04T05:00:00.000Z

availableAt =
  2026-08-30T13:00:00.000Z

spatialSupport.type =
  FARM

verticalSupport =
  null

temporalSupport.type =
  INTERVAL

uncertainty.type =
  UNKNOWN

uncertainty.reasonCode =
  ACCEPTED_EVIDENCE_UNCERTAINTY_NOT_ESTABLISHED

source.providerId =
  github.com/isudatateam/datateam

source.sourceRef =
  blob/4847e7b3b4aad42193de3f5f0da6f81f6b62dc50/scripts/cscap/chicago.ipynb#adr:JUPYTER_OUTPUT_TABLE_ROW_V1:cellIndex=3;outputIndex=0;mimeType=text%2Fplain;headerLineIndex=0;rowIndex=33

source.contentHash =
  sha256:d27e8539ed45115419093d563cf44f0f364568efb4633781ea8120aaa2bb819f
```

All of those values are individually governed.

However, the existing A02 `publishContextDatum` API intentionally validates only:

1. the frozen ContextDatum field shape and canonicalization;
2. exact creator organization/tenant scope;
3. replayable scoped `CONTEXT_WRITE` authorization;
4. direct publication audit.

It does not know that the caller's field values came from DEC-0016 through DEC-0030.

Therefore:

```text
all required fields have authority
!=
the field set is authorized to converge into one ContextDatum
```

A caller with valid `CONTEXT_WRITE` could otherwise submit a syntactically valid
ContextDatum assembled from unrelated or caller-invented field values.

The remaining first-world seam is therefore assembly authority, not another field.

## Problem

ADR needs one exact authority that answers:

> do these independently reviewed field-level authority branches converge on one
> exact source world, and if they do, may their exact values be materialized through
> the frozen A02 ContextDatum publication path?

The answer must not be obtained by:

- trusting a caller-supplied ContextDatum object;
- comparing only human-readable values;
- accepting semantically equal but independently published predecessor worlds;
- deriving missing fields from source reputation or runtime defaults;
- treating `CONTEXT_WRITE` permission as scientific/semantic authority;
- modifying the frozen generic A02 ContextDatum contract.

## Decision

For the exact first Sustainable Corn planting-date world only, introduce a governed:

`AgronomicContextDatumAssemblyCompilation`

or equivalent content-addressed internal authority.

The assembly compilation must bind the exact field-providing predecessor authorities,
revalidate them through their own validators, prove exact predecessor convergence,
and freeze one exact A02-compatible `datumTemplate`.

Only a publication bridge that consumes an accepted exact assembly compilation may
publish the first governed real-source ContextDatum.

The resulting public object remains the existing standard:

```text
ContextDatum
```

DEC-0031 does not create a competing public ContextDatum type.

## Exact field-providing predecessors

The first assembly must bind at least the exact accepted refs for:

```text
DEC-0016
AgronomicRecordedOperationContextSemanticMappingCompilation

DEC-0017
AgronomicRecordedOperationContextEpistemicClassificationCompilation

DEC-0018
AgronomicRecordedOperationContextProvenanceClassificationCompilation

DEC-0020
AgronomicRecordedOperationContextSourceReferenceHashProjectionCompilation

DEC-0021
AgronomicRecordedOperationContextTemporalSupportClassificationCompilation

DEC-0023
AgronomicRecordedOperationContextSpatialSupportClassificationCompilation

DEC-0024
AgronomicContextNonQuantitativeUnitRepresentationCompilation

DEC-0025
AgronomicContextVerticalSupportNonApplicabilityCompilation

DEC-0026
AgronomicContextUncertaintyUnknownRepresentationCompilation

DEC-0028
AgronomicContextSourceAcquisitionAvailabilityProjectionCompilation

DEC-0030
AgronomicContextHistoricalTimezoneBoundaryResolutionCompilation
```

DEC-0019 is revalidated transitively through DEC-0020.

DEC-0022 and DEC-0029 are revalidated transitively through DEC-0030.

DEC-0015 is revalidated transitively through DEC-0023.

## DEC-0027 is deliberately not a ContextDatum predecessor

DEC-0027 establishes:

```text
targetRef.farmId =
  exact source-backed target_src_<64hex>
```

The frozen A02 ContextDatum does not contain `targetRef`.

Therefore DEC-0031 must not:

- inject `farmId` into ContextDatum;
- substitute `farmId` for `spatialSupport.geometryRef`;
- substitute `farmId` for A02 organization/tenant target scope;
- invent a geometryRef from source target identity.

DEC-0027 remains downstream target-world authority for DecisionProblem /
ContextManifest work.

## Exact predecessor convergence

The assembly validator must not accept predecessor branches merely because they
produce the same visible value.

It must prove exact authority-world convergence.

At minimum:

1. DEC-0017 must bind the exact DEC-0016 semantic-mapping ref used by assembly.
2. DEC-0018 must bind the exact DEC-0017 ref used by assembly.
3. DEC-0020 must replay the exact DEC-0018/source world used by assembly.
4. DEC-0021 must bind the exact DEC-0020 ref used by assembly.
5. DEC-0028 must bind the exact DEC-0020 ref used by assembly.
6. DEC-0023 must bind the exact DEC-0016 semantic mapping used by assembly.
7. DEC-0024 must bind the exact DEC-0016 semantic mapping used by assembly.
8. DEC-0025 must bind the exact DEC-0016 semantic mapping used by assembly.
9. DEC-0026 must bind the exact DEC-0016 semantic mapping used by assembly.
10. DEC-0030's revalidated chain must close through the exact DEC-0021 temporal
    support world used by assembly.
11. all branches must resolve to the exact same
    `crop.planting_date = DATE 2011-05-03` world.

Where exact AuthorityRef equality is available and required, semantic-value equality
is not a substitute.

## Exact datum template

The first accepted assembly template is:

```js
{
  contractVersion: "adr.context-datum.v1",

  semanticId: "crop.planting_date",

  value: {
    type: "DATE",
    date: "2011-05-03"
  },

  unit: "NOT_APPLICABLE",

  epistemicClass: "ASSERTION",

  provenanceClass: "EXTERNAL_PROVIDER",

  effectiveInterval: {
    start: "2011-05-03T05:00:00.000Z",
    end:   "2011-05-04T05:00:00.000Z"
  },

  availableAt: "2026-08-30T13:00:00.000Z",

  spatialSupport: {
    type: "FARM"
  },

  verticalSupport: null,

  temporalSupport: {
    type: "INTERVAL"
  },

  uncertainty: {
    type: "UNKNOWN",
    reasonCode:
      "ACCEPTED_EVIDENCE_UNCERTAINTY_NOT_ESTABLISHED"
  },

  source: {
    providerId:
      "github.com/isudatateam/datateam",

    sourceRef:
      "blob/4847e7b3b4aad42193de3f5f0da6f81f6b62dc50/scripts/cscap/chicago.ipynb#adr:JUPYTER_OUTPUT_TABLE_ROW_V1:cellIndex=3;outputIndex=0;mimeType=text%2Fplain;headerLineIndex=0;rowIndex=33",

    contentHash:
      "sha256:d27e8539ed45115419093d563cf44f0f364568efb4633781ea8120aaa2bb819f"
  }
}
```

No field in this template may be supplied as caller authority.

## Field ownership

The exact field ownership is:

```text
semanticId + value
  <- DEC-0016

epistemicClass
  <- DEC-0017

provenanceClass
  <- DEC-0018

source.providerId
  <- DEC-0019 through exact DEC-0020 replay

source.sourceRef + source.contentHash
  <- DEC-0020

temporalSupport
  <- DEC-0021

spatialSupport
  <- DEC-0023

unit
  <- DEC-0024

verticalSupport
  <- DEC-0025

uncertainty
  <- DEC-0026

availableAt
  <- DEC-0028

effectiveInterval
  <- DEC-0030
```

Assembly authority supplies no new scientific value.

Its job is convergence and publication binding only.

## Caller-selected logical identity

The frozen A02 publisher takes:

```text
logicalId
version
```

outside the datum payload.

DEC-0031 does not derive a global canonical ContextDatum id from:

- sourceRef;
- source content hash;
- SERF;
- target_src_<hash>;
- semanticId;
- effectiveInterval;
- assembly hash.

The caller may choose an opaque non-empty `logicalId` and opaque non-empty
`version`, subject to the existing AuthorityLedger immutability rules.

The assembly's semantic field authority does not become authority for naming.

## datumId and semantic identity

A02 inserts the exact `logicalId` as ContextDatum `datumId` before semantic
hashing.

Therefore two different caller-selected logical ids may produce different A02
semantic identities even when their scientific field templates are identical.

DEC-0031 does not alter this frozen behavior.

It also does not interpret `version` as numeric ordering, semantic versioning or
freshness.

## Publication target scope is not agronomic target identity

A02 publication also requires:

```text
target.organizationId
target.tenantId?
```

This is authorization/isolation scope.

It is not:

- SERF;
- source-native target identity;
- DEC-0027 `farmId`;
- geometry;
- DecisionProblem targetRef.

DEC-0031 must keep these identity domains separate.

## Writer authority is not semantic authority

Publishing the final ContextDatum requires the existing exact scoped operation:

```text
CONTEXT_WRITE
```

The writer must have a replayable `AuthorizationDecisionAudit` that binds:

- exact principal;
- exact organization/tenant;
- resourceType = CONTEXT_DATUM;
- resourceId = exact caller-selected logicalId;
- exact RoleAssignment refs;
- reproducible decision hash.

A valid writer cannot alter the accepted datum template.

Conversely, a semantic reviewer cannot publish without valid `CONTEXT_WRITE`.

## Reviewer and writer may differ

The semantic/assembly reviewer and the A02 ContextDatum creator are separate
authority roles.

DEC-0031 must not require them to be the same principal merely for implementation
convenience.

The assembly reviewer approves convergence of exact evidence authorities.

The ContextDatum writer exercises scoped publication permission.

## Publication bridge

Implementation should introduce an additive bridge conceptually equivalent to:

```text
publishAgronomicContextDatumFromAssembly({
  ledger,
  sourceRegistry,

  assemblyCompilationRef,

  logicalId,
  version,

  target,
  principal,
  authorizationDecisionAuditRef,

  audit
})
```

The bridge must:

1. revalidate the exact assembly compilation;
2. revalidate every exact field authority behind it;
3. derive the datum object only from the accepted assembly template;
4. reject caller datum/field overrides;
5. call the existing A02 `publishContextDatum`;
6. preserve the existing A02 `CONTEXT_WRITE` replay;
7. bind the exact assembly compilation ref in the direct ContextDatum publication
   audit;
8. bind exact predecessor refs or a replayable exact assembly ref sufficient to
   recover them;
9. return the standard A02 ContextDatum authority record.

## No modification to generic A02

DEC-0031 must not weaken or repurpose generic `publishContextDatum`.

Generic A02 remains capable of publishing other governed ContextDatum worlds under
their own authority paths.

The new bridge is a source-specific governed producer for this exact first
Sustainable Corn context world.

## Direct publication audit binding

The resulting ContextDatum's direct immutable publication audit must contain the
exact:

```text
AgronomicContextDatumAssemblyCompilation ref
```

as an input authority.

The audit should also expose a stable detail field identifying that assembly ref.

A specialized validation path must reject a ContextDatum that has identical public
fields but was published through generic A02 without the accepted assembly proof.

This preserves the distinction:

```text
valid generic ContextDatum
!=
validated first Sustainable Corn governed ContextDatum publication
```

## Internal assembly authority is not public wire

The exact DEC predecessor refs must remain internal provenance/governance authority.

They must not be serialized into the frozen public ContextDatum wire.

Public wire remains exactly A02.

This prevents internal repository authority topology from becoming a competing
public contract.

## Expected first public wire

For an example caller-selected:

```text
datum_id = ctx-gold-sustainable-corn-serf-planting-date
```

the first Gold should materialize:

```yaml
contract_version: adr.context-datum.v1

datum_id: ctx-gold-sustainable-corn-serf-planting-date

semantic_id: crop.planting_date

value:
  type: DATE
  date: 2011-05-03

unit: NOT_APPLICABLE

epistemic_class: ASSERTION

provenance_class: EXTERNAL_PROVIDER

effective_interval:
  start: 2011-05-03T05:00:00.000Z
  end: 2011-05-04T05:00:00.000Z

available_at: 2026-08-30T13:00:00.000Z

spatial_support:
  type: FARM

vertical_support: null

temporal_support:
  type: INTERVAL

uncertainty:
  type: UNKNOWN
  reason_code: ACCEPTED_EVIDENCE_UNCERTAINTY_NOT_ESTABLISHED

source:
  provider_id: github.com/isudatateam/datateam
  source_ref: blob/4847e7b3b4aad42193de3f5f0da6f81f6b62dc50/scripts/cscap/chicago.ipynb#adr:JUPYTER_OUTPUT_TABLE_ROW_V1:cellIndex=3;outputIndex=0;mimeType=text%2Fplain;headerLineIndex=0;rowIndex=33
  content_hash: sha256:d27e8539ed45115419093d563cf44f0f364568efb4633781ea8120aaa2bb819f

semantic_hash:
  <exact A02-generated semantic hash>
```

The example datum id is Gold fixture identity only.

It is not accepted as the global production id for this fact.

## No geometry injection

Because DEC-0023 establishes only:

```text
spatialSupport.type = FARM
```

the first public wire must not contain:

```text
geometry_ref
```

DEC-0031 cannot derive geometry from SERF or DEC-0027.

## No targetRef injection

The first ContextDatum public wire contains no targetRef.

DEC-0031 does not extend A02 with:

- farmId;
- fieldId;
- seasonId;
- zoneId;
- target_src_<hash>.

Target-world association remains a later DecisionProblem / ContextManifest
responsibility.

## No availableAt recomputation

DEC-0031 must use exactly:

```text
2026-08-30T13:00:00.000Z
```

from DEC-0028.

It must not recompute availability as:

- publication time;
- assembly review time;
- max predecessor acquisition time;
- current wall clock;
- effectiveInterval start.

## No effectiveInterval recomputation

DEC-0031 must use exactly the accepted DEC-0030 UTC boundaries.

It must not invoke:

- Node Date timezone rules;
- Python zoneinfo;
- OS tzdata;
- ICU;
- database timezone tables.

Timezone-rule replay belongs to DEC-0030 validation.

## No uncertainty upgrade

DEC-0031 must preserve:

```text
uncertainty.type = UNKNOWN
```

It must not reinterpret the exact calendar date as proof of `NONE`.

## No unit reinterpretation

DEC-0031 must preserve:

```text
unit = NOT_APPLICABLE
```

It must not rewrite this as:

- day;
- date;
- none;
- unitless;
- empty string.

## No value mutation

The public ContextDatum value remains:

```text
DATE 2011-05-03
```

The effectiveInterval timestamps do not convert the value to TIMESTAMP.

## No source identity widening

The exact public source wire remains the finite DEC-0020 projection.

DEC-0031 does not establish a generic GitHub/Jupyter sourceRef formatter.

## No generic assembly rule

DEC-0031 does not establish:

```text
any set of field authorities
  ->
ContextDatum
```

The first assembly compiler is finite to the exact accepted Sustainable Corn
planting-date world.

Future context semantics/providers require reviewed expansion.

## Authority shape

Conceptually:

```text
AgronomicContextDatumAssembly {
  contractVersion
  assemblyId

  predecessorRefs {
    contextSemanticMappingCompilationRef
    epistemicClassificationCompilationRef
    provenanceClassificationCompilationRef
    sourceReferenceHashProjectionCompilationRef
    temporalSupportClassificationCompilationRef
    spatialSupportClassificationCompilationRef
    unitRepresentationCompilationRef
    verticalSupportNonApplicabilityCompilationRef
    uncertaintyUnknownRepresentationCompilationRef
    sourceAcquisitionAvailabilityProjectionCompilationRef
    historicalTimezoneBoundaryResolutionCompilationRef
  }

  datumTemplate {
    contractVersion
    semanticId
    value
    unit
    epistemicClass
    provenanceClass
    effectiveInterval
    availableAt
    spatialSupport
    verticalSupport
    temporalSupport
    uncertainty
    source
  }

  convergenceProof
  rationale
}

AgronomicContextDatumAssemblyCompilation {
  contractVersion
  authorityClass
  assembly
  assemblyHash
  assemblyReviewRef
  losslessCoverage
  limitations
}
```

Exact implementation field names remain implementation-level after architecture
acceptance.

## Reviewer authority

Assembly publication requires an explicit:

`AgronomicContextDatumAssemblyReviewDecision`

or equivalent governed review authority.

The review must bind:

- every exact predecessor ref;
- exact cross-branch convergence;
- exact datumTemplate;
- absence of caller field authority;
- A02 compatibility;
- absence of targetRef/geometry widening.

## Mandatory review checks

An accepted assembly review should confirm at least:

1. `CONTEXT_SEMANTIC_MAPPING_AUTHORITY_VERIFIED`;
2. `EPISTEMIC_CLASSIFICATION_AUTHORITY_VERIFIED`;
3. `PROVENANCE_CLASSIFICATION_AUTHORITY_VERIFIED`;
4. `SOURCE_REFERENCE_HASH_AUTHORITY_VERIFIED`;
5. `TEMPORAL_SUPPORT_AUTHORITY_VERIFIED`;
6. `SPATIAL_SUPPORT_AUTHORITY_VERIFIED`;
7. `UNIT_REPRESENTATION_AUTHORITY_VERIFIED`;
8. `VERTICAL_SUPPORT_AUTHORITY_VERIFIED`;
9. `UNCERTAINTY_AUTHORITY_VERIFIED`;
10. `AVAILABLE_AT_AUTHORITY_VERIFIED`;
11. `EFFECTIVE_INTERVAL_AUTHORITY_VERIFIED`;
12. `EXACT_CONTEXT_SEMANTIC_WORLD_CONVERGENCE_VERIFIED`;
13. `EXACT_SOURCE_WORLD_CONVERGENCE_VERIFIED`;
14. `EXACT_TEMPORAL_WORLD_CONVERGENCE_VERIFIED`;
15. `EXACT_AUTHORITY_REF_CONVERGENCE_VERIFIED`;
16. `A02_CONTEXT_DATUM_TEMPLATE_COMPATIBILITY_VERIFIED`;
17. `NO_CALLER_FIELD_AUTHORITY`;
18. `NO_DATE_TO_TIMESTAMP_MUTATION`;
19. `NO_AVAILABLE_AT_RECOMPUTATION`;
20. `NO_TIMEZONE_HOST_RUNTIME_RECOMPUTATION`;
21. `NO_GEOMETRY_INFERENCE`;
22. `NO_TARGET_REF_INJECTION`;
23. `NO_FARM_ID_AS_GEOMETRY_OR_TENANT_SCOPE`;
24. `NO_GENERIC_CONTEXT_DATUM_ASSEMBLY_RULE`;
25. `NO_CONTEXT_MANIFEST_PUBLICATION`;
26. `NO_DECISION_PROBLEM_PUBLICATION`;
27. `NO_POLICY_RUNTIME_EXECUTION_OR_OUTCOME_INFERENCE`.

All mandatory checks are required for accepted assembly publication.

## Review dispositions

At minimum:

- `ACCEPT_CONTEXT_DATUM_ASSEMBLY`;
- `REJECT_CONTEXT_DATUM_ASSEMBLY`.

Rejected review cannot authorize the assembly compilation.

## Publication authorization checks

The actual A02 ContextDatum publication must independently prove:

1. exact `CONTEXT_WRITE` operation;
2. allowed = true;
3. exact creator principal;
4. exact organization/tenant scope;
5. resourceType = `CONTEXT_DATUM`;
6. resourceId = exact caller-selected logicalId;
7. at least one exact RoleAssignment ref;
8. reproduced decision hash;
9. direct authorization audit;
10. exact ContextDatum publication audit actor.

Assembly review cannot replace these checks.

## Specialized final validation

Implementation should expose a validation path conceptually equivalent to:

```text
validateAgronomicContextDatumAssemblyPublicationAuthority({
  ledger,
  sourceRegistry,
  contextDatumRef
})
```

It must:

1. run standard A02 `validateContextDatumAuthority`;
2. locate the exact direct publication audit;
3. require the exact accepted assembly compilation ref;
4. revalidate the assembly compilation and all field predecessors;
5. derive the expected datum template;
6. normalize it using the actual ContextDatum logicalId;
7. require exact semantic equality with the stored ContextDatum;
8. require exact semantic hash equality;
9. require standard A02 write authorization still valid.

An ordinary ContextDatum lacking the assembly proof must fail this specialized
validation even if its visible fields match.

## Content addressing

Changing any material assembly element must change assembly identity or fail review,
including:

- any predecessor ref;
- semantic/value;
- unit;
- epistemic class;
- provenance class;
- effectiveInterval;
- availableAt;
- spatial support;
- vertical support;
- temporal support;
- uncertainty;
- source provider/ref/hash;
- convergence proof;
- review decision;
- rationale;
- limitations.

The caller-selected ContextDatum logicalId/version remain publication-envelope
inputs and are not part of assembly identity.

## First Gold

The first Gold must replay the exact cumulative Sustainable Corn authority chain
through DEC-0030 and prove:

```text
11 exact field-authority branches
        ↓
exact AuthorityRef convergence
        ↓
one reviewed A02-compatible datumTemplate
        ↓
exact scoped CONTEXT_WRITE authorization
        ↓
standard ContextDatum publication
        ↓
specialized assembly-publication validation
        ↓
public A02 wire
```

The Gold must verify the exact field values listed in this DEC.

## Mandatory negative Gold

At minimum fail closed for:

- wrong DEC-0016 mapping ref;
- DEC-0017 predecessor ref drift;
- DEC-0018 predecessor ref drift;
- DEC-0020 source-world ref drift;
- DEC-0021 temporal branch drift;
- DEC-0023 mapping/target branch drift;
- DEC-0024 mapping ref drift;
- DEC-0025 mapping ref drift;
- DEC-0026 mapping ref drift;
- DEC-0028 source projection ref drift;
- DEC-0030 temporal branch drift;
- semantically equal but different AuthorityRef substitution where exact equality is
  required;
- semanticId drift;
- DATE value drift;
- DATE to TIMESTAMP mutation;
- unit drift;
- epistemicClass drift;
- provenanceClass drift;
- effectiveInterval drift;
- availableAt drift;
- spatialSupport FIELD substitution;
- geometryRef injection;
- verticalSupport non-null injection;
- temporalSupport INSTANT substitution;
- uncertainty NONE substitution;
- uncertainty reasonCode drift;
- providerId drift;
- sourceRef drift;
- contentHash drift;
- caller datum override;
- caller field override;
- DEC-0027 farmId inserted as geometryRef;
- DEC-0027 farmId inserted as organization/tenant target;
- missing assembly review;
- incomplete assembly review;
- unauthorized assembly reviewer;
- rejected assembly review;
- assembly review/publication mismatch;
- missing CONTEXT_WRITE authorization;
- wrong-context logicalId authorization;
- denied context write;
- wrong RoleAssignment;
- cross-tenant publication;
- publication audit actor mismatch;
- generic A02 ContextDatum with matching visible fields but no accepted assembly
  proof;
- ContextManifest creation;
- DecisionProblem creation;
- AuthorizedContextReference creation;
- ResolvedContextDatumReceipt creation;
- Policy/runtime/execution/Outcome creation.

## No ContextManifest yet

DEC-0031 creates the first governed real-source ContextDatum only.

It does not authorize ContextManifest inclusion.

A04 still requires a validated DecisionProblem targetRef and evidence cutoff.

That remains the next downstream frontier.

## No DecisionProblem yet

DEC-0027 provides only one targetRef component:

```text
farmId
```

It does not establish a complete DecisionProblem.

DEC-0031 must not create missing organization/tenant/season/field/zone semantics as a
shortcut.

## Consequences

Positive:

- closes the gap between field-level authority and actual A02 publication;
- creates the first standard ContextDatum backed by the exact real-source authority
  chain;
- preserves the frozen public ContextDatum wire;
- keeps scientific review distinct from scoped write permission;
- makes assembly provenance replayable and fail-closed;
- prevents a valid writer from manufacturing scientific field authority;
- keeps target-world semantics out of A02.

Costs:

- one final internal assembly authority/review layer is required;
- publication requires both semantic assembly proof and A02 write authorization;
- specialized validation is required to distinguish this governed first-world
  publication from an ordinary generic A02 datum with matching visible values;
- logicalId/version remain intentionally caller-selected rather than globally
  canonical.

## Local completeness

If DEC-0031 is accepted and implemented successfully:

```text
first Sustainable Corn planting-date ContextDatum
= PUBLISHABLE
```

This is only ContextDatum-local completeness.

It does not mean:

- ContextManifest is publishable;
- DecisionProblem is complete;
- targetRef is complete;
- cross-provider target identity is solved;
- all ContextDatum semantics are generically compilable;
- runtime decision/execution authority is complete.

## Remaining downstream work

After DEC-0031 implementation closure, the next expected product-layer frontier is:

```text
DecisionProblem / targetRef completion
        +
ContextManifest evidence-cutoff inclusion
```

The exact next DEC should be chosen only after a fresh A01/A04 authority audit.

## Architecture acceptance gate

Before implementation may begin:

1. this DEC must receive explicit user acceptance;
2. the accepted documentation head must receive fresh Constitution qualification;
3. accepted docs must close through the normal Draft/successor path;
4. qualified head -> merge must have `files=[]`;
5. post-merge Constitution must succeed.

Only then may an independent implementation branch start.

## Final decision statement

DEC-0031 proposes exactly one new authority boundary:

> the first real-source ContextDatum may be published only when the exact accepted
> field-level authority branches converge through a reviewed, content-addressed
> assembly compilation, after which the existing A02 scoped CONTEXT_WRITE path may
> materialize the exact assembly template as a standard ContextDatum. Caller write
> permission cannot supply field semantics; internal predecessor refs remain
> provenance authority rather than public wire; DEC-0027 target identity is not
> injected into A02.

No generic assembly engine, targetRef completion, ContextManifest publication,
DecisionProblem creation, runtime policy, execution or Outcome authority is
accepted by this proposal.

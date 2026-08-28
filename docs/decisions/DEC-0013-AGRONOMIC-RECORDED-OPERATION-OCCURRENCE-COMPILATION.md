# DEC-0013 — Governed Agronomic Recorded-Operation Occurrence Compilation

Status: **PROPOSED**

Date: 2026-08-29

## Context

ADR has now accepted source-semantic authorities for:

- hard obligations;
- normative modality;
- agronomic goal conditions;
- repeated-action regimens;
- source-defined action realizations;
- conditional compound action realizations;
- scoped planning-versus-actual source-authority routing.

DEC-0012 established the source-governance relation:

```text
planning source
  -> PLANNED_MANAGEMENT_GUIDANCE

actual-operation record source
  -> ACTUAL_FIELD_OPERATION_RECORD

subject scope
  -> FIELD_OPERATION_OCCURRENCE

routing relation
  -> ACTUAL_OCCURRENCE_DEFER_TO_RECORD_SOURCE
```

DEC-0012 intentionally stopped before event-level ingestion.

Its accepted unresolved frontier explicitly includes:

1. event-level field-log ingestion;
2. exact operation-event schema for external agronomic logs;
3. field-log row source-faithful extraction;
4. planned-versus-actual reconciliation;
5. missing-log completeness semantics;
6. execution identity across multiple log tables;
7. equipment/material/rate normalization;
8. integration with Outcome externalExecutionRef;
9. data-rights enforcement for restricted rows.

The next problem is therefore no longer:

`which source should answer the actual-operation question?`

The next problem is:

`what exact authority represents that a governed source records a specific agronomic operation as having occurred?`

## Why DEC-0013 is now source-qualified

DEC-0012 used KBS public catalog metadata because the KBS field-log rows raised redistribution-rights concerns.

That was sufficient for source routing, but insufficient for event-level Gold.

A separate public source now closes the evidence gap.

### Sustainable Corn CAP public dataset

Dataset:

`Sustainable Corn CAP Research Data (USDA-NIFA Award No. 2011-68002-30190)`

Persistent identifier:

`https://doi.org/10.15482/USDA.ADC/1411953`

The public repository metadata states that the dataset contains:

- `Field Operations`;
- planting dates;
- harvesting dates;
- tillage dates;
- fertilizer application dates;
- seeding rate;
- fertilizer and pesticide type and application rate.

The published repository record is Public and licensed CC0.

The published resource set includes:

`Sustainable_Corn_Research_Data_2011-2015.xlsx`

whose documented sheets include:

`Field Operations`.

### Public exact-row evidence

The Iowa State Data Team public repository:

`https://github.com/isudatateam/datateam`

contains a committed notebook:

`scripts/cscap/chicago.ipynb`

that executes:

```sql
SELECT
  uniqueid,
  operation,
  to_char(valid, 'Mon dd,YYYY'),
  cropyear,
  valid
FROM operations
ORDER BY valid ASC
```

and retains the rendered query outputs in the committed notebook artifact.

The public notebook contains exact operation rows including:

```text
2011-05-03 | plant_corn | SERF    | 2011
2011-06-18 | plant_corn | KELLOGG | 2011
```

and:

```text
2013-05-08 | termination_rye_soy  | KELLOGG | 2013
2013-05-08 | termination_rye_corn | KELLOGG | 2013
```

At the architecture-review frontier, the notebook is pinned by repository blob identity:

`4847e7b3b4aad42193de3f5f0da6f81f6b62dc50`

The preferred implementation Gold remains the published CC0 dataset artifact itself, not an inferred reconstruction from notebook output.

The notebook rows establish that exact dated real-operation records are publicly inspectable and can be used to test the proposed semantic boundary.

## Decision under proposal

Introduce a separate source-backed authority:

`AgronomicRecordedOperationOccurrence`

and a governed publication authority:

`AgronomicRecordedOperationOccurrenceCompilation`.

Candidate contracts:

```text
adr.agronomic-recorded-operation-occurrence.v1
adr.agronomic-recorded-operation-occurrence-compilation.v1
```

The authority means only:

`the exact governed source record states that the specified agronomic operation was recorded as occurring for the specified source-native subject and temporal support.`

It is deliberately named **RecordedOperationOccurrence**, not simply **Execution**, because the source record is evidence about an operation occurrence.

It is not itself proof that ADR executed the operation.

## Core semantic distinction

DEC-0013 must preserve three separate layers:

```text
PLANNED MANAGEMENT
  source says what was intended/planned

RECORDED OPERATION OCCURRENCE
  record source says an operation was recorded as occurring

ADR EXECUTION AUTHORITY
  ADR-owned runtime/execution system proves its own execution lineage
```

These layers must not be collapsed.

For example:

```text
protocol:
  plant corn on planned date X

field-operation record:
  plant_corn recorded on actual date Y

ADR execution:
  no ADR execution authority necessarily exists
```

DEC-0013 governs the second line only.

## Why generic Claim is insufficient as the final authority

The existing Scientific Compiler can materialize source-faithful Claim candidates and reviewed Claim authority.

That is useful for publications, protocols and scientific assertions.

However its v1 claim-type set is:

- SEMANTIC_DEFINITION;
- PARAMETER;
- RELATIONSHIP;
- BIOLOGICAL_PATTERN;
- CAUSAL_EFFECT;
- STATISTICAL_ASSOCIATION;
- MODEL_ASSUMPTION;
- OPERATIONAL_RECOMMENDATION;
- BOUNDARY_CONSTRAINT;
- EVALUATION_CLAIM.

A dated operation record is not faithfully represented by pretending it is:

- an OPERATIONAL_RECOMMENDATION;
- a RELATIONSHIP;
- an EVALUATION_CLAIM;
- a BOUNDARY_CONSTRAINT;
- or another scientific proposition class.

Using one of those types merely because the generic Claim carrier already exists would be semantic laundering.

DEC-0013 therefore does not require mutating Scientific Compiler v1 in place.

Implementation may reuse exact Source / SourceArtifact / locator / audit primitives, but the final event authority should remain a distinct contract.

A future Scientific Compiler v2 could separately add an event-fact candidate class if justified.

That is not required by this decision.

## Why AGRONOMIC_POLICY_INPUT is the wrong scientific-use target

Existing agronomic policy compilation authorities consume exact qualified knowledge for:

`AGRONOMIC_POLICY_INPUT`.

A recorded operation occurrence is not policy guidance.

Qualifying:

`2011-05-03 | SERF | plant_corn`

for:

`AGRONOMIC_POLICY_INPUT`

would misstate its authority class.

If a qualification target is used upstream of DEC-0013, the candidate v1 use is instead:

`AGRONOMIC_OPERATION_OCCURRENCE_EVIDENCE`.

This use means only that the exact source-backed evidence is eligible to support a recorded-operation occurrence authority.

It does not make the row:

- a recommendation;
- a requirement;
- a permission;
- a prohibition;
- a Policy action;
- a runtime datum;
- an Outcome.

## Why ContextDatum is insufficient as the final source-occurrence authority

ADR already has a frozen public `ContextDatum` contract.

That contract is intentionally broad enough to represent target-world facts with epistemic classes such as:

- `OBSERVATION`;
- `ASSERTION`;
- `DERIVED`;
- `STATE_ESTIMATE`.

The frozen architecture explicitly gives examples including:

- planter telemetry event;
- grower-stated planting date;
- `management.irrigation_event`.

DEC-0013 therefore must not claim that ADR lacks all operation/event representation.

The narrower gap is **source-record occurrence authority before target-world reconciliation**.

A public source row such as:

```text
SERF | 2011-05-03 | plant_corn
```

does not yet provide the information required to publish a faithful target `ContextDatum`.

### ContextDatum requires target-world authority

Current ContextDatum publication is scoped to an ADR target and `CONTEXT_WRITE` authorization.

A source-native site identifier such as:

`SERF`

is not automatically an ADR:

- organization;
- tenant;
- farm;
- field;
- season;
- zone.

Publishing the row directly as target ContextDatum would require identity reconciliation that DEC-0013 explicitly does not infer.

### ContextDatum v1 requires timestamped effectiveInterval

Current ContextDatum v1 requires:

```text
effectiveInterval.start = RFC3339 timestamp
effectiveInterval.end   = RFC3339 timestamp
availableAt             = RFC3339 timestamp
```

The proposed first Gold source supports only:

`2011-05-03`

at day precision.

DEC-0013 must not fabricate:

- midnight UTC;
- local midnight;
- noon;
- start time;
- end time;
- timezone.

Therefore the exact source occurrence cannot be losslessly forced into ContextDatum v1 without a separately governed temporal projection.

### ContextDatum source is provider provenance, not source-artifact review closure

ContextDatum v1 retains:

```text
source {
  providerId
  sourceRef
  contentHash
}
```

That is useful runtime provenance.

DEC-0013 requires stronger source-governance closure for the source record itself:

- exact `Source`;
- exact `SourceArtifact`;
- retained exact bytes;
- row/source locator;
- rights snapshot;
- governed operation-semantic review.

Those are different responsibilities.

### Required relationship

The proposed relationship is:

```text
exact external operation record
  ↓
AgronomicRecordedOperationOccurrence
  source-native identity + source precision + exact artifact lineage
  ↓
separate identity / temporal / semantic projection, if justified
  ↓
ContextDatum
  target-world fact usable by ContextManifest/runtime
```

DEC-0013 does not itself create the downstream ContextDatum.

A later projection must preserve the original occurrence authority as lineage and must not silently upgrade:

- source-native subject identity;
- temporal precision;
- epistemic class;
- normalized operation semantics.

If a source already provides a fully reconciled ADR target, exact timestamp support and governed context-write authority, an implementation may be able to publish ContextDatum directly.

That does not eliminate the need for a source-record authority when those conditions are absent.

## Why packages/operations is insufficient

The current pilot operational-job contract explicitly declares:

`NONE_OPERATIONAL_METADATA_IS_NOT_DOMAIN_AUTHORITY`.

Operational job and attempt records are platform-operational metadata.

They are intentionally non-authority.

An externally published agronomic record stating that planting occurred is domain evidence.

Therefore it must not be stored as an OperationalJob/OperationalAttempt merely to obtain timestamps or status fields.

## Why ExecutionReceipt is insufficient

A source-backed field-operation record is not automatically an ADR ExecutionReceipt.

DEC-0013 must not claim that:

- the operation was dispatched by ADR;
- ADR authorized the action;
- ADR owned the actuator;
- ADR generated the receipt;
- the exact machine command is known;
- the exact operator is known;
- execution start/end timestamps exist.

A source record may later be reconciled with execution evidence.

That later reconciliation is separate authority.

## Why Outcome is insufficient

Outcome is downstream evidence associated with a decision and/or execution context.

A row stating:

`plant_corn recorded on 2011-05-03 at SERF`

is not itself:

- crop response;
- measured performance;
- treatment effect;
- yield;
- soil response;
- post-decision evaluation.

Using Outcome to represent the operation record would conflate occurrence evidence with resulting state/effect evidence.

DEC-0013 therefore remains upstream of Outcome.

## Candidate v1 semantic shape

An illustrative v1 object is:

```text
AgronomicRecordedOperationOccurrence {
  contractVersion

  occurrenceId

  sourceRef
  sourceArtifactRef
  sourceArtifactContentHash
  sourceLocator

  recordSemanticRole:
    ACTUAL_FIELD_OPERATION_RECORD

  occurrenceSemantics {
    occurrenceClass:
      SOURCE_RECORDED_OPERATION_OCCURRENCE

    sourceOperationCode:
      plant_corn

    normalizedOperation {
      actionCode:
        PLANT

      subject {
        kind:
          CROP

        code:
          CORN
      }
    }

    sourceNativeSubject {
      siteId:
        SERF

      plotId:
        NOT_REPORTED
    }

    temporalSupport {
      kind:
        CALENDAR_DATE

      date:
        2011-05-03

      precision:
        DAY
    }
  }

  authorityBindings[]
  transformationRationale
}
```

The exact implementation identifiers remain subject to post-acceptance implementation review.

## Recorded occurrence, not absolute physical truth

The v1 authority class is intentionally:

`SOURCE_RECORDED_OPERATION_OCCURRENCE`.

It means:

`the exact governed record source records the operation as occurring.`

It does not establish metaphysical certainty that the physical event happened exactly as recorded.

Source errors, transcription errors, corrections or later superseding records remain possible.

ADR preserves the source-backed occurrence authority and its provenance.

A later correction or reconciliation authority may supersede or qualify that record.

## Required source identity

Publication must close to exact:

- Source;
- SourceArtifact;
- exact retained bytes;
- exact source locator;
- rights snapshot;
- source-native record identity sufficient to locate the row.

A website description saying that the dataset contains field operations is not sufficient to mint an occurrence.

The occurrence requires event-level record content.

## Rights closure

DEC-0013 separates:

1. authority semantics; and
2. whether exact evidence may be retained or redistributed in a particular environment.

Public Gold fixtures must use exact source evidence with rights permitting repository retention.

For the proposed Sustainable Corn Gold source:

`CC0`

closes that public-fixture redistribution concern.

Restricted agronomic logs may still be ingested in private tenant-scoped storage if separately authorized, but acceptance of DEC-0013 does not establish any right to republish restricted rows.

No source-rights rule may be weakened to make a test pass.

## Source locator

The occurrence must point to the exact event evidence.

Acceptable locator forms may include existing exact artifact locator primitives such as:

- BYTE_RANGE;
- DOCUMENT_COORDINATE;
- exact structured-row coordinate if separately governed.

A locator that points only to:

- the dataset landing page;
- a protocol;
- a data dictionary;
- a sheet name without row identity;
- a query description without result identity

is insufficient for an occurrence authority.

## Source-native subject identity

DEC-0013 v1 preserves source-native subject identity.

For the Sustainable Corn example:

`siteId = SERF`

is source-native identity.

DEC-0013 must not silently convert that identifier into an ADR:

- organization;
- tenant;
- field;
- season;
- treatment;
- runtime target

unless separately governed identity-reconciliation authority exists.

Unknown mapping remains unresolved.

## Plot identity

If plot identity is explicitly present in the event record, it may be retained.

If plot identity is absent from the exact evidence, DEC-0013 must record it as not reported or omit it according to the final closed contract.

It must not infer a plot from:

- site defaults;
- nearby records;
- treatment structure;
- protocol design;
- notebook ordering.

## Temporal semantics

Source operation records may have only day-level temporal support.

DEC-0013 v1 therefore must not require fake timestamps.

If the source reports only:

`2011-05-03`

then the authority must preserve:

```text
temporalSupport.kind = CALENDAR_DATE
date = 2011-05-03
precision = DAY
```

It must not synthesize:

- 00:00:00Z;
- local noon;
- start time;
- end time;
- execution duration.

Timestamp precision may be added only when explicitly supported by the source.

## Operation normalization

The source-native operation code must always be retained.

For example:

`plant_corn`.

A normalized operation may also be published only if governed review establishes the mapping.

For the proposed Gold example:

```text
plant_corn
  -> actionCode = PLANT
  -> subject.kind = CROP
  -> subject.code = CORN
```

The normalized mapping is not a lexical free-for-all.

Ambiguous, local or undocumented codes must remain source-native until separately adjudicated.

## No normative-force inference

A record that:

`plant_corn`

occurred does not establish:

- REQUIRE PLANT;
- SHOULD PLANT;
- PERMITTED PLANT;
- optimal planting;
- compliant planting;
- recommended planting.

Occurrence and normative force are different semantic axes.

## No plan-adherence inference

If the plan says:

`plant on May 1`

and a record says:

`plant_corn on May 3`

DEC-0013 may preserve the recorded May 3 occurrence.

It does not automatically conclude:

- late execution;
- deviation;
- noncompliance;
- agronomic harm;
- operator failure.

Those require planned-versus-actual reconciliation and evaluation authority.

## No absence-equals-nonoccurrence inference

If no event row is found, ADR must not mint:

`operation did not occur`.

Absence may mean:

- operation did not occur;
- row is missing;
- record source is incomplete;
- query scope is wrong;
- data are unavailable;
- access is restricted;
- record was corrected elsewhere.

DEC-0013 v1 therefore governs positive recorded occurrences only.

Negative occurrence authority is explicitly out of scope.

## No source completeness inference

A source designated:

`ACTUAL_FIELD_OPERATION_RECORD`

by DEC-0012 is not automatically exhaustive.

An occurrence row establishes that one event is recorded.

It does not establish that the source contains every operation.

## No execution identity synthesis

DEC-0013 must not invent:

- operationId from a source field that is not an operation identifier;
- machine task ID;
- work order ID;
- actuator command ID;
- operator identity;
- provider execution ID.

ADR may create a deterministic internal `occurrenceId` for content addressing.

That internal identifier must remain distinguishable from source-native execution identity.

## Deterministic occurrence identity

A candidate v1 `occurrenceId` should be derived from content-addressed semantics including at least:

- exact sourceRef;
- exact sourceArtifactRef/content hash;
- exact source locator;
- source-native operation code;
- source-native subject identity;
- exact temporal support;
- governed normalized operation semantics, if present.

Changing any material element must change the semantic hash.

## Corrections and duplicates

Two source rows must not be merged merely because they share:

- date;
- site;
- operation code.

They may be:

- duplicates;
- repeated passes;
- separate plots;
- corrections;
- distinct operations at day-level precision.

DEC-0013 v1 must preserve row identity and must not deduplicate agronomic events by semantic guess.

Duplicate/correction adjudication remains separate unless exact source metadata proves lineage.

## No mutation of SourceRegistry v1

SourceRegistry v1 already supports:

- DATASET_DOCUMENTATION;
- OTHER;
- exact SourceArtifact bytes;
- rights snapshots;
- acquisition metadata;
- content-addressed retention.

DEC-0013 does not require mutating SourceRegistry source-type enums in place.

A future dedicated:

`AGRONOMIC_OPERATION_LOG`

source type may be proposed separately.

The operational role already established by DEC-0012 is a more precise semantic dimension than a generic source type.

## No mutation of Scientific Compiler v1

DEC-0013 must not add a new candidate type to:

`CLAIM_CANDIDATE_TYPES`

inside the accepted Scientific Compiler v1 merely to force event rows through a scientific-claim pipeline.

If implementation later concludes a shared event candidate is desirable, that requires an additive versioned compiler contract.

## No Policy mutation

DEC-0013 does not add:

- PLANT;
- TILL;
- APPLY;
- IRRIGATE;
- HARVEST

to any deployed Policy actionSpace.

It does not change actionSemantics.

A recorded action may exist even when no corresponding ADR Policy is deployed.

## No runtime authority

DEC-0013 does not create:

- RuntimePlan;
- RuntimeEligibility;
- RuntimeBinding;
- RuntimeAlternativeSet;
- RuntimeResult;
- DecisionResult.

The occurrence is evidence about recorded field history, not a runtime decision.

## No Outcome authority

DEC-0013 does not create Outcome.

A later Outcome may reference separately governed external execution/occurrence evidence, but that bridge is not part of v1.

## No causal-effect authority

A recorded operation occurrence cannot establish:

`operation caused outcome`.

Causal effect still requires separate scientific/evaluation authority.

## Relationship to DEC-0012

DEC-0012 answers:

`which source role governs actual-operation questions?`

DEC-0013 answers:

`what exact positive operation occurrence does that record evidence support?`

The relation is:

```text
AgronomicSourceAuthorityRoutingCompilation
  establishes source role

exact operation record evidence
  establishes event content

AgronomicRecordedOperationOccurrenceCompilation
  publishes governed recorded-occurrence authority
```

DEC-0013 does not require every occurrence source to have a DEC-0012 routing authority.

A standalone source can be self-evidently an actual-operation dataset through separately reviewed metadata.

However, when an accepted routing authority exists for the same subject scope, implementation should preserve that lineage where applicable.

## Candidate publication authority shape

A candidate publication object is:

```text
AgronomicRecordedOperationOccurrenceCompilation {
  contractVersion:
    adr.agronomic-recorded-operation-occurrence-compilation.v1

  authorityClass:
    AGRONOMIC_RECORDED_OPERATION_OCCURRENCE_COMPILATION_AUTHORITY

  occurrence:
    AgronomicRecordedOperationOccurrence

  sourceArtifactRefs[]
  sourceEvidenceRefs[]

  sourceRoleAuthorityRefs[]
  semanticReviewDecisionRefs[]

  occurrenceHash

  losslessCoverage:
    COMPLETE
}
```

## Meaning of losslessCoverage = COMPLETE

For DEC-0013 v1, COMPLETE means only that the targeted single-record occurrence semantics are represented without material source-backed loss.

It may require preservation of:

- source-native operation code;
- source-native subject identity;
- exact temporal support;
- exact source locator;
- any reviewed normalized operation semantics;
- exact source provenance.

It does not mean:

- field history is complete;
- all operations are known;
- execution details are complete;
- plan adherence is known;
- Outcome is known;
- causal effect is known.

## Required governed semantic review

Publication must require explicit review confirming at least:

1. exact event-level source evidence exists;
2. the row is from an actual-operation record source or otherwise clearly represents recorded field-operation occurrence;
3. source-native operation code is retained exactly;
4. source-native subject identity is retained exactly;
5. temporal support preserves source precision;
6. normalized operation semantics do not exceed the source;
7. no normative force is inferred;
8. no runtime/ADR execution identity is inferred;
9. no nonoccurrence is inferred from missing data;
10. no Outcome or causal-effect authority is created.

Keyword matching on operation names is insufficient authority.

## Mandatory negative cases

Implementation acceptance must prove at least:

1. a planned protocol statement cannot mint a recorded occurrence;
2. a dataset landing page saying that field operations exist cannot mint a specific occurrence;
3. a data dictionary row cannot mint a specific occurrence without event data;
4. a record with operation code but no temporal support fails closed for v1;
5. a record with date but no operation identity fails closed;
6. a source-native site ID cannot be silently converted to an ADR field target;
7. a source-native operation code cannot be silently canonicalized when ambiguous;
8. absence of a matching row does not mint NON_OCCURRENCE;
9. two same-day same-operation rows are not automatically deduplicated;
10. a recorded occurrence cannot become REQUIRE/SHOULD/PERMITTED/PROHIBIT;
11. a recorded occurrence cannot become ExecutionReceipt;
12. a recorded occurrence cannot become Outcome;
13. a recorded occurrence cannot become DecisionResult or RuntimeBinding;
14. a wrong or unavailable SourceArtifact fails closed;
15. source-artifact hash drift fails closed;
16. row/source-locator drift changes occurrence identity or fails review closure;
17. rights-insufficient evidence cannot be copied into public Gold merely because it is technically accessible.

## Real-source Gold target

Preferred implementation source:

`Sustainable Corn CAP Research Data (USDA-NIFA Award No. 2011-68002-30190)`

DOI:

`https://doi.org/10.15482/USDA.ADC/1411953`

Public repository page:

`https://figshare.com/articles/dataset/Sustainable_Corn_CAP_Research_Data_USDA-NIFA_Award_No_2011-68002-30190_/24851877`

The repository metadata explicitly states:

- Public Access Level = Public;
- Licence = CC0;
- the main workbook contains Field Operations;
- field management information includes planting, harvesting, tillage and fertilizer application dates.

Public bootstrap evidence for architecture review:

`https://github.com/isudatateam/datateam/blob/main/scripts/cscap/chicago.ipynb`

Pinned notebook blob:

`4847e7b3b4aad42193de3f5f0da6f81f6b62dc50`

Candidate first positive Gold event:

```text
date:
  2011-05-03

sourceOperationCode:
  plant_corn

sourceNativeSiteId:
  SERF

cropYear:
  2011
```

Preferred implementation should re-materialize the equivalent event from the published CC0 dataset artifact and exact Field Operations row rather than treating this markdown decision as event evidence.

## Why KBS is not the first DEC-0013 Gold row

KBS remains the source that established the planning-versus-actual routing architecture in DEC-0012.

However, the earlier KBS data-use review did not establish a sufficiently clear basis for republishing exact restricted field-log rows in a public GitHub Gold fixture.

DEC-0013 must not weaken that boundary.

The Sustainable Corn CAP dataset provides:

- actual field-operation semantics;
- public access;
- CC0 redistribution rights;
- exact dated real records.

It is therefore the safer first event-level Gold source.

KBS event ingestion may be revisited later under rights-compliant retention.

## Explicitly unresolved after DEC-0013

Even if accepted and implemented, ADR will still leave at least:

1. planned-versus-actual reconciliation;
2. operation-log completeness semantics;
3. negative/nonoccurrence authority;
4. source corrections and event supersession semantics;
5. cross-source event identity;
6. equipment identity normalization;
7. product/material identity normalization;
8. quantitative rate normalization;
9. operator identity;
10. start/end timestamp semantics;
11. machine execution receipt reconciliation;
12. connection to Outcome externalExecutionRef;
13. runtime use of prior-operation history;
14. target/field identity reconciliation;
15. treatment/plot identity reconciliation.

These must not be collapsed into DEC-0013 v1.

## Acceptance targets

Before implementation is authorized, architecture review must confirm:

1. recorded actual-operation occurrence is materially different from planning semantics;
2. source role routing from DEC-0012 is not itself event evidence;
3. generic scientific Claim types are not a sufficient final event authority;
4. AGRONOMIC_POLICY_INPUT is not the correct use classification for operation occurrence evidence;
5. pilot OperationalJob/Attempt metadata is explicitly non-domain-authority and cannot substitute;
6. Outcome is downstream and cannot substitute;
7. a source-backed occurrence is not automatically an ADR ExecutionReceipt;
8. source-native identity must be preserved;
9. temporal precision must not be fabricated;
10. occurrence authority is positive-only in v1;
11. missing rows do not imply nonoccurrence;
12. public Gold evidence must have rights permitting retention;
13. implementation is additive and does not mutate accepted SourceRegistry, Scientific Compiler, Policy, Outcome or runtime contracts in place;
14. Sustainable Corn CAP provides a legitimate public real-source Gold target;
15. the first implementation remains source-generic and does not hard-code SERF, corn or Sustainable Corn CAP in core contracts.

## Proposed post-acceptance implementation gate

If explicitly accepted, implementation should begin on a separate branch created from the resulting accepted DEC merge head.

The first implementation slice should contain only:

1. recorded-occurrence contract;
2. occurrence semantic review authority;
3. exact Source/SourceArtifact closure;
4. content-addressed occurrence publication;
5. one public real-source positive Gold event;
6. mandatory negative boundary cases;
7. dedicated workflow/acceptance lane if required.

It must not include:

- planned-versus-actual reconciliation;
- Outcome integration;
- machine execution reconciliation;
- runtime use;
- Policy mutation;
- completeness inference.

## Proposal status

This decision remains **PROPOSED**.

No implementation is authorized by this document until explicit architecture acceptance.

Acceptance of this proposal would establish only the architecture for governed positive source-recorded agronomic operation occurrence.

It would not establish that any source row is an ADR execution receipt, an Outcome, a normative instruction, a complete field history, or a causal claim.

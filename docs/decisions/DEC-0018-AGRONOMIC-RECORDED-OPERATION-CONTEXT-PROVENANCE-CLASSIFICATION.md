# DEC-0018 — Governed Recorded-Operation Context Provenance Classification

Status: **PROPOSED**

Date: 2026-09-01

## Context

DEC-0013 established exact source-recorded operation occurrence authority.

The first real occurrence remains:

```text
siteid = SERF
sourceOperationCode = plant_corn
date = 2011-05-03
precision = DAY
recordSemanticRole = ACTUAL_FIELD_OPERATION_RECORD
occurrenceClass = SOURCE_RECORDED_OPERATION_OCCURRENCE
```

DEC-0014 established source-scoped operation semantic normalization:

```text
plant_corn -> PLANT / CROP:CORN
```

DEC-0016 established exact context semantic/value mapping:

```text
PLANT / CROP:CORN
CALENDAR_DATE 2011-05-03 / DAY
  ->
crop.planting_date
DATE 2011-05-03
```

DEC-0017 established the first governed epistemic projection:

```text
crop.planting_date
DATE 2011-05-03
  ->
epistemicClass = ASSERTION
```

The chain still does not answer:

> through which actor/channel did the mapped context value enter ADR?

The Frozen Context Contract defines ProvenanceClass as:

> the actor/channel through which a datum entered ADR.

Frozen values are:

```text
USER
AGRONOMIST
SENSOR
MACHINERY
REMOTE_SENSING
EXTERNAL_PROVIDER
CUSTOMER_SYSTEM
LABORATORY
MODEL
PLATFORM
```

EpistemicClass and ProvenanceClass are explicitly orthogonal.

The current Sustainable Corn chain contains more than one Source:

1. the exact parent occurrence source/artifact containing the source-recorded operation/date;
2. the DEC-0014 semantic-normalization source/artifact explaining the meaning of `plant_corn`.

Those sources play different roles.

The final context value:

```text
crop.planting_date = DATE 2011-05-03
```

derives its **value** from the exact DEC-0013 occurrence source.

The DEC-0014 `mantable.py` source contributes semantic interpretation.

It must not silently become the value provenance channel.

Therefore the next authority must solve two separate but coupled questions:

1. which exact predecessor source supplied the context value;
2. which frozen ProvenanceClass is accepted for that exact value-source channel.

## Existing first value-source world

The first DEC-0013 occurrence source is an ADR Source authority representing the public ISU Data Team Sustainable Corn persisted operations query output.

Its exact origin is content-addressed through the accepted predecessor chain.

The retained SourceArtifact records an acquisition method:

```text
REPOSITORY_RETAINED_PUBLIC_GOLD
```

and the Source carries an external public repository origin locator.

Those fields establish exact lineage and acquisition facts.

They do **not** by themselves create ContextDatum ProvenanceClass authority.

In particular:

```text
sourceType = OTHER
```

is a Source Registry classification, not a Context ProvenanceClass.

Likewise:

```text
ownership.organizationId = org-a
```

is ADR storage/governance scope, not the origin actor/channel of the agricultural datum.

## Decision

Introduce a distinct content-addressed authority:

`AgronomicRecordedOperationContextProvenanceClassificationCompilation`

Its narrow purpose is:

> bind the exact accepted DEC-0017 context epistemic classification to the exact predecessor Source/SourceArtifact that supplied the mapped context value, and classify that exact ingress channel under the Frozen Context ProvenanceClass vocabulary, without creating ContextDatum source-wire, temporal, spatial, unit, uncertainty, runtime, execution or Outcome authority.

For the first real Gold, the only accepted provenance candidate is:

```text
value source:
  exact DEC-0013 parent occurrence Source
  exact DEC-0013 parent occurrence SourceArtifact

source channel:
  external public source retained into ADR

provenanceClass:
  EXTERNAL_PROVIDER
```

## Why EXTERNAL_PROVIDER

The first mapped value originates from an external public source maintained outside ADR and retained into ADR through the governed Source/SourceArtifact path.

It is not:

- a user-entered datum;
- an agronomist-entered datum;
- sensor telemetry;
- machinery telemetry;
- remote-sensing imagery;
- a customer operational system;
- a laboratory result;
- a model output;
- an ADR platform-originated assertion.

The provenance classification therefore proposed for this exact first value-source world is:

```text
EXTERNAL_PROVIDER
```

This is an explicit architecture decision and reviewed authority.

It must not be implemented as a lexical rule such as:

```text
github.com -> EXTERNAL_PROVIDER
```

or:

```text
sourceType OTHER -> EXTERNAL_PROVIDER
```

or:

```text
public source -> EXTERNAL_PROVIDER
```

The exact reviewed predecessor world is material.

## Value-source routing is mandatory

DEC-0016 depends on both an occurrence source world and a semantic-normalization source world.

Those sources are not interchangeable.

For the first Gold:

```text
occurrence source
  supplies:
    sourceOperationCode = plant_corn
    date = 2011-05-03
    source-native subject = SERF

semantic-normalization source
  supplies:
    plant_corn -> PLANT / CROP:CORN
```

Therefore:

```text
crop.planting_date = DATE 2011-05-03
```

must route value provenance to the occurrence Source/SourceArtifact.

The `mantable.py` semantic source must not become the context value provenance source.

This distinction is mandatory for all future implementation.

## Proposed authority shape

Conceptually:

```text
AgronomicRecordedOperationContextProvenanceClassification {
  contractVersion

  classificationId

  contextEpistemicClassificationCompilationRef

  valueSource {
    sourceRef
    sourceArtifactRef
    sourceArtifactContentHash
  }

  targetContextSemantic {
    semanticId
    value
  }

  epistemicClass

  provenanceClass

  classificationRationale
}
```

Publication compilation should additionally contain:

- classification hash;
- provenance review ref;
- local lossless coverage;
- explicit limitations.

Exact field names remain implementation-level after architecture acceptance.

## Mandatory predecessor closure

Publication must require the exact accepted:

`AgronomicRecordedOperationContextEpistemicClassificationCompilation`

That authority must be fully revalidated through its own validator.

The classifier must then close through DEC-0017 -> DEC-0016 -> DEC-0013 and recover the exact parent occurrence:

- Source ref;
- SourceArtifact ref;
- SourceArtifact content hash;
- mapped semantic/value;
- epistemicClass.

The valueSource in DEC-0018 must equal those exact parent occurrence source identities.

A caller cannot replace them with:

- the DEC-0014 semantic-normalization source;
- another Source with the same title;
- another artifact with the same source;
- another version;
- another content hash;
- another repository copy.

## Exact source content closure

For the first Gold, the valueSource must preserve:

```text
exact Source ref
exact SourceArtifact ref
exact SourceArtifact content hash
```

The SourceArtifact must still replay through Source Registry.

The source/artifact relationship must remain exact.

Content-addressed drift requires a new review.

## Exact target semantic closure

The first provenance classification must close to the exact DEC-0017 target:

```text
semanticId = crop.planting_date

value:
  type = DATE
  date = 2011-05-03

epistemicClass = ASSERTION
```

DEC-0018 cannot rewrite the semantic value or epistemic class.

## First provenance vocabulary is finite

The first implementation slice must accept only:

```text
EXTERNAL_PROVIDER
```

for this exact predecessor world.

The following must fail closed for the first Gold:

```text
USER
AGRONOMIST
SENSOR
MACHINERY
REMOTE_SENSING
CUSTOMER_SYSTEM
LABORATORY
MODEL
PLATFORM
```

Future source worlds may legitimately map to those classes under their own reviewed provenance authority.

## Why not CUSTOMER_SYSTEM

Rejected for the first Gold.

The exact occurrence source is a public external research/data repository source.

The current accepted authority does not establish that the datum entered ADR from a customer-owned operational FMIS or customer production system.

Therefore `CUSTOMER_SYSTEM` would invent a customer-channel fact.

## Why not MACHINERY

Rejected.

The predecessor chain does not establish planter telemetry, machine CAN/ISOBUS event data, or another machinery ingress channel.

DEC-0017 already rejected OBSERVATION upgrade on the same basis.

Provenance and epistemic class remain orthogonal, but both must respect the actual source world.

## Why not PLATFORM

Rejected.

ADR materializes and governs the SourceArtifact, but ADR did not originate the planting-date assertion.

Storage/materialization by ADR must not silently rewrite external value provenance as `PLATFORM`.

`PLATFORM` remains valid for values whose actual ingress/origin channel is the ADR platform under a future explicit authority.

## Why not USER or AGRONOMIST

Rejected.

No user or agronomist actor is established as the origin channel for the source-recorded value.

Reviewers who approve authority are governance actors.

They do not become the value provenance channel.

## Why not SENSOR or REMOTE_SENSING

Rejected.

No sensor or remote-sensing source channel is established.

## Why not LABORATORY

Rejected.

No laboratory channel is established.

## Why not MODEL

Rejected.

The planting date is not a model output.

The semantic projection is governed transformation, not model generation.

## Source Registry ownership is not provenance

The Source Registry stores:

```text
ownership.organizationId
ownership.tenantId
```

Those fields describe ADR governance/storage scope.

They must not be mapped to:

```text
USER
CUSTOMER_SYSTEM
PLATFORM
```

or any other ProvenanceClass.

## sourceType is not provenance

The Source Registry `sourceType` vocabulary is:

```text
PUBLICATION
PROTOCOL
LABEL
TRIAL_REPORT
CULTIVAR_DOCUMENT
REGULATORY_DOCUMENT
DATASET_DOCUMENTATION
OTHER
```

This vocabulary classifies source-document type.

It does not classify context ingress channel.

No generic mapping from SourceType -> ProvenanceClass is accepted by DEC-0018.

## originLocator is not provenance by itself

A URL or repository locator identifies origin location.

It does not independently establish a ProvenanceClass.

Therefore the system must not implement:

```text
github.com -> EXTERNAL_PROVIDER
customer-domain.example -> CUSTOMER_SYSTEM
```

or similar lexical/domain rules.

The first provenance classification exists because the architecture explicitly accepts the reviewed first source world.

## acquisition.method is not provenance by itself

The SourceArtifact records:

```text
acquisition.method = REPOSITORY_RETAINED_PUBLIC_GOLD
```

This is an exact ADR acquisition fact.

It is not itself part of the Frozen ProvenanceClass vocabulary.

DEC-0018 may use it as reviewed evidence of the ingress world, but must not establish a repository-wide automatic mapping:

```text
REPOSITORY_RETAINED_PUBLIC_GOLD -> EXTERNAL_PROVIDER
```

for unrelated sources.

## Reviewer authority

Publication requires an explicit:

`AgronomicRecordedOperationContextProvenanceClassificationReviewDecision`

or equivalent governed review authority.

The review must bind the exact:

- DEC-0017 classification ref;
- DEC-0016 mapping ref through predecessor closure;
- parent occurrence Source ref;
- parent occurrence SourceArtifact ref;
- parent artifact content hash;
- target semantic/value;
- epistemicClass;
- proposed ProvenanceClass.

## Proposed mandatory review checks

An accepted review should confirm at least:

1. `CONTEXT_EPISTEMIC_CLASSIFICATION_AUTHORITY_VERIFIED`;
2. `EXACT_PARENT_OCCURRENCE_CLOSURE_VERIFIED`;
3. `EXACT_VALUE_SOURCE_VERIFIED`;
4. `EXACT_VALUE_SOURCE_ARTIFACT_VERIFIED`;
5. `EXACT_VALUE_SOURCE_CONTENT_HASH_VERIFIED`;
6. `VALUE_SOURCE_NOT_SEMANTIC_INTERPRETATION_SOURCE`;
7. `TARGET_CONTEXT_SEMANTIC_VERIFIED`;
8. `TARGET_CONTEXT_VALUE_VERIFIED`;
9. `EPISTEMIC_CLASS_PRESERVED`;
10. `EXTERNAL_PROVIDER_CHANNEL_VERIFIED`;
11. `NO_SOURCE_TYPE_TO_PROVENANCE_INFERENCE`;
12. `NO_ORIGIN_LOCATOR_LEXICAL_INFERENCE`;
13. `NO_ACQUISITION_METHOD_GLOBAL_INFERENCE`;
14. `NO_CUSTOMER_SYSTEM_INFERENCE`;
15. `NO_MACHINERY_OR_SENSOR_INFERENCE`;
16. `NO_PLATFORM_ORIGIN_INFERENCE`;
17. `NO_CONTEXT_DATUM_PUBLICATION`;
18. `NO_CONTEXT_SOURCE_WIRE_PROJECTION`;
19. `NO_EFFECTIVE_INTERVAL_OR_AVAILABLE_AT_INFERENCE`;
20. `NO_TARGET_OR_SPATIAL_PROJECTION`;
21. `NO_UNIT_OR_UNCERTAINTY_INFERENCE`;
22. `NO_CURRENT_STATE_OR_SEASON_INFERENCE`;
23. `NO_DECISION_PROBLEM_OR_POLICY_INFERENCE`;
24. `NO_RUNTIME_EXECUTION_OR_OUTCOME_INFERENCE`;
25. `NO_INVERSE_OR_COMPLETENESS_INFERENCE`.

All mandatory checks are required for accepted publication.

## Proposed review dispositions

At minimum:

- `ACCEPT_RECORDED_OPERATION_CONTEXT_PROVENANCE_CLASSIFICATION`;
- `REJECT_RECORDED_OPERATION_CONTEXT_PROVENANCE_CLASSIFICATION`.

Rejected review cannot authorize provenance classification publication.

## No ContextDatum source-wire authority

DEC-0018 does **not** decide the final ContextDatum `source` object:

```text
source:
  providerId
  sourceRef
  contentHash
```

Even though DEC-0018 binds an exact Source/SourceArtifact as value provenance, the wire projection into those three public fields remains a separate authority.

In particular, DEC-0018 does not decide:

- how `providerId` is generated;
- whether `sourceRef` uses ADR authority ref, origin locator, or another identifier;
- whether `contentHash` is copied directly from SourceArtifact or wrapped in another projection.

## No availableAt authority

The SourceArtifact contains:

```text
acquisition.acquiredAt
```

DEC-0018 must not automatically convert that timestamp into ContextDatum:

```text
availableAt
```

Acquisition time and context availability time are distinct authority dimensions.

A later temporal/availability authority must decide that relationship explicitly.

## No effectiveInterval authority

DEC-0018 creates no:

- effectiveInterval.start;
- effectiveInterval.end;
- timezone;
- UTC offset;
- local-day boundary;
- RFC3339 day interval.

## No target/spatial authority

DEC-0018 does not project DEC-0015 target identity into:

- spatialSupport;
- geometryRef;
- farmId;
- fieldId;
- DecisionProblem targetRef.

## No unit authority

DEC-0018 does not decide the ContextDatum unit representation for a DATE-valued semantic.

## No uncertainty authority

DEC-0018 does not set any uncertainty form.

`EXTERNAL_PROVIDER` is an origin/channel classification, not a confidence model.

## No temporalSupport projection

DEC-0018 does not convert DEC-0013 DAY precision into ContextDatum temporalSupport vocabulary.

## No current-state inference

The resulting authority:

```text
crop.planting_date = DATE 2011-05-03
epistemicClass = ASSERTION
provenanceClass = EXTERNAL_PROVIDER
```

does not establish:

- current crop presence;
- current crop identity;
- current phenology;
- active season;
- current farm/field state.

## No truth or execution upgrade

Provenance classification does not upgrade the source assertion into:

- ground truth;
- independently verified execution;
- direct machinery observation;
- ExecutionReceipt;
- Outcome.

## No DecisionProblem authority

DEC-0018 creates no DecisionProblem or targetRef authority.

## No Policy/runtime authority

DEC-0018 creates no:

- Policy;
- RuntimePlan;
- RuntimeEligibility;
- RuntimeBinding;
- DecisionResult.

## No execution or Outcome authority

DEC-0018 creates no:

- ExecutionReceipt;
- actual machine execution;
- Outcome;
- effect attribution.

## No inverse provenance rule

Acceptance of:

```text
this exact value-source world -> EXTERNAL_PROVIDER
```

does not authorize:

```text
EXTERNAL_PROVIDER -> this Source
```

or any inverse source reconstruction.

## No provenance completeness claim

The first accepted classification does not mean:

- every Sustainable Corn datum is EXTERNAL_PROVIDER;
- every public repository datum is EXTERNAL_PROVIDER;
- every external source is EXTERNAL_PROVIDER;
- every `sourceType=OTHER` is EXTERNAL_PROVIDER;
- every datum using semantic-normalization evidence inherits that evidence source as provenance.

Only the exact reviewed first value-source world is covered.

## Content addressing

Changing any material classification element must change semantic identity or fail review closure, including:

- DEC-0017 classification ref;
- value Source ref;
- value SourceArtifact ref;
- value SourceArtifact content hash;
- target semanticId;
- target typed value;
- epistemicClass;
- provenanceClass;
- provenance review ref;
- classification rationale;
- limitations.

## Local completeness

For DEC-0018:

`losslessCoverage = COMPLETE`

means only:

> the targeted value-source routing and ProvenanceClass classification for the exact accepted DEC-0017 world are represented without inventing another ContextDatum field.

It does not mean ContextDatum is complete or publishable.

## First real-source Gold

The first Gold must reuse the exact accepted Sustainable Corn chain:

```text
DEC-0013
SERF / plant_corn / 2011-05-03 / DAY

DEC-0014
plant_corn -> PLANT / CROP:CORN

DEC-0016
crop.planting_date = DATE 2011-05-03

DEC-0017
epistemicClass = ASSERTION
```

It must route provenance to the exact DEC-0013 occurrence Source/SourceArtifact.

Accepted provenance candidate:

```text
provenanceClass = EXTERNAL_PROVIDER
```

The Gold must prove that using the DEC-0014 semantic-normalization Source as the value source fails closed.

## Mandatory implementation acceptance cases

If DEC-0018 is accepted, implementation must prove at least:

1. exact DEC-0017 authority is mandatory;
2. exact DEC-0016 closure is mandatory through DEC-0017;
3. exact DEC-0013 parent occurrence closure is mandatory;
4. exact parent occurrence Source is the value source;
5. exact parent occurrence SourceArtifact is the value source artifact;
6. exact artifact content hash is mandatory;
7. DEC-0014 semantic source cannot replace value source;
8. target semantic remains `crop.planting_date`;
9. target value remains `DATE 2011-05-03`;
10. epistemicClass remains `ASSERTION`;
11. first real-source provenance can publish as `EXTERNAL_PROVIDER`;
12. `USER` fails closed;
13. `AGRONOMIST` fails closed;
14. `SENSOR` fails closed;
15. `MACHINERY` fails closed;
16. `REMOTE_SENSING` fails closed;
17. `CUSTOMER_SYSTEM` fails closed;
18. `LABORATORY` fails closed;
19. `MODEL` fails closed;
20. `PLATFORM` fails closed;
21. source ref drift fails closed;
22. source artifact ref drift fails closed;
23. source artifact content hash drift fails closed;
24. target semantic/value drift fails closed;
25. epistemic-class drift fails closed;
26. incomplete review cannot publish;
27. unauthorized reviewer cannot publish;
28. rejected review cannot publish;
29. no ContextDatum/ContextManifest authority is created;
30. no ContextDatum source-wire authority is created;
31. no effectiveInterval/availableAt/timezone authority is created;
32. no spatial/target/geometry authority is created;
33. no unit/uncertainty authority is created;
34. no DecisionProblem/Policy/runtime authority is created;
35. no ExecutionReceipt/Outcome authority is created;
36. no inverse or completeness claim is created.

At least one positive case must use the exact real Sustainable Corn predecessor chain.

## Proposed first implementation slice

Only after explicit acceptance and accepted documentation merge may implementation begin.

The first implementation slice should contain only:

1. context provenance classification contract;
2. exact DEC-0017 predecessor closure;
3. exact parent occurrence value-source routing;
4. exact Source/SourceArtifact/content-hash closure;
5. review authority;
6. content-addressed publication/validation;
7. first finite provenance classification to `EXTERNAL_PROVIDER`;
8. real Sustainable Corn Gold;
9. mandatory fail-closed cases;
10. focused workflow wiring if required.

It must not contain:

- ContextDatum publication;
- ContextDatum source-wire projection;
- effectiveInterval;
- availableAt;
- timezone;
- spatialSupport;
- geometry;
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
DEC-0016 context semantic/value mapping
      |
      v
DEC-0017 epistemic classification
      |
      v
DEC-0018 provenance classification
      |
      +---- future source-wire projection
      +---- future temporal projection
      +---- future target/spatial projection
      +---- future unit/uncertainty projection
      |
      v
future governed ContextDatum projection
```

No downstream arrow is pre-accepted by DEC-0018.

## Explicitly unresolved after DEC-0018

Even if accepted and implemented, the following remain unresolved:

1. ContextDatum source.providerId;
2. ContextDatum source.sourceRef;
3. ContextDatum source.contentHash projection;
4. effectiveInterval;
5. availableAt;
6. timezone / UTC offset;
7. DAY -> RFC3339 interval interpretation;
8. unit for DATE semantic;
9. uncertainty;
10. temporalSupport projection;
11. DEC-0015 target identity -> spatialSupport;
12. ContextDatum publication;
13. ContextManifest inclusion;
14. field/plot/zone/season identity;
15. cross-provider canonical identity;
16. planned-versus-actual reconciliation;
17. execution reconciliation;
18. Outcome linkage.

## Acceptance targets

Before this architecture may be accepted, review must confirm:

1. ProvenanceClass and EpistemicClass remain orthogonal;
2. exact DEC-0017 closure is mandatory;
3. value-source routing is distinct from semantic-interpretation evidence routing;
4. the exact DEC-0013 occurrence source supplies the first mapped context value;
5. the DEC-0014 semantic source cannot become value provenance;
6. the first exact source world supports `EXTERNAL_PROVIDER`;
7. SourceType, origin URL and acquisition method do not create global provenance mappings;
8. ADR storage ownership does not become value provenance;
9. no ContextDatum source-wire projection is implied;
10. no availableAt inference from acquisition time occurs;
11. no temporal/spatial/unit/uncertainty projection is implied;
12. no DecisionProblem/Policy/runtime/execution/Outcome authority is created;
13. implementation remains additive and does not weaken DEC-0013/0014/0016/0017.

## Post-acceptance gate

Before accepted DEC-0018 documentation may merge:

1. repository-wide ADR Constitution MUST pass on the exact accepted documentation head;
2. PR MUST remain docs-only;
3. no package/runtime/schema/workflow/acceptance mutation may be included;
4. no existing accepted contract may be changed;
5. PR base MUST remain the expected protected `main`;
6. accepted exact head MUST be recorded before merge.

Only after accepted documentation merge and post-merge Constitution success may implementation begin.

## Acceptance

Not yet accepted.

Explicit architecture approval is required before implementation.

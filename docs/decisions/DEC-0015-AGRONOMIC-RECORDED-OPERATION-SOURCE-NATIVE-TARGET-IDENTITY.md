# DEC-0015 — Governed Recorded-Operation Source-Native Target Identity Binding

Status: **PROPOSED**

Date: 2026-08-31

## Context

DEC-0013 established governed source-recorded operation occurrence authority.

DEC-0014 established governed source-scoped semantic normalization for the exact source-native operation code carried by that occurrence.

The first implemented chain now proves:

```text
exact recorded source occurrence
  source-native subject:
    siteid = SERF

exact normalized operation semantic:
  plant_corn
    -> family = PLANT
    -> subject = CROP:CORN
```

The next question is not whether planting occurred in the source record and not what `plant_corn` means.

The next question is:

> what exact target identity, at what source-supported granularity, may ADR bind to the source-native occurrence subject without inventing a canonical field, geometry, season, zone, or cross-system identity?

The current source occurrence carries only:

```text
siteid = SERF
```

That is a source-native identifier.

It is not yet an ADR farm/field/zone identity authority.

## Why this is a separate authority

A source-native subject identifier may be:

- a farm code;
- a research-site code;
- a field code;
- a plot code;
- a machine group;
- a treatment unit;
- a provider object id;
- an account-local alias;
- an opaque external identifier.

The identifier string alone does not establish target granularity.

For example:

```text
SERF
```

does not intrinsically mean:

```text
farm
field
zone
plot
geometry
season
```

A target binding therefore requires exact identity evidence and explicit review.

String equality is not sufficient target authority.

## Current ContextDatum / DecisionProblem gap

Existing ADR target/context contracts do not close this gap.

### ContextDatum

`ContextDatum` v1 accepts:

- organization/tenant write scope;
- `spatialSupport.type`;
- optional `spatialSupport.geometryRef`.

But `geometryRef` is currently a string and A02 does not verify that it represents the exact source-native site.

Therefore:

```text
siteid = SERF
-> spatialSupport.geometryRef = SERF
```

would be an ungoverned adapter inference.

### ContextManifest

A04 explicitly does not invent field/zone geometry containment or scientific equivalence.

It checks organization/tenant consistency, not external field identity reconciliation.

### DecisionProblem

A01 admits:

```text
organizationId
tenantId
farmId
fieldId
seasonId
zoneId
```

inside `targetRef`.

But A01 assumes those target identifiers are supplied as decision-scope semantics.

It does not establish where an external `siteid` came from or what target level it represents.

### A08 Source→Target Applicability

A08 asks whether governed scientific knowledge is applicable to an already-defined target context.

A08 explicitly does not create TargetContext truth.

It is therefore not an external identity reconciliation authority.

### K03 Source-Faithful Authority

K03 asks whether source material was represented faithfully.

It explicitly does not answer:

`Does it apply to a target field?`

K03 cannot substitute for target identity binding.

## Real-source evidence for the first architecture target

The first target remains the public Sustainable Corn data world.

Official public repository:

`isudatateam/datateam`

Identity source file:

`htdocs/cscap/dl/sites.html`

Exact observed Git blob:

`3145c0fe0099fedd1bb82e6af9e588b785234d80`

Exact UTF-8 byte range:

```text
2692:2900
```

The retained source region states, in one exact table row:

```text
IA
SERF
Helmers
Southeast Research and Demonstration Farm
Iowa State University
```

This materially supports:

1. `SERF` is a source-native site identity in this source world;
2. the named entity represented by that site code is a Research and Demonstration Farm;
3. the first target granularity may therefore be `FARM`.

It does **not** support:

- FIELD;
- ZONE;
- PLOT;
- SEASON;
- geometry;
- polygon;
- timezone;
- canonical cross-provider identity.

## Decision

Introduce a distinct content-addressed authority:

`AgronomicRecordedOperationTargetIdentityBindingCompilation`

Its purpose is narrowly:

> bind the exact source-native subject of an exact governed recorded-operation occurrence to an ADR source-backed target identity at the exact granularity supported by reviewed source identity evidence.

This authority is source-scoped identity authority.

It is not global entity resolution.

It is not geometry authority.

It is not ContextDatum authority.

It is not DecisionProblem authority.

## Proposed authority meaning

For the first Gold, the authority means only:

> the exact governed Sustainable Corn source identifies `siteid=SERF` as the Southeast Research and Demonstration Farm, and ADR therefore recognizes a source-backed FARM-level target identity for that exact source-native identifier.

It does not mean:

> SERF is a globally canonical farm identity shared across all providers.

It does not mean:

> SERF is a field.

It does not mean:

> SERF resolves to a polygon.

## Source-backed target identity

The target identity should be explicitly source-backed.

Conceptually:

```text
SourceBackedTargetIdentity {
  identityNamespace
  granularity
  sourceNativeIdentifier {
    name
    value
  }
  targetId
}
```

For the first Gold:

```text
granularity = FARM

sourceNativeIdentifier:
  name  = siteid
  value = SERF
```

The target identity should preserve source namespace explicitly.

The implementation must not use a naked global id such as:

`SERF`

as if all systems shared that namespace.

A deterministic source-scoped target id is required.

## Proposed source-backed identity key

The implementation may use a content-addressed source-backed key derived from at least:

- exact source namespace identity;
- source-native identifier name;
- source-native identifier value;
- target granularity;
- identity-contract version.

Conceptually:

```text
target_src_<content-addressed-id>
```

The exact printable prefix is implementation-level.

The semantic identity must not depend on:

- current time;
- mutable database sequence;
- reviewer display name;
- arbitrary caller-generated UUID;
- current Git branch.

## Target granularity vocabulary

DEC-0015 v1 should keep target granularity finite.

For the first implementation slice only:

```text
FARM
```

must be required.

The contract may be designed for future extension, but first publication must not accept:

- FIELD;
- ZONE;
- PLOT;
- SEASON;
- POINT;
- MACHINE.

Those remain unresolved until source evidence supports them.

## Why FARM rather than FIELD

The exact real-source evidence says:

`Southeast Research and Demonstration Farm`

It does not say:

`Field SERF`

Therefore:

```text
siteid=SERF
-> FARM
```

may be reviewed.

But:

```text
siteid=SERF
-> FIELD
```

must fail closed in the first Gold.

Using FIELD merely because later ContextDatum/DecisionProblem logic often deals with fields would be authority laundering.

## Proposed contract shape

Conceptually:

```text
AgronomicRecordedOperationTargetIdentityBinding {
  contractVersion

  bindingId

  parentOccurrenceCompilationRef

  sourceNativeSubject {
    identifierName
    identifierValue
  }

  sourceBackedTargetIdentity {
    namespaceRef
    granularity
    targetId
  }

  identityEvidence[] {
    evidenceRole
    sourceRef
    sourceArtifactRef
    sourceArtifactContentHash
    sourceLocator
    evidenceHash
  }

  applicability {
    appliesToOccurrenceSourceRef
    appliesToSourceNativeIdentifier
  }

  transformationRationale
}
```

Exact field names remain subject to implementation review after acceptance.

## Parent occurrence closure

Publication must require the exact accepted DEC-0013:

`AgronomicRecordedOperationOccurrenceCompilation`

The parent must be fully revalidated through DEC-0013 authority validation.

The binding source-native identifier must exist exactly in:

`parent.occurrence.occurrenceSemantics.sourceNativeSubject.identifiers`

For the first Gold:

```text
name  = siteid
value = SERF
```

If the parent contains:

`siteid=NWREC`

while the binding claims:

`siteid=SERF`

publication must fail closed.

## DEC-0014 relationship

DEC-0014 normalization may be bound as an optional predecessor for later context projection, but it is not required to establish source-native target identity itself.

Target identity answers:

> which target entity does the source-native occurrence subject denote?

Semantic normalization answers:

> what agronomic operation semantic does the source code denote?

These are orthogonal authority dimensions.

The first implementation may bind the exact DEC-0014 normalization as additional lineage if useful, but DEC-0015 must not make operation semantics part of target identity.

## Identity evidence

Target granularity and identity meaning require exact retained source evidence.

Each evidence item must bind:

1. exact Source;
2. exact SourceArtifact;
3. exact artifact content hash;
4. deterministic locator;
5. deterministic evidence hash;
6. explicit evidence role.

For plain text / HTML source evidence, v1 should reuse exact `BYTE_RANGE` replay.

## Proposed evidence roles

The first implementation needs at least:

```text
SOURCE_NATIVE_IDENTIFIER_CONTEXT
TARGET_GRANULARITY_MEANING
```

The same exact byte range may satisfy both roles only if the contract explicitly allows role-specific references to the same exact source bytes.

Alternatively, one exact evidence item may carry a compound role only if the review remains independently inspectable.

The first Gold's source row is contiguous and supports both:

- `SERF`;
- `Research and Demonstration Farm`.

Unlike DEC-0014, non-contiguous evidence is not required for the first identity Gold.

## Namespace applicability

The identity evidence source does not need to be the same artifact as the DEC-0013 operation row.

For the first Gold:

- occurrence artifact: `chicago.ipynb`;
- identity artifact: `sites.html`.

Both belong to the public Sustainable Corn data-team source world.

The system must not infer that relationship merely because both files are in one GitHub repository.

The reviewer must explicitly confirm:

`SOURCE_IDENTITY_NAMESPACE_APPLICABILITY_VERIFIED`

This review assertion binds the exact parent occurrence source and exact identity evidence source/artifact.

## No lexical granularity inference

The system must not infer target granularity from identifier syntax.

Examples that are forbidden as final authority:

```text
id contains "field" -> FIELD

code begins "F" -> FARM

siteid -> FIELD
```

Such heuristics may generate candidates.

They cannot authorize publication.

## No cross-source canonical identity

Acceptance of:

```text
Sustainable Corn
siteid=SERF
-> source-backed FARM identity X
```

does not establish:

```text
John Deere field "SERF"
FMIS farm "SERF"
KBS plot "SERF"
other provider object "SERF"
```

as the same entity.

Cross-source equivalence requires a separate reconciliation authority.

## No global canonical farm claim

The target identity created by DEC-0015 is source-backed.

It is not a global master-data identity.

The authority may later participate in canonical reconciliation.

It cannot claim that reconciliation has already occurred.

## No geometry authority

DEC-0015 must not create or infer:

- latitude/longitude;
- point geometry;
- field polygon;
- farm polygon;
- geometry containment;
- coordinate reference system;
- area;
- centroid;
- geometryRef equivalence.

The first source evidence contains a map link, but DEC-0015 does not dereference that link or infer geometry.

The existence of a map link is not geometry authority.

## No spatial-support projection yet

DEC-0015 must not directly publish:

`ContextDatum.spatialSupport`

or assert:

```text
spatialSupport.geometryRef = targetId
```

That bridge belongs to a later context-projection authority.

DEC-0015 establishes identity only.

## No DecisionProblem mutation

DEC-0015 must not create or mutate:

- DecisionProblem;
- targetRef;
- farmId;
- fieldId;
- seasonId;
- zoneId;
- decision scope;
- logical time;
- action space.

A later target projection may copy an accepted source-backed FARM id into a DecisionProblem targetRef under separate authority.

DEC-0015 does not pre-accept that bridge.

## No ContextDatum mutation

DEC-0015 must not create:

- ContextDatum;
- ContextManifest;
- AuthorizedContextReference;
- ResolvedContextDatumReceipt.

It establishes target identity only.

## No temporal authority

DEC-0015 must not create or infer:

- timezone;
- UTC offset;
- local midnight;
- effectiveInterval;
- availableAt semantics;
- season interval;
- event timestamp;
- DST rule.

The source occurrence remains:

`2011-05-03 / DAY`

until a later temporal authority resolves how, if at all, that date may be projected into timestamp-bearing target context.

## No season identity

A planting event in crop year 2011 does not automatically establish:

`seasonId=2011`

as ADR season identity.

Source crop year may later become identity evidence.

DEC-0015 first slice does not perform that mapping.

## No plot/field identity

The source site `SERF` may contain many plots or fields.

The first identity evidence establishes only farm-level site identity.

No child field/plot identity is inferred.

## No current target-state authority

A source-backed farm identity does not establish current crop, management state, ownership, active season, or operational status.

Identity is not state.

## No runtime eligibility

DEC-0015 does not create:

- RuntimePlan;
- RuntimeEligibility;
- RuntimeBinding;
- RuntimeAlternativeSet;
- DecisionResult.

Identity binding does not imply a decision can be made for that target.

## No execution authority

DEC-0015 does not create:

- ExecutionReceipt;
- operation execution identity;
- machine identity;
- operator identity.

## No Outcome authority

DEC-0015 does not establish agronomic effect or Outcome.

## No Policy authority

DEC-0015 does not create or mutate:

- Policy;
- Policy actionSpace;
- Policy actionSemantics;
- normative modality;
- obligation;
- prohibition.

## No inverse lookup/write-back authority

Acceptance of a source-backed target identity does not authorize:

```text
ADR target id -> provider/site source identifier write-back
```

DEC-0015 is read-side identity binding only.

## No identity completeness claim

The existence of one binding does not establish that:

- all Sustainable Corn sites are mapped;
- all provider ids are known;
- all farm aliases are reconciled;
- unmapped ids are invalid;
- absence of binding means no target exists.

## No same-name equivalence

Two source entities with the same display name or identifier value are not automatically the same target.

Source namespace is material to identity.

## Source-version drift

Identity evidence is content-addressed.

If the exact identity source artifact changes materially, the previous binding remains historically valid for its exact reviewed bytes but must not silently qualify the new source version.

A new evidence version requires:

- new review; or
- explicit governed continuity authority in a later architecture.

## Reviewer authority

Publication requires an explicit:

`AgronomicRecordedOperationTargetIdentityBindingReviewDecision`

or equivalent governed review authority.

The reviewer must be authorized to inspect:

- parent occurrence source when needed;
- every identity evidence source.

## Proposed mandatory review checks

An accepted review should confirm at least:

1. `PARENT_OCCURRENCE_AUTHORITY_VERIFIED`;
2. `SOURCE_NATIVE_IDENTIFIER_VERIFIED`;
3. `EXACT_IDENTITY_EVIDENCE_VERIFIED`;
4. `SOURCE_IDENTITY_NAMESPACE_APPLICABILITY_VERIFIED`;
5. `TARGET_GRANULARITY_SUPPORTED`;
6. `SOURCE_BACKED_NAMESPACE_PRESERVED`;
7. `NO_FIELD_OR_PLOT_GRANULARITY_INFERENCE`;
8. `NO_GEOMETRY_INFERENCE`;
9. `NO_TEMPORAL_OR_TIMEZONE_INFERENCE`;
10. `NO_DECISION_PROBLEM_INFERENCE`;
11. `NO_CONTEXT_DATUM_INFERENCE`;
12. `NO_CROSS_SOURCE_CANONICAL_IDENTITY_INFERENCE`;
13. `NO_RUNTIME_OR_EXECUTION_INFERENCE`;
14. `NO_OUTCOME_INFERENCE`;
15. `NO_COMPLETENESS_OR_INVERSE_INFERENCE`.

An accepted publication must require all mandatory checks.

## Proposed review dispositions

At minimum:

- `ACCEPT_RECORDED_OPERATION_TARGET_IDENTITY_BINDING`;
- `REJECT_RECORDED_OPERATION_TARGET_IDENTITY_BINDING`.

Rejected review cannot authorize binding publication.

## Content addressing

The binding authority must be content-addressed.

Changing any of the following must change binding semantic identity or fail review closure:

- exact parent occurrence compilation ref;
- source-native identifier name;
- source-native identifier value;
- source namespace;
- target granularity;
- source-backed target id;
- identity evidence Source ref;
- identity evidence SourceArtifact ref;
- locator;
- evidence hash;
- source-namespace applicability;
- semantic review ref;
- transformation rationale;
- limitations.

## Local completeness

For DEC-0015:

`losslessCoverage = COMPLETE`

means only:

> the targeted source-native identifier→source-backed target identity binding is represented without inventing a finer target granularity or external canonical identity.

For the first Gold, COMPLETE means only:

```text
Sustainable Corn source world
siteid=SERF
-> source-backed FARM identity
```

It does not mean:

- all site metadata is modeled;
- geometry is known;
- all farms are mapped;
- fields are known;
- seasons are known;
- timezone is known;
- ContextDatum projection is possible;
- DecisionProblem target mapping is complete.

## Why not mutate DEC-0013

Rejected.

DEC-0013 preserves source-native subject authority.

Its job is to record what the source says:

`siteid=SERF`

It must remain valid even when no target identity binding exists.

DEC-0015 must be additive.

## Why not mutate DEC-0014

Rejected.

DEC-0014 normalizes operation semantics.

`PLANT / CROP:CORN`

does not identify the farm where the occurrence was recorded.

Target identity and operation semantics remain orthogonal.

## Why not use A08

Rejected.

A08 consumes an already frozen target world and asks whether scientific knowledge transports to it.

A08 explicitly does not create target truth.

## Why not use DecisionProblem targetRef directly

Rejected.

A caller could write:

```text
farmId = SERF
```

but that would merely place a string into decision scope.

It would not prove:

- that `SERF` is farm-granularity in the source;
- that the target id is namespaced;
- that the occurrence source is the source world being bound;
- that source identity evidence was reviewed.

DEC-0015 closes those facts before later decision-scope projection.

## Why not use ContextDatum.geometryRef

Rejected.

A02 currently accepts a geometryRef string but does not establish external identity equivalence.

Using `SERF` directly would conflate target identity with geometry authority.

## Why not create global farm registry now

Rejected.

The first use case requires only a source-backed target identity.

A global master-data registry would introduce:

- cross-provider merge policy;
- alias resolution;
- entity lifecycle;
- supersession;
- conflict rules;
- geometry reconciliation;
- ownership semantics.

Those are not required for the first target binding and remain unresolved.

## First real-source Gold target

Parent:

the accepted DEC-0013 Sustainable Corn bootstrap occurrence:

```text
siteid=SERF
sourceOperationCode=plant_corn
date=2011-05-03
precision=DAY
```

Identity evidence:

`isudatateam/datateam`

file:

`htdocs/cscap/dl/sites.html`

exact observed blob:

`3145c0fe0099fedd1bb82e6af9e588b785234d80`

exact UTF-8 byte range:

`2692:2900`

Source-supported identity meaning:

```text
site code: SERF

named site:
Southeast Research and Demonstration Farm

institution:
Iowa State University
```

Proposed accepted granularity:

`FARM`

## First Gold target id

The Gold must not use naked:

`SERF`

as a global target id.

The implementation must derive a deterministic source-scoped id from the exact source namespace and source-native identifier.

The exact printable representation is implementation-level.

The Gold must prove that:

- same source namespace + same source-native identifier + same granularity -> same target identity;
- changed namespace -> different target identity;
- changed identifier -> different target identity;
- changed granularity -> different target identity.

## Rights

The upstream repository is public and licensed under MIT.

The first implementation may retain the exact identity source artifact or the exact required byte-range evidence with required license notice.

DEC-0015 does not weaken rights requirements.

## Mandatory implementation acceptance cases

If DEC-0015 is accepted, implementation acceptance must prove at least:

1. exact DEC-0013 parent occurrence authority is mandatory;
2. parent source-native identifier `siteid=SERF` is mandatory;
3. exact identity Source/SourceArtifact/locator evidence is mandatory;
4. identity evidence is replayed from exact retained bytes;
5. source identity namespace applicability is explicitly reviewed;
6. exact source evidence supports FARM granularity;
7. `siteid=SERF -> source-backed FARM identity` can publish;
8. changing parent source-native identifier to another value fails closed;
9. changing target granularity to FIELD fails closed;
10. changing target granularity to ZONE fails closed;
11. removing identity evidence fails closed;
12. unrelated identity evidence is rejected;
13. evidence hash drift fails closed;
14. SourceArtifact content drift fails closed;
15. unauthorized reviewer cannot publish;
16. incomplete review cannot publish;
17. rejected review cannot publish;
18. target id remains source-namespaced;
19. changed source namespace changes target identity;
20. no global/cross-provider equivalence is created;
21. no geometry/geometryRef authority is created;
22. no timezone/effectiveInterval authority is created;
23. no DecisionProblem/targetRef mutation is created;
24. no ContextDatum/ContextManifest authority is created;
25. no field/plot/zone/season identity is inferred;
26. no Policy/runtime/DecisionResult authority is created;
27. no ExecutionReceipt is created;
28. no Outcome authority is created;
29. no inverse/write-back mapping is created;
30. no source-identity completeness claim is created.

At least one positive acceptance case must use exact real Sustainable Corn identity evidence.

## Proposed first implementation slice

Only after explicit acceptance and accepted documentation merge may implementation begin.

The first implementation slice should contain only:

1. source-backed target identity contract;
2. exact DEC-0013 parent closure;
3. exact identity BYTE_RANGE replay;
4. identity review authority;
5. content-addressed binding publication/validation;
6. deterministic source-backed target id;
7. one real-source `SERF -> FARM` Gold;
8. mandatory negative boundaries;
9. dedicated acceptance/workflow wiring if needed.

It must not include:

- DecisionProblem creation;
- ContextDatum creation;
- ContextManifest creation;
- spatial geometry;
- timezone;
- temporal projection;
- crop season identity;
- field/zone/plot identity;
- cross-provider entity reconciliation;
- canonical enterprise master-data registry;
- planned-versus-actual reconciliation;
- execution reconciliation;
- Outcome integration.

## Interaction with DEC-0013

DEC-0013 remains the authority for the exact recorded occurrence and its source-native subject.

DEC-0015 consumes it.

Conceptually:

```text
AgronomicRecordedOperationOccurrenceCompilation
  |
  | sourceNativeSubject = siteid=SERF
  v
AgronomicRecordedOperationTargetIdentityBindingCompilation
  |
  +--> source-backed target granularity = FARM
  +--> source-backed target identity
```

The parent is not rewritten.

## Interaction with DEC-0014

DEC-0014 may independently establish:

```text
plant_corn -> PLANT / CROP:CORN
```

The identity chain may later be joined with the semantic-normalization chain by a context-projection authority.

DEC-0015 does not create that join.

## Interaction with future temporal binding

The occurrence still has only:

```text
2011-05-03
precision = DAY
```

DEC-0015 does not invent timezone or timestamps.

A later temporal authority must decide whether sufficient source/target evidence exists to map date-level support into any timestamp-bearing context representation.

## Interaction with future Context projection

A later context-projection authority may consume:

- DEC-0013 occurrence;
- DEC-0014 operation semantic normalization;
- DEC-0015 source-backed target identity;
- future temporal authority;
- explicit context semantic mapping.

Only that later authority may attempt to create a ContextDatum.

DEC-0015 alone is insufficient.

## Explicitly unresolved after DEC-0015

Even if accepted and implemented, the following remain unresolved:

1. exact timezone authority;
2. DAY→RFC3339 temporal interpretation;
3. ContextDatum effectiveInterval;
4. ContextDatum availableAt projection;
5. source-backed target identity→DecisionProblem targetRef projection;
6. source-backed target identity→spatialSupport projection;
7. farm geometry;
8. child field identity;
9. plot identity;
10. season identity;
11. zone identity;
12. cross-provider canonical entity reconciliation;
13. source alias/supersession;
14. `PLANT/CROP:CORN`→Context semanticId/value mapping;
15. ContextDatum publication;
16. ContextManifest inclusion;
17. planned-versus-actual reconciliation;
18. execution reconciliation;
19. Outcome linkage.

These may not be silently folded into the DEC-0015 first slice.

## Acceptance targets

Before this architecture may be accepted, review must confirm:

1. source-native subject identity is a separate authority dimension from occurrence and operation semantics;
2. exact parent occurrence closure is mandatory;
3. exact identity evidence is replayable from retained bytes;
4. target granularity must come from reviewed source evidence;
5. source namespace is material to target identity;
6. first Gold uses FARM, not FIELD;
7. no geometry authority is implied;
8. no temporal/timezone authority is implied;
9. no DecisionProblem authority is implied;
10. no ContextDatum authority is implied;
11. no global canonical target identity is implied;
12. no cross-source same-name equivalence is implied;
13. no current state is implied;
14. no runtime/decision authority is created;
15. no execution or Outcome authority is created;
16. no inverse/write-back identity mapping is created;
17. no source-identity completeness claim is created;
18. implementation remains additive and does not weaken DEC-0013/0014.

## Post-acceptance gate

Before an accepted DEC-0015 documentation PR may merge:

1. repository-wide ADR Constitution MUST pass on the exact accepted documentation head;
2. PR MUST remain docs-only;
3. no package/runtime/schema/workflow/acceptance mutation may be included;
4. no existing accepted contract may be changed;
5. PR base MUST remain the expected protected `main`;
6. accepted exact head MUST be recorded before merge.

Only after the accepted documentation PR is merged may implementation begin from the resulting exact `main`.

## Acceptance

Not yet accepted.

Explicit architecture approval is required before implementation.

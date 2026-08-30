# DEC-0014 — Governed Agronomic Recorded-Operation Semantic Normalization

Status: **ACCEPTED**

Date: 2026-08-30

## Context

DEC-0013 established a governed authority for a positive source-recorded agronomic operation occurrence.

Its accepted architecture deliberately separates:

```text
source-recorded occurrence
!= normalized agronomic operation semantic
!= Policy action
!= runtime action
!= machine execution
!= Outcome
```

The first implementation slice now enforces that separation in code.

Current DEC-0013 publication fails closed when an occurrence attempts to carry an unbound `normalizedOperation`:

```text
AGRONOMIC_RECORDED_OPERATION_OCCURRENCE_NORMALIZATION_AUTHORITY_REQUIRED
```

The implementation message is explicit:

```text
v1 publication does not accept normalizedOperation
until a distinct governed normalization authority is bound
```

That is now the next architecture frontier.

The problem is no longer:

`does a governed source record an operation occurrence?`

DEC-0013 answers that.

The next problem is:

`what exact authority may establish the agronomic meaning of a source-native operation code without laundering that meaning into Policy, runtime, execution, Outcome, or a global cross-source ontology?`

## Why this is a separate authority

A source-recorded event may contain a provider-native code such as:

`plant_corn`

DEC-0013 may faithfully publish that exact source-native code because the event artifact records it.

However, the statements:

```text
plant_corn
  -> operation family PLANT
  -> operation subject CROP:CORN
```

are additional semantic assertions.

They do not follow merely because a string contains the tokens `plant` and `corn`.

A different source could use:

- opaque numeric codes;
- abbreviations;
- locale-specific labels;
- historical aliases;
- overloaded codes;
- codes whose meaning changes by version;
- codes whose suffix denotes destination rather than operated-on subject;
- compound-operation codes.

Therefore lexical decomposition is not authority.

Normalization requires its own source evidence, scope, review, provenance, and content-addressed publication.

## Real-source evidence for the first architecture target

The first target remains the public Sustainable Corn data world already used by DEC-0013.

Official public repository:

`isudatateam/datateam`

Semantic source file:

`src/isudatateam/cscap/mantable.py`

Exact observed Git blob:

`689a5c6c4bdc8bc242cd09673f0063fea177c6bb`

The official code reads operation records from the Sustainable Corn `operations` table and explicitly uses both:

- `plant_corn`;
- `plant_soy`.

The same code places those operation values in a presentation section titled:

`Cash Crop Planting`

and labels the paired columns:

- `Corn`;
- `Soybean`.

This is materially stronger evidence than lexical token splitting.

It establishes a source-system semantic context in which:

```text
plant_corn
```

is used as the corn member of cash-crop planting semantics.

The first proposed normalization Gold may therefore target only:

```text
sourceOperationCode = plant_corn

normalized agronomic operation =
  family = PLANT
  subject.kind = CROP
  subject.code = CORN
```

No broader operation-code dictionary is accepted by this decision.

## Relationship to the DEC-0013 Gold occurrence

The DEC-0013 bootstrap Gold records:

```text
source-native occurrence subject:
  siteid = SERF

source operation code:
  plant_corn

date:
  2011-05-03

precision:
  DAY
```

The proposed normalization must bind the exact accepted:

`AgronomicRecordedOperationOccurrenceCompilation`

for that occurrence.

The normalization authority does not replace or rewrite the parent occurrence.

It refines only the meaning of the parent occurrence's exact source-native operation code.

## Two different meanings of “subject”

DEC-0014 must preserve a critical distinction.

The DEC-0013 occurrence contains a source-native occurrence subject:

```text
siteid = SERF
```

That answers:

`where / for which source-native site was the event recorded?`

The normalized operation may contain an operation semantic subject:

```text
CROP:CORN
```

That answers:

`what agronomic object is named by the operation semantic?`

These are not interchangeable.

DEC-0014 must never transform:

`SERF -> CORN`

or treat `CORN` as a field identity.

Likewise, it must not infer that the source-native site is already reconciled to an ADR field, season, crop stand, management unit, or runtime target.

## Decision

Introduce a distinct content-addressed authority:

`AgronomicRecordedOperationSemanticNormalizationCompilation`

Its purpose is narrowly:

> establish a reviewed, source-scoped semantic normalization for the exact source-native operation code carried by an exact governed recorded-operation occurrence.

The authority is upstream source semantics.

It is not a decision specification and is not runtime authority.

## Proposed semantic shape

Conceptually:

```text
AgronomicRecordedOperationSemanticNormalization {
  contractVersion

  normalizationId

  parentOccurrenceCompilationRef

  sourceCode {
    sourceOperationCode
  }

  normalizedOperation {
    family
    subject {
      kind
      code
    }
  }

  semanticEvidence[] {
    sourceRef
    sourceArtifactRef
    sourceLocator
    evidenceHash
    evidenceRole
  }

  applicability {
    appliesToOccurrenceSourceRef
    appliesToSourceOperationCode
  }

  semanticReviewRef

  authorityBindings[]

  transformationRationale

  losslessCoverage

  limitations[]
}
```

Exact implementation field names remain subject to post-acceptance implementation review.

## Parent occurrence closure

Publication must require the exact accepted:

`AgronomicRecordedOperationOccurrenceCompilation`

The parent must be revalidated through DEC-0013 authority validation.

The normalization source code must equal exactly:

`parent.occurrence.occurrenceSemantics.sourceOperationCode`

For the first Gold:

`plant_corn`

If the requested normalization says it applies to `plant_corn` while the parent occurrence records `harvest_corn`, publication must fail closed.

The authority may not normalize an operation code that is not present in the exact parent occurrence.

## Source-code semantic evidence

Normalization requires exact retained evidence supporting the source-native code meaning.

A normalization may require more than one non-contiguous evidence item. DEC-0014 therefore requires a non-empty `semanticEvidence[]` set rather than pretending one locator is always sufficient.

Each evidence item must identify:

1. exact semantic Source authority;
2. exact SourceArtifact authority;
3. exact locator within retained bytes;
4. deterministic evidence hash;
5. an explicit evidence role.

Collectively, the evidence set must support:

6. the exact source-native operation code;
7. source wording or source-system structure sufficient to support the normalized operation family;
8. source wording or source-system structure sufficient to support the normalized semantic subject.

For the first Gold, at least two semantic facts are required:

- the source code pairs `plant_corn` with `plant_soy` in the operation values rendered into the cash-crop planting table;
- the corresponding presentation identifies that table as `Cash Crop Planting` and labels the paired columns `Corn` and `Soybean`.

Those facts occur in separate source regions and must not be collapsed into a fabricated single excerpt.

A dataset landing page alone is insufficient.

A repository URL alone is insufficient.

A code file name alone is insufficient.

The normalizer must retain the exact source evidence used by review.

## Source locator

DEC-0014 should reuse accepted source-locator primitives.

For plain-text or source-code evidence, each v1 evidence item may use:

`BYTE_RANGE`

over exact retained SourceArtifact bytes.

Multiple BYTE_RANGE evidence items may bind the same exact SourceArtifact when the semantic proof is non-contiguous.

The existing Scientific Compiler already defines deterministic hashing semantics over exact selected byte ranges. DEC-0014 may reuse that locator primitive without requiring one ClaimCandidate or one locator to carry the entire normalization proof.

DEC-0014 therefore does not require a new generic locator contract.

If a future source requires structured coordinates, that locator must be separately replayable against exact retained bytes.

## No lexical normalization

The implementation must not contain a rule such as:

```text
split sourceOperationCode on "_"
uppercase tokens
infer operation family and crop
```

as authority.

That may be a candidate-generation heuristic.

It cannot authorize publication.

For example:

`plant_corn`

is not accepted as `PLANT/CORN` merely because the token text looks obvious.

The exact semantic evidence and review are mandatory.

## No cross-source dictionary by default

A mapping accepted for one source-code namespace must not automatically normalize the same string in another source.

For example, acceptance of:

```text
Sustainable Corn code:
plant_corn -> PLANT / CROP:CORN
```

does not establish:

```text
every provider code "plant_corn"
-> PLANT / CROP:CORN
```

Source identity and applicability are part of authority.

## Source-system applicability review

The semantic evidence artifact or artifacts do not need to be the same artifact as the event row.

For the first Gold:

- the parent occurrence evidence is a persisted operation query output;
- the semantic evidence is official source code that interprets the same Sustainable Corn operation code domain.

The system must not infer applicability merely because two artifacts share a GitHub organization or repository.

The semantic review must explicitly confirm:

`SOURCE_CODE_NAMESPACE_APPLICABILITY_VERIFIED`

That review assertion is part of the normalization authority.

It must bind:

- the exact parent occurrence compilation;
- the exact parent occurrence Source;
- every exact semantic evidence Source;
- every exact semantic evidence SourceArtifact;
- every exact semantic evidence locator/evidenceHash.

Applicability cannot be authorized by checking only one member of a multi-item evidence set.

## Proposed v1 normalized operation domain

DEC-0014 v1 should be intentionally narrow.

For the first Gold it needs only an atomic agronomic operation semantic:

```text
family = PLANT

subject.kind = CROP

subject.code = CORN
```

This does not establish a global complete action taxonomy.

It does not establish that every agricultural operation can be represented by exactly one family and one subject.

Compound, multi-target, material-bearing, treatment-bearing, termination, sampling, fertilizer, tillage-method, harvest-detail, and machine-operation semantics remain unresolved unless independently covered later.

## Why “family” instead of Policy actionCode

The normalized semantic should not be treated as a Policy action code merely because the token `PLANT` may resemble one.

The authority expresses source semantic meaning.

Policy actionSpace belongs to decision specification.

Therefore:

```text
normalizedOperation.family = PLANT
```

must not imply:

```text
Policy.actionSpace includes PLANT
```

or:

```text
Policy actionCode PLANT is selected
```

A later bridge may map source semantic operations to Policy action semantics.

DEC-0014 does not accept that bridge.

## No Policy laundering

DEC-0014 must not create or mutate:

- Policy;
- Policy.actionSpace;
- Policy.actionSemantics;
- threshold authority;
- human-gate semantics;
- fallback semantics;
- decision logic.

The normalized operation is evidence about source-code meaning, not authority to decide an action.

## No normative-force laundering

A recorded source code does not establish:

- REQUIRE;
- PROHIBIT;
- SHOULD;
- BEST_EFFORT;
- PERMITTED.

The normalization authority must not infer any normative modality.

## No runtime laundering

DEC-0014 must not create:

- RuntimePlan;
- RuntimeEligibility;
- RuntimeBinding;
- RuntimeAlternativeSet;
- DecisionResult.

It does not answer whether planting is currently legal, eligible, possible, preferred, or selected.

## No execution laundering

The parent occurrence is source-recorded occurrence authority.

Even after semantic normalization it is not automatically an ADR execution.

DEC-0014 must not create:

- ExecutionReceipt;
- machine task identity;
- ADR operationId;
- executor identity;
- operator identity;
- machine identity;
- completion status.

## No Outcome laundering

Normalization does not establish:

- agronomic effect;
- measured response;
- causal outcome;
- yield consequence;
- resource consequence;
- success/failure.

No Outcome authority is created.

## No target-identity laundering

Normalization of:

`plant_corn`

must not reconcile:

`SERF`

to an ADR field.

DEC-0014 does not establish:

- canonical field identity;
- tenant/project identity;
- season identity;
- crop stand identity;
- runtime target identity.

## No current crop-state inference

A record normalized as planting corn does not by itself establish the current state:

`crop.code = CORN`

for arbitrary later times.

It is a historical recorded-operation semantic.

Any ContextDatum or current state projection requires its own temporal and reconciliation authority.

DEC-0014 must not publish ContextDatum.

## No physical-truth upgrade

The authority means:

```text
the governed source records an operation code
whose reviewed source semantic is planting corn
```

It does not independently prove:

```text
corn was physically planted exactly as intended
```

beyond the epistemic class already established by the parent recorded-occurrence authority.

Normalization may not upgrade source-recorded evidence into independently verified physical truth.

## No completeness inference

A normalized code mapping does not establish that:

- all operation codes are known;
- all operations for a field are recorded;
- the provider vocabulary is complete;
- unrecognized codes are invalid;
- missing codes imply no operation.

No completeness authority is created.

## No inverse inference

Acceptance of:

```text
plant_corn -> PLANT / CROP:CORN
```

does not automatically authorize the inverse rule:

```text
PLANT / CROP:CORN -> plant_corn
```

for writing back into the source system.

DEC-0014 is read-side semantic normalization only.

## No equivalence inference

Two source-native codes that normalize to the same family/subject are not automatically materially equivalent.

Normalization does not establish equivalence of:

- parameters;
- rates;
- equipment;
- timing;
- costs;
- implementation;
- execution semantics;
- decision consequences.

## No silent source-version drift

Normalization applicability must be content-addressed and versioned.

If source semantic evidence changes, the previous normalization authority does not silently apply to the new bytes.

A changed code definition or source artifact requires:

- new reviewed authority; or
- explicit governed continuity proof in a later architecture.

## Semantic review

Publication must require an explicit:

`AgronomicRecordedOperationSemanticNormalizationReviewDecision`

or equivalent governed review authority.

An accepted review should confirm at least:

1. `PARENT_OCCURRENCE_AUTHORITY_VERIFIED`;
2. `EXACT_SOURCE_OPERATION_CODE_VERIFIED`;
3. `EXACT_SEMANTIC_EVIDENCE_VERIFIED`;
4. `SOURCE_CODE_NAMESPACE_APPLICABILITY_VERIFIED`;
5. `NORMALIZED_OPERATION_FAMILY_SUPPORTED`;
6. `NORMALIZED_OPERATION_SUBJECT_KIND_SUPPORTED`;
7. `NORMALIZED_OPERATION_SUBJECT_CODE_SUPPORTED`;
8. `NO_LEXICAL_ONLY_INFERENCE`;
9. `NO_POLICY_ACTION_INFERENCE`;
10. `NO_NORMATIVE_FORCE_INFERENCE`;
11. `NO_RUNTIME_OR_EXECUTION_INFERENCE`;
12. `NO_OUTCOME_INFERENCE`;
13. `NO_TARGET_IDENTITY_INFERENCE`;
14. `NO_CURRENT_STATE_INFERENCE`;
15. `NO_COMPLETENESS_OR_INVERSE_INFERENCE`.

An accepted publication must require all mandatory checks.

## Reviewer authorization

Review must be performed by an authorized reviewer.

The reviewer must be authorized to inspect every source world needed to adjudicate the mapping.

At minimum, review authorization must cover:

- the parent occurrence source resource when its source semantics are inspected;
- every semantic evidence source resource.

A single authorization decision may be reused only when its governed resource/scope legitimately covers all required evidence; otherwise separate exact AuthorizationDecisionAudit refs are required.

The reviewer audit must bind:

- parent occurrence ref;
- parent occurrence Source ref;
- every semantic evidence Source ref;
- every semantic evidence SourceArtifact ref;
- every locator/evidence hash;
- candidate normalized semantic;
- disposition.

A reviewer may not approve a mapping over even one evidence item they are not authorized to inspect.

## Proposed review dispositions

At minimum:

- `ACCEPT_RECORDED_OPERATION_SEMANTIC_NORMALIZATION`;
- `REJECT_RECORDED_OPERATION_SEMANTIC_NORMALIZATION`.

Rejected normalization cannot authorize publication.

## Content addressing

The normalized semantic authority must be content-addressed.

Changing any of the following must change semantic identity:

- exact parent occurrence compilation ref;
- exact source operation code;
- every semantic evidence Source ref;
- every semantic evidence SourceArtifact ref;
- every locator;
- every evidence hash;
- evidence-role assignment;
- normalized operation family;
- normalized subject kind;
- normalized subject code;
- source-code namespace applicability;
- semantic review ref;
- transformation rationale;
- local completeness/limitations.

Stored authority must fail closed if replayed inputs do not reproduce the declared semantic hash.

## Local lossless coverage

For DEC-0014 v1:

`losslessCoverage = COMPLETE`

means only:

> the targeted semantic normalization for the exact parent source operation code is represented without changing its reviewed source meaning.

For the first Gold, COMPLETE covers only:

```text
plant_corn
  -> PLANT
  -> CROP:CORN
```

It does not mean:

- the Sustainable Corn operation vocabulary is fully normalized;
- all planting semantics are represented;
- all crop aliases are known;
- all event parameters are normalized;
- the recorded-operation history is complete;
- Policy or runtime semantics are complete.

## Why not mutate DEC-0013

Rejected.

DEC-0013 is already accepted and implemented as source-recorded occurrence authority.

Silently changing its publication rules so that arbitrary `normalizedOperation` values become accepted would weaken the invariant that normalization needs separate authority.

DEC-0014 must be additive.

A later additive projection may expose parent occurrence plus accepted normalization together, but the immutable DEC-0013 occurrence authority remains independently inspectable.

## Why not use QualifiedTransformation

Rejected for the first architecture target.

The existing `QualifiedTransformation` authority is defined over semantic input/output ports and epistemic preservation in the specification layer.

Using it directly would blur:

- source-code semantic adjudication;
- generic Context semantic transformations;
- specification authority.

DEC-0014 needs source evidence, source-code namespace applicability, parent occurrence closure, and source-faithful review.

Those are not the present purpose of `QualifiedTransformation`.

## Why not use Policy.actionSemantics

Rejected.

Policy.actionSemantics defines governed equivalence/material parameters for actions in a Policy actionSpace.

A source log can be normalized before any Policy exists.

Using Policy authority would reverse the architecture and make source meaning depend on a deployed decision specification.

## Why not use DEC-0009/0010 directly

Rejected.

DEC-0009 and DEC-0010 compile source propositions about agronomic action regimens and realizations from planning/protocol evidence.

They do not define provider operation-code dictionaries.

A field-log code meaning is a different independently reviewable proposition.

## Why not use a global static enum map

Rejected.

A global map such as:

```text
plant_corn: { family: PLANT, crop: CORN }
```

without source scope and evidence would:

- hide provenance;
- ignore source version drift;
- conflate providers;
- make string identity equal semantic identity;
- bypass reviewer authority.

## Why not use an LLM classifier as final authority

Rejected.

An LLM may propose normalization candidates.

It cannot publish authoritative normalization merely from linguistic plausibility.

Exact source evidence and governed review remain mandatory.

## First real-source Gold target

Parent:

the accepted DEC-0013 Sustainable Corn bootstrap occurrence for:

```text
siteid=SERF
sourceOperationCode=plant_corn
date=2011-05-03
precision=DAY
```

Semantic evidence:

`isudatateam/datateam`

file:

`src/isudatateam/cscap/mantable.py`

exact observed blob:

`689a5c6c4bdc8bc242cd09673f0063fea177c6bb`

Evidence structure includes:

- the operation keys `plant_corn` and `plant_soy`;
- their use in the rendered Cash Crop Planting table;
- the Corn/Soybean column pairing.

Proposed accepted normalization:

```text
plant_corn
  -> family = PLANT
  -> subject.kind = CROP
  -> subject.code = CORN
```

## Rights for the first Gold

The official `isudatateam/datateam` repository is public.

Its repository LICENSE is MIT.

The first implementation may retain the exact semantic source artifact or an exact required byte-range fixture with the required copyright/license notice.

The underlying Sustainable Corn research dataset is separately published as Public/CC0.

DEC-0014 does not weaken either rights boundary.

## Mandatory implementation acceptance cases

If DEC-0014 is accepted, implementation acceptance must prove at least:

1. exact DEC-0013 parent occurrence authority is mandatory;
2. exact parent source operation code is mandatory;
3. a non-empty exact semantic evidence set is mandatory;
4. every semantic Source/SourceArtifact/locator evidence item is mandatory and replayed from retained bytes;
5. non-contiguous source semantics may require multiple evidence items and may not be collapsed into fabricated continuity;
6. source-code namespace applicability is explicitly reviewed;
7. `plant_corn -> PLANT / CROP:CORN` can publish from the complete exact real-source evidence set;
8. removing either required first-Gold semantic evidence region fails closed;
9. changing parent operation code to `harvest_corn` fails closed;
10. changing normalized family to `HARVEST` fails closed;
11. changing normalized subject code to `SOYBEAN` fails closed;
12. using only lexical decomposition with no semantic evidence fails closed;
13. using unrelated semantic evidence fails closed;
14. semantic evidence hash drift fails closed;
15. source artifact drift fails closed;
16. rejected review cannot publish;
17. incomplete review cannot publish;
18. unauthorized reviewer cannot publish;
19. Policy/actionSpace mutation is absent;
20. normative force is absent;
21. RuntimePlan/RuntimeEligibility/RuntimeBinding/DecisionResult are absent;
22. ExecutionReceipt is absent;
23. Outcome is absent;
24. ContextDatum/current crop-state projection is absent;
25. canonical ADR field identity is absent;
26. no inverse source-write mapping is created;
27. no source-vocabulary completeness claim is created.

At least one positive acceptance case must use exact real Sustainable Corn semantic source evidence.

## Proposed first implementation slice

Only after explicit acceptance and accepted docs merge may implementation begin.

The first implementation slice should contain only:

1. semantic-normalization contract;
2. semantic-normalization review authority;
3. parent DEC-0013 occurrence closure;
4. exact multi-item semantic Source/SourceArtifact evidence replay;
5. content-addressed normalization publication/validation;
6. one real-source `plant_corn` positive Gold;
7. mandatory negative boundaries;
8. dedicated acceptance/workflow wiring if needed.

It must not include:

- ContextDatum projection;
- current field-state derivation;
- Policy mutation;
- runtime use;
- planned-versus-actual reconciliation;
- machine execution reconciliation;
- Outcome integration;
- global provider vocabulary registry;
- bidirectional source adapter;
- write-back normalization.

## Interaction with DEC-0013

DEC-0013 remains authoritative for whether a source records an operation occurrence.

DEC-0014 refines only the meaning of the exact recorded source operation code.

The conceptual relation is:

```text
AgronomicRecordedOperationOccurrenceCompilation
  |
  | exact parent
  v
AgronomicRecordedOperationSemanticNormalizationCompilation
```

The child does not replace the parent.

## Interaction with future ContextDatum projection

A later authority may potentially project a normalized historical event into governed context.

DEC-0014 does not pre-accept that.

Such a projection must separately solve at least:

- canonical target identity;
- event-to-context semantic mapping;
- temporal validity interval;
- historical versus current state;
- conflict/supersession;
- authorization to write context;
- uncertainty/epistemic preservation.

## Interaction with future planned-versus-actual reconciliation

A normalized actual operation may eventually be compared to planned management semantics.

DEC-0014 does not perform that comparison.

It establishes only a source semantic bridge for the actual record code.

## Interaction with future execution reconciliation

A source-recorded `plant_corn` occurrence may eventually be linked to an ADR or external execution identity.

DEC-0014 does not establish that identity.

Semantic normalization is not execution matching.

## Explicitly unresolved after DEC-0014

Even if accepted and implemented, the following remain unresolved:

1. preferred exact Figshare workbook Gold replacement/addition for DEC-0013;
2. normalization of `plant_soy`;
3. normalization of harvest codes;
4. normalization of tillage codes;
5. normalization of fertilizer codes and material/rate semantics;
6. normalization of termination codes;
7. compound operation semantics;
8. global crop-code vocabulary authority;
9. provider-version continuity;
10. cross-provider semantic equivalence;
11. canonical field/season/crop-state reconciliation;
12. ContextDatum projection;
13. planned-versus-actual comparison;
14. ExecutionReceipt/external execution reconciliation;
15. Outcome linkage.

None of these may be collapsed into the first DEC-0014 implementation merely to make the pipeline appear end-to-end complete.

## Acceptance targets

Before this architecture may be accepted, review must confirm:

1. normalization is a separate authority from recorded occurrence;
2. exact parent occurrence closure is mandatory;
3. semantic evidence is a complete exact replayable set rather than an assumed single excerpt;
4. non-contiguous source facts may bind through multiple exact evidence items;
5. lexical plausibility is not authority;
6. mapping is source-scoped rather than global by default;
7. source-code namespace applicability requires explicit review;
8. occurrence site identity and operation semantic subject remain distinct;
9. normalized family is not Policy actionSpace authority;
10. no normative force is inferred;
11. no runtime/decision authority is created;
12. no execution authority is created;
13. no Outcome authority is created;
14. no current-state/ContextDatum authority is created;
15. no target identity is inferred;
16. no completeness, inverse mapping, or material equivalence is inferred;
17. first Gold is source-generic in contract despite using real `plant_corn` evidence;
18. implementation remains additive and does not weaken DEC-0013.

## Post-acceptance gate

Before an accepted DEC-0014 documentation PR may merge:

1. repository-wide ADR Constitution MUST pass on the exact accepted documentation head;
2. the PR MUST remain docs-only;
3. no package/runtime/schema/workflow/acceptance mutation may be included;
4. no existing accepted contract may be changed;
5. PR base MUST remain the expected protected `main`;
6. accepted exact head MUST be recorded before merge.

Only after the accepted documentation PR is merged may implementation begin from the resulting exact `main`.

## Acceptance

Accepted on 2026-08-30 after explicit architecture approval.

Acceptance establishes only the source-scoped semantic-normalization architecture described by this decision.

The accepted authority means:

```text
exact governed recorded-operation occurrence
+ exact source operation code
+ complete exact replayable semantic evidence set
+ reviewed source-code namespace applicability
+ reviewed normalized agronomic operation semantic
```

For the first Gold, the accepted target is narrowly:

```text
plant_corn
  -> family = PLANT
  -> subject.kind = CROP
  -> subject.code = CORN
```

Acceptance does **not** establish:

- Policy actionSpace or Policy action selection;
- normative force;
- runtime eligibility, binding, alternatives or decisions;
- ADR ExecutionReceipt or machine/operator execution identity;
- Outcome or causal effect;
- ContextDatum or current crop state;
- canonical ADR field/season/target identity;
- source vocabulary completeness;
- inverse/write-back mapping;
- cross-source/global code equivalence;
- planned-versus-actual reconciliation.

The accepted first implementation slice is limited to:

1. semantic-normalization contract;
2. semantic-normalization review authority;
3. exact DEC-0013 parent occurrence closure;
4. complete exact multi-item semantic-evidence replay;
5. content-addressed normalization publication/validation;
6. one real-source `plant_corn` positive Gold;
7. mandatory negative boundary cases;
8. dedicated acceptance/workflow wiring if required.

All explicitly unresolved items remain unresolved after acceptance and require later authority rather than silent expansion.

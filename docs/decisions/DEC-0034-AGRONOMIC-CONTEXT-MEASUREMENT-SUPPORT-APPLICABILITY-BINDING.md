# DEC-0034 — Agronomic Context Measurement-Support Applicability Binding

Status: **PROPOSED — REQUIRES EXPLICIT USER ACCEPTANCE**

Date: 2026-09-06

## Decision statement

ADR should close the first machine-proven measurement-support binding seam by extending the existing K04 → A08 scientific-precondition / source-to-target transport path with a bounded, governed `ContextDatum` support-compatibility predicate family.

The new predicate family is owned by existing Applicability authority and must allow A08 to test whether the exact target `ContextDatum` that is proposed to satisfy a knowledge requirement has the measurement support required by that knowledge.

For the first bounded implementation, vertical support is the only newly exercised support dimension.

DEC-0034 does **not** create a new authority object, does **not** change the public `ContextDatum` wire, does **not** widen `RuntimeProfile`, and does **not** authorize a governed Transformation path.

The existing authority separation remains:

```text
K04 ScientificQualificationDecision / QualifiedKnowledge
  owns the reviewed scientific-use constraint

A08 ApplicabilityAssessment
  owns source → target measurement-support adjudication

A05 RuntimeProfile
  owns reusable runtime composition policy
  but does not become scientific measurement-compatibility authority

R01 RuntimePlan
  consumes the A08 disposition + existing RuntimeProfile requirements

R02 InformationRequirement
  exposes missing target context only when upstream A08/R01 can identify it
```

If the only available target evidence is a point/depth-specific observation and the intended target semantic is a root-zone state that requires an actual semantic/scientific transformation, that remains a separate conditional `MTL-S01 + MTL-A09` frontier and must fail closed until `QualifiedTransformation` authority exists.

## Exact triggering evidence

This DEC is opened only because the post-DEC-0033 compatibility/productization audit discovered a real authority seam, as DEC-0033 explicitly required before any further DEC expansion.

The exact protected-main predecessor is:

```text
main =
7ad311b6ff0f06349e3646f0461b2cb2a81e3c27
```

The triggering evidence chain is:

```text
PR #217
ADR-3B irrigation metric comparability
  -> METRIC_SEMANTICS_NOT_EQUIVALENT

PR #218
independent root-zone soil-water scientific authority
  -> current-day root-zone deficit QualifiedKnowledge
  -> FAO-56 root-zone total-available-water QualifiedKnowledge

PR #219
root-zone measurement binding adequacy
  -> ROOT_ZONE_MEASUREMENT_BINDING_CONSTRAINT_GAP
```

PR #219 proves behaviorally that two standard `ContextDatum` records may be identical in:

```text
semanticId
value
unit
epistemicClass
provenanceClass
spatialSupport
temporalSupport
effectiveInterval
availableAt
source
```

while differing only in:

```text
verticalSupport
```

and the current A08 → R01 → R02 path can still treat both worlds equivalently for structural runtime qualification.

The triggering audit is qualification evidence only. It is not itself architecture authority.

## Existing architecture authority

DEC-0034 does not introduce a new architectural responsibility.

Frozen Architecture v1.0 already assigns to the Transport / Applicability Engine responsibility for:

- source and target semantic compatibility;
- measurement conventions;
- target-state compatibility;
- required transformations;
- calibration requirements;
- limitations, missing information and conflicts.

The frozen `ContextDatum` contract already includes:

```text
verticalSupport = null
```

or:

```text
verticalSupport = {
  fromMm,
  toMm
}
```

and therefore the target evidence object already carries the support fact that A08 currently fails to consume.

The Master Task Line also already freezes:

```text
MTL-A08 — Source→Target Applicability Core
MTL-A09 — Governed Transformation Applicability Path (conditional)
MTL-S01 — Transformation / Model / Policy Specification Authority
```

and explicitly forbids using a unit conversion to hide spatial/depth/epistemic mismatch.

Therefore the first seam is an implementation/constraint-language gap inside already-owned Applicability authority, not a missing architectural plane or component.

## Why RuntimeProfile is not the primary repair owner

The current A05 `RuntimeProfile` is intentionally minimal and its implemented context requirements contain only:

```text
requiredSemanticIds
epistemicConstraints
```

A profile may require that a semantic be present and may constrain acceptable epistemic classes.

That does not make A05 the authority that decides whether one scientific claim's root-zone measurement semantics are compatible with one exact target datum's depth support.

Moving this rule into a root-zone-specific `RuntimeProfile` field would conflate:

```text
composition policy
with
source→target scientific transport
```

and would also fail for target-dependent support boundaries whose correct extent changes across crop/stage/field/time worlds.

DEC-0034 therefore forbids a repair whose only mechanism is adding a hard-coded root-zone depth field to A05.

A future RuntimeProfile may constrain a governed transformation/specification when C10 is exercised, but that is a separate composition concern.

## Why semanticId alone is insufficient

The following must remain invalid as a proof strategy:

```text
semanticId = soil.root_zone_deficit
therefore
verticalSupport is necessarily the correct root zone
```

PR #219 disproves that implication in the generic runtime path.

A standard `ContextDatum` is semantically hashed including its support metadata, but the current A08/R01 selection logic does not interpret the vertical-support meaning.

Therefore a name containing `root_zone` cannot launder an arbitrary point/shallow/deep support interval into root-zone scientific compatibility.

## Why a producer-only specialized validator is insufficient

DEC-0031 established the important distinction:

```text
valid generic ContextDatum
!=
source-specifically governed ContextDatum publication
```

A source-specific producer or specialized validator may be useful for generating a trustworthy root-zone state datum.

However, producer qualification alone does not close this seam if generic A08 can later consume another semantically named datum without checking the measurement support required by the exact knowledge candidate.

The consumer-side transport relation must therefore remain explicit and replayable.

DEC-0034 does not prohibit future specialized root-zone datum producers; it only states that they do not replace A08 measurement-support adjudication.

## Existing K04 constraint authority is sufficient as the owner

K04 `ScientificQualificationDecision` already freezes reviewed arrays for:

```text
semanticPreconditions
effectModifiers
transportConstraints
limitations
```

Those entries are canonical, versioned and bound to the exact Claim + SourceContext + scientific approver authority.

DEC-0034 therefore does not introduce a parallel `MeasurementRequirementAuthority` object.

For the bounded first implementation, the reviewed support requirement should be carried as an explicit structured semantic precondition (or an implementation-equivalent constraint inside the existing K04-owned scientific-use constraint set).

The constraint must remain traceable to the exact ScientificQualificationDecision that supplied it.

## Bounded measurement-support predicate family

Implementation may introduce a structured A08 semantic-precondition operator equivalent to:

```text
CONTEXT_DATUM_SUPPORT_MATCH
```

The exact implementation spelling may differ, but the semantics must be finite and fail closed.

The predicate must identify at least:

```text
targetSemanticId
supportDimension
requiredRelation
expectedSupportBasis
```

For DEC-0034 first scope:

```text
supportDimension = VERTICAL_INTERVAL
```

A required support basis may be one of a finite reviewed set such as:

```text
EXACT_INTERVAL
CONTEXT_SEMANTIC_INTERVAL
```

where:

```text
EXACT_INTERVAL
```

means the scientific qualification itself establishes the exact acceptable vertical interval; and:

```text
CONTEXT_SEMANTIC_INTERVAL
```

means the acceptable vertical interval must be obtained from another exact `ContextDatum` semantic in the same immutable `ContextManifest`.

This DEC does not freeze a universal root-depth semantic ID and does not invent target-specific root depth.

A real ADR-3B root-zone world must acquire/qualify whichever target semantic supplies that support basis through its own governed context authority before the relation can resolve.

## No caller-selected expected support

The A08 invocation caller must not supply or override the expected support interval.

Expected support comes only from:

1. the exact K04-owned support constraint; or
2. the exact context semantic explicitly named by that reviewed constraint and frozen in the same ContextManifest.

The caller cannot turn:

```text
shallow probe support
```

into:

```text
root-zone support
```

by passing a convenient runtime option.

## Exact target datum binding

A support predicate must bind the exact target `ContextDatum` selected by semantic ID from the exact `ContextManifest` used by the ApplicabilityAssessment.

At minimum it must fail closed for:

- target semantic absent;
- multiple ambiguous target datums when the predicate requires one exact support-bearing datum;
- `verticalSupport = null` when a vertical interval is required;
- expected support basis absent;
- expected support basis ambiguous;
- unsupported unit/conversion for the support basis;
- actual support mismatch;
- malformed interval;
- unsupported support relation;
- caller override of expected support.

## A08 disposition rules

For a supported measurement-support predicate:

```text
actual target support satisfies reviewed required relation
  -> MATCH
```

A missing context semantic needed to establish expected support must remain information-visible:

```text
required support-basis semantic missing
  -> UNKNOWN / UNRESOLVED
  -> missingContextSemanticIds includes the exact missing semantic
```

A target datum whose support materially contradicts a resolved required support must not be treated as directly applicable:

```text
support mismatch
  -> MISMATCH / CONFLICT
  -> runtimeUse = BLOCKED
```

An unsupported relation/operator must remain:

```text
UNRESOLVED
```

with a stable unsupported-constraint code.

No low-confidence or heuristic match is permitted.

## Existing A08 public wire remains sufficient

The frozen `adr.applicability-assessment.v1` condition-result shape already contains:

```text
source
semanticId
operator
expected
target
unit?
status
disposition
```

and permits structured canonical values in `expected` and `target`.

Therefore DEC-0034 does not require a new ApplicabilityAssessment authority kind or a mandatory wire-contract version solely to express support comparison evidence.

The support predicate's condition result should encode the reviewed expected support and exact observed target support in those existing structured fields.

Any implementation change that cannot remain truthful within the frozen v1 shape must stop and return for separate architecture review rather than silently widening the wire.

## R01 and R02 ownership after A08

R01 remains the runtime composition consumer, not the owner of scientific measurement compatibility.

After A08 support adjudication:

- a support conflict is already an Applicability conflict and blocks that candidate;
- a missing support-basis semantic enters `missingContextSemanticIds` and can flow into the existing R01 open-requirement path;
- R02 may then emit an `InformationRequirement` for that missing semantic using existing information-planning authority.

DEC-0034 does not authorize R02 to invent a required interval independently of K04/A08.

## Governed Transformation remains separate

DEC-0034 explicitly distinguishes:

```text
A target datum already claims the required semantic,
but its measurement support must be checked
```

from:

```text
the available target evidence has a different semantic/measurement basis
and must be transformed into the required semantic state
```

The first is DEC-0034 A08 support compatibility.

The second is the existing conditional architecture:

```text
MTL-S01 QualifiedTransformation authority
+
MTL-A09 governed transform path
```

For ADR-3B specifically:

```text
instantaneous / point VWC
!=
root-zone soil-water deficit
```

has already been machine-adjudicated by PR #217.

Therefore DEC-0034 must not authorize an adapter, LLM, runtime helper or semantic rename to convert GEOX point `soil_moisture` into a root-zone deficit.

Until a separately accepted and implemented QualifiedTransformation path exists, the current point-VWC world remains incapable of satisfying root-zone deficit semantics through transformation.

## No automatic MTL-S01 / A09 implementation in this DEC

The existence of the ADR-3B point-VWC migration case makes S01/A09 commercially relevant, but DEC-0034 does not yet authorize their implementation.

Why:

- the current retained root-zone science establishes root-zone deficit semantics and FAO-56 TAW relation;
- it does not yet publish target-specific field-capacity, wilting-point, rooting-depth or a complete governed point-VWC→root-zone-deficit transformation specification;
- implementing QualifiedTransformation now would risk inventing missing scientific/target parameter authority.

After DEC-0034 closure, ADR-3B must choose one of two legal next paths:

```text
A. acquire an independently governed target root-zone state ContextDatum
   and prove DEC-0034 support compatibility

or

B. acquire sufficient scientific + target parameter authority for a
   QualifiedTransformation, then separately activate MTL-S01 + MTL-A09
```

No third path may silently reuse the legacy `0.22` threshold.

## No legacy threshold laundering

DEC-0034 establishes no authority for:

```text
soil_moisture < 0.22
```

The legacy GEOX `0.22` constant remains migration evidence only.

It must not be used as:

- root-zone depletion fraction;
- Management Allowable Depletion;
- field capacity;
- wilting point;
- target root-zone deficit;
- a conversion coefficient;
- calibration authority;
- default parameter for missing target state.

## No scientific upgrade from semantic naming

A datum may not acquire additional scientific authority merely because its semantic ID uses words such as:

```text
root_zone
deficit
depletion
storage
```

Its value, epistemic class, provenance, support and source remain independently governed ContextDatum facts.

## No ContextDatum contract mutation

DEC-0034 does not change:

```text
adr.context-datum.v1
```

and does not add fields to `verticalSupport`.

The existing exact representation remains:

```text
null
```

or:

```text
{ fromMm, toMm }
```

Support compatibility is a relation over existing target evidence, not a new field in that evidence.

## No RuntimeProfile mutation

DEC-0034 does not add:

- `verticalSupportConstraints`;
- root-zone depth constants;
- scientific measurement predicates;

into `adr.runtime-profile.v1` or v2.

A future C10-exercising RuntimeProfile may bind Transformation/Model/Policy constraints through its own accepted path, but A05 does not absorb source-to-target transport authority here.

## No new public authority object

DEC-0034 introduces none of:

- MeasurementRequirement;
- MeasurementCompatibilityAuthority;
- RootZoneAuthority;
- new TargetContext mega-object;
- new ContextManifest kind;
- new RuntimeProfile kind.

The existing exact refs remain sufficient:

```text
ScientificQualificationDecision / QualifiedKnowledge
ContextManifest / ContextDatum
ApplicabilityAssessment
RuntimePlan
InformationRequirement
```

## First implementation Gold

After explicit acceptance and architecture-doc closure, implementation should prove a finite synthetic mechanism world before claiming any real target root-zone state.

The Gold should contain:

1. one QualifiedKnowledge whose exact ScientificQualificationDecision contains one reviewed vertical-support compatibility precondition;
2. one DecisionProblem;
3. one RuntimeProfile / Deployment using existing minimal A05/A06 semantics;
4. one ContextManifest containing:
   - the target semantic datum whose vertical support is checked;
   - the exact context semantic needed to establish the expected support basis, when the relation uses `CONTEXT_SEMANTIC_INTERVAL`;
5. one A08 assessment that produces `MATCH` only when support is correct;
6. one R01 plan with no support-related open requirement only for the matching world.

The first Gold is mechanism qualification only and must not be described as real root-zone field-state authority.

## Mandatory negative Gold

At minimum fail closed for:

- same semantic/value/unit/epistemic target datum with wrong vertical support;
- same semantic/value with `verticalSupport = null`;
- missing support-basis context semantic;
- ambiguous support-basis semantic;
- wrong support-basis unit;
- expected interval mismatch;
- malformed support constraint;
- unsupported support dimension;
- unsupported support relation;
- caller-supplied expected interval override;
- semanticId containing `root_zone` while support is wrong;
- direct RuntimeProfile-only support bypass;
- A08 condition result that hides support mismatch;
- R01 `STRUCTURALLY_COMPLETE` after a material A08 support conflict;
- R02 silently treating a missing support basis as satisfied;
- legacy `0.22` used as support/threshold/conversion authority;
- point VWC relabeled as root-zone deficit without QualifiedTransformation;
- creation of `QualifiedTransformation` under DEC-0034;
- creation of DecisionResult/Outcome authority;
- GEOX write or production cutover.

## Backward compatibility

Existing K04 qualifications that contain only the already-supported scalar `EQUALS` semantic preconditions remain unchanged.

Existing A08 assessments and historical RuntimeBindings remain immutable.

DEC-0034 must not reinterpret historical assessments under the new predicate semantics.

New support predicates apply only to new exact ScientificQualificationDecision / QualifiedKnowledge authority that explicitly contains them.

Historical `adr.applicability-assessment.v1` records remain valid under the engine/compiler version that produced them.

## Authority and versioning discipline

A support-bearing ScientificQualificationDecision must be a new exact authority record/version.

It must not mutate an already-published K04 decision in place.

If existing ADR-3B QualifiedKnowledge is later requalified with a DEC-0034 support constraint, normal K04 supersession rules apply.

A08 execution must bind exact current:

- QualifiedKnowledge;
- ScientificQualificationDecision-derived constraint set;
- ContextManifest;
- DecisionProblem;
- engine identity/version;

and produce a content-addressed ApplicabilityAssessment as already required.

## Explicit nonclaims

Acceptance of DEC-0034 would **not** prove or authorize:

- a real target root-zone state exists;
- a correct target rooting depth exists;
- target field capacity or wilting point exists;
- point VWC can be transformed into root-zone deficit;
- QualifiedTransformation exists;
- Model or Policy specification authority exists;
- calibration is satisfied;
- RuntimeEligibility for ADR-3B;
- RuntimeBinding for ADR-3B;
- DecisionResult parity with GEOX;
- GEOX shadow adoption;
- production cutover;
- human approval, dispatch or machine execution.

## Consequences

Positive:

- closes the machine-proven vertical-support blind spot at the architecture-assigned A08 owner;
- keeps scientific constraints owned by K04 rather than runtime callers;
- preserves generic ContextDatum and RuntimeProfile contracts;
- makes missing support-basis context visible to existing R01/R02 planning;
- prevents semantic-ID laundering of point/shallow/deep measurements into root-zone state;
- leaves the larger QualifiedTransformation stack conditional until its real scientific predecessors exist.

Costs:

- A08 predicate evaluation becomes richer than scalar equality;
- real root-zone worlds need explicit support-basis target context authority;
- existing ADR-3B root-zone QualifiedKnowledge cannot be retroactively upgraded; a new qualification decision is required;
- the GEOX point-VWC migration remains blocked until ADR either acquires governed root-zone state or separately closes MTL-S01/A09 transformation authority.

## Local completeness if accepted and implemented

If DEC-0034 implementation closes successfully:

```text
ROOT_ZONE_MEASUREMENT_BINDING_CONSTRAINT_GAP
= CLOSED FOR GOVERNED A08 VERTICAL-SUPPORT COMPATIBILITY
```

This does not imply:

```text
ADR-3B ROOT-ZONE STATE ACQUISITION = COMPLETE
```

The next ADR-3B frontier must be chosen from actual available authority:

```text
GOVERNED_ROOT_ZONE_STATE_ACQUISITION
```

or, only after sufficient scientific/target parameter evidence exists:

```text
MTL-S01 + MTL-A09 QUALIFIED_TRANSFORMATION ACTIVATION
```

## Architecture acceptance gate

No implementation is authorized by this proposal.

Before implementation may begin:

1. DEC-0034 must receive explicit user acceptance;
2. the exact accepted documentation head must receive fresh Constitution qualification;
3. accepted docs must close through Draft → Ready using the repository's exact-head merge discipline;
4. qualified head → merge must be free of unexpected file drift;
5. post-merge Constitution must succeed;
6. only then may an independent DEC-0034 implementation branch start from the exact accepted architecture main.

## Final proposal

DEC-0034 proposes one narrow closure rule:

> When QualifiedKnowledge requires a target semantic with material measurement-support semantics, A08 must adjudicate that requirement against the exact support metadata of the exact ContextDatum in the immutable ContextManifest using a reviewed K04-owned support constraint. RuntimeProfile does not become scientific measurement-compatibility authority. Missing support basis remains information-visible; incompatible support fails closed. Conversion of different target evidence into the required semantic remains a separate QualifiedTransformation / MTL-A09 problem and is not authorized by DEC-0034.

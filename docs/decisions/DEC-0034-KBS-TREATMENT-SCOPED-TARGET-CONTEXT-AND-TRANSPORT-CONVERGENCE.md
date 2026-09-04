# DEC-0034 — KBS Treatment-Scoped Target Context and Transport Convergence

Status: **PROPOSED**

Date: 2026-09-04

## Decision statement

For the first real-positive product candidate, ADR will use the exact 2015 KBS LTER
Main Site Treatment 6 nitrogen-prohibition knowledge only after establishing an
independent, source-backed KBS target world and tightening the scientific transport
scope of that knowledge.

DEC-0034 proposes one finite, source-specific bridge for the exact first KBS world.
It does **not** generalize experimental-treatment support across all sources and does
**not** widen the frozen public A01, A02, A04 or A08 wire contracts.

The first accepted world must prove all of the following in one replayable
`AuthorityLedger`:

1. exact retained KBS target evidence independently establishes a real Main Site T6
   target occurrence/context;
2. source-native `T6` is normalized to the exact canonical semantic
   `treatment.name = "Main Site Treatment 6"` only through explicit reviewed
   authority;
3. a source-backed KBS Main Site parent target and a source-backed T6 child treatment
   target are both established without representing the treatment as a FARM, FIELD,
   ZONE or geometry that the source does not establish;
4. the A01 `DecisionProblem` remains targeted at an existing supported parent target
   and carries an explicit immutable treatment selector plus an explicit historical
   evaluation-date selector in its creator-owned constraints;
5. the governed target context contains exact source-backed ContextDatum authorities
   required by the corrected KBS scientific transport boundary;
6. the generic A04 `ContextManifest` is published unchanged, but a DEC-0034
   specialized validator proves that every treatment-scoped datum, the parent target,
   the T6 child target and the A01 selectors converge on the exact same authority
   world;
7. the existing T6 ScientificQualificationDecision is not mutated; a new superseding
   qualification must prevent the 2015 rule from transporting on `treatment.name`
   alone;
8. the proof is explicitly retrospective and no-lookahead relative to its decision
   logical time:

   ```text
   datum.availableAt <= evidenceCutoff < DecisionProblem.logicalTime
   ```

9. the historical target slice is separately bound to the source-supported
   evaluation date and must not be confused with the DecisionProblem logical time;
10. only after those gates may the existing generic A07 -> A08 -> R01 -> R03 -> D01
    path attempt a positive RuntimeBinding.

## Why this DEC exists

DEC-0030 through DEC-0033 completed the first Sustainable Corn target context world.
PR #171 then proved that the generic A05-D01 stack can compose that world when given
synthetic matching knowledge. PR #172 proved that real KBS knowledge fails closed
when its material target context is absent.

The next milestone is therefore not another synthetic runtime test. It is the first:

```text
REAL QualifiedKnowledge
+
REAL compatible target context
+
no-lookahead evidence world
        ->
A08 DIRECTLY_APPLICABLE / ALLOWED
        ->
R03 RUNTIME_ELIGIBLE
        ->
D01 RuntimeBinding
```

A fresh audit of the intended KBS nitrogen candidate found real authority seams that
cannot be closed by test wiring alone.

## Exact knowledge candidate

The accepted KBS 2015 prohibition Gold retains a real source assertion for Main Site
Treatment 6:

```text
Do not add any nitrogen to treatment 6.
```

The current accepted Claim is explicitly scoped in its assertion to the 2015 KBS
LTER agronomic protocol. Its reviewed SourceContext also records:

```text
crop.code      = alfalfa
site.name      = Kellogg Biological Station
treatment.name = Main Site Treatment 6
decision.domain = nitrogen input control
```

However the current ScientificQualificationDecision freezes only:

```text
semanticPreconditions = [
  treatment.name == "Main Site Treatment 6"
]
```

K04 itself states that context limitations belong in explicit preconditions or
constraints. Therefore the current one-predicate qualification is too weak for the
first real-positive product claim.

DEC-0034 must not exploit that weakness merely because A08 would return
`DIRECTLY_APPLICABLE` for a matching treatment name.

## Independent real target evidence

The KBS Agronomic Field Log contains actual 2015 Main Site T6 records independent of
the QualifiedKnowledge publication path.

The first intended exact target evidence is KBS Aglog observation `3138`:

```text
Observation Date: 2015-04-15
Areas: T6
Observation Type: Fertilizer Application

Fertilized the LTER Main Site Treatment T6, Alfalfa plots,
all replications ... with phosphorus (0-46-0) ...
```

Official source location:

```text
https://aglog.kbs.msu.edu/observations/3138
```

The implementation must retain exact bytes or an explicitly governed normalized
transcription before this evidence can become ADR authority. A mutable live webpage
is not sufficient replay authority by itself.

The official KBS Main Cropping System Experiment documentation independently states
that T1-T7 were established at the LTER Main Site in replicated plots and that T6 was
continuous alfalfa before the 2018/2019 management change.

Official source location:

```text
https://lter.kbs.msu.edu/research/long-term-experiments/main-cropping-system-experiment/
```

This historical change is also an explicit reason DEC-0034 must not treat a 2015 T6
fact as current T6 state.

## Target evidence and knowledge evidence must remain distinct

The positive proof must not use QualifiedKnowledge SourceContext as if it were target
state.

Forbidden shortcut:

```text
KBS QualifiedKnowledge
  -> SourceContext(treatment.name = Treatment 6)
  -> copy into ContextManifest
  -> A08 MATCH
```

That would use the rule's own applicability context to prove that the target satisfies
the rule.

DEC-0034 instead requires an independent target-evidence root, beginning with the
actual KBS Aglog target record and exact KBS target identity evidence.

The same retained KBS protocol may be referenced for a source-name normalization only
when that use has its own exact locator, review and authority role. Reusing source
bytes does not collapse target-evidence authority into Knowledge authority.

## Why existing Context-side compilation contracts cannot be reused unchanged

The current first-world contracts are intentionally narrow:

- `AgronomicRecordedOperationOccurrence` accepts only XLSX worksheet-row and Jupyter
  output-table row locators; it cannot exactly locate a KBS Aglog HTML observation;
- `AgronomicRecordedOperationContextSemanticMapping` is frozen to
  `PLANT / CROP:CORN -> crop.planting_date`;
- `AgronomicRecordedOperationTargetIdentityBinding` supports only `FARM` granularity;
- `AgronomicRecordedOperationContextSpatialSupportClassification` is frozen to
  `siteid = SERF`, source-backed `FARM`, and `spatialSupport.type = FARM`;
- DEC-0030 historical timezone resolution is frozen to 2011-05-03 / America/Chicago;
- DEC-0028 availability projection is frozen to the first Sustainable Corn artifact
  acquisition;
- DEC-0031 ContextDatum assembly is frozen to the first Sustainable Corn planting-date
  datum template.

Those restrictions are not implementation bugs. They are accepted finite-world
boundaries. DEC-0034 must not silently parameterize them beyond their accepted
contracts.

## Parent target and treatment subtarget

A01 v1 supports target components:

```text
organizationId
tenantId?
farmId?
fieldId?
seasonId?
zoneId?
```

It has no `treatmentId`.

DEC-0034 therefore does not insert a new public A01 field and does not mislabel T6 as
a field or zone.

The proposed finite model is:

```text
source-backed KBS Main Site parent target
        |
        +-- source-backed experimental-treatment child target: T6
```

The A01 `targetRef` binds the supported parent target. The immutable A01 constraints
must additionally carry an explicit DEC-0034 treatment selector containing the exact
child target authority identity and canonical treatment semantic.

The treatment selector is creator/deployment decision intent. It does not create T6
source authority. DEC-0034 specialized validation must prove that the selector equals
the independently source-backed T6 child target.

## Historical evaluation slice is not logical time

The first proof is retrospective.

A01 `logicalTime` remains the as-of time of the machine decision/proof. It must not be
rewritten to 2015 merely to make old context look contemporaneous.

The A01 constraints must instead contain an explicit historical evaluation selector
for the exact source-supported target slice, initially:

```text
2015-04-15
```

The selector is decision intent. Source evidence must independently prove that the
accepted ContextDatum values have effective support for that historical slice.

DEC-0034 specialized validation must reject a world in which:

- the A01 historical selector is absent;
- the selector does not match the exact governed source slice;
- a required ContextDatum does not support that slice; or
- a caller attempts to substitute `logicalTime` for the historical target slice.

This closes the finite proof without inventing a generic rule that every ContextDatum
must be effective at DecisionProblem logical time. Historical replay is a valid ADR
use case and those are separate temporal concepts.

## Historical timezone authority

The KBS source record reports a calendar date, not an RFC3339 instant.

A02 requires an exact `effectiveInterval`, so the source date must be resolved through
explicit local-civil-time authority. Host timezone libraries remain forbidden as
source authority.

DEC-0034 proposes a KBS-specific local-civil-day binding that:

1. binds the exact KBS Main Site location to the accepted IANA zone for the site;
2. reuses the already retained IANA tzdb 2026c rule authority where applicable;
3. derives the exact UTC boundaries for the governed 2015-04-15 local civil day;
4. retains the location/zone and transition evidence required to replay the result;
5. fails closed if the exact KBS location-to-zone mapping cannot be established.

No value may be taken from Node `Date`, OS tzdata, browser timezone data, ICU,
PostgreSQL timezone tables or an unpinned `latest` tzdata artifact as authority.

## ContextDatum set for the first KBS world

The first DEC-0034 world is allowed to contain only the minimum datums required by the
corrected transport boundary and exact target convergence.

The intended semantic set is:

```text
treatment.name   = "Main Site Treatment 6"
crop.code        = "alfalfa"
site.name        = "Kellogg Biological Station"
protocol.version = "2015"
```

The implementation must prove each datum's source/deployment authority separately.
It must not copy these values from the QualifiedKnowledge object.

For example:

- `treatment.name` and `crop.code` require independent target evidence for T6;
- `site.name` requires exact KBS/Main Site identity evidence;
- `protocol.version` requires the exact retained KBS 2015 protocol authority plus an
  explicit decision/deployment selection of that protocol for the retrospective
  evaluation.

The exact A02 epistemic/provenance/support fields must be decided from those
predecessors during implementation qualification; no field may be filled merely
because A02 requires it.

## Experimental-treatment spatial support

T6 is not a FARM and is not one contiguous FIELD inferred by ADR. KBS documents it as
a treatment distributed across replicated plots.

DEC-0034 therefore permits a source-specific spatial classification for the exact T6
child target without inventing plot geometry.

The implementation may publish a ContextDatum support type such as an experimental-
treatment class only if the exact classification name and meaning are frozen by the
DEC-0034 implementation contract and source-backed review.

No geometryRef is authorized unless exact retained geometry authority is separately
established.

## Why generic A04 is insufficient by itself

The current A04 `ContextManifest` correctly validates generic membership,
authorization and evidence cutoff, but its datum-target comparison checks only
organization/tenant scope.

It does not prove that a datum's FARM/FIELD/ZONE/treatment support is the same target
selected by A01.

For DEC-0033 this was closed by a specialized exact-AuthorityRef convergence proof.
DEC-0034 uses the same architectural principle.

The generic A04 wire remains unchanged. Before publication and during specialized
replay, DEC-0034 must prove exact convergence among:

```text
A01 parent targetRef
A01 treatment selector
A01 historical evaluation selector
source-backed KBS Main Site parent target
source-backed T6 child target
all required ContextDatum authorities
```

A semantically equal independently published target authority is insufficient.

No DEC-0034 bridge marker is inserted into the public ContextManifest.

## ScientificQualificationDecision supersession

The accepted T6 ScientificQualificationDecision remains immutable historical
authority.

DEC-0034 requires a new decision that explicitly supersedes the exact earlier T6
qualification for the same scientific use.

The corrected finite transport boundary must include, at minimum:

```text
treatment.name   == "Main Site Treatment 6"
crop.code        == "alfalfa"
site.name        == "Kellogg Biological Station"
protocol.version == "2015"
```

Each added condition must have explicit qualification rationale traceable to the
accepted source Claim/SourceContext/Source authority. The superseding decision must
be qualified by the existing K04 governance path; DEC-0034 does not bypass scientific
review.

A07/A08 must select the effective superseding qualification rather than aggregate the
obsolete one-predicate decision as an independent permission source.

If existing qualification-selection semantics cannot prove that, implementation must
stop and return to architecture review rather than weaken the required preconditions.

## No-lookahead and availability

`availableAt` is not the 2015 operation date and is not automatically the Aglog
`Created on` date.

The implementation must establish one accepted availability basis for every retained
target source artifact. Unless a stronger source-publication availability authority
is separately proven, the conservative authority is the exact ADR SourceArtifact
acquisition/materialization time.

The positive proof must then choose:

```text
max(required datum availableAt)
<= evidenceCutoff
< DecisionProblem.logicalTime
```

The proof classification must state that this is a retrospective machine evaluation
performed after evidence acquisition. It does not establish what a KBS operator knew
on 2015-04-15.

## Required positive product result

After the exact KBS governed target world and superseding scientific qualification
are established, existing generic runtime contracts are used unchanged.

Required result:

```text
A07:
  retrieves exact real KBS QualifiedKnowledge
  under the effective superseding qualification

A08:
  scientificUseStatus = QUALIFIED
  transportStatus = DIRECTLY_APPLICABLE
  runtimeUse = ALLOWED
  missingContextSemanticIds = []
  conflicts = []

R01:
  openRequirements = []

R03:
  RUNTIME_ELIGIBLE
  legal runtime candidates > 0

D01:
  exact RuntimeBinding published
```

This would be ADR's first real-Knowledge / real-target positive RuntimeBinding.

## Mandatory negative proofs

The DEC-0034 implementation is incomplete unless the same Gold also proves fail-closed
behavior for at least these mutations:

1. `T6 -> T7` target selector drift;
2. `Main Site Treatment 6 -> semantically equal but independently published target
   authority` exact-ref drift;
3. `crop.code = alfalfa -> switchgrass`;
4. KBS site identity drift;
5. `protocol.version = 2015 -> another version`;
6. historical evaluation-date drift outside the accepted source slice;
7. treatment datum bound to the wrong parent Main Site authority;
8. treatment ContextDatum inserted through generic A04 without DEC-0034 target
   convergence proof;
9. reuse of the superseded one-predicate T6 qualification as if still sufficient;
10. `availableAt > evidenceCutoff`;
11. `evidenceCutoff >= logicalTime` for the claimed no-lookahead proof;
12. host-timezone or unpinned timezone authority substitution;
13. missing independent target-evidence root, including any attempt to use only the
    QualifiedKnowledge SourceContext as target evidence.

Every negative case must deny the positive authority it is attacking. No negative
case may be repaired by weakening A08/R03/D01.

## What remains frozen

DEC-0034 does not authorize changes to the public semantics of:

```text
A01 DecisionProblem
A02 ContextDatum
A04 ContextManifest
A05 RuntimeProfile
A06 Deployment
A07 Knowledge Retrieval
A08 ApplicabilityAssessment
R01 RuntimePlan
R03 RuntimeEligibility
D01 RuntimeBinding
```

It also does not authorize a new parallel ContextManifest, RuntimeBinding or
DecisionResult object.

If implementation proves that one of these frozen generic contracts genuinely cannot
represent the accepted DEC-0034 authority without semantic loss, implementation must
stop and return with that exact defect.

## Nonclaims

Even a successful DEC-0034 positive proof will not establish:

- that T6 is currently alfalfa;
- that the 2015 no-nitrogen rule applies to current T6;
- that a 2015 operator had the same evidence available at the same time;
- that every KBS treatment is now supported by ADR;
- that experimental treatments are fields or zones;
- exact plot geometry;
- agronomic recommendation correctness beyond the accepted source rule;
- action authorization, dispatch, execution or outcome;
- D02-D06 correctness.

The proof classification must remain:

```text
RETROSPECTIVE_REAL_SOURCE_COMPATIBILITY_TEST_ONLY
```

until a separate authority closes any stronger claim.

## Why DEC-0034 is not a generic A08 temporal rewrite

The A08 engine does not currently compare every ContextDatum effective interval to the
DecisionProblem logical time. That is not sufficient reason to add a generic temporal
rule here because ADR supports historical replay and `logicalTime` is not necessarily
the time represented by every datum.

DEC-0034 instead freezes an explicit historical evaluation selector and proves that
its target datums support that exact source slice. The corrected Knowledge transport
scope also freezes the 2015 protocol version.

A future decision requiring generic temporal transport semantics may justify a
separate architecture decision. This DEC does not manufacture that generalization
from one retrospective KBS proof.

## Alternatives rejected

### Infer T6 from the Knowledge SourceContext

Rejected. Circular applicability authority.

### Treat T6 as `fieldId` or `zoneId`

Rejected. The source describes a treatment distributed over replicated plots; it does
not establish A01 FIELD or ZONE identity.

### Add `treatmentId` directly to A01 now

Rejected for this finite proof. Existing A01 plus exact parent target and immutable
source-backed treatment selector can represent the decision intent without widening
the public target schema.

### Let generic A04 membership imply target convergence

Rejected. A04 checks organization/tenant but not the exact source-specific treatment
lineage required here.

### Use the existing one-predicate K04 decision unchanged

Rejected. It under-represents the accepted source context and would permit overbroad
transport.

### Use a zero-precondition QualifiedKnowledge Gold

Rejected. That would test a qualification boundary weakness rather than real target
compatibility.

### Rewrite A08 to require datum effectiveInterval overlap with logicalTime

Rejected for this DEC. Historical replay requires a distinct target evaluation slice;
logicalTime and context effective time are not universally the same concept.

### Use host timezone data

Rejected. Runtime timezone libraries may consume accepted timezone authority but may
not create it.

## Implementation authorization boundary

This DEC is architecture-only while status is `PROPOSED`.

No implementation branch may claim DEC-0034 authority until this decision is
explicitly accepted and its exact architecture head is qualified.

After acceptance, implementation should prefer the smallest source-specific additions
that satisfy this DEC. It must not turn the first KBS proof into a broad refactor of
all existing Context or Applicability contracts.

## Acceptance criteria for this DEC

Architecture acceptance should require agreement that:

1. a real-positive KBS T6 proof cannot legitimately be produced from the existing
   Sustainable Corn Context bridge;
2. target evidence must be independent of the QualifiedKnowledge SourceContext;
3. T6 requires an exact source-backed child target rather than FARM/FIELD/ZONE
   relabeling;
4. the public A01/A02/A04/A08 contracts remain frozen for this finite proof;
5. an explicit historical evaluation slice is required and is distinct from A01
   logicalTime;
6. KBS calendar-date -> RFC3339 boundaries require retained timezone authority;
7. the current T6 K04 decision must be superseded by a stricter explicit transport
   boundary rather than exploited unchanged;
8. A04 publication remains generic while DEC-0034 specialized replay proves exact
   parent/child target and datum convergence;
9. the final proof remains retrospective and must satisfy no-lookahead relative to its
   own logicalTime;
10. positive A08/R03/D01 is not recommendation correctness and is not D06 authority.

If accepted, DEC-0034 becomes the architecture authority for the first real-positive
KBS Treatment 6 runtime-binding implementation.
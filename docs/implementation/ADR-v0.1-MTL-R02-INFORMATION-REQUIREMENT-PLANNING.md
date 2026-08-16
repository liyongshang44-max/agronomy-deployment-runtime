# ADR v0.1 — MTL-R02 InformationRequirement / Acquisition Planning

Status: **IMPLEMENTATION CONTRACT / NON-ARCHITECTURE-AUTHORITY**

Baseline: `main @ 09bf833765b0cb77bce9f18713d8888b63b75459` (R01 closed)

## 1. Purpose

R02 turns unresolved, decision-material and information-addressable RuntimePlan gaps into explicit `InformationRequirement` read models and optional acquisition choices.

R02 does not answer runtime legality. That remains MTL-R03.

```text
RuntimePlan gap
  -> InformationRequirement
  -> optional InformationAcquisitionOption
  -> authorized new ContextDatum / receipt outside R02
  -> new ContextManifest
  -> new RuntimePlan
  -> InformationRequirement status projection
```

An acquisition option is never evidence and never satisfies a requirement by itself.

## 2. RuntimePlan binding

R01 RuntimePlan remains compiler IR/read model, not an AuthorityLedger publication. R02 does not upgrade it into a new immutable ledger authority merely to obtain a `plan_ref`.

Every requirement freezes exact plan identity:

```text
planId
planHash
compilerVersion
```

Before planning, R02 recompiles the supplied RuntimePlan from its exact DecisionProblem / Deployment / RuntimeProfile / ContextManifest / KnowledgeRetrievalResult / ApplicabilityAssessment inputs and requires byte-equivalent canonical output.

A tampered plan cannot mint an InformationRequirement even if the caller leaves the old `planHash` text in place.

## 3. Information-addressable gaps

R02 v1 converts only gaps that can truthfully be addressed by new context information:

```text
MISSING_CONTEXT
RUNTIME_PROFILE_CONTEXT
```

Examples include:

- applicability requires `crop.code` but it is missing;
- RuntimeProfile requires `soil.volumetric_water_content` even when Knowledge Applicability is otherwise direct.

Multiple RuntimePlan requirements for the same semantic ID are deduplicated into one InformationRequirement while preserving every exact required-by source and reason code.

R02 deliberately does **not** convert these into fake data requests:

```text
CALIBRATION_REQUIRED
REPLAY_REQUIREMENT
APPLICABILITY_CONFLICT
SCIENTIFIC_USE blocker
DECISION_RELEVANCE blocker
APPLICABILITY_RUNTIME_DISPOSITION
other non-semantic unsupported constraints
```

They remain explicit `nonInformationBlockers` for later R03 legality adjudication.

## 4. InformationRequirement contract

Public contract version:

```text
adr.information-requirement.v1
```

A requirement freezes:

- content-derived stable requirement ID;
- exact origin plan identity;
- exact DecisionProblem / Deployment / RuntimeProfile / origin ContextManifest refs;
- required semantic ID;
- exact required-by ApplicabilityAssessment / RuntimeProfile refs;
- exact RuntimePlan requirement IDs and reason codes;
- acceptable EpistemicClass set;
- acceptable ProvenanceClass set;
- the upstream basis for those acceptance constraints;
- required resolution;
- exact DecisionProblem deadline;
- decision materiality;
- initial status `OPEN`;
- exact origin plan hash;
- semantic hash.

Base InformationRequirement is immutable `OPEN` information-need semantics. Later lifecycle state is represented by a separate deterministic status read model rather than mutating the requirement.

## 5. Acceptable evidence semantics

When RuntimeProfile freezes epistemic constraints for the semantic ID, R02 carries those exact constraints.

When no RuntimeProfile provenance restriction exists, R02 does not invent one. All frozen ProvenanceClass values remain admissible at this planning layer and the requirement records:

```text
provenance basis = NO_ADDITIONAL_RUNTIME_PROFILE_CONSTRAINT
```

This means R02 does not silently reject `MODEL`, `CUSTOMER_SYSTEM`, or another valid provenance merely because a test or adapter prefers another channel. Epistemic validity remains independently constrained.

The current required resolution is deliberately narrow:

```text
mode = CONTEXT_DATUM_SEMANTIC_ID_PRESENT
minimumMatchingDatumCount = 1
```

A matching ContextDatum must also satisfy the requirement's acceptable epistemic/provenance sets.

## 6. Requirement authenticity

A semantic hash by itself is not accepted as origin authority.

Any downstream acquisition-option or status calculation must receive the exact origin RuntimePlan. R02 re-plans that world and requires the supplied InformationRequirement to match the exact derived requirement by ID, semantic hash and canonical payload.

Therefore a caller cannot:

1. copy a legitimate requirement;
2. widen `acceptableEpistemicClasses` or rewrite `requiredBy`;
3. recompute a self-consistent hash;
4. use the modified JSON to create broader acquisition/status semantics.

Nested contract structures are closed and validated, including plan ref, required-by authority kinds, acceptance-constraint basis, required resolution and status basis.

## 7. Acquisition capabilities and options

Supported planning channels are:

```text
EXISTING_CONTEXT
DERIVED_STATE
REMOTE_SENSING
CUSTOMER_API
USER_QUESTION
SCOUTING
LABORATORY
SENSOR
```

An acquisition capability may describe only:

- capability/provider identity;
- supported semantic IDs;
- supported epistemic/provenance classes;
- relative cost rank;
- estimated latency;
- non-authority quality descriptor.

It cannot embed a value, ContextDatum ref, receipt ref or evidence payload.

An `adr.information-acquisition-option.v1` is emitted only when semantic, epistemic and provenance contracts intersect. Options are deterministically ordered by relative cost, then latency, then capability ID.

Every option states:

```text
authorityClass = ACQUISITION_OPTION_NON_EVIDENCE
evidenceStatus = NOT_EVIDENCE
requirementStatusEffect = NONE_UNTIL_AUTHORIZED_CONTEXT_EXISTS
```

Adding/removing options cannot change the InformationRequirement identity or OPEN status.

## 8. Status lifecycle

Frozen status vocabulary:

```text
OPEN
SATISFIED
UNSATISFIABLE
NO_LONGER_DECISION_MATERIAL
```

### OPEN

A successor exact RuntimePlan still derives the same stable InformationRequirement ID.

### SATISFIED

SATISFIED requires all of:

1. exact origin requirement authentication against its origin RuntimePlan;
2. a different successor RuntimePlan;
3. the same exact DecisionProblem / Deployment / RuntimeProfile world;
4. a successor ContextManifest rather than mutation of the origin manifest;
5. at least one matching acceptable ContextDatum;
6. recompilation such that the requirement no longer persists.

Thus a provider option, API response promise or mutable context pool cannot directly satisfy the requirement.

### UNSATISFIABLE

R02 permits an UNSATISFIABLE planning status only from a catalog explicitly declared complete for that requirement and explicitly marked:

```text
PLANNING_CATALOG_ONLY_NO_RUNTIME_OR_EVIDENCE_AUTHORITY
```

If a matching option still exists, UNSATISFIABLE fails closed. A partial catalog cannot claim UNSATISFIABLE.

This status is planning semantics only; it does not itself prove `NO_LEGAL_RUNTIME`.

### NO_LONGER_DECISION_MATERIAL

If a valid successor plan no longer derives the requirement and no matching datum satisfied it, the lifecycle projection can represent `NO_LONGER_DECISION_MATERIAL`.

This preserves the architectural status vocabulary without pretending the missing value was observed.

## 9. Separation from R03

R02 outputs explicitly carry no runtime-legality authority.

```text
InformationRequirement OPEN != INFORMATION_REQUIRED RuntimeEligibility
InformationRequirement SATISFIED != RUNTIME_ELIGIBLE
InformationRequirement UNSATISFIABLE != NO_LEGAL_RUNTIME
AcquisitionOption exists != evidence exists
```

R03 must independently consume the converged RuntimePlan / requirement state and adjudicate runtime legality.

## 10. Read-only semantics

R02 planning and status derivation are read-only over AuthorityLedger. They do not:

- mutate ContextManifest;
- publish fabricated ContextDatum;
- create RuntimeBinding;
- create RuntimeEligibility;
- create DecisionResult;
- write scientific authority.

## 11. Acceptance history

`test:information-requirement` is wired into root `npm test` from the first substantive R02 implementation run.

First root-wired run `31947325168`:

```text
positive:  7 / 7
integrity: 10 / 11
```

The sole failure was a test expectation error: it assumed `MODEL` provenance was forbidden although no RuntimeProfile provenance restriction existed. The implementation was not narrowed to satisfy that incorrect assumption.

Independent review then hardened:

- provenance non-invention semantics;
- nested requirement contract closure;
- exact origin-plan authentication for every downstream option/status operation;
- self-hashed evidence-acceptance widening resistance;
- explicit planning-only UNSATISFIABLE catalog authority;
- successor ContextManifest requirement for SATISFIED.

Exact hardened feature head `cbc3e9806ff6da5b975f78df143544f2324fe142`, root run `31947674998`: **GREEN**.

R02 acceptance in that root run:

```text
positive:  7 / 7
integrity: 14 / 14
total:     21 / 21
```

All existing F/K/A/Gate-A/P01-P04/R01 regression suites were GREEN in the same run.

R02 is CLOSED only after the final documentation head, Draft merge-ref, independent authority review, Ready-state recomputed merge candidate, expected-head merge, actual-main verification and exact-main full root CI are GREEN.

# ADR v0.1 — MTL-D01 Immutable RuntimeBinding

Status: **IMPLEMENTATION CONTRACT / NON-ARCHITECTURE-AUTHORITY**

Baseline: `main @ afc4a84ec2e999d01e9b00c3c29477973f832370` (Gate R closed)

## 1. Purpose

D01 freezes one fully adjudicated legal RuntimePlan alternative into an immutable exact runtime-composition/replay authority.

A RuntimeBinding answers:

> Exactly which Control/Context/Knowledge/applicability world was selected for this runtime composition?

It does not answer:

> Was the agronomic conclusion scientifically correct?

## 2. Hard and conditional predecessors

Hard predecessor:

```text
Gate R
```

Conditional predecessors remain conditional:

```text
MTL-S03 when executable ImplementationConformance is actually bound
MTL-S04 when calibration is material
```

The current minimal runtime path exercises no Transformation, Model, Policy, Implementation or Calibration authority. D01 therefore does not fabricate those objects merely to populate a binding.

The frozen v1 payload explicitly carries:

```text
transformationBindings: []
modelBindings: []
policyBindings: []
implementationBindings: []
calibrationBindings: []
```

The explicit empty arrays mean that the selected world uses none of those authority classes. They are not unknown/omitted semantics.

Final Architecture adjudication explicitly requires exact `calibration_bindings` when calibration is material. Therefore a future non-empty calibration binding requires the corresponding S04 authority path first; current D01 fails closed on a non-empty calibration array.

## 3. Publication input boundary

The caller may provide only:

```text
AuthorityLedger
logicalId
version
exact RuntimeEligibility ref
selectedAlternativePathId
optional snapshotStore
audit metadata
```

The caller cannot inject or override:

- DecisionProblem;
- Deployment;
- RuntimeProfile;
- KnowledgeRelease;
- ContextManifest;
- Knowledge binding;
- Applicability binding;
- Transformation/Model/Policy/Implementation/Calibration bindings;
- assumptions;
- RuntimeBinding/Decision outputs.

All material authority refs are derived from the validated exact RuntimeEligibility world and selected alternative.

## 4. Selection semantics

D01 requires an explicit `selectedAlternativePathId`.

The selected path must exist in the exact bound RuntimeEligibility and have disposition:

```text
LEGAL
or
LEGAL_WITH_LIMITATIONS
```

A globally `INFORMATION_REQUIRED` or `NO_LEGAL_RUNTIME` world cannot produce a RuntimeBinding.

A globally eligible mixed world can contain a hard-blocked sibling alternative, but that blocked sibling itself cannot be selected.

When multiple legal alternatives coexist, D01 does not silently collapse or rank them. One RuntimeBinding freezes exactly one explicitly selected legal world. Other legal alternatives remain outside that binding and are handled by later AlternativeSet/coverage work.

The selection is runtime-composition selection only:

```text
selectionAuthorityClass = RUNTIME_COMPOSITION_SELECTION_NOT_DECISION
```

It is not action selection or DecisionResult authority.

## 5. Frozen RuntimeBinding payload

Contract version:

```text
adr.runtime-binding.v1
```

Authority class:

```text
RUNTIME_COMPOSITION_REPLAY_AUTHORITY
```

The current minimal binding freezes:

- exact RuntimeEligibility ref;
- exact RuntimePlan identity (`planId + planHash + compilerVersion`);
- selected alternative path ID;
- exact DecisionProblem ref;
- exact Deployment ref;
- exact RuntimeProfile ref;
- exact KnowledgeRelease ref;
- exact ContextManifest ref;
- exactly one selected Knowledge ref;
- exactly one selected ApplicabilityAssessment ref;
- explicit empty Transformation/Model/Policy/Implementation/Calibration binding sets;
- exact logical time;
- exact evidence cutoff;
- exact selected-path limitations;
- exact empty assumptions set in the current minimal path;
- `unresolvedAlternativeCount = 0`;
- explicit non-correctness claim.

The current minimal D01 contract freezes exactly one Knowledge/Applicability pair. It does not manufacture executable specifications that the runtime path has not yet exercised.

## 6. No unresolved alternatives or hidden assumptions

A RuntimeBinding cannot contain unresolved alternatives.

```text
unresolvedAlternativeCount = 0
```

The current path also has no upstream governed assumption authority. Therefore:

```text
assumptions = []
```

Open InformationRequirements, calibration requirements, blocked alternatives or missing evidence cannot be hidden inside an `assumptions` array to force a binding through.

## 7. Limitations

For `LEGAL_WITH_LIMITATIONS`, the RuntimeBinding freezes the exact structured limitations carried by the selected RuntimeEligibility alternative.

Limitations are not converted to a scalar confidence score and do not imply correctness.

For a fully `LEGAL` selected path, the current minimal binding has no selected-path limitation.

## 8. Correctness nonclaim

Every binding carries exactly:

```text
correctnessClaim = NONE_BINDING_PROVES_WHAT_WAS_USED_NOT_SCIENTIFIC_CORRECTNESS
```

Therefore:

```text
RuntimeBinding exists != agronomically correct
RuntimeBinding exists != DecisionResult
RuntimeBinding exists != action authorization
RuntimeBinding executable != scientifically valid
```

## 9. Publication authority and audit closure

D01 introduces no new IAM permission.

Publication is performed by the exact runtime principal that published the bound RuntimeEligibility under the existing Deployment runtime authorization.

The publication audit action is fixed:

```text
PUBLISH_RUNTIME_BINDING
```

The exact audit input set closes over:

- RuntimeEligibility;
- DecisionProblem;
- Deployment;
- RuntimeProfile;
- KnowledgeRelease;
- ContextManifest;
- selected Knowledge;
- selected ApplicabilityAssessment;
- exact runtime AuthorizationDecisionAudit.

Caller-supplied audit input refs cannot redefine this authority set.

## 10. Current publication vs historical validation

D01 deliberately separates two questions.

### Publication

At publication time, D01 uses the current R03 validator. The exact RuntimeEligibility must still replay as current runtime-legality authority and the selected path must currently be legal.

### Historical validation

After publication, `validateRuntimeBinding()` does **not** rerun current/latest R03 authority validation.

Doing so would make historical replay depend on later lifecycle drift and would violate the C16 requirement that a historical binding remain replay-addressable after newer Knowledge/Model/Policy/Deployment/Calibration versions exist.

Historical validation instead verifies the exact frozen objects, hashes, relations and creation-time audit chain.

No `latest` lookup or logical-ID redirect is used.

## 11. Frozen historical relation closure

Historical validation checks more than the fact that every individual ref still hashes correctly.

It verifies the frozen world relations:

```text
Deployment -> exact RuntimeProfile
RuntimeProfile -> exact KnowledgeRelease
ContextManifest -> exact DecisionProblem
KnowledgeRetrievalResult -> exact DecisionProblem / Deployment / RuntimeProfile / KnowledgeRelease
KnowledgeRetrievalResult contains selected Knowledge
ApplicabilityAssessment -> exact Retrieval / Knowledge / ContextManifest / DecisionProblem
RuntimeEligibility -> same exact Decision / Deployment / Profile / Manifest / Retrieval / Applicability world
```

This prevents a collection of individually valid but mutually unrelated authority objects from being treated as one historical RuntimeBinding world.

Historical RuntimeEligibility publication audit is also replay-checked against:

- exact runtime principal and audit actor;
- exact plan identity;
- exact frozen RuntimeEligibility state;
- exact runtime AuthorizationDecisionAudit;
- exact RuntimeEligibility publication input-ref set.

## 12. Later-version behavior

The acceptance suite publishes a newer version of the same logical Deployment after a RuntimeBinding already exists.

The historical binding remains frozen to the original exact Deployment ref and validates without redirecting to the newer version.

The same identity/replay rule applies to future newer Knowledge, RuntimeProfile, Model, Policy, Calibration or other authority versions: a later version does not rewrite an already published binding.

## 13. Immutability

Publishing RuntimeBinding does not mutate:

- RuntimeEligibility;
- ContextManifest;
- selected ApplicabilityAssessment;
- Knowledge;
- Deployment/RuntimeProfile/KnowledgeRelease.

Historical replay remains append-only/exact-ref based.

## 14. Acceptance

`test:runtime-binding` was wired into root `npm test` from the first substantive D01 run.

The first exact root-wired D01 run was:

```text
31949046258
```

and completed GREEN with the full existing repository regression suite.

The D01 acceptance surface contains:

```text
positive:   6 tests
integrity: 11 tests
total:     17 tests
```

It covers:

- direct legal binding;
- exact control/context/release/time freeze;
- limited legal binding;
- explicit choice among multiple legal alternatives;
- mixed legal/hard-blocked world isolation;
- historical exact replay;
- rejection of INFORMATION_REQUIRED and NO_LEGAL_RUNTIME worlds;
- rejection of blocked/unknown path selection;
- closed publication input surface;
- fake spec/calibration/assumption rejection;
- unresolved-alternative/correctness/decision laundering rejection;
- exact runtime-principal publication;
- later same-logical Deployment version not rewriting historical binding;
- exact publication audit closure;
- source-authority immutability.

Independent review after that first GREEN further removed a temporary RuntimePlan-decoration implementation detail and hardened both historical RuntimeEligibility audit replay and frozen cross-object relation closure.

D01 is CLOSED only after the final hardened feature/docs head, Draft merge-ref, Ready-state merge candidate, expected-head merge, actual-main verification and exact-main full root CI are GREEN.

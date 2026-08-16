# ADR v0.1 — MTL-R01 RuntimePlan DAG

Status: **IMPLEMENTATION CONTRACT / NON-ARCHITECTURE-AUTHORITY**

Baseline: `main @ 274a72aff3eba79b4fc9178c7e3dafb170ec1e07`

## 1. Purpose

R01 compiles the exact Gate-A planning world into a deterministic candidate DAG.

The compiler consumes only exact, already-established evidence:

```text
DecisionProblem
Deployment
RuntimeProfile
ContextManifest
KnowledgeRetrievalResult
ApplicabilityAssessment[]
```

and emits:

```text
RuntimeCandidates
RuntimePlan
```

The output is compiler IR. It is not a new scientific authority object and is not published to the AuthorityLedger.

## 2. Conditional specification authority

R01 does not fabricate TransformationSpec, ModelSpec, PolicySpec, ImplementationConformance or CalibrationSpec authority merely to populate a graph.

The MTL-S01 predecessor is conditional. In the current minimal direct Gate-A slice there are no governed Transformation/Model/Policy specification paths to represent.

If a validated ApplicabilityAssessment requires an exact transformation path, the minimal R01 compiler fails closed with `RUNTIME_PLAN_SPEC_AUTHORITY_REQUIRED` until the corresponding conditional specification authority exists. It does not invent a TRANSFORMATION node or silently drop the requirement.

Calibration requirement codes, missing context, unsupported constraints and applicability conflicts are structured open requirements; they are not fabricated calibration/spec authority.

## 3. Exact planning-world closure

The compiler requires exact refs for:

- DecisionProblem;
- Deployment;
- RuntimeProfile;
- ContextManifest;
- KnowledgeRetrievalResult;
- one ApplicabilityAssessment for every exact retrieval candidate.

It validates current replayable authority for retrieval, manifest and applicability evidence, then verifies cross-object closure:

```text
retrieval.decision_problem_ref == DecisionProblem
retrieval.deployment_ref == Deployment
retrieval.runtime_profile_ref == RuntimeProfile
validated Deployment profile authority == RuntimeProfile
manifest.decision_problem_ref == DecisionProblem
assessment.retrieval_ref == KnowledgeRetrievalResult
assessment.context_manifest_ref == ContextManifest
assessment.decision_problem_ref == DecisionProblem
assessment.knowledge_ref ∈ retrieval.candidate_refs
```

Every retrieval candidate must be covered exactly once. A caller cannot make the plan appear cleaner by omitting a candidate assessment or duplicating one candidate under multiple assessment refs.

The compiler input object is itself a closed contract. Unknown predecessor fields fail with `INVALID_RUNTIME_PLAN_INPUT_FIELD`. In particular, current RuntimeBinding, RuntimeEligibility, DecisionRobustness or DecisionResult output cannot be supplied as hidden predecessors.

## 4. RuntimeProfile constraints are part of candidate construction

RuntimeCandidates are not Applicability-only projections. The compiler also consumes exact RuntimeProfile constraints that are representable in the current minimal slice.

### Context requirements

For every RuntimeProfile `requiredSemanticId`, the exact ContextManifest must contain at least one matching ContextDatum. Where the RuntimeProfile freezes acceptable epistemic classes, at least one matching datum must satisfy that epistemic constraint.

Failure remains explicit as a shared planning requirement:

```text
requirementType = RUNTIME_PROFILE_CONTEXT
code = REQUIRED_SEMANTIC_MISSING | EPISTEMIC_CLASS_UNSATISFIED
```

This closes the case where knowledge Applicability itself is DIRECTLY_APPLICABLE but the active RuntimeProfile still requires an additional context semantic.

### Replay requirement

The ContextManifest replay class is compared with the exact RuntimeProfile minimum. A weaker replay world becomes:

```text
requirementType = REPLAY_REQUIREMENT
code = REPLAY_REQUIREMENT_UNSATISFIED
```

R01 records the gap; it does not turn that gap into RuntimeEligibility authority.

## 5. RuntimeCandidates

`adr.runtime-candidates.v1` freezes the exact candidate set, shared RuntimeProfile/world requirements, and each candidate's existing ApplicabilityAssessment disposition:

```text
sharedOpenRequirements[]

candidate:
  knowledgeRef
  applicabilityAssessmentRef
  transportStatus
  scientificUseStatus
  decisionRelevance
  applicabilityRuntimeUse
  compilerState
  openRequirements[]
```

`compilerState` is compiler structure only:

```text
STRUCTURALLY_COMPLETE
OPEN_REQUIREMENTS
BLOCKED_BY_APPLICABILITY
```

A candidate with no Applicability-local gap can still be `OPEN_REQUIREMENTS` when a shared RuntimeProfile requirement is unresolved.

This state is not RuntimeEligibility and does not mean the path is executable.

## 6. RuntimePlan DAG

`adr.runtime-plan.v1` uses the frozen node vocabulary:

```text
CONTEXT
APPLICABILITY
TRANSFORMATION
MODEL
POLICY
INFORMATION
RESULT
```

The current minimal slice produces only:

```text
CONTEXT
APPLICABILITY
INFORMATION (only when an open requirement exists)
RESULT
```

No MODEL/POLICY/TRANSFORMATION node is fabricated.

Each emitted node freezes:

- deterministic node id;
- node type;
- exact authority refs consumed by the node;
- semantic inputs;
- semantic outputs;
- dependency node ids;
- structured open-requirement ids.

The Context node exposes exact ContextManifest semantic IDs rather than an opaque source blob.

Shared RuntimeProfile/world information nodes depend on the Context node and are included in every affected candidate result branch. Candidate-local information nodes depend on the exact Applicability node that produced the unresolved requirement.

## 7. DAG integrity and cycle detection

R01 includes an executable `validateRuntimePlanDag` guard.

It fails closed on:

- duplicate node IDs;
- dependencies on unknown nodes;
- dependency cycles.

A current-binding cycle therefore cannot be normalized into a valid RuntimePlan graph. Downstream runtime outputs are also rejected at the compiler input boundary rather than ignored.

The validator protects graph structure only; it does not manufacture legal-runtime authority.

## 8. Open requirements

Unresolved planning needs are first-class structured objects, never prose-only notes.

Current requirement classes include:

```text
MISSING_CONTEXT
RUNTIME_PROFILE_CONTEXT
REPLAY_REQUIREMENT
CALIBRATION_REQUIRED
UNSUPPORTED_CONSTRAINT
APPLICABILITY_CONFLICT
SCIENTIFIC_USE
DECISION_RELEVANCE
APPLICABILITY_RUNTIME_DISPOSITION
```

A missing `crop.code`, for example, appears as a structured applicability requirement and INFORMATION node. A missing profile-required `soil.volumetric_water_content` can independently appear as a shared RuntimeProfile requirement even when the exact Knowledge candidate is directly applicable.

## 9. Alternative paths

Every retrieval candidate becomes a distinct canonical alternative path tied to its exact knowledge/applicability pair.

Multiple candidates can coexist in one RuntimePlan. Input ApplicabilityAssessment ordering cannot change RuntimeCandidates, graph identity or path identity.

Alternative paths contain no ranking score, best-candidate selection or recommendation claim.

## 10. Determinism and identity

The compiler version is frozen as:

```text
ADR_RUNTIME_PLAN_COMPILER@1
```

R01 uses the shared F02 canonical semantic-hash mechanism rather than an ad-hoc JSON hash. Domain-separated semantic hashes derive candidate/node/requirement/path and plan identities.

Same exact inputs produce the same:

- RuntimeCandidates;
- node ids and graph;
- structured requirements;
- alternative paths;
- plan id;
- plan hash.

No publication time, execution time or mutable latest lookup participates in plan identity.

## 11. No circular downstream predecessor

Current RuntimeBinding is not required to compile current RuntimePlan. RuntimeEligibility is a later R03 output and RuntimeBinding is a later D01 authority object; neither may become a predecessor of the graph they consume/adjudicate.

The compiler's closed input surface rejects fields such as:

```text
currentRuntimeBindingRef
runtimeEligibilityRef
decisionResultRef
```

rather than silently ignoring them.

This is stronger than merely showing that such a field does not perturb plan identity.

## 12. Read-only / non-authority semantics

Compilation does not write to AuthorityLedger.

The plan carries:

```text
authorityClass = RUNTIME_COMPILER_IR_NON_AUTHORITY
executionAuthority = NONE_RUNTIME_PLAN_IS_NOT_ELIGIBILITY_OR_BINDING
```

Each alternative path carries:

```text
executionAuthority = NOT_EVALUATED_BY_RUNTIME_PLAN
```

Therefore:

```text
RuntimePlan exists != RuntimeEligibility
RuntimePlan exists != RuntimeBinding
RuntimePlan exists != execution
RuntimePlan exists != recommendation or DecisionResult
```

## 13. Acceptance and gate history

Root CI now includes:

```text
npm run test:runtime-plan
```

The suite proves:

- direct Gate-A candidate compiles;
- exact planning-world closure;
- deterministic graph identity;
- semantic I/O is explicit;
- context -> applicability -> result dependency chain;
- AuthorityLedger remains unchanged;
- missing applicability context becomes structured open requirement + INFORMATION node;
- missing RuntimeProfile-required context remains a shared plan gap even when Applicability is direct/allowed;
- blocked applicability is preserved rather than dropped;
- incomplete/duplicate applicability coverage fails closed;
- exact foreign Decision/Deployment/Profile/Manifest/Assessment drift fails closed;
- downstream RuntimeBinding/Eligibility/Decision inputs fail closed;
- unknown DAG dependencies and graph cycles fail closed;
- two exact retrieval candidates produce two coexisting alternative paths;
- assessment input order cannot perturb graph identity;
- no ranking/recommendation/runtime-legality/decision claim is created.

### Superseded false-green evidence

Run `31944835602` was GREEN before `test:runtime-plan` was wired into root `npm test`. It is explicitly **not R01 acceptance evidence**.

The first root-wired R01 run, `31946600017`, correctly failed and exposed a fixture error. A later hardened run also exposed incomplete ContextDatum fixture source identity. Both failures were fixed without weakening any upstream authority contract.

Exact feature head `22159760fc85567dab373db121bb11cfe2713aa7` then passed full root run `31946838284` with:

```text
R01 positive:      6 / 6
R01 integrity:    12 / 12
R01 alternatives: 4 / 4
R01 total:        22 / 22
```

All existing F/K/A/Gate-A/P01-P04 regression suites also passed in the same root run.

R01 is CLOSED only after current merge-ref full root CI, independent compiler/authority review, Ready-state merge-candidate revalidation, expected-head merge, actual-main verification and exact-main full root CI are green.

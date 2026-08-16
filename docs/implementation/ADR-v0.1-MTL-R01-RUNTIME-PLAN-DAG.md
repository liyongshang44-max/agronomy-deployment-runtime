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
manifest.decision_problem_ref == DecisionProblem
assessment.retrieval_ref == KnowledgeRetrievalResult
assessment.context_manifest_ref == ContextManifest
assessment.decision_problem_ref == DecisionProblem
assessment.knowledge_ref ∈ retrieval.candidate_refs
```

Every retrieval candidate must be covered exactly once. A caller cannot make the plan appear cleaner by omitting a candidate assessment or duplicating one candidate under multiple assessment refs.

## 4. RuntimeCandidates

`adr.runtime-candidates.v1` freezes the exact candidate set and each candidate's existing ApplicabilityAssessment disposition:

```text
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

It is not RuntimeEligibility and does not mean the path is executable.

## 5. RuntimePlan DAG

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

Each node freezes:

- deterministic node id;
- node type;
- exact authority refs consumed by the node;
- semantic inputs;
- semantic outputs;
- dependency node ids;
- structured open-requirement ids.

The Context node exposes exact ContextManifest semantic IDs rather than an opaque source blob.

## 6. Open requirements

Unresolved planning needs are first-class structured objects, never prose-only notes.

Current requirement classes include:

```text
MISSING_CONTEXT
CALIBRATION_REQUIRED
UNSUPPORTED_CONSTRAINT
APPLICABILITY_CONFLICT
SCIENTIFIC_USE
DECISION_RELEVANCE
APPLICABILITY_RUNTIME_DISPOSITION
```

A missing `crop.code`, for example, appears as a structured requirement and an INFORMATION node bound into the candidate branch.

## 7. Alternative paths

Every retrieval candidate becomes a distinct canonical alternative path tied to its exact knowledge/applicability pair.

Multiple candidates can coexist in one RuntimePlan. Input ApplicabilityAssessment ordering cannot change RuntimeCandidates, graph identity or path identity.

Alternative paths contain no ranking score, best-candidate selection or recommendation claim.

## 8. Determinism

The compiler version is frozen as:

```text
ADR_RUNTIME_PLAN_COMPILER@1
```

Plan semantic identity is derived only from the normalized planning IR. Same exact inputs produce the same:

- RuntimeCandidates;
- node ids and graph;
- structured requirements;
- alternative paths;
- plan id;
- plan hash.

No publication time, execution time or mutable latest lookup participates in plan identity.

## 9. No circular RuntimeBinding predecessor

Current RuntimeBinding is not required to compile current RuntimePlan. Binding belongs to the later R03 stage and cannot become a predecessor of the graph it is meant to bind.

The compiler does not inspect RuntimeBinding, RuntimeEligibility, DecisionRobustness or DecisionResult state.

## 10. Read-only / non-authority semantics

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
RuntimePlan exists != RuntimeEligibility ALLOWED
RuntimePlan exists != RuntimeBinding
RuntimePlan exists != execution
RuntimePlan exists != recommendation or DecisionResult
```

## 11. Acceptance

Root CI includes:

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
- missing context becomes structured open requirement + INFORMATION node;
- blocked applicability is preserved rather than dropped;
- incomplete/duplicate applicability coverage fails closed;
- exact foreign Decision/Deployment/Profile/Manifest/Assessment drift fails closed;
- two exact retrieval candidates produce two coexisting alternative paths;
- assessment input order cannot perturb graph identity;
- no ranking/recommendation/runtime-legality/decision claim is created.

R01 is CLOSED only after exact feature-head full root CI, current merge-ref full root CI, independent compiler/authority review, Ready-state merge-candidate revalidation, expected-head merge, actual-main verification and exact-main full root CI are green.

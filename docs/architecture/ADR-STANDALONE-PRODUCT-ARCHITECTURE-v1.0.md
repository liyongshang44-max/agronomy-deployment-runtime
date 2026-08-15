# Agronomy Deployment Runtime — Standalone Product Architecture v1.0

Status: **FROZEN TARGET ARCHITECTURE**  
Product: **Agronomy Deployment Runtime (ADR)**  
Repository: `agronomy-deployment-runtime`

## 1. Product mission

Agronomy Deployment Runtime is an independent product that compiles the valid domain of agronomic knowledge into a governed, traceable, replayable computational world for a specific target context and decision purpose.

Its core questions are:

1. What does the exact source material actually say?
2. What may the platform recognize as qualified agronomic knowledge?
3. Does that knowledge survive transport from its governed origin context to a TargetContext for this purpose?
4. What exact runtime world is legally composable here?
5. Across the declared decision-material legal worlds, does the material action change?
6. What did reality teach us after deployment, and what can actually be attributed causally?

ADR is not a digital twin, FMIS, sensor platform, weather platform, satellite platform, farm ERP, machine-control system, or AO-ACT implementation.

## 2. Standalone product boundary

ADR owns:

- source provenance, logical Source identity and exact SourceArtifact identity;
- scientific compilation into source-faithful claims;
- qualification of agronomic knowledge;
- derived knowledge, scientific lineage and derived-knowledge origin context;
- Source/Derived origin-context to TargetContext transport semantics;
- governed transformations;
- knowledge, model, policy and implementation registries as distinct authority domains;
- explicit ImplementationConformance authority;
- scoped calibration authority distinct from scientific knowledge;
- KnowledgeRelease, RuntimeProfile and Deployment control;
- context-resolution contracts and immutable ContextManifests;
- applicability / transport adjudication;
- replayable KnowledgeRetrievalResult provenance;
- RuntimePlan compilation;
- InformationRequirement generation;
- RuntimeEligibility resolution;
- immutable RuntimeBinding creation;
- RuntimeAlternativeSet coverage authority for robustness;
- runtime result normalization with RuntimeDatum semantics;
- DecisionRobustness evaluation;
- DecisionResult authority where the configured decision-authority mode permits;
- outcome evaluation, explicit causal-attribution authority where claimed, and revision proposals;
- tenant/IP governance, provenance, replay and audit.

ADR may consume externally supplied reality/context, evidence, prior state, forecasts, model execution, policy execution, recommendations, execution records and outcomes.

ADR must not require any specific external farm platform or runtime provider.

## 3. Product relationship to GEOX

GEOX is:

- a first-party integration;
- a reference consumer;
- a field-validation substrate;
- potentially a context/state/model/forecast/outcome provider.

GEOX is **not**:

- the host of ADR;
- the schema authority of ADR;
- the scientific authority of ADR;
- a required dependency of ADR core.

The dependency direction is always:

```text
ADR public contracts / APIs
          ▲
          │
        GEOX
```

Never:

```text
ADR core
   │
   ▼
GEOX internals
```

## 4. System planes

### 4.1 Knowledge Control Plane

```text
Source
  ↓
SourceArtifact
  ↓
Scientific Compiler
  ↓
Claims + SourceContext
  ↓
Qualification
  ↓
Qualified Knowledge
  ↓
Derived Knowledge + DerivedKnowledgeContext / Conflict
  ↓
KnowledgeRelease

Transformations ─┐
Models          ─┼→ RuntimeProfile → Deployment
Policies        ─┤
Implementations ─┤
Conformance     ─┤
Calibration     ─┘
```

### 4.2 Deployment Runtime Plane

```text
DecisionProblem
       +
Context inputs / authorized references
       ↓
Context Resolution
       ↓
ContextManifest
       ↓
Knowledge Retrieval
       ↓
KnowledgeRetrievalResult
       ↓
Origin → Target Transport / Applicability
       ↓
RuntimeCandidates
       ↓
Runtime Compiler
       ↓
RuntimePlan DAG
       ↓
InformationRequirements
       ↓
RuntimeEligibility
       ↓
RuntimeBinding(s)
       ↓
RuntimeAlternativeSet
       ↓
Implementation execution
       ↓
RuntimeResults / RuntimeDatum
       ↓
DecisionRobustness
       ↓
DecisionResult when authority mode permits
       ↓
ACT / WAIT / ASK / ABSTAIN disposition + structured action semantics
```

### 4.3 Evaluation Plane

```text
Execution + Outcome
       ↓
OutcomeEvaluation
       ├→ EffectAttributionAssessment when causal claims are made
       ↓
Calibration / Knowledge / Transformation /
Model / Policy revision proposals
       ↓
Control-plane review
       ↓
new version if authorized
```

### 4.4 Governance Fabric

IAM, tenant isolation, IP rights, provenance, semantic identity, canonical hashing, audit, immutability and replay span all planes.

## 5. Core authority separations

The following distinctions are architectural invariants:

```text
Source ≠ SourceArtifact ≠ Claim ≠ QualifiedKnowledge ≠ DerivedKnowledge
SourceContext ≠ DerivedKnowledgeContext ≠ TargetContext ≠ ContextManifest
KnowledgeRelease ≠ RuntimeProfile ≠ Deployment
Specification ≠ Implementation ≠ ImplementationConformance
DerivedKnowledge ≠ CalibrationArtifact
RuntimePlan ≠ RuntimeAlternativeSet ≠ RuntimeBinding
RuntimeEligibility ≠ DecisionDisposition ≠ DecisionResult
ContextDatum ≠ RuntimeDatum
Outcome ≠ CausalEffect
RuntimeEnvironment ≠ RolloutStage
Knowledge ≠ Transformation ≠ Model ≠ Policy ≠ Implementation
```

## 6. Six long-term product backbone objects

### KnowledgeRelease
A frozen set of QualifiedKnowledge and DerivedKnowledge. It answers: **what knowledge is recognized in this release?**

### RuntimeProfile
A reusable, versioned composition policy over a KnowledgeRelease plus allowed transformations, models, policies, implementation/conformance/calibration constraints and runtime governance. It answers: **how may knowledge be computed and decided with?**

### Deployment
Applies a RuntimeProfile to a technical runtime environment and an authorized rollout stage/scope. It answers: **where, for whom, for what use, and at what operational exposure is this profile deployed?**

### ContextManifest
An immutable snapshot of the exact target-context data and resolved external-reference receipts used for one runtime compilation. It answers: **what world was visible to the runtime at this time and cutoff?**

### RuntimeBinding
The immutable adjudicated computational world actually selected for one DecisionProblem. It answers: **what exact versions, context, knowledge, transformations, calibrations, models, policies, implementations and conformance authorities were bound this time?**

### DecisionRobustness
Evaluates whether the RuntimeAlternativeSet's decision-material legal worlds lead to materially equivalent actions. It answers: **does remaining governed uncertainty materially change the action?**

These six are the long-term backbone, not the complete domain-object inventory.

## 7. Authority chains

### Scientific authority

```text
Source
→ SourceArtifact
→ Claim
→ Qualification
→ QualifiedKnowledge
→ DerivedKnowledge where applicable
→ KnowledgeRelease
```

### Runtime authority

```text
DecisionProblem
+ TargetContext inputs
→ ContextManifest
→ KnowledgeRetrievalResult
→ Transport / Applicability
→ RuntimePlan
→ RuntimeEligibility
→ RuntimeBinding(s)
→ RuntimeAlternativeSet
```

### Decision authority

```text
RuntimeAlternativeSet
+ RuntimeResults
+ Policy results
→ DecisionRobustness
→ DecisionResult when authorized
→ ACT / WAIT / ASK / ABSTAIN disposition + structured action semantics
```

### Learning authority

```text
Execution / Outcome
→ OutcomeEvaluation
→ EffectAttributionAssessment when causality is claimed
→ Proposal
→ Review
→ New version if authorized
```

No chain may impersonate another chain.

## 8. Runtime outcome separation

Scientific applicability is not action authority.

ADR first resolves runtime legality:

- `RUNTIME_ELIGIBLE`
- `RUNTIME_ELIGIBLE_WITH_LIMITATIONS`
- `INFORMATION_REQUIRED`
- `NO_LEGAL_RUNTIME`

Only after legal runtime execution, declared-alternative coverage and robustness evaluation may an authorized decision layer produce a `DecisionResult` with a disposition:

- `ACT`
- `WAIT`
- `ASK`
- `ABSTAIN`

Therefore:

```text
Knowledge applicable
≠ Runtime legal
≠ Decision disposition
≠ Structured action justified
```

## 9. RuntimePlan as compiler IR

RuntimePlan is the internal intermediate representation of the Runtime Compiler. It is a DAG of semantic requirements, authority references, candidate alternatives, transformations, calibration requirements, model nodes, policy nodes and information gaps.

RuntimePlan is revisable and may branch while solving.

RuntimeBinding is immutable and represents one adjudicated world selected after the plan has converged sufficiently to materialize that world.

DecisionRobustness does not infer the comparison universe from whatever bindings happen to exist. It evaluates an immutable RuntimeAlternativeSet with explicit coverage/completeness semantics.

## 10. Standalone product test

ADR is considered architecturally independent only if all core build and acceptance tests remain valid when:

- the GEOX adapter is deleted;
- the GEOX repository is unavailable;
- no MCFT/CAP/KBS/T3R1 concepts exist;
- no external farm platform is connected.

The standalone architecture is governed by:

- `ADR-REPO-CONSTITUTION-v1.0.md`
- `ADR-COMPLETE-COMPONENT-ARCHITECTURE-v1.0.md`
- `ADR-AGRONOMIC-CONTEXT-AND-PUBLIC-RUNTIME-CONTRACT-v1.0.md`
- `ADR-ARCHITECTURE-v1.0-FINAL-ADJUDICATION.md`
- `../domain/ADR-DOMAIN-MODEL-v1.0.md`
- `../decisions/DEC-0001-INDEPENDENT-PRODUCT-BOUNDARY.md`

Where a pre-adjudication v1.0 clause conflicts with `ADR-ARCHITECTURE-v1.0-FINAL-ADJUDICATION.md`, the final adjudication controls that seam.
# Agronomy Deployment Runtime — Standalone Product Architecture v1.0

Status: **FROZEN TARGET ARCHITECTURE**  
Product: **Agronomy Deployment Runtime (ADR)**  
Repository: `agronomy-deployment-runtime`

## 1. Product mission

Agronomy Deployment Runtime is an independent product that compiles the valid domain of agronomic knowledge into a governed, traceable, replayable computational world for a specific target context and decision purpose.

Its core questions are:

1. What does the source actually say?
2. What may the platform recognize as qualified agronomic knowledge?
3. Does that knowledge survive transport from its SourceContext to a TargetContext for this purpose?
4. What exact runtime world is legally composable here?
5. Across the remaining legal worlds, does the decision change?
6. What did reality teach us after deployment?

ADR is not a digital twin, FMIS, sensor platform, weather platform, satellite platform, farm ERP, machine-control system, or AO-ACT implementation.

## 2. Standalone product boundary

ADR owns:

- source provenance and source intelligence;
- scientific compilation into source-faithful claims;
- qualification of agronomic knowledge;
- derived knowledge and scientific lineage;
- SourceContext and TargetContext transport semantics;
- governed transformations;
- knowledge, model, policy and implementation registries as distinct authority domains;
- KnowledgeRelease, RuntimeProfile and Deployment control;
- context-resolution contracts and immutable ContextManifests;
- applicability / transport adjudication;
- RuntimePlan compilation;
- InformationRequirement generation;
- RuntimeEligibility resolution;
- immutable RuntimeBinding creation;
- runtime result normalization;
- DecisionRobustness evaluation;
- outcome evaluation and revision proposals;
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
Sources
  ↓
Source Intelligence
  ↓
Scientific Compiler
  ↓
Claims + SourceContext
  ↓
Qualification
  ↓
Qualified Knowledge
  ↓
Derived Knowledge / Conflict
  ↓
KnowledgeRelease

Transformations ─┐
Models          ─┼→ RuntimeProfile → Deployment
Policies        ─┤
Implementations ─┘
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
Source → Target Transport / Applicability
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
RuntimeBinding
       ↓
Implementation execution
       ↓
RuntimeResults
       ↓
DecisionRobustness
       ↓
ACT / WAIT / ASK / ABSTAIN
```

### 4.3 Evaluation Plane

```text
Execution + Outcome
       ↓
OutcomeEvaluation
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
Source ≠ Claim ≠ QualifiedKnowledge ≠ DerivedKnowledge
SourceContext ≠ TargetContext ≠ ContextManifest
KnowledgeRelease ≠ RuntimeProfile ≠ Deployment
RuntimePlan ≠ RuntimeBinding
RuntimeEligibility ≠ Decision
Knowledge ≠ Transformation ≠ Model ≠ Policy ≠ Implementation
```

## 6. Six long-term product backbone objects

### KnowledgeRelease
A frozen set of QualifiedKnowledge and DerivedKnowledge. It answers: **what knowledge is recognized in this release?**

### RuntimeProfile
A reusable, versioned composition policy over a KnowledgeRelease plus allowed transformations, models, policies, implementation constraints and runtime governance. It answers: **how may knowledge be computed and decided with?**

### Deployment
Applies a RuntimeProfile to an environment and authorized deployment scope. It answers: **where, for whom, for what use, and at what rollout stage is this profile deployed?**

### ContextManifest
An immutable snapshot of the exact target-context data and resolved external-reference receipts used for one runtime compilation. It answers: **what world was visible to the runtime at this time and cutoff?**

### RuntimeBinding
The immutable adjudicated computational world actually selected for one DecisionProblem. It answers: **what exact versions, context, knowledge, transformations, models, policies and implementations were bound this time?**

### DecisionRobustness
Evaluates whether remaining legal runtime alternatives lead to the same decision. It answers: **does remaining uncertainty materially change the action?**

## 7. Authority chains

### Scientific authority

```text
Source
→ Claim
→ Qualification
→ QualifiedKnowledge
→ DerivedKnowledge
→ KnowledgeRelease
```

### Runtime authority

```text
DecisionProblem
+ TargetContext inputs
→ ContextManifest
→ Transport / Applicability
→ RuntimePlan
→ RuntimeEligibility
→ RuntimeBinding
```

### Decision authority

```text
RuntimeBinding
→ RuntimeResults
→ Policy result
→ DecisionRobustness
→ ACT / WAIT / ASK / ABSTAIN
```

### Learning authority

```text
Execution / Outcome
→ OutcomeEvaluation
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

Only after legal runtime execution and robustness evaluation may the decision layer produce:

- `ACT`
- `WAIT`
- `ASK`
- `ABSTAIN`

Therefore:

```text
Knowledge applicable
≠ Runtime legal
≠ Action justified
```

## 9. RuntimePlan as compiler IR

RuntimePlan is the internal intermediate representation of the Runtime Compiler. It is a DAG of semantic requirements, authority references, candidate alternatives, transformations, model nodes, policy nodes and information gaps.

RuntimePlan is revisable and may branch while solving.

RuntimeBinding is immutable and represents the adjudicated world selected after the plan has converged.

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
- `../domain/ADR-DOMAIN-MODEL-v1.0.md`
- `../decisions/ADR-0001-INDEPENDENT-PRODUCT-BOUNDARY.md`

# Agronomy Deployment Runtime — Repository Constitution v1.0

Status: **FROZEN**

This document defines the non-negotiable authority, dependency, immutability, tenancy, replay and safety rules of the `agronomy-deployment-runtime` repository.

## 1. Constitutional product boundary

Agronomy Deployment Runtime owns the semantics and governance of agronomic knowledge deployment.

It may consume context, state, models, forecasts, runtime results and outcomes from external systems, but it must never require any specific farm platform, digital-twin implementation, sensor provider, weather provider, satellite provider, or execution stack.

## 2. Authority owned by ADR

ADR owns:

1. Source Provenance Authority — source identity, version, artifact integrity and provenance.
2. Scientific Qualification Authority — whether a source-faithful claim is qualified for specified scientific uses.
3. Transport Authority — whether qualified knowledge is applicable to a specific TargetContext, DecisionProblem and use purpose.
4. Transformation Authority — which semantic transformations are legally permitted and under what conditions.
5. Runtime Composition Authority — which exact knowledge, transformations, models, policies, context and implementations constitute a legal runtime world.
6. Decision Robustness Authority — whether remaining legal runtime alternatives materially alter the decision.
7. Evaluation Authority — what post-runtime evidence supports calibration, requalification or revision proposals.

ADR does not own field reality, sensor truth, external-provider truth, digital-twin state truth, machine execution authority, or final human approval authority merely by ingesting references to them.

## 3. Dependency direction

Permitted:

```text
core domain → ADR contracts
adapters → ADR contracts + external systems
apps → ADR domain/services/contracts
external consumers → ADR public API / SDK
```

Forbidden:

```text
ADR core → GEOX
ADR core → customer-specific implementation
ADR core → farm-platform schema
ADR core → MCFT/CAP/KBS/T3R1 semantics
core packages → adapters/*
```

A first-party adapter has no privileged scientific status.

## 4. Standalone independence tests

CI shall enforce or be capable of enforcing:

```text
NO @geox/* dependency
NO GEOX DB/schema/table dependency
NO MCFT/CAP/KBS/T3R1 semantic dependency
core packages cannot import adapters/*
scientific domain cannot call external farm-provider URLs
adapters cannot grant scientific qualification
adapters cannot invent semantic transformations
delete adapters/geox → core build and acceptance remain valid
GEOX repository unavailable → standalone acceptance remains valid
```

These tests are constitutional, not implementation conveniences.

## 5. Immutable authority objects

Once authority-bearing semantics are published, they are immutable. Semantic changes create a new version with lineage.

This applies to:

- Claim;
- SourceContext;
- QualifiedKnowledge;
- DerivedKnowledge;
- KnowledgeRelease;
- QualifiedTransformation;
- Model specification;
- Policy specification;
- RuntimeProfile;
- Deployment version;
- ContextManifest;
- ApplicabilityAssessment;
- RuntimeBinding;
- DecisionRobustnessResult;
- OutcomeEvaluation.

In-place semantic mutation is prohibited.

Permitted lifecycle relations include:

- `supersedes`;
- `superseded_by`;
- `revokes`;
- `derived_from`;
- `requalifies`;
- `replaces`.

Historical RuntimeBindings always retain the exact versions they originally referenced.

## 6. Knowledge lifecycle and deployment lifecycle are independent

Knowledge lifecycle:

```text
CANDIDATE
→ UNDER_REVIEW
→ QUALIFIED
→ SUPERSEDED | REVOKED

or
→ REJECTED
```

Deployment lifecycle:

```text
DRAFT
→ SANDBOX
→ SHADOW
→ PILOT
→ PRODUCTION
→ SUSPENDED
→ DEPRECATED
```

`QUALIFIED` is scientific-use authority. `PRODUCTION` is deployment authority. Neither implies the other.

## 7. KnowledgeRelease, RuntimeProfile and Deployment are separate authority objects

`KnowledgeRelease` is only a frozen set of QualifiedKnowledge and DerivedKnowledge.

It must not contain Model, Policy, Implementation or deployment lifecycle state.

`RuntimeProfile` references a KnowledgeRelease and defines reusable composition constraints over:

- qualified transformations;
- model specifications;
- policy specifications;
- implementation constraints;
- context requirements;
- replay requirements;
- runtime governance.

`Deployment` applies a RuntimeProfile to a concrete authorized scope and rollout stage.

Knowledge, model, policy and deployment can therefore evolve independently.

## 8. Knowledge ownership and permission dimensions are orthogonal

Knowledge access cannot be represented by a single `PUBLIC/PRIVATE` field.

At minimum, authority must distinguish:

### ownership
Who owns or controls the knowledge asset and under what rights/license.

### visibility_policy
Who may inspect/read the knowledge object.

### qualification_scope
For which crop/capability/decision/use/jurisdiction the knowledge is scientifically qualified.

### deployment_scope
For which organizations/programs/tenants/regions/crops/seasons it may be deployed.

Runtime tenant identity does not imply knowledge ownership.

## 9. Adapter authority restriction

Adapters translate external representations into ADR public contracts.

Adapters may not:

- invent a scientific claim;
- grant qualification;
- determine Source→Target transport;
- silently reinterpret epistemic class;
- invent a transformation;
- convert an observation into a state estimate without a qualified transformation/model;
- resolve a scientific conflict.

Example: a connector may publish a 100 mm VWC observation. It may not silently declare that value equivalent to root-zone storage.

## 10. Context and temporal integrity

`TargetContext` is the conceptual target world.

`ContextManifest` is the immutable, time-bounded snapshot used by one runtime compilation.

Applicability and RuntimeBinding consume ContextManifest, not an open mutable context pool.

Every ContextManifest must carry at least:

- DecisionProblem reference;
- target identity/scope;
- logical time;
- evidence cutoff;
- exact ContextDatum hashes;
- resolved external-reference receipt hashes;
- manifest semantic hash.

New evidence or state never mutates an existing ContextManifest; it creates another manifest.

## 11. External reference replay

Decision-critical external references must be resolved before use and produce a `ResolvedContextDatumReceipt`.

The receipt must capture enough authority to state what was actually read at the time, including:

- reference identity/hash;
- authorization context hash;
- resolution time;
- effective time;
- provider response hash;
- normalized ContextDatum hash;
- retention/replay class.

Replay capability must be explicit:

- `EXACT`;
- `CONTENT_ADDRESSED_EXTERNAL`;
- `PROVIDER_DEPENDENT`;
- `NON_REPLAYABLE`.

No system may label provider-dependent or non-replayable data as exact replay.

## 12. SourceContext and TargetContext are distinct scientific objects

`SourceContext` describes the original scientific/empirical context in which a Claim was observed, derived, studied or recommended.

`TargetContext` describes the real-world context in which that knowledge is proposed for use.

Transport is conceptually:

```text
Transport(
  QualifiedKnowledge,
  SourceContext,
  ContextManifest,
  UsePurpose,
  DecisionProblem
)
```

Transport must evaluate claim-relevant effect modifiers and semantics; it must not use country/region names as a mechanical compatibility shortcut.

## 13. Epistemic identity is separate from provenance identity

Every ContextDatum must distinguish what the datum epistemically is from how it entered the system.

Epistemic class:

- `OBSERVATION`;
- `ASSERTION`;
- `DERIVED`;
- `STATE_ESTIMATE`;
- `FORECAST`;
- `CONFIGURATION`;
- `MODEL_PRIOR`.

Provenance class:

- `USER`;
- `AGRONOMIST`;
- `SENSOR`;
- `MACHINERY`;
- `REMOTE_SENSING`;
- `EXTERNAL_PROVIDER`;
- `CUSTOMER_SYSTEM`;
- `LABORATORY`;
- `MODEL`;
- `PLATFORM`.

Source channel never upgrades epistemic status.

## 14. Semantic transformations require explicit authority

All non-trivial semantic conversions must be represented by a QualifiedTransformation or Model.

Runtime or adapters must never improvise transformations using LLM inference, heuristics or undocumented equivalence.

Transformations change representation/semantics under governed rules; they do not create missing reality.

## 15. Runtime legality and action authority are distinct

RuntimeEligibility can only be:

- `RUNTIME_ELIGIBLE`;
- `RUNTIME_ELIGIBLE_WITH_LIMITATIONS`;
- `INFORMATION_REQUIRED`;
- `NO_LEGAL_RUNTIME`.

Decision results can only be produced after legal runtime execution and robustness evaluation:

- `ACT`;
- `WAIT`;
- `ASK`;
- `ABSTAIN`.

Therefore:

```text
Knowledge applicable
≠ Runtime legal
≠ Action justified
```

## 16. RuntimePlan and RuntimeBinding are different

RuntimePlan is the compiler IR and may contain alternatives, branches, unresolved requirements and replaceable candidates.

RuntimeBinding is the immutable adjudicated runtime world actually selected.

A RuntimePlan has planning authority only. A RuntimeBinding has runtime-composition authority only.

No unfinished plan may be represented as a binding.

## 17. Conflict cannot be silently resolved

Conflicting qualified knowledge, transformations, models or policies may not be silently:

- averaged;
- overwritten;
- resolved by newest timestamp alone;
- resolved by citation count;
- resolved by LLM preference.

Legal mechanisms include explicit synthesis authority, explicit precedence policy, calibration authority, human adjudication, or preservation of multiple legal runtime alternatives.

DecisionRobustness determines whether unresolved alternatives are decision-material.

## 18. No epistemic cycle

The outputs produced under a RuntimeBinding cannot be used retroactively to justify the legality of that same binding.

The allowed direction is:

```text
external reality/evidence/prior state/configuration
→ ContextManifest
→ Applicability
→ RuntimePlan
→ RuntimeBinding
→ current runtime outputs
```

Current outputs may only influence subsequent evaluations or future bindings.

## 19. RuntimeBinding is replay authority, not correctness authority

A perfect replay proves what the system used and how it computed.

It does not prove that the knowledge, model or policy was scientifically correct.

Correctness and performance are evaluated separately.

## 20. Outcome cannot mutate authority directly

Execution/outcome information produces `OutcomeEvaluation` and proposals only.

Permitted outputs include:

- CalibrationProposal;
- KnowledgeRequalificationProposal;
- TransformationRevisionProposal;
- ModelRevisionProposal;
- PolicyRevisionProposal.

A proposal must re-enter the appropriate Control Plane review/authority process before a new version can be published.

## 21. Core authority separations

These are permanent invariants:

1. `Source ≠ Claim ≠ QualifiedKnowledge ≠ DerivedKnowledge`.
2. `SourceContext ≠ TargetContext ≠ ContextManifest`.
3. `KnowledgeRelease ≠ RuntimeProfile ≠ Deployment`.
4. `RuntimePlan ≠ RuntimeBinding`.
5. `RuntimeEligibility ≠ Decision`.
6. Knowledge, Transformation, Model, Policy and Implementation evolve independently.
7. Ownership, visibility, qualification and deployment scope are orthogonal.
8. Compiler has no qualification authority.
9. Adapter has no scientific/transport authority.
10. ContextManifest is immutable after creation.
11. Decision-critical external reference use produces a resolution receipt.
12. Replay capability is explicit and truthful.
13. Source→Target transport is scientific-context dependent.
14. Semantic transformation requires Transformation authority.
15. Scientific conflict is not silently resolved.
16. Current runtime outputs cannot justify their own binding.
17. Outcome creates evaluation/proposal, not authority mutation.
18. RuntimeBinding is reproducibility authority, not correctness authority.
19. Decision uncertainty is evaluated through legal alternatives/robustness, not a universal confidence score.
20. Removing any specific external-platform adapter must not invalidate ADR core.

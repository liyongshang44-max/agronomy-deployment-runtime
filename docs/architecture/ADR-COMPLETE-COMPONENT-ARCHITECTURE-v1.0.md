# Agronomy Deployment Runtime — Complete Component Architecture v1.0

Status: **FROZEN**

This document freezes the complete target component architecture of Agronomy Deployment Runtime (ADR). It defines bounded components, authority ownership, call direction and plane boundaries. It does not define MVP sequencing.

## 1. Architectural planes

ADR is composed of:

1. Knowledge Control Plane
2. Deployment Runtime Plane
3. Evaluation Plane
4. Governance Fabric spanning all planes

The legal authority flow is:

```text
CONTROL
  │ frozen releases/profiles/deployments
  ▼
RUNTIME
  │ immutable bindings/results
  ▼
EVALUATION
  │ proposals only
  └──────────────► CONTROL REVIEW
```

Evaluation cannot directly mutate control authority objects. Runtime cannot mutate QualifiedKnowledge. Control cannot rewrite historical RuntimeBindings.

# 2. Knowledge Control Plane

## 2.1 Source Intelligence

Responsibilities:

- source discovery and registration;
- source identity and versioning;
- artifact deduplication;
- supersession relationships;
- content integrity;
- rights/licensing metadata;
- source freshness metadata where relevant.

Produces:

- `Source`
- `SourceArtifact`

Authority: source provenance only.

It cannot qualify claims or infer runtime applicability.

## 2.2 Scientific Compiler

Input:

- `SourceArtifact`

Produces candidate-only objects:

- `ClaimCandidate`
- `SourceContextCandidate`
- extraction provenance and genealogy

Authority: proposal only.

The compiler, including any LLM-based implementation, may not publish `QualifiedKnowledge` or production deployment authority.

## 2.3 Claim Registry

Stores immutable source-faithful assertions.

Core relation:

```text
Source 1 ── * Claim
Claim  1 ── 1 SourceContext identity
```

A Claim answers only: what did this source assert?

## 2.4 Source Context Service

Builds the scientific origin context for a Claim using shared context semantics.

Context families:

- Biological
- Environmental
- Management
- Operational
- Measurement
- Jurisdiction/Economic

Unsupported dimensions are represented as `NOT_REPORTED`; they are not guessed.

Authority: source-context representation.

## 2.5 Qualification Service

Consumes source-faithful claims and context plus review evidence.

Produces:

- `QualifiedKnowledge`
- qualification decision lineage
- allowed uses
- forbidden uses
- limitations
- known effect modifiers
- scientific qualification scope

Authority: scientific-use qualification.

Qualification does not imply target-field applicability or production deployment.

## 2.6 Synthesis Service

Consumes one or more QualifiedKnowledge objects through an authorized derivation method.

Produces:

- `DerivedKnowledge`
- complete `DERIVED_FROM` lineage
- derivation method reference

Examples include governed synthesis, meta-analysis, parameter derivation or calibrated knowledge generation.

DerivedKnowledge never overwrites its sources.

## 2.7 Knowledge Conflict Service

Detects incompatible assertions that compete for the same semantic role under overlapping use/applicability conditions.

Produces:

- `KnowledgeConflict`

It does not silently average or choose a winner.

## 2.8 Knowledge Registry

Versioned registry for:

- QualifiedKnowledge
- DerivedKnowledge
- KnowledgeConflict
- scientific lineage

Responsibilities include retrieval authorization and semantic identity, not runtime transport adjudication.

## 2.9 Knowledge Release Service

Produces immutable `KnowledgeRelease` objects.

A KnowledgeRelease is only a frozen set of QualifiedKnowledge and DerivedKnowledge versions.

It contains no model, policy, implementation or rollout state.

## 2.10 Transformation Registry

Stores QualifiedTransformation specifications.

Each transformation declares:

- input semantic contract;
- output semantic contract;
- method;
- applicability domain;
- uncertainty consequences;
- limitations;
- version;
- qualification authority;
- implementation bindings where applicable.

Authority: governed semantic transformation.

## 2.11 Model Registry

Stores Model specifications independently from implementations.

Each Model declares:

- purpose;
- input semantics;
- output semantics;
- required state/evidence;
- parameter slots;
- compatible knowledge classes;
- measurement conventions;
- applicability domain;
- calibration requirements;
- known limitations;
- available implementation bindings.

Authority: computational semantic specification.

## 2.12 Policy Registry

Stores Policy specifications independently from knowledge and model semantics.

Each Policy declares:

- decision type;
- action space;
- required model/runtime outputs;
- threshold authority;
- operational constraints;
- jurisdiction constraints where relevant;
- human review/approval requirements;
- fallback and abstention rules;
- available implementation bindings.

Authority: decision-logic specification.

## 2.13 Implementation Registry

Stores executable implementation identities for Models, Policies and Transformations.

Implementation types may include:

- `INTERNAL`
- `EXTERNAL_HTTP`
- `CUSTOMER_RUNTIME`
- `GEOX_RUNTIME`
- `BATCH`
- `WASM`
- `OTHER_REGISTERED_PROVIDER`

Implementation identity does not grant scientific authority and cannot modify the semantics of the specification it implements.

## 2.14 Runtime Profile Registry

Produces versioned reusable `RuntimeProfile` objects.

RuntimeProfile references:

- one KnowledgeRelease;
- transformation constraints;
- model constraints;
- policy constraints;
- implementation constraints;
- required context semantics;
- replay requirements;
- runtime governance.

A RuntimeProfile has no current TargetContext and is not a runtime execution record.

## 2.15 Deployment Controller

Applies a RuntimeProfile to a deployment scope and lifecycle.

Deployment lifecycle:

```text
DRAFT → SANDBOX → SHADOW → PILOT → PRODUCTION
                            │
                            ├→ SUSPENDED
                            └→ DEPRECATED
```

Deployment defines:

- RuntimeProfile reference;
- environment;
- tenant/program/customer cohort;
- geography/crop/decision scope;
- effective interval;
- entitlements/licensing;
- rollout mode;
- production constraints.

Deployment is the formal Control Plane boundary exposed to Runtime.

# 3. Deployment Runtime Plane

## 3.1 Decision Problem Service

Creates immutable/versioned `DecisionProblem` objects.

A DecisionProblem defines:

- what question is being solved;
- target scope;
- logical time;
- decision horizon;
- objective;
- action space;
- constraints;
- use class;
- decision authority mode;
- deadline.

No Runtime Compile is valid without a DecisionProblem.

## 3.2 Context Provider Gateway

Public ingress for:

- `ContextDatum`
- `AuthorizedContextReference`

Responsibilities:

- contract validation;
- authorization;
- tenant boundary enforcement;
- canonical semantic parsing.

It has no transformation or scientific authority.

## 3.3 Reference Resolution Service

Resolves decision-relevant `AuthorizedContextReference` values and produces immutable `ResolvedContextDatumReceipt` records.

It captures what was actually obtained, when, under what authorization and with which hashes/replay class.

## 3.4 Context Resolver

Determines which context dimensions are required for a DecisionProblem and currently available under the active Deployment/RuntimeProfile.

It may select existing valid ContextDatum objects or trigger reference resolution.

It cannot invent missing values or silently upgrade epistemic status.

## 3.5 Context Manifest Builder

Freezes the exact context used by one runtime compilation into an immutable `ContextManifest`.

The manifest includes:

- DecisionProblem reference;
- target identity;
- logical time;
- evidence cutoff;
- exact ContextDatum hashes;
- resolved reference receipt hashes;
- semantic hash.

Applicability and RuntimeBinding may consume only a ContextManifest, never a mutable open context pool.

## 3.6 Knowledge Retrieval Engine

Performs high-recall candidate discovery from the active KnowledgeRelease.

Inputs may include:

- DecisionProblem;
- Deployment/RuntimeProfile;
- crop/cultivar/stage summary;
- target context semantics;
- use purpose;
- available model/policy slots.

Output:

- `CandidateKnowledgeSet`

Retrieval does not decide scientific applicability.

## 3.7 Transport / Applicability Engine

Core conceptual function:

```text
Transport(
  QualifiedKnowledge,
  SourceContext,
  ContextManifest,
  UsePurpose,
  DecisionProblem
)
```

It evaluates:

- source and target semantic compatibility;
- claim-relevant effect modifiers;
- measurement conventions;
- target-state compatibility;
- decision relevance;
- allowed scientific use;
- required transformations;
- calibration requirements;
- known limitations;
- unresolved information;
- conflicts.

Produces immutable `ApplicabilityAssessment`.

Transport states:

- `DIRECTLY_APPLICABLE`
- `APPLICABLE_WITH_GOVERNED_TRANSFORM`
- `CALIBRATION_REQUIRED`
- `BOUNDED_EXTRAPOLATION`
- `UNRESOLVED`
- `CONFLICT`
- `NOT_RELEVANT`

## 3.8 Runtime Candidate Builder

Combines applicability results with RuntimeProfile constraints to produce candidate runtime components:

- knowledge candidates;
- transformation candidates;
- model candidates;
- policy candidates;
- implementation candidates;
- legal alternatives;
- preliminary information gaps.

Produces `RuntimeCandidates`.

## 3.9 Runtime Compiler

Consumes:

- DecisionProblem;
- Deployment;
- RuntimeProfile;
- ContextManifest;
- RuntimeCandidates.

Produces:

- `RuntimePlan DAG`

The Runtime Compiler is deterministic with respect to its authority inputs and compiler version.

It may branch over multiple legal alternatives.

## 3.10 RuntimePlan DAG

RuntimePlan is ADR's internal compiler IR.

Each node declares:

- semantic input contracts;
- semantic output contracts;
- dependencies;
- authority refs;
- candidate alternatives;
- required implementation capability;
- unresolved requirements;
- status.

Node categories may include:

- context node;
- applicability node;
- transformation node;
- model node;
- policy node;
- information node;
- result node.

The graph must be acyclic with respect to current-binding authority.

RuntimePlan is revisable solving state; it is not historical runtime authority.

## 3.11 Information Requirement Planner

Creates `InformationRequirement` when a legal RuntimePlan cannot be completed with current context.

Each requirement states:

- required semantic dimension;
- why it is required;
- which Knowledge/Model/Policy/Applicability node requires it;
- acceptable epistemic classes;
- acceptable provenance classes;
- acceptable semantic resolution;
- deadline;
- decision materiality.

Statuses:

- `OPEN`
- `SATISFIED`
- `UNSATISFIABLE`
- `NO_LONGER_DECISION_MATERIAL`

Optional acquisition choices may describe providers/cost/latency/quality, but information acquisition need not be owned by ADR.

## 3.12 Runtime Eligibility Resolver

After RuntimePlan convergence, produces one of:

- `RUNTIME_ELIGIBLE`
- `RUNTIME_ELIGIBLE_WITH_LIMITATIONS`
- `INFORMATION_REQUIRED`
- `NO_LEGAL_RUNTIME`

Possible `NO_LEGAL_RUNTIME` reasons include:

- `KNOWLEDGE_CONFLICT`
- `NO_COMPATIBLE_MODEL`
- `NO_COMPATIBLE_POLICY`
- `UNAUTHORIZED_KNOWLEDGE`
- `UNRESOLVABLE_SEMANTICS`
- `PROHIBITED_TRANSFORM`
- `DEPENDENCY_CYCLE`
- `REPLAY_REQUIREMENT_UNSATISFIED`

RuntimeEligibility is not a Decision.

## 3.13 Runtime Binding Compiler

Creates immutable `RuntimeBinding` only after the RuntimePlan is fully adjudicated for the selected legal world.

A binding freezes:

- DecisionProblem;
- Deployment;
- RuntimeProfile;
- KnowledgeRelease;
- ContextManifest;
- exact Knowledge versions;
- exact Transformation versions;
- exact Model versions;
- exact Policy versions;
- exact Implementation bindings;
- logical time/cutoffs;
- assumptions;
- limitations;
- semantic hash.

A binding cannot contain unresolved alternatives.

## 3.14 Implementation Broker

Dispatches executable runtime nodes to registered implementations while preserving specification semantics.

The broker may execute internally or invoke external/customer/GEOX runtimes.

It cannot change model/policy/transformation semantics to make an implementation fit.

## 3.15 Runtime Result Collector

Normalizes outputs into `RuntimeResult` objects bound to:

- RuntimeBinding;
- runtime node;
- implementation;
- exact input semantic hashes;
- output semantic hash;
- execution time.

## 3.16 Decision Robustness Engine

Compares policy outputs across the remaining legal RuntimeBindings/runtime alternatives.

Robustness classes:

- `ROBUST`
- `SENSITIVE`
- `UNRESOLVED`

Decision output, when authorized by DecisionProblem mode, is limited to:

- `ACT`
- `WAIT`
- `ASK`
- `ABSTAIN`

`ASK` must identify decision-material InformationRequirement(s).

A conflict that changes action cannot be hidden behind a scalar confidence score.

## 3.17 Result / Recommendation Sink

Exports runtime legality, bindings, results, robustness and/or decision output to external systems.

Possible consumers:

- ADR agronomist workbench;
- GEOX;
- consultant software;
- seed-company applications;
- customer recommendation/workflow systems.

ADR does not require ownership of downstream approval or execution.

# 4. Evaluation Plane

## 4.1 Outcome Ingress

Accepts post-decision evidence such as:

- execution records;
- later observations;
- yield/quality;
- commercial outcomes;
- human disposition;
- customer adjudication.

Outcome inputs preserve Context Contract epistemic/provenance semantics.

## 4.2 Outcome Evaluator

Produces `OutcomeEvaluation` and explicitly separates:

- Knowledge Evaluation;
- Transport Evaluation;
- Model Evaluation;
- Policy Evaluation;
- Execution Evaluation;
- Commercial Evaluation.

A poor outcome cannot be directly equated with incorrect knowledge.

## 4.3 Proposal Services

May produce:

- `CalibrationProposal`
- `KnowledgeRequalificationProposal`
- `TransformationRevisionProposal`
- `ModelRevisionProposal`
- `PolicyRevisionProposal`

Proposals have no authority to mutate current control objects. They re-enter review workflows.

# 5. Governance Fabric

## 5.1 IAM and tenancy

Minimum concepts:

- Organization;
- Tenant;
- Workspace;
- Program;
- User;
- ServiceAccount;
- Role;
- ResourceScope.

Relevant roles may include:

- KnowledgeAuthor;
- AgronomyReviewer;
- ScientificApprover;
- DeploymentManager;
- Agronomist;
- Auditor;
- IntegrationService.

Compiler identities must not have `QUALIFY` or `DEPLOY_PRODUCTION` authority.

## 5.2 Knowledge IP isolation

Customer proprietary knowledge must be isolated at retrieval, qualification, release and deployment layers, not only in UI filtering.

No tenant's proprietary knowledge may influence another tenant without explicit entitlement/license authority.

## 5.3 Provenance and genealogy

Core lineage relations include:

- `ASSERTED_BY`
- `DERIVED_BY`
- `DERIVED_FROM`
- `CITED_FROM`
- `QUALIFIED_BY`
- `TRANSFORMED_BY`
- `BOUND_BY`
- `EXECUTED_BY`
- `VALIDATED_BY`
- `SUPERSEDES`
- `REVOKES`

Lineage must prevent authority laundering.

## 5.4 Canonical identity

Authority objects carry:

- stable logical object ID;
- version;
- semantic hash;
- artifact hash where relevant.

Database UUID is not semantic identity.

## 5.5 Audit

Every authority-bearing mutation is represented as creation of a new object/version or lifecycle event and is auditable by actor, authority, time and prior/new references.

# 6. Component authority summary

| Component | Owns | Must not own |
|---|---|---|
| Source Intelligence | provenance | qualification |
| Scientific Compiler | extraction candidates | scientific authority |
| Qualification | allowed scientific use | target applicability |
| Synthesis | governed derived assertion | source rewriting |
| Knowledge Registry | versioned knowledge | runtime selection |
| Applicability Engine | Source→Target transport | action selection |
| Runtime Compiler | legal plan construction | scientific qualification |
| Info Planner | missing semantic requirements | evidence fabrication |
| Binding Compiler | exact runtime composition | correctness claim |
| Implementation Broker | execution routing | model semantic mutation |
| Robustness Engine | action stability across legal worlds | silent conflict resolution |
| Outcome Evaluator | post-runtime evaluation evidence | direct authority mutation |
| Adapter | representation translation | scientific/transport authority |

# 7. Complete target repository component map

```text
apps/
  api/
  worker/
  agronomist-workbench/
  admin/

packages/
  contracts/
  context-contract/
  source-registry/
  scientific-compiler/
  claim-registry/
  source-context/
  qualification-engine/
  synthesis-engine/
  conflict-engine/
  knowledge-registry/
  knowledge-release/
  transformation-registry/
  model-registry/
  policy-registry/
  implementation-registry/
  runtime-profile/
  deployment-control/
  context-resolver/
  reference-resolution/
  applicability-engine/
  runtime-candidates/
  runtime-compiler/
  runtime-plan/
  information-planner/
  runtime-eligibility/
  runtime-binding/
  implementation-broker/
  runtime-results/
  robustness-engine/
  outcome-evaluation/
  provenance/
  canonicalization/
  authorization/
  audit/

adapters/
  geox/
  generic-rest/
  generic-webhook/
  generic-batch/
  customer/

sdks/
  typescript/
  python/
  openapi/
```

This is the complete target architecture. Implementation sequencing is intentionally not specified here.

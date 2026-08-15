# Agronomy Deployment Runtime — Capability Map 01

Status: **PLANNING BASELINE / NON-ARCHITECTURE-AUTHORITY**

Architecture baseline: `main @ 4852912699741e9491f4e92611251b561108488e`

Frontier: `ADR-CAPABILITY-MAP-01`

Purpose: derive a complete implementation capability graph from the frozen Agronomy Deployment Runtime Architecture v1.0 authority set without reopening architecture boundaries or prematurely creating an implementation task sequence.

This document is a planning artifact. It does not supersede, amend, reinterpret for convenience, or replace Architecture v1.0. If a capability appears difficult to implement, implementation must adapt to the frozen architecture. Architecture may be reopened only if this map discovers a genuine logical contradiction that makes the frozen authority model impossible to implement, and that reopening must occur through an explicit `DEC-xxxx` decision.

---

## 0. Normative basis used by this map

This map is derived from the Architecture v1.0 authority set at the exact baseline above:

- `docs/architecture/ADR-REPO-CONSTITUTION-v1.0.md`
- `docs/domain/ADR-DOMAIN-MODEL-v1.0.md`
- `docs/architecture/ADR-COMPLETE-COMPONENT-ARCHITECTURE-v1.0.md`
- `docs/architecture/ADR-AGRONOMIC-CONTEXT-AND-PUBLIC-RUNTIME-CONTRACT-v1.0.md`
- `docs/architecture/ADR-STANDALONE-PRODUCT-ARCHITECTURE-v1.0.md`
- `docs/decisions/DEC-0001-INDEPENDENT-PRODUCT-BOUNDARY.md`
- `docs/architecture/ADR-ARCHITECTURE-v1.0-FINAL-ADJUDICATION.md`

Final Adjudication conflict-supersession authority remains intact. This planning map intentionally uses the corrected v1.0 object separations, including:

```text
Source ≠ SourceArtifact
SourceContext ≠ DerivedKnowledgeContext ≠ TargetContext ≠ ContextManifest
Specification ≠ Implementation ≠ ImplementationConformance
DerivedKnowledge ≠ CalibrationArtifact
RuntimePlan ≠ RuntimeAlternativeSet ≠ RuntimeBinding
RuntimeEligibility ≠ DecisionDisposition ≠ DecisionResult
ContextDatum ≠ RuntimeDatum
Outcome ≠ CausalEffect
RuntimeEnvironment ≠ RolloutStage
```

No architecture amendment was required to derive this map.

---

# 1. Capability-map rules

Every capability below is defined by six fields:

1. Capability ID
2. Purpose
3. Authority objects involved
4. Required predecessors
5. Positive acceptance
6. Forbidden / nonclaim acceptance

A capability is **not** a package, service, table, endpoint, repository directory, sprint, milestone, or version. One capability may span contracts, persistence, IAM, audit, runtime logic, API surfaces and UI. Acceptance is based on proving the capability end-to-end across its authority boundary, not on a component merely building.

Capability IDs are planning identifiers only. They do not create architecture authority and do not imply implementation order by number.

Two dependency types are used:

- **Hard predecessor** — the capability cannot make its claimed authority statement without the predecessor.
- **Conditional predecessor** — required only when the exercised path uses that authority type, e.g. calibration, external execution or ADR-owned decision policy.

---

# 2. Taxonomy adjudication before mapping

The initial planning taxonomy C0–C22 was directionally complete but omitted one first-class frozen authority capability: `DecisionProblem` creation and action/use-purpose semantics. Hiding DecisionProblem inside Context or Retrieval would violate the architecture rule that no Runtime Compile is valid without an exact DecisionProblem.

Therefore this map adds a dedicated capability and uses **C00–C23**. This is a planning correction only; it does not modify Architecture v1.0.

---

# 3. Capability families

## C00 — Product Independence / Constitutional Enforcement

**Purpose**

Make standalone-product boundaries executable rather than documentary: ADR must build, test and preserve domain authority without GEOX or any customer-specific farm platform.

**Authority objects involved**

- Repository Constitution
- dependency-boundary rules
- adapter authority restrictions
- standalone acceptance evidence

**Required predecessors**

- Architecture v1.0 baseline only

**Positive acceptance**

- automated check rejects `@geox/*` or equivalent core dependency;
- automated check rejects GEOX DB/schema/table semantic dependencies;
- automated check rejects MCFT/CAP/KBS/T3R1 semantic dependencies in core;
- core packages cannot import `adapters/*`;
- scientific/control-plane core cannot call customer/GEOX provider URLs directly;
- deleting `adapters/geox` leaves core build and standalone acceptance valid;
- GEOX repository being unavailable does not prevent ADR core acceptance from running.

**Forbidden / nonclaim acceptance**

- passing because GEOX happens to be available is not independence;
- adapter mocks cannot be required to boot core domain tests;
- no claim that ADR is standalone merely because it is a separate Git repository;
- an adapter may not gain privileged scientific authority by being first-party.

---

## C01 — Canonical Identity, Immutability, Lineage, Replay and Audit Foundation

**Purpose**

Provide the common authority substrate by which semantic objects are versioned, content-addressed, immutable after publication, linked by explicit lineage, and auditable/replayable.

**Authority objects involved**

Cross-cutting identity for all immutable authority objects, including SourceArtifact, Claim, QualifiedKnowledge, DerivedKnowledge, KnowledgeRelease, specifications, conformance, CalibrationArtifact, ContextManifest, ApplicabilityAssessment, KnowledgeRetrievalResult, RuntimeBinding, RuntimeAlternativeSet, RuntimeResult, DecisionResult and OutcomeEvaluation.

**Required predecessors**

- C00

**Positive acceptance**

- canonical semantic hashing is deterministic for identical semantic inputs;
- operational metadata that is not semantically authoritative cannot perturb semantic identity unless the frozen contract says it must;
- semantic mutation of a published authority object creates a new version rather than updating history in place;
- lineage relations such as `supersedes`, `revokes`, `derived_from`, `requalifies`, `replaces` are explicit and replayable;
- historical references continue resolving to the exact old version/hash after newer versions exist;
- audit can reconstruct who/what created an authority object and which exact authority inputs it used.

**Forbidden / nonclaim acceptance**

- UUID equality is not semantic identity;
- mutable rows behind stable IDs do not satisfy immutability;
- `updated_at` history is not a substitute for versioned authority;
- replayability does not imply scientific correctness.

---

## C02 — Tenant, Knowledge-IP, Authorization and Deployment Entitlement Authority

**Purpose**

Enforce independent B2B ownership, visibility, qualification and deployment rights without collapsing them into one `PUBLIC/PRIVATE` flag.

**Authority objects involved**

- ownership scope
- visibility policy
- qualification scope
- deployment scope
- organization/tenant/program identities
- service/user principal authorization
- Deployment entitlements

**Required predecessors**

- C00
- C01

**Positive acceptance**

- an organization can own knowledge while granting read access to selected partners and deployment rights to a different authorized program/tenant set;
- runtime tenant identity does not imply ownership;
- retrieval excludes knowledge that is not visible/deployable for the active principal and Deployment;
- qualification scope and deployment scope are independently enforced;
- authorization decisions are auditable against immutable authority references;
- two tenants with proprietary agronomy cannot cross-read or cross-deploy knowledge without explicit authority.

**Forbidden / nonclaim acceptance**

- a single `private=true` flag is insufficient;
- UI hiding without retrieval/runtime enforcement is not tenant isolation;
- adapter possession of data does not grant deployment rights;
- qualification does not override licensing/entitlement restrictions.

---

## C03 — Source Materialization and Candidate Scientific Compilation

**Purpose**

Convert exact retained source material into candidate source-faithful scientific objects while preserving logical Source identity separately from exact SourceArtifact bytes.

**Authority objects involved**

- Source
- SourceArtifact
- ClaimCandidate
- SourceContextCandidate
- compilation provenance/genealogy

**Required predecessors**

- C01
- C02

**Positive acceptance**

- one logical Source may have multiple immutable SourceArtifacts/editions/materializations;
- Scientific Compiler always binds the exact `SourceArtifact@content_hash` compiled;
- compiler output carries exact source locator/provenance adequate to trace candidate assertions to source material;
- recompiling the same artifact under the same compiler contract yields reproducible candidate semantics;
- artifact acquisition/version changes do not silently rewrite prior compiled candidates.

**Forbidden / nonclaim acceptance**

- compiling a mutable URL without exact content identity is not source materialization;
- compiler may not emit `QUALIFIED` knowledge;
- LLM confidence cannot grant scientific-use authority;
- compiler may not silently fill unreported experimental conditions as facts.

---

## C04 — Claim, Knowledge Origin Context and Scientific Qualification

**Purpose**

Create immutable source-faithful Claims and their SourceContexts, then grant explicit scientific-use qualification without granting target-field applicability or production deployment.

**Authority objects involved**

- Claim
- SourceContext
- QualifiedKnowledge
- qualification decision lineage
- allowed/forbidden uses
- effect modifiers
- qualification scope

**Required predecessors**

- C03
- C01
- C02

**Positive acceptance**

- Claim states what Source asserted, separately from what ADR later believes/permits;
- SourceContext captures reported Biological, Environmental, Management, Operational, Measurement and Jurisdiction/Economic context;
- absent source conditions are represented as `NOT_REPORTED`, not inferred silently;
- a reviewer can qualify a claim for one use and prohibit another;
- QualifiedKnowledge binds exact Claim and qualification authority/version/hash;
- revocation/supersession creates lineage without altering historical claims.

**Forbidden / nonclaim acceptance**

- `QUALIFIED` cannot be interpreted as target applicability;
- reviewer correction must not rewrite the original Claim;
- source reputation alone cannot auto-qualify every claim;
- SourceContext is not TargetContext and is not PDF metadata only.

---

## C05 — Derived Knowledge, Knowledge Conflict and Knowledge Release

**Purpose**

Support governed synthesis and release of qualified knowledge while preserving input lineage, origin-domain authority and unresolved scientific conflict.

**Authority objects involved**

- DerivedKnowledge
- DerivedKnowledgeContext
- KnowledgeConflict
- KnowledgeRelease
- derivation method authority
- scientific lineage

**Required predecessors**

- C04
- C01
- C02

**Positive acceptance**

- multiple QualifiedKnowledge inputs can produce a DerivedKnowledge object only through an authorized derivation method;
- DerivedKnowledge has its own DerivedKnowledgeContext rather than borrowing one arbitrary SourceContext;
- full `DERIVED_FROM` lineage remains queryable;
- conflicting qualified assertions competing for one semantic role produce KnowledgeConflict rather than silent overwrite/average;
- KnowledgeRelease freezes exact QualifiedKnowledge/DerivedKnowledge versions and contains no Model, Policy, Implementation or rollout state;
- a new release can reuse unchanged knowledge while later RuntimeProfiles change independently.

**Forbidden / nonclaim acceptance**

- local calibration is not automatically DerivedKnowledge;
- newest source does not automatically supersede conflicting knowledge;
- conflict may not be resolved by LLM preference or simple averaging;
- KnowledgeRelease is not DeploymentRelease/RuntimeProfile.

---

## C06 — Agronomic Context Contract, Reference Resolution and Immutable ContextManifest

**Purpose**

Allow any external platform to describe decision-relevant target reality/state/configuration with preserved semantic, epistemic, temporal, spatial, uncertainty and provenance identity, then freeze one exact runtime context world.

**Authority objects involved**

- ContextDatum
- AuthorizedContextReference
- ResolvedContextDatumReceipt
- TargetContext
- ContextManifest
- ReplayClass

**Required predecessors**

- C00
- C01
- C02

**Positive acceptance**

- ContextDatum separates `epistemic_class` from `provenance_class`;
- values preserve units, semantic ID, effective time/interval, available-at time, spatial/vertical/temporal support and uncertainty where required;
- external references are resolved before decision-critical use and yield immutable receipts stating what was actually read;
- replay class is truthful (`EXACT`, `CONTENT_ADDRESSED_EXTERNAL`, `PROVIDER_DEPENDENT`, `NON_REPLAYABLE`);
- ContextManifest freezes exact datum/receipt hashes, DecisionProblem reference, logical time and evidence cutoff;
- later provider/customer updates create a new ContextManifest rather than mutating the old one.

**Forbidden / nonclaim acceptance**

- open mutable context pools cannot be consumed directly by Applicability/RuntimeBinding;
- provider-dependent data cannot be labelled exact replay;
- adapter may not upgrade ASSERTION to OBSERVATION or OBSERVATION to STATE_ESTIMATE;
- a bare numeric value without semantic support identity is insufficient for decision-critical context.

---

## C07 — DecisionProblem and Use-Purpose Authority

**Purpose**

Freeze what exact decision/question ADR is solving, for which target/time/horizon/objective/action space/use class and under which decision authority mode.

**Authority objects involved**

- DecisionProblem
- action-space contract
- UsePurpose/use class
- decision authority mode
- target scope/logical time/deadline

**Required predecessors**

- C01
- C02

**Positive acceptance**

- DecisionProblem is immutable/versioned and identifies exact question, scope, logical time, decision horizon, objective, action space, constraints and use class;
- authority mode distinguishes `ADR_POLICY`, `EXTERNAL_POLICY`, and `RUNTIME_ONLY`;
- two materially different action spaces or horizons produce distinct semantic identities;
- downstream ContextManifest, retrieval, applicability and runtime objects bind the exact DecisionProblem.

**Forbidden / nonclaim acceptance**

- no Runtime Compile without a DecisionProblem;
- applicability cannot be claimed globally without a use purpose/decision context;
- `RUNTIME_ONLY` must not later fabricate ADR decision authority;
- DecisionProblem itself contains no agronomic conclusion.

---

## C08 — Replayable Knowledge Retrieval

**Purpose**

Discover a high-recall candidate knowledge set from one exact authorized KnowledgeRelease while making retrieval itself reproducible and explicitly non-scientific.

**Authority objects involved**

- KnowledgeRelease
- KnowledgeRetrievalResult
- retrieval engine/version/configuration
- corpus/index snapshot identity
- DecisionProblem
- Deployment/RuntimeProfile reference

**Required predecessors**

- C05
- C07
- C13
- C02

**Conditional predecessors**

- C06 when retrieval uses target-context summary dimensions

**Positive acceptance**

- retrieval binds exact KnowledgeRelease/version/hash;
- result records retrieval engine/version, relevant query semantics/configuration, corpus/index snapshot and returned candidate references;
- historical replay can distinguish retrieval miss from later applicability error;
- tenant/visibility/deployment rights are enforced before candidate disclosure/use;
- deterministic/replayable fixtures return the same candidate identities under the same retrieval authority inputs.

**Forbidden / nonclaim acceptance**

- retrieval result cannot qualify knowledge;
- ranking score cannot become Applicability authority;
- retrieval may not scan unreleased/latest knowledge dynamically during a bound run;
- omission from retrieval does not mean scientific rejection.

---

## C09 — Source→Target Transport and Applicability

**Purpose**

Deterministically adjudicate whether one exact Qualified/Derived Knowledge object survives transport from its governed origin context into one exact ContextManifest for one DecisionProblem/use purpose.

**Authority objects involved**

- QualifiedKnowledge or DerivedKnowledge
- SourceContext or DerivedKnowledgeContext (`KnowledgeOriginContext`)
- ContextManifest
- DecisionProblem
- ApplicabilityAssessment
- QualifiedTransformation references where applicable
- known effect modifiers/limitations

**Required predecessors**

- C04
- C05
- C06
- C07
- C08
- C10 for governed-transform paths

**Positive acceptance**

- exact fixtures can deterministically adjudicate `DIRECTLY_APPLICABLE`, `APPLICABLE_WITH_GOVERNED_TRANSFORM`, `CALIBRATION_REQUIRED`, `BOUNDED_EXTRAPOLATION`, `UNRESOLVED`, `CONFLICT`, and `NOT_RELEVANT`;
- evaluation compares claim-relevant effect modifiers and semantic conventions rather than mechanically matching all context fields;
- a governed transform must be explicitly identified when required;
- required missing target context yields UNRESOLVED rather than guessed compatibility;
- known hard mismatch yields CONFLICT where architecture requires it;
- allowed scientific use and decision relevance are checked independently from source scientific qualification.

**Forbidden / nonclaim acceptance**

- no inference of missing TargetContext solely to force a match;
- adapter cannot grant Applicability;
- LLM cannot convert CONFLICT/UNKNOWN into MATCH;
- country/region equality alone is not transport proof;
- Applicability cannot claim ACT/WAIT or RuntimeEligibility by itself;
- `CALIBRATION_REQUIRED` cannot be silently treated as runtime-eligible without C12 authority.

---

## C10 — Transformation, Model and Policy Specification Authority

**Purpose**

Version and govern independent semantic specifications for legal transformations, computations and decision logic without embedding mutable executor availability.

**Authority objects involved**

- QualifiedTransformation specification
- Model specification
- Policy specification
- input/output semantic contracts
- parameter/action semantics
- applicability/limitation contracts

**Required predecessors**

- C01
- C02

**Positive acceptance**

- Transformations declare exact input/output semantics, method, domain, uncertainty consequences and limitations;
- Models declare inputs/outputs, required evidence/state, parameter slots, conventions, calibration requirements and limitations;
- Policies declare decision type/action space, required outputs, threshold authority, operational constraints, human gate/fallback/abstention semantics;
- semantic specification versions remain unchanged when new executor implementations are merely registered;
- incompatible measurement/reference conventions fail compatibility unless a legal Transformation exists.

**Forbidden / nonclaim acceptance**

- Model/Policy/Transformation specs may not treat registered endpoint lists as semantic authority;
- Policy may not masquerade as Knowledge;
- Transformation may not create evidence/reality absent from its input authority;
- a model equation does not itself justify a user action.

---

## C11 — Implementation Identity and Specification Conformance

**Purpose**

Prove that an exact executable implementation version faithfully implements an exact Transformation/Model/Policy specification under stated execution conditions.

**Authority objects involved**

- Implementation
- ImplementationConformance
- Transformation/Model/Policy specification refs
- execution-environment/capability constraints

**Required predecessors**

- C10
- C01
- C02

**Positive acceptance**

- Implementation registration creates executable identity/version/hash only;
- separate immutable ImplementationConformance binds exact spec and exact implementation plus conformance method/test authority and limitations;
- multiple conforming implementations may exist for one spec without changing the spec version;
- RuntimeBinding can bind `Specification@hash + Implementation@hash + ImplementationConformance@hash`;
- nonconforming or expired/out-of-scope conformance fails runtime composition.

**Forbidden / nonclaim acceptance**

- endpoint registration is not conformance;
- implementation success on one fixture does not alter semantic specification;
- broker cannot rewrite spec semantics to make an implementation fit;
- first-party implementation receives no automatic authority advantage.

---

## C12 — Calibration Authority

**Purpose**

Provide legal, scoped, versioned calibration authority for model/transformation runtime use without laundering calibration into global scientific knowledge.

**Authority objects involved**

- CalibrationArtifact
- CalibrationProposal
- calibrated specification refs
- calibration evidence/method/scope/validity/diagnostics

**Required predecessors**

- C01
- C02
- C10

**Conditional predecessors**

- C06 when calibration evidence/target scope is represented through ADR context semantics

**Positive acceptance**

- CalibrationArtifact binds exact calibrated spec, parameter/value/distribution semantics, target/program/field scope, method, evidence refs, validity interval, limitations and qualification authority;
- an applicability result `CALIBRATION_REQUIRED` becomes runtime-eligible only when a valid applicable CalibrationArtifact is bound or an explicitly authorized calibration step produces separately qualified authority;
- CalibrationArtifact can expire/supersede without rewriting prior RuntimeBindings;
- evaluation can create CalibrationProposal but not qualified calibration directly.

**Forbidden / nonclaim acceptance**

- runtime assumptions cannot satisfy calibration authority;
- field calibration does not automatically become DerivedKnowledge/global agronomy;
- a model fit statistic alone does not grant deployment authority;
- Evaluation Plane cannot directly mutate/create qualified CalibrationArtifact.

---

## C13 — RuntimeProfile and Deployment Control Authority

**Purpose**

Separate reusable allowed runtime composition from where/how that composition is authorized and rolled out operationally.

**Authority objects involved**

- RuntimeProfile
- Deployment
- KnowledgeRelease
- transformation/model/policy constraints
- implementation/conformance constraints
- calibration constraints
- replay requirements
- runtime governance
- runtime environment
- rollout stage

**Required predecessors**

- C01
- C02
- C05
- C10

**Conditional predecessors**

- C11 when implementations are constrained/bound
- C12 when calibration requirements are used

**Positive acceptance**

- RuntimeProfile references one exact KnowledgeRelease while keeping model/policy/transformation/implementation constraints separately versioned;
- changing Model M5→M6 can create a new RuntimeProfile without creating a new unchanged KnowledgeRelease;
- Deployment applies an exact RuntimeProfile to authorized organization/program/target/decision scope and effective interval;
- `runtime_environment` (`DEVELOPMENT/STAGING/PRODUCTION`) is independent from `rollout_stage` (`DRAFT/SANDBOX/SHADOW/PILOT/PRODUCTION/SUSPENDED/DEPRECATED`);
- deployment entitlements and replay minima are enforceable at runtime.

**Forbidden / nonclaim acceptance**

- KnowledgeRelease may not carry rollout state;
- QUALIFIED knowledge is not automatically PRODUCTION deployed;
- `PILOT` cannot be used as technical runtime environment;
- Deployment cannot alter the semantic contents of referenced specifications/releases.

---

## C14 — Runtime Compiler and RuntimePlan DAG IR

**Purpose**

Compile DecisionProblem + frozen ContextManifest + active Deployment/RuntimeProfile + retrieved/applicable candidates into an explicit acyclic solving graph that exposes alternatives, dependencies and unresolved requirements.

**Authority objects involved**

- RuntimeCandidates
- RuntimePlan DAG
- DecisionProblem
- ContextManifest
- KnowledgeRetrievalResult
- ApplicabilityAssessments
- RuntimeProfile/Deployment
- specification/conformance/calibration candidates

**Required predecessors**

- C06
- C07
- C08
- C09
- C10
- C13

**Conditional predecessors**

- C11 for executable implementation candidate paths
- C12 for calibrated paths

**Positive acceptance**

- compiler is deterministic with respect to frozen authority inputs and compiler version;
- DAG nodes expose semantic inputs/outputs, dependencies, authority refs, candidate alternatives and unresolved requirements;
- multiple legal alternatives can coexist in Plan without being silently collapsed;
- current-binding dependency cycles are detected/rejected;
- changing a material authority input changes plan semantic identity/graph where relevant;
- Plan can be revised while solving without being mistaken for historical execution authority.

**Forbidden / nonclaim acceptance**

- RuntimePlan is not RuntimeBinding;
- plan may not consume outputs produced by the same binding to justify that binding's legality;
- missing inputs may not be invented;
- compiler may not qualify Knowledge or create Calibration authority.

---

## C15 — Information Requirement and Runtime Eligibility

**Purpose**

Make unresolved runtime needs explicit and separately decide whether any legal runtime world exists before any action claim is made.

**Authority objects involved**

- InformationRequirement
- InformationAcquisitionOption (optional)
- RuntimeEligibility
- RuntimePlan
- decision-materiality reasoning

**Required predecessors**

- C14

**Conditional predecessors**

- C12 for calibration-required resolution paths
- C11 for implementation/conformance-required paths

**Positive acceptance**

- unresolved required semantic dimensions create explicit InformationRequirements with reason, required-by refs, acceptable epistemic/provenance classes, semantic resolution and deadline;
- statuses support `OPEN`, `SATISFIED`, `UNSATISFIABLE`, `NO_LONGER_DECISION_MATERIAL`;
- RuntimeEligibility returns exactly `RUNTIME_ELIGIBLE`, `RUNTIME_ELIGIBLE_WITH_LIMITATIONS`, `INFORMATION_REQUIRED`, or `NO_LEGAL_RUNTIME`;
- `NO_LEGAL_RUNTIME` carries governed reason(s) such as conflict, no compatible model/policy, unauthorized knowledge, prohibited transform, dependency cycle or replay failure;
- satisfying information produces a new/further compilation context rather than mutating prior ContextManifest authority.

**Forbidden / nonclaim acceptance**

- RuntimeEligibility cannot claim ACT/WAIT;
- UNKNOWN must not be hidden behind scalar confidence;
- acquisition option is not evidence until an authorized ContextDatum/receipt exists;
- unresolved decision-material requirements cannot be silently ignored.

---

## C16 — Immutable RuntimeBinding

**Purpose**

Freeze one fully adjudicated legal runtime world with exact scientific, context, specification, calibration, implementation and governance authorities.

**Authority objects involved**

- RuntimeBinding
- DecisionProblem
- Deployment/RuntimeProfile/KnowledgeRelease
- ContextManifest
- exact knowledge bindings
- exact transformation/model/policy specifications
- CalibrationArtifacts where material
- Implementation + ImplementationConformance
- logical time/cutoffs/assumptions/limitations

**Required predecessors**

- C15
- C13

**Conditional predecessors**

- C11 when executable specifications are bound
- C12 when calibration is material

**Positive acceptance**

- Binding is created only from a legal, fully adjudicated selected world;
- exact versions/hashes for every material authority are frozen;
- unresolved alternatives never appear inside one RuntimeBinding;
- binding semantic hash is deterministic and changes if a material authority input changes;
- historical binding remains replay-addressable after newer knowledge/model/policy/deployment/calibration versions exist;
- replay can state exactly what was used, including limitations and assumptions.

**Forbidden / nonclaim acceptance**

- Binding does not prove scientific correctness;
- Binding cannot dynamically retrieve latest knowledge or model at execution time;
- unresolved InformationRequirement cannot be hidden as an assumption where authority requires resolution;
- ContextManifest cannot be replaced mid-binding.

---

## C17 — Runtime Execution and RuntimeDatum Semantics

**Purpose**

Execute or broker exact bound runtime nodes internally or externally while preserving specification conformance, exact inputs and portable semantic/epistemic output envelopes.

**Authority objects involved**

- RuntimeBinding
- Implementation
- ImplementationConformance
- RuntimeResult
- RuntimeDatum
- execution metadata/input hashes

**Required predecessors**

- C16
- C11

**Positive acceptance**

- broker dispatches only implementations conformant with bound specifications and execution constraints;
- internal and external execution produce normalized RuntimeResult bound to exact RuntimeBinding/node/implementation/conformance/input hashes;
- RuntimeDatum preserves semantic ID, value/unit, epistemic/provenance classes, effective interval/horizon, support and uncertainty as applicable;
- output semantic hash is deterministic for exact output semantics;
- a RuntimeDatum may enter a future ContextManifest only through normal context resolution/temporal rules.

**Forbidden / nonclaim acceptance**

- RuntimeDatum is not ContextDatum and cannot retroactively authorize its producing RuntimeBinding;
- successful HTTP response is not semantic conformance;
- broker cannot rewrite model/policy/transformation semantics;
- runtime output cannot be relabeled OBSERVATION merely because customer requested that shape.

---

## C18 — RuntimeAlternativeSet and Decision Robustness

**Purpose**

Define the governed universe/coverage of decision-material legal runtime worlds and determine whether materially equivalent decisions hold across that sufficiently covered set.

**Authority objects involved**

- RuntimeAlternativeSet
- RuntimeBinding(s)
- RuntimePlan snapshot
- material uncertainty/conflict dimensions
- inclusion/exclusion reasons
- completeness class
- RuntimeResults
- DecisionRobustness
- MaterialActionSignature

**Required predecessors**

- C14
- C16
- C17

**Positive acceptance**

- RuntimeAlternativeSet freezes included bindings, excluded candidates/reason codes, alternative-generation method, uncertainty dimensions and coverage semantics;
- completeness is one of `EXHAUSTIVE_ENUMERATION`, `BOUNDED_ENVELOPE`, `GOVERNED_COVERAGE`, `INCOMPLETE`;
- `ROBUST` can be returned only when coverage satisfies active RuntimeProfile/Policy robustness requirements;
- `INCOMPLETE` coverage cannot yield ROBUST;
- materially different actions such as IRRIGATE 10 mm vs 30 mm are distinguished through governed MaterialActionSignature even if both dispositions are ACT;
- action-changing uncertainty/conflict yields SENSITIVE/UNRESOLVED and supports ASK/ABSTAIN paths.

**Forbidden / nonclaim acceptance**

- evaluating a convenient subset does not prove robustness;
- comparing only ACT/WAIT labels is insufficient when action parameters matter;
- probability/confidence score cannot hide an uncovered legal alternative;
- conflict cannot be silently averaged to manufacture convergence.

---

## C19 — DecisionResult Authority

**Purpose**

When the active DecisionProblem authority mode permits ADR/external authorized policy decision ownership, produce one immutable structured decision result without conflating runtime legality with action authority.

**Authority objects involved**

- DecisionResult
- DecisionDisposition (`ACT`, `WAIT`, `ASK`, `ABSTAIN`)
- DecisionProblem/action contract
- Policy result/authority
- DecisionRobustness
- RuntimeAlternativeSet
- relevant RuntimeBindings
- InformationRequirements

**Required predecessors**

- C18
- C07
- C10

**Positive acceptance**

- ADR creates DecisionResult only when decision authority mode permits;
- ACT contains structured material action semantics, not generic ACT only;
- WAIT identifies governed wait/reevaluation semantics;
- ASK references exact decision-material InformationRequirement(s);
- ABSTAIN carries governed abstention reason authority;
- DecisionResult binds robustness, policy and runtime authority references and is immutable/replayable.

**Forbidden / nonclaim acceptance**

- `RUNTIME_ONLY` mode cannot fabricate DecisionResult;
- RuntimeEligibility alone cannot justify ACT/WAIT;
- two materially different ACT actions cannot be treated as the same result;
- ADR DecisionResult does not imply downstream human approval or machine execution authority.

---

## C20 — Outcome, Evaluation and Effect Attribution

**Purpose**

Import post-runtime evidence, evaluate Knowledge/Transport/Model/Policy/Execution/Commercial performance separately, and make causal claims only through explicit attribution authority.

**Authority objects involved**

- Outcome
- OutcomeEvaluation
- EffectAttributionAssessment
- CalibrationProposal
- KnowledgeRequalificationProposal
- TransformationRevisionProposal
- ModelRevisionProposal
- PolicyRevisionProposal

**Required predecessors**

- C01
- C06
- C16

**Conditional predecessors**

- C17 when runtime-execution results are evaluated
- C18/C19 when robustness/decision performance is evaluated

**Positive acceptance**

- Outcome ingestion preserves semantic/epistemic/provenance identity;
- evaluation separately reports Knowledge, Transport, Model, Policy, Execution and Commercial dimensions where supported;
- descriptive/associational evaluation does not claim causal effect;
- any explicit causal/effect attribution binds evaluation design, counterfactual basis, evidence, confounders, limitations and attribution authority in EffectAttributionAssessment;
- Evaluation produces proposals only; proposals re-enter Control Plane review to create future authority versions.

**Forbidden / nonclaim acceptance**

- favorable outcome does not prove ADR caused benefit;
- unfavorable outcome does not prove Knowledge is false;
- one successful field cannot automatically increase global knowledge authority;
- Evaluation Plane cannot directly mutate/create qualified Knowledge, CalibrationArtifact, Transformation, Model, Policy or Deployment.

---

## C21 — External Integration and SDK Surface

**Purpose**

Make ADR portable across GEOX, consultant software, seed/input-company systems and customer data/runtime stacks through stable public contracts rather than customer-schema coupling.

**Authority objects involved**

- public Context contracts
- DecisionProblem contract
- Runtime plan/binding/result read/write contracts
- Outcome contracts
- adapter identities
- service principals/authorization

**Required predecessors**

- C00
- C01
- C02
- C06
- C07

**Conditional predecessors**

- C17 for external Model/Policy/Transformation execution
- C20 for Outcome providers
- C19 for recommendation/workflow sinks

**Positive acceptance**

- a non-GEOX reference integration can provide ContextDatum/reference input and consume ADR runtime outputs through public contracts;
- GEOX adapter can be removed without public contracts changing;
- customer-specific schema mapping remains inside adapter/integration boundary;
- SDK/API preserves hashes, epistemic/provenance semantics and authorization context rather than flattening them;
- external executor path can prove exact Implementation/Conformance and result binding when used.

**Forbidden / nonclaim acceptance**

- public API cannot require GEOX DB/table concepts;
- adapter cannot contain hidden scientific transport rules;
- SDK convenience types cannot discard authority-critical fields;
- successful customer integration alone does not prove agronomic correctness.

---

## C22 — Agronomist Workbench / Review and Escalation Operations

**Purpose**

Expose scientific review, applicability reasoning, conflicts, missing information and field escalation as an efficient expert workflow while preserving the same backend authority boundaries.

**Authority objects involved**

- SourceArtifact/Claim/SourceContext
- qualification objects
- KnowledgeConflict/KnowledgeRelease
- DecisionProblem/ContextManifest
- ApplicabilityAssessment
- InformationRequirement/RuntimeEligibility
- DecisionRobustness/DecisionResult where present
- audit lineage

**Required predecessors**

Hard for applicability/escalation workbench:

- C04
- C05
- C06
- C07
- C08
- C09
- C15

Conditional for later decision/evaluation surfaces:

- C18
- C19
- C20

**Positive acceptance**

- expert can inspect source span/artifact, claim, origin context, qualification and lineage before approving scientific authority;
- applicability inspector explains source→target comparison, transforms/calibration requirements, limitations/conflicts and missing context;
- queue distinguishes no-review-needed candidate state from review-required causes without hiding blocked/unknown cases;
- actions in UI invoke the same qualification/deployment/runtime authorities as API paths and are fully audited;
- review workflow can measure review volume/time/reasons without using those metrics as scientific authority.

**Forbidden / nonclaim acceptance**

- UI override cannot silently mutate immutable authority objects;
- “accept recommendation” button cannot bypass qualification, applicability, runtime or decision authority;
- reduced review rate is not proof of false-safe quality;
- Workbench cannot become a parallel recommendation system.

---

## C23 — Enterprise Operations, Observability and Safety Operations

**Purpose**

Operate ADR as an enterprise platform while preserving authority semantics across failures, retries, asynchronous work, deployment changes and incident response.

**Authority objects involved**

Cross-cutting operational metadata around all Control/Runtime/Evaluation objects, including deployment state, job/run identity, audit, metrics, traces, failure classifications and retention controls. Operational metadata must not silently become semantic authority.

**Required predecessors**

- C00
- C01
- C02

Conditional predecessors:

- the capability being operated (C03–C22)

**Positive acceptance**

- idempotent/retry-safe asynchronous workflows cannot duplicate or mutate immutable authority objects;
- logs/traces identify exact authority refs/hashes without leaking tenant-private knowledge;
- operational health distinguishes provider/integration failure from scientific/runtime ineligibility;
- deployment suspension/rollback preserves historical RuntimeBindings and decisions;
- audit/retention policy preserves required replay classes and rights constraints;
- production observability can answer which KnowledgeRelease/RuntimeProfile/Deployment/ContextManifest/Binding produced a runtime event.

**Forbidden / nonclaim acceptance**

- retry success cannot overwrite a failed historical authority result;
- monitoring state cannot become agronomic evidence;
- operational feature flags cannot silently alter Knowledge/Model/Policy semantics;
- observability must not bypass tenant/IP visibility boundaries.

---

# 4. Dependency graph

The capability graph is not a single linear chain. The principal hard-dependency structure is:

```text
                         C00 Independence
                                │
                                ▼
                    C01 Identity/Replay/Audit
                         │              │
                         ▼              ▼
                    C02 IAM/IP       C07 DecisionProblem
                         │
          ┌──────────────┼──────────────────────────────┐
          │              │                              │
          ▼              ▼                              ▼
   C03 Source/Compile  C06 Context                  C10 Specs
          │              │                              │
          ▼              │                    ┌─────────┴─────────┐
   C04 Claim/Qualify      │                    ▼                   ▼
          │              │               C11 Impl/Conformance   C12 Calibration
          ▼              │
 C05 Derived/Conflict/KR  │
          │              │
          └──────┬───────┘
                 │
                 ▼
        C13 RuntimeProfile/Deployment
                 │
      ┌──────────┴──────────┐
      │                     │
      ▼                     ▼
 C08 Retrieval         C06+C07 context/problem
      │
      ▼
 C09 Transport/Applicability ◄──── C10 Transform authority
      │
      ▼
 C14 Runtime Compiler / Plan DAG
      │
      ▼
 C15 Info Requirement / Eligibility
      │
      ▼
 C16 RuntimeBinding
      │
      ▼
 C17 Execution / RuntimeDatum
      │
      ▼
 C18 RuntimeAlternativeSet / Robustness
      │
      ▼
 C19 DecisionResult
      │
      ▼
 C20 Outcome / Evaluation / Attribution
```

Cross-cutting/product surfaces:

```text
C21 External Integration / SDK
  spans public boundaries around C06/C07/C16/C17/C19/C20

C22 Agronomist Workbench
  first closes value around C04/C05/C06/C07/C08/C09/C15,
  later extends to C18/C19/C20

C23 Enterprise Operations
  spans all implemented capabilities without owning their scientific semantics
```

Important graph interpretation:

- C10 may be developed before or in parallel with C03–C06 because it is an independent Control Plane authority family.
- C13 can exist with an intentionally minimal RuntimeProfile; C11/C12 are conditional until a profile/runtime path actually binds executable implementations or calibration.
- C08 requires an exact KnowledgeRelease and active deployment/runtime-profile authority but does not require model execution.
- Therefore the first commercial applicability/escalation vertical slice does **not** logically require C16–C20.

---

# 5. Capability gates implied by the graph

These are capability closures, not version assignments.

## Gate F — Standalone Authority Foundation

Requires:

```text
C00 + C01 + C02
```

Proves ADR is an independent, multi-tenant, immutable authority system rather than a GEOX module.

## Gate K — Deployable Knowledge Authority

Requires:

```text
Gate F
+ C03 + C04 + C05
```

Proves exact SourceArtifact → candidate compile → source-faithful Claim/Origin Context → human qualification → governed derived/conflict handling → frozen KnowledgeRelease.

It does **not** prove field applicability.

## Gate A — Applicability / Escalation Core

Requires:

```text
Gate K
+ C06 + C07 + C10 + C13 + C08 + C09 + C14 + C15
```

The C14/C15 path at this gate may remain runtime-light: its purpose is to prove explicit missing-information/runtime-legality reasoning rather than full model execution.

Proves one exact DecisionProblem + ContextManifest can yield explainable source→target applicability and a legally classified escalation state without claiming ACT/WAIT.

This is the first capability gate that can support the commercial wedge:

```text
Company Agronomy
  ↓
thousands of targets
  ↓
NO_REVIEW_REQUIRED candidate flow
or
REVIEW_REQUIRED / INFORMATION_REQUIRED / CONFLICT
  ↓
explainable expert queue
```

`NO_REVIEW_REQUIRED` is a product/read-model classification only; it is not a new scientific/runtime authority state and must be derived from frozen applicability/runtime legality rules.

## Gate D — Decision Runtime

Requires:

```text
Gate A
+ C11 + C12 as used
+ C16 + C17 + C18 + C19
```

Proves exact executable worlds, results, sufficient alternative coverage, robustness and structured DecisionResult when authority mode permits.

## Gate E — Evaluation / Learning Loop

Requires:

```text
Gate D where decision path is evaluated
+ C20
```

Also supports descriptive evaluation of runtime-only/external-decision integrations where C19 is intentionally absent.

Proves outcomes can produce governed evaluations/proposals without authority laundering.

## Gate P — Enterprise Productization

Requires the relevant capability gates plus:

```text
C21 + C22 + C23
```

The exact subset depends on commercial surface; this map deliberately does not assign product versions yet.

---

# 6. Commercial-wedge implications without version slicing

The frozen architecture and this dependency graph support an early commercial value closure before full Decision Runtime or Evaluation Plane implementation.

The smallest capability-complete commercial proof is not “a registry plus some APIs.” It is the closed loop:

```text
Exact customer/company agronomy
        ↓
Qualified KnowledgeRelease
        ↓
Exact DecisionProblem
        ↓
Immutable ContextManifest
        ↓
Replayable KnowledgeRetrievalResult
        ↓
Source→Target Applicability
        ↓
Information/Runtime-legality classification
        ↓
Explainable agronomist escalation queue
```

The commercial KPI family may later include fields reviewed per agronomist, minutes per field, manual review rate, escalation precision, false-safe rate and acres per agronomist. Those KPI thresholds are **not** capability authority and are intentionally not frozen here; they belong in Version Slicing / Commercial Gates after the Master Task Line is derived.

This preserves the key distinction:

```text
capability completeness
≠
commercial KPI target
≠
scientific authority
```

---

# 7. Architecture contradiction check

Deriving this map exposed one planning-taxonomy omission (`DecisionProblem` as a dedicated capability) but no logical contradiction in Architecture v1.0.

Specifically, the graph can preserve all corrected authority seams without circular dependency:

```text
Control authority
  ↓
DecisionProblem + ContextManifest
  ↓
Retrieval
  ↓
Transport
  ↓
RuntimePlan
  ↓
RuntimeEligibility
  ↓
RuntimeBinding
  ↓
RuntimeAlternativeSet / Execution
  ↓
DecisionRobustness / DecisionResult
  ↓
OutcomeEvaluation
  ↓
proposal back to Control review only
```

No capability requires current-binding outputs to authorize the current binding. No Evaluation capability must mutate Control authority. No adapter requires scientific authority. No KnowledgeRelease needs Model/Policy rollout semantics.

Therefore:

**Architecture v1.0 remains closed. No `DEC-xxxx` architecture amendment is proposed by ADR-CAPABILITY-MAP-01.**

---

# 8. Next planning frontier after this map is accepted

This document intentionally does not create implementation tasks or assign product versions.

The next artifact should derive a real dependency-ordered Master Task Line from this capability graph. Task IDs should be created only after capability predecessors and capability acceptance gates are accepted, so historical task numbering cannot force architecture-invalid sequencing.

The required planning sequence remains:

```text
Architecture v1.0
      ↓
Capability Map               ← this document
      ↓
Dependency Graph             ← contained here, to be adjudicated
      ↓
Master Task Line
      ↓
Technical / Commercial Gates
      ↓
Version Slicing
```

Until this Capability Map is reviewed, no implementation task sequence should be treated as authoritative.
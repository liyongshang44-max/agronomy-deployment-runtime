# Agronomy Deployment Runtime — Domain Model v1.0

Status: **FROZEN**

This document freezes the semantic meaning, relationships and authority boundaries of the core domain objects in Agronomy Deployment Runtime (ADR).

## 1. Source

A `Source` is a stable, versioned knowledge-bearing artifact or publication identity.

Examples:

- scientific paper;
- extension bulletin;
- cultivar technical sheet;
- trial report;
- product label;
- regulatory document;
- agronomist protocol;
- farm protocol.

It answers: **where did this material come from?**

Authority: provenance only.

It cannot establish scientific truth, target applicability or runtime eligibility.

Core attributes include source identity, type, author/publisher, edition/version, publication date, artifact/content hash, rights/license and supersession lineage.

## 2. Claim

A `Claim` is the smallest source-faithful semantic assertion extracted from a Source.

It answers: **what did the source actually assert?**

Representative types:

- `SEMANTIC_DEFINITION`
- `PARAMETER`
- `RELATIONSHIP`
- `BIOLOGICAL_PATTERN`
- `CAUSAL_EFFECT`
- `STATISTICAL_ASSOCIATION`
- `MODEL_ASSUMPTION`
- `OPERATIONAL_RECOMMENDATION`
- `BOUNDARY_CONSTRAINT`
- `EVALUATION_CLAIM`

Authority: source assertion authority.

A Claim must never be rewritten to reflect later expert judgment. New judgment creates another authority object with lineage.

## 3. SourceContext

`SourceContext` describes the original scientific, empirical or operational context in which a Claim was observed, derived, studied or recommended.

Context families:

- Biological;
- Environmental;
- Management;
- Operational;
- Measurement;
- Jurisdiction/Economic.

Unknown dimensions are `NOT_REPORTED`, not guessed.

Authority: source-context authority.

It is a scientific object, not PDF metadata.

## 4. QualifiedKnowledge

`QualifiedKnowledge` is a Claim that has passed a governed qualification process for explicit scientific use purposes.

It answers: **what uses may ADR recognize this knowledge for?**

It binds:

- Claim reference;
- qualification authority;
- allowed uses;
- forbidden uses;
- limitations;
- known effect modifiers;
- semantic preconditions;
- transport constraints;
- qualification scope.

Authority: scientific-use authority.

Invariant:

```text
QUALIFIED ≠ RUNTIME_ELIGIBLE
```

## 5. DerivedKnowledge

`DerivedKnowledge` is a new governed assertion produced from one or more QualifiedKnowledge objects through an explicit derivation method.

Examples:

- governed synthesis;
- meta-analysis;
- parameter synthesis;
- calibrated knowledge;
- approved aggregation.

Every DerivedKnowledge must retain complete lineage and derivation-method identity.

Authority: derivation authority.

It must never impersonate a source Claim.

## 6. KnowledgeConflict

`KnowledgeConflict` represents incompatible qualified/derived assertions that compete for the same semantic role under overlapping applicability/use conditions.

Conflict cannot be silently averaged, overwritten, newest-wins selected or resolved by LLM preference.

Legal resolutions include:

- qualified synthesis;
- explicit precedence authority;
- calibration;
- human adjudication;
- preservation as multiple legal runtime alternatives.

## 7. KnowledgeRelease

`KnowledgeRelease` is an immutable frozen set of specific QualifiedKnowledge and DerivedKnowledge versions.

It answers: **which knowledge objects are recognized in this release?**

It does not contain Model, Policy, Implementation or rollout state.

Authority: release composition of scientific knowledge only.

## 8. DecisionProblem

`DecisionProblem` defines the question ADR is solving for a particular target and time.

It includes:

- decision type;
- target scope;
- logical time;
- decision horizon;
- objective;
- action space;
- constraints;
- use class;
- decision authority mode;
- decision deadline.

Authority: decision-scope authority.

It does not itself contain agronomic truth or action justification.

## 9. TargetContext

`TargetContext` is the conceptual real-world background in which knowledge is proposed for use.

It may include biological, environmental, management, operational, measurement and jurisdiction/economic dimensions.

It does not constitute a new mega-truth object. Actual runtime evaluation uses an immutable ContextManifest.

## 10. ContextDatum

`ContextDatum` is a portable semantic atom describing a target-context value with:

- semantic ID;
- value and unit;
- epistemic class;
- provenance class;
- effective time/interval;
- available-at time;
- spatial support;
- vertical support where relevant;
- temporal support;
- uncertainty representation;
- source reference;
- semantic hash.

A ContextDatum preserves what the value means and how it is known.

## 11. ContextManifest

`ContextManifest` is the immutable snapshot of ContextDatum identities and resolved external-reference receipts used by one runtime compilation.

It binds:

- DecisionProblem;
- target identity;
- logical time;
- evidence cutoff;
- exact datum hashes;
- exact resolution receipt hashes;
- manifest semantic hash.

Authority: context-resolution authority for that compilation.

It cannot upgrade State to Observation or Assertion to Fact-like authority.

## 12. ApplicabilityAssessment

`ApplicabilityAssessment` is the governed Source→Target transport assessment of a Knowledge object for a specific ContextManifest, DecisionProblem and use purpose.

Conceptually:

```text
Applicability = Transport(
  Knowledge,
  SourceContext,
  ContextManifest,
  UsePurpose,
  DecisionProblem
)
```

Transport statuses:

- `DIRECTLY_APPLICABLE`
- `APPLICABLE_WITH_GOVERNED_TRANSFORM`
- `CALIBRATION_REQUIRED`
- `BOUNDED_EXTRAPOLATION`
- `UNRESOLVED`
- `CONFLICT`
- `NOT_RELEVANT`

Authority: transport authority.

It may determine allowed use, required transformation/calibration, limitations and unresolved conditions. It cannot select a final action.

## 13. QualifiedTransformation

A `QualifiedTransformation` is an authorized method for converting one semantic representation into another.

It declares:

- input semantic contract;
- output semantic contract;
- method;
- applicability domain;
- uncertainty consequences;
- limitations;
- qualification authority;
- implementation identity where needed.

Authority: semantic transformation authority.

Transformation changes representation/semantics under governed rules; it cannot create missing reality or silently upgrade epistemic class.

## 14. Model

A `Model` is a versioned computational semantic specification converting legal inputs into states, forecasts, scenario outputs or other modeled results.

It declares:

- purpose;
- input/output contracts;
- evidence/state requirements;
- parameter slots;
- accepted knowledge classes;
- measurement conventions;
- applicability domain;
- calibration requirements;
- limitations;
- available implementations.

Authority: computational semantic authority.

It does not establish that reality must follow the model and does not by itself choose user action.

## 15. Policy

A `Policy` maps valid runtime/model outputs and operational constraints into candidate decision logic.

It declares:

- decision type;
- action space;
- required inputs/results;
- threshold authority;
- operational constraints;
- jurisdiction constraints where applicable;
- human gate;
- fallback;
- abstention conditions.

Authority: decision-logic authority.

Knowledge and Policy are not interchangeable.

## 16. ImplementationBinding

`ImplementationBinding` identifies an executable implementation of a Model, Policy or Transformation specification.

Examples:

- internal function;
- external HTTP service;
- customer runtime;
- GEOX runtime;
- batch job;
- WASM implementation.

Authority: implementation identity only.

Implementation cannot alter the semantic specification it implements.

## 17. RuntimeProfile

`RuntimeProfile` is a reusable versioned composition policy over:

- one KnowledgeRelease;
- transformation constraints;
- model constraints;
- policy constraints;
- implementation constraints;
- context requirements;
- replay requirements;
- runtime governance.

It contains no current TargetContext or current runtime result.

Authority: reusable deployment-composition policy.

## 18. Deployment

`Deployment` activates a RuntimeProfile for a specific environment, scope and lifecycle.

It binds:

- RuntimeProfile;
- deployment environment;
- authorized organization/program/tenant/cohort;
- crop/geography/decision scope;
- effective interval;
- entitlements;
- rollout state.

Authority: deployment authority.

Scientific qualification does not imply Deployment authorization.

## 19. RuntimeCandidates

`RuntimeCandidates` is the candidate set produced after retrieval and applicability evaluation under a RuntimeProfile/Deployment.

It may contain candidate:

- Knowledge;
- Transformations;
- Models;
- Policies;
- Implementations;
- runtime alternatives;
- information gaps.

Authority: candidate set only.

## 20. RuntimePlan

`RuntimePlan` is the Runtime Compiler's intermediate representation: a directed acyclic graph describing candidate ways to solve a DecisionProblem.

It may contain:

- unresolved alternatives;
- open InformationRequirements;
- replaceable candidates;
- blocked nodes;
- multiple legal branches.

Authority: execution-planning authority.

RuntimePlan is mutable/revisable solving state and must never be represented as the immutable executed world.

## 21. InformationRequirement

`InformationRequirement` describes a semantic input required to complete or distinguish a legal RuntimePlan.

It states:

- required semantic dimension;
- why required;
- required-by authority object/node;
- acceptable epistemic classes;
- acceptable provenance classes;
- acceptable resolution;
- deadline;
- decision materiality.

Statuses:

- `OPEN`
- `SATISFIED`
- `UNSATISFIABLE`
- `NO_LONGER_DECISION_MATERIAL`

Authority: information-need authority only.

It cannot generate the missing evidence itself.

## 22. RuntimeEligibility

`RuntimeEligibility` states whether at least one legal runtime world can be constructed under the current DecisionProblem, Deployment and ContextManifest.

Frozen states:

- `RUNTIME_ELIGIBLE`
- `RUNTIME_ELIGIBLE_WITH_LIMITATIONS`
- `INFORMATION_REQUIRED`
- `NO_LEGAL_RUNTIME`

Authority: runtime legality only.

It is not an action recommendation.

## 23. RuntimeBinding

`RuntimeBinding` is the immutable, fully adjudicated runtime world selected for one DecisionProblem.

It freezes exact references to:

- DecisionProblem;
- Deployment;
- RuntimeProfile;
- KnowledgeRelease;
- ContextManifest;
- Knowledge versions;
- Transformations;
- Models;
- Policies;
- Implementations;
- logical time and cutoffs;
- assumptions;
- limitations.

Authority: runtime-composition/replay authority.

It proves what was used. It does not prove scientific correctness.

## 24. RuntimeResult

`RuntimeResult` is the normalized output of executing one bound runtime node under a RuntimeBinding.

It binds:

- RuntimeBinding;
- node identity;
- implementation identity;
- exact input semantic hashes;
- output semantic identity/value;
- execution timestamp;
- output hash.

Authority: execution result record only.

## 25. DecisionRobustness

`DecisionRobustness` evaluates whether all remaining legal runtime worlds produce materially equivalent decision outcomes.

Robustness classes:

- `ROBUST`
- `SENSITIVE`
- `UNRESOLVED`

When ADR owns policy decision authority, final output is restricted to:

- `ACT`
- `WAIT`
- `ASK`
- `ABSTAIN`

`ASK` identifies the information whose resolution may change the decision.

Authority: robustness/action-stability authority.

It cannot silently resolve scientific conflicts.

## 26. Outcome

`Outcome` represents post-deployment reality/evidence relevant to evaluating the runtime decision and execution.

Examples:

- execution records;
- later field observations;
- yield/quality;
- commercial outcome;
- human disposition.

Outcome retains epistemic/provenance semantics and cannot automatically rewrite earlier authority.

## 27. OutcomeEvaluation

`OutcomeEvaluation` assesses a RuntimeBinding/decision/execution against later outcomes.

It separates:

- Knowledge Evaluation;
- Transport Evaluation;
- Model Evaluation;
- Policy Evaluation;
- Execution Evaluation;
- Commercial Evaluation.

Authority: evaluation evidence authority.

It may produce proposals but cannot directly mutate Knowledge, Transformation, Model, Policy or Deployment authority.

## 28. RevisionProposal

A `RevisionProposal` is a governed proposal arising from evaluation.

Types include:

- CalibrationProposal;
- KnowledgeRequalificationProposal;
- TransformationRevisionProposal;
- ModelRevisionProposal;
- PolicyRevisionProposal.

A proposal must return to the appropriate Control Plane review process before a new authority version exists.

# 29. Relationship graph

```text
Source
  │
  ├────► Claim ─────► SourceContext
  │          │
  │          ▼
  │    Qualification
  │          │
  │          ▼
  │  QualifiedKnowledge
  │          │
  │          ├──────────────► KnowledgeConflict
  │          │
  │          ▼
  │   DerivedKnowledge
  │          │
  │          ▼
  │   KnowledgeRelease
  │
══════════════════════════════════════════════════

RuntimeProfile ─────► Deployment
      ▲                   │
      │                   │
KnowledgeRelease          │
Transformations           │
Models                    │
Policies                  │
Implementations           │
                          │
DecisionProblem           │
      │                   │
TargetContext inputs      │
      │                   │
      ▼                   │
ContextManifest           │
      │                   │
      ├──────────────┐    │
      │              │    │
      ▼              ▼    ▼
Knowledge Retrieval + Deployment/Profile constraints
              │
              ▼
       Applicability
              │
              ▼
      RuntimeCandidates
              │
              ▼
       RuntimeCompiler
              │
              ▼
       RuntimePlan DAG
              │
              ▼
 InformationRequirements
              │
              ▼
     RuntimeEligibility
              │
              ▼
       RuntimeBinding
              │
              ▼
    Implementation Execution
              │
              ▼
        RuntimeResults
              │
              ▼
     DecisionRobustness
              │
      ACT / WAIT / ASK / ABSTAIN
              │
              ▼
     External workflow/execution
              │
              ▼
            Outcome
              │
              ▼
      OutcomeEvaluation
              │
              ▼
       RevisionProposals
```

# 30. Authority matrix

| Object | May decide | Must not decide |
|---|---|---|
| Source | provenance/version | scientific truth/runtime use |
| Claim | source assertion | ADR acceptance |
| SourceContext | source study/use conditions | target compatibility |
| QualifiedKnowledge | permitted scientific uses | current field applicability |
| DerivedKnowledge | governed new assertion | rewrite source claim |
| KnowledgeRelease | frozen recognized knowledge set | model/policy/deployment |
| DecisionProblem | question/scope/horizon | agronomic answer |
| ContextDatum | portable semantic value identity | cross-semantic inference |
| ContextManifest | exact context snapshot | create new truth |
| ApplicabilityAssessment | Source→Target use eligibility | action selection |
| Transformation | governed semantic conversion | fabricate missing reality |
| Model | computational semantics | final user action |
| Policy | decision logic | fabricate state/evidence |
| Implementation | executable implementation identity | alter specification semantics |
| RuntimeProfile | reusable legal composition constraints | current runtime world |
| Deployment | rollout/use authorization | scientific truth |
| RuntimePlan | candidate solving graph | historical runtime authority |
| InformationRequirement | missing decision-relevant information | generate the information |
| RuntimeEligibility | existence of legal runtime | ACT/WAIT judgment |
| RuntimeBinding | exact used runtime world | correctness proof |
| RuntimeResult | execution output | scientific validation |
| DecisionRobustness | decision stability across legal worlds | silent scientific adjudication |
| OutcomeEvaluation | post-runtime evidence/evaluation | authority mutation |

# 31. Permanent domain invariants

1. Source is not Claim.
2. Claim is not QualifiedKnowledge.
3. QualifiedKnowledge is not DerivedKnowledge.
4. SourceContext is not TargetContext.
5. TargetContext is not ContextManifest.
6. KnowledgeRelease is not RuntimeProfile.
7. RuntimeProfile is not Deployment.
8. RuntimePlan is not RuntimeBinding.
9. RuntimeEligibility is not Decision.
10. Knowledge, Transformation, Model, Policy and Implementation are distinct authority domains.
11. Compiler may propose but may not self-qualify.
12. Adapter may translate but may not grant scientific/transport authority.
13. Applicability is always target-, purpose- and decision-specific.
14. Semantic transformations require explicit authority.
15. Scientific conflict cannot be silently resolved.
16. Current runtime outputs cannot justify the binding that created them.
17. RuntimeBinding guarantees reproducibility, not correctness.
18. Decision uncertainty is handled through legal alternatives/robustness, not a universal confidence percentage.
19. Outcome produces evaluation/proposal, not automatic authority updates.
20. Historical authority objects remain exactly replayable to the degree declared by their replay class.

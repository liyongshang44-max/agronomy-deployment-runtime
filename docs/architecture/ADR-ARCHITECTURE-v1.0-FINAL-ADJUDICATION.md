# Agronomy Deployment Runtime — Architecture v1.0 Final Adjudication

Status: **FROZEN / NORMATIVE**

Date: 2026-08-15

This document records the final cross-document consistency adjudication for the Agronomy Deployment Runtime standalone product architecture before the v1.0 architecture baseline is merged.

It is not a new architecture layer. It closes authority seams discovered while reviewing the Repository Constitution, Domain Model, Complete Component Architecture, Agronomic Context & Public Runtime Contract, Standalone Product Architecture and independent-product decision record as one system.

## 0. Authority precedence

The existing v1.0 architecture documents remain authoritative **as amended by this document**.

Where any prior v1.0 text conflicts with a rule below, this document supersedes only that conflicting clause. Non-conflicting definitions remain unchanged.

The final v1.0 architecture authority set is therefore:

1. Repository Constitution v1.0;
2. Domain Model v1.0;
3. Complete Component Architecture v1.0;
4. Agronomic Context & Public Runtime Contract v1.0;
5. Standalone Product Architecture v1.0;
6. DEC-0001 Independent Product Boundary;
7. this Final Adjudication.

The purpose of this precedence rule is to preserve the review history without leaving duplicate or ambiguous authority.

---

# 1. Source and SourceArtifact are separate authority objects

The previous definition that allowed `Source` to mean either a publication identity or a content-bearing artifact is superseded.

## Source

`Source` is the logical identity of a knowledge-bearing work, publication, protocol, label, trial report, cultivar document, regulatory document or equivalent source authority.

It may carry bibliographic/version/edition lineage, ownership and rights metadata, but it is **not** the exact bytes compiled by the Scientific Compiler.

Authority: logical provenance and source-version identity.

## SourceArtifact

`SourceArtifact` is an immutable content-bearing materialization of an exact Source version or edition.

Examples include:

- a PDF file;
- a retained HTML snapshot;
- a scanned document;
- a machine-readable label edition;
- a retained structured export.

A SourceArtifact binds at least:

- `source_ref`;
- artifact/media type;
- acquisition/retrieval metadata;
- exact content hash;
- retention identity;
- artifact version/materialization identity.

Authority: exact source-material identity.

The Scientific Compiler must compile an exact `SourceArtifact@content_hash`, not a mutable Source URL or logical Source identity alone.

A Claim therefore has both provenance relationships where relevant:

```text
Claim ASSERTED_BY Source
Claim COMPILED_FROM SourceArtifact@content_hash
```

SourceContext locators must ultimately resolve to the exact SourceArtifact materialization from which the context was established.

Invariant:

```text
Source ≠ SourceArtifact ≠ Claim
```

---

# 2. Specification, Implementation and ImplementationConformance are separate

The previous clauses allowing Model, Policy or QualifiedTransformation specifications to contain authoritative lists of "available implementation bindings" are superseded.

A semantic specification must not be version-bumped merely because another executor becomes available.

## Specification authority

`Model`, `Policy` and `QualifiedTransformation` remain immutable semantic specifications.

They declare what computation/decision/transformation means, including input/output contracts and limitations. They do not own mutable implementation availability.

## Implementation

`Implementation` is an executable artifact/service identity and version.

Examples:

- internal executable;
- HTTP service;
- customer runtime;
- GEOX runtime;
- WASM module;
- batch executor.

Registration establishes identity and execution metadata only.

Registration does **not** establish that an implementation faithfully implements a semantic specification.

## ImplementationConformance

`ImplementationConformance` is a first-class immutable authority relation proving that an exact Implementation version is qualified to implement an exact Model, Policy or QualifiedTransformation specification version under stated conditions.

It binds at least:

- `specification_ref` and semantic hash;
- `implementation_ref` and artifact/runtime identity hash;
- conformance method/test authority;
- qualified execution environment/capabilities;
- known limitations;
- qualification status/version;
- semantic hash.

Authority: specification-to-implementation conformance only.

A RuntimeProfile may constrain acceptable implementation/conformance attributes, but it must not cause Model/Policy/Transformation specifications to embed mutable implementation lists.

A RuntimeBinding that executes a specification must bind:

```text
Specification@version/hash
Implementation@version/hash
ImplementationConformance@version/hash
```

Invariant:

```text
Specification ≠ Implementation ≠ ImplementationConformance
```

---

# 3. DerivedKnowledge requires its own governed origin context

`SourceContext` is permanently reserved for the original context of a source-faithful Claim.

A `DerivedKnowledge` object synthesized from multiple QualifiedKnowledge objects must not pretend to have one arbitrary input SourceContext.

## DerivedKnowledgeContext

`DerivedKnowledgeContext` is the governed applicability/origin context of a DerivedKnowledge assertion produced by its derivation method.

It must retain lineage to:

- all material input QualifiedKnowledge objects;
- their SourceContexts;
- the derivation method;
- any context restrictions introduced by synthesis, aggregation or calibration;
- unresolved context heterogeneity and limitations.

Authority: the declared valid origin/applicability domain of that DerivedKnowledge assertion.

For transport purposes, the source-side context is therefore generalized as `KnowledgeOriginContext`:

```text
QualifiedKnowledge → SourceContext
DerivedKnowledge   → DerivedKnowledgeContext
```

The transport function is normatively interpreted as:

```text
Transport(
  Knowledge,
  KnowledgeOriginContext,
  ContextManifest,
  UsePurpose,
  DecisionProblem
)
```

This does not collapse SourceContext and DerivedKnowledgeContext into one authority type.

Invariant:

```text
SourceContext ≠ DerivedKnowledgeContext ≠ TargetContext ≠ ContextManifest
```

---

# 4. Calibration is a first-class runtime authority, not hidden Knowledge

The existing `CALIBRATION_REQUIRED` applicability state requires a legal object capable of satisfying it. Runtime assumptions are not sufficient authority.

## CalibrationArtifact

`CalibrationArtifact` is a versioned, scope-bounded authority object describing an approved model-specific or transformation-specific calibration.

It binds at least:

- calibrated specification reference/version/hash;
- parameter/value/distribution semantics;
- target/program/field applicability scope;
- calibration evidence/data references;
- fitting/calibration method reference;
- calibration interval and effective/validity interval;
- uncertainty and fit diagnostics where available;
- limitations;
- review/qualification authority;
- semantic hash.

Authority: scoped calibration authority only.

Ordinary field/model calibration does **not** automatically become scientific Knowledge or DerivedKnowledge.

If a calibration result is later proposed as generalizable agronomic knowledge, it must enter the normal Scientific Control Plane qualification/synthesis process as a new candidate authority object.

`CALIBRATION_REQUIRED` can become runtime-eligible only when either:

1. an applicable qualified CalibrationArtifact is bound; or
2. the RuntimePlan contains an authorized calibration step whose result is separately qualified for the binding being created.

RuntimeProfile may constrain acceptable calibrations. RuntimeBinding must include exact `calibration_bindings` when calibration is material to runtime legality.

Evaluation may produce a `CalibrationProposal`; it may not silently create or mutate a qualified CalibrationArtifact.

Invariant:

```text
DerivedKnowledge ≠ CalibrationArtifact
```

---

# 5. Knowledge retrieval is replayable but has no scientific authority

The informal `CandidateKnowledgeSet` output is promoted to a first-class immutable runtime-provenance object named `KnowledgeRetrievalResult`.

It binds at least:

- DecisionProblem reference;
- Deployment/RuntimeProfile reference;
- exact KnowledgeRelease reference/hash;
- retrieval engine/version;
- retrieval configuration/query semantics;
- index/corpus snapshot identity where applicable;
- candidate knowledge references returned;
- retrieval filters/limits relevant to reproducibility;
- semantic hash.

Authority: candidate-discovery provenance only.

It does not qualify knowledge and does not determine applicability.

The legal chain is:

```text
KnowledgeRelease
→ KnowledgeRetrievalResult
→ ApplicabilityAssessment(s)
→ RuntimeCandidates
→ RuntimePlan
```

Historical replay must be able to distinguish:

- "the correct knowledge was retrieved but applicability was wrong" from
- "the relevant knowledge never entered the candidate set".

---

# 6. Robustness requires a frozen RuntimeAlternativeSet

`DecisionRobustness` must never claim robustness merely because the executor happened to evaluate a convenient subset of alternatives.

## RuntimeAlternativeSet

`RuntimeAlternativeSet` is an immutable authority object defining the decision-material legal runtime worlds admitted to one robustness evaluation.

It binds at least:

- DecisionProblem;
- ContextManifest;
- Deployment/RuntimeProfile;
- RuntimePlan snapshot/version/hash;
- Runtime Compiler/version and alternative-generation method;
- material uncertainty/conflict dimensions;
- included RuntimeBinding references;
- excluded candidate alternatives with governed exclusion reason codes;
- coverage semantics;
- completeness class;
- semantic hash.

Frozen completeness classes:

- `EXHAUSTIVE_ENUMERATION` — all discrete alternatives under the declared bounded domain are enumerated;
- `BOUNDED_ENVELOPE` — continuous/large spaces are represented by a governed envelope sufficient for the declared robustness method;
- `GOVERNED_COVERAGE` — a qualified coverage/sampling rule has been applied;
- `INCOMPLETE` — the current set is not sufficient to establish robustness.

`ROBUST` may be returned only if the RuntimeAlternativeSet completeness/coverage satisfies the active RuntimeProfile/Policy robustness requirement.

If coverage is insufficient, DecisionRobustness must return `UNRESOLVED` or lead to `ASK`/`ABSTAIN`; it may not return `ROBUST`.

Invariant:

```text
RuntimePlan ≠ RuntimeAlternativeSet ≠ RuntimeBinding
```

DecisionRobustness must bind the exact `RuntimeAlternativeSet@semantic_hash` it evaluated.

---

# 7. DecisionDisposition and DecisionResult are separate

The four values `ACT / WAIT / ASK / ABSTAIN` are dispositions, not complete action semantics.

## DecisionDisposition

Frozen values remain:

- `ACT`;
- `WAIT`;
- `ASK`;
- `ABSTAIN`.

They describe the system's disposition toward the DecisionProblem.

## DecisionResult

`DecisionResult` is a first-class immutable decision authority object when ADR or an authorized external policy owns decision authority.

It binds at least:

- `decision_id`;
- DecisionProblem;
- decision authority mode and authority reference;
- DecisionDisposition;
- selected/material action semantics where disposition is `ACT`;
- wait semantics/next evaluation condition where disposition is `WAIT`;
- InformationRequirement references where disposition is `ASK`;
- abstention reason authority where disposition is `ABSTAIN`;
- Policy result references;
- DecisionRobustness reference;
- RuntimeAlternativeSet and relevant RuntimeBinding references;
- decided-at time;
- semantic hash.

An `ACT` DecisionResult must express the structured action from the DecisionProblem/Policy action contract. It may not collapse materially different actions into one generic ACT value.

Example:

```text
IRRIGATE 10 mm ≠ IRRIGATE 30 mm
```

even though both have `DecisionDisposition = ACT`.

## Material action equivalence

DecisionRobustness compares a governed `MaterialActionSignature`, not only the four DecisionDisposition values.

Material equivalence is defined by the DecisionProblem action space and Policy action-equivalence contract, including decision-material amount/timing/constraints.

Invariant:

```text
RuntimeEligibility ≠ DecisionDisposition ≠ DecisionResult
```

For `decision_authority_mode = RUNTIME_ONLY`, ADR may stop at runtime legality/results and must not fabricate a DecisionResult.

---

# 8. RuntimeResult must preserve semantic/epistemic envelopes

The previous bare `semantic_id + value + unit` RuntimeResult example is insufficient and is superseded.

## RuntimeDatum

`RuntimeDatum` is the semantic output atom of a runtime node. It reuses the portable semantic envelope discipline of ContextDatum while preserving runtime-output lineage.

It includes as applicable:

- semantic ID;
- value and unit;
- epistemic class;
- provenance class (`MODEL`, `PLATFORM` or other truthful execution provenance);
- effective/valid interval;
- forecast reference time/horizon where relevant;
- spatial support;
- vertical support;
- temporal support;
- uncertainty representation;
- RuntimeBinding reference;
- runtime node reference;
- Implementation and ImplementationConformance references;
- output semantic hash.

A RuntimeResult contains one or more RuntimeDatum objects plus execution metadata and exact input hashes.

RuntimeDatum does not become input authority for the same RuntimeBinding that produced it.

A RuntimeDatum may enter a **future** ContextManifest only through normal context resolution, temporal checks and epistemic rules.

Invariant:

```text
ContextDatum ≠ RuntimeDatum
```

They may share a semantic envelope but have different authority lineage.

---

# 9. Outcome is not causal effect

The existing rule that a poor Outcome does not prove incorrect Knowledge is strengthened symmetrically.

Permanent invariant:

```text
Outcome ≠ CausalEffect
```

A favorable outcome does not prove that the ADR decision caused the improvement. An unfavorable outcome does not prove that the Knowledge, transport, Model or Policy caused the deterioration.

## OutcomeEvaluation requirements

OutcomeEvaluation must state, where it makes any effect claim:

- evaluation design;
- counterfactual basis;
- attribution class;
- known confounders;
- attribution limitations.

## EffectAttributionAssessment

Any explicit causal/effect attribution beyond descriptive association must be represented by a first-class `EffectAttributionAssessment` or an equivalent qualified evaluation object.

It binds the evaluation design, counterfactual basis, evidence, confounding limitations and attribution authority.

Without such authority, OutcomeEvaluation is descriptive/associational only and may not raise scientific qualification authority.

Evaluation still produces proposals only; it cannot directly mutate Knowledge, Transformation, Calibration, Model, Policy or Deployment authority.

---

# 10. Deployment runtime environment and rollout stage are orthogonal

The prior public-contract example `environment: PILOT` is superseded because `PILOT` is a rollout stage, not an execution environment.

Deployment must distinguish:

```text
runtime_environment:
  DEVELOPMENT | STAGING | PRODUCTION

rollout_stage:
  DRAFT | SANDBOX | SHADOW | PILOT | PRODUCTION | SUSPENDED | DEPRECATED
```

The two values answer different questions:

- runtime environment: **which technical execution environment is this deployment using?**
- rollout stage: **how much operational authority/exposure has this deployment been granted?**

Invariant:

```text
RuntimeEnvironment ≠ RolloutStage
```

---

# 11. Decision-record namespace is DEC, not ADR

`ADR` remains the product abbreviation and the public contract namespace (`adr.*`).

Architecture/product decision records use the `DEC-xxxx` namespace to avoid collision with the industry-standard abbreviation "Architecture Decision Record" and with the product abbreviation itself.

The independent-product-boundary decision is therefore normatively identified as:

```text
DEC-0001 — Independent Product Boundary
```

Future decision files must use `DEC-xxxx`.

---

# 12. Corrected plane ownership

The following ownership additions are normative.

## Knowledge Control Plane

Owns:

- Source;
- SourceArtifact;
- Claim / SourceContext;
- QualifiedKnowledge;
- DerivedKnowledge / DerivedKnowledgeContext;
- KnowledgeRelease;
- QualifiedTransformation;
- Model;
- Policy;
- Implementation;
- ImplementationConformance;
- qualified CalibrationArtifact;
- RuntimeProfile;
- Deployment.

It does not own TargetContext truth, runtime outputs or Outcome attribution.

## Deployment Runtime Plane

Owns runtime provenance/composition objects including:

- DecisionProblem;
- ContextManifest / reference receipts;
- KnowledgeRetrievalResult;
- ApplicabilityAssessment;
- RuntimeCandidates;
- RuntimePlan;
- InformationRequirement;
- RuntimeEligibility;
- RuntimeBinding;
- RuntimeAlternativeSet;
- RuntimeResult / RuntimeDatum;
- DecisionRobustness;
- DecisionResult where decision authority is present.

It cannot qualify Knowledge, silently create Calibration authority, or mutate Control Plane specifications.

## Evaluation Plane

Owns:

- Outcome ingestion;
- OutcomeEvaluation;
- EffectAttributionAssessment where causality is claimed;
- revision/calibration/requalification proposals.

It cannot directly create a new qualified Knowledge, CalibrationArtifact, Transformation, Model or Policy version.

---

# 13. Corrected end-to-end authority chain

The v1.0 chain is normatively interpreted as:

```text
Source
  ↓
SourceArtifact
  ↓
Scientific Compile
  ↓
Claim + SourceContext
  ↓
Qualification
  ↓
QualifiedKnowledge
  ├───────────────┐
  ↓               │
DerivedKnowledge  │
+ DerivedKnowledgeContext
  ↓               │
KnowledgeRelease  │
                  │
RuntimeProfile ← Transformations / Models / Policies
      ↑          Implementations + Conformance
      ↑          Calibration constraints
      │
Deployment
      │
DecisionProblem + external TargetContext inputs
      ↓
ContextManifest
      ↓
KnowledgeRetrievalResult
      ↓
Transport / Applicability
      ↓
RuntimeCandidates
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
RuntimeResult / RuntimeDatum
      ↓
DecisionRobustness
      ↓
DecisionResult (when authority mode permits)
      ↓
ACT / WAIT / ASK / ABSTAIN disposition + structured action semantics
      ↓
external workflow / execution
      ↓
Outcome
      ↓
OutcomeEvaluation
      ├→ EffectAttributionAssessment when causal claims are made
      ↓
Revision / Calibration / Requalification Proposals
      ↓
Control Plane review
```

`RuntimeAlternativeSet` may be assembled after the concrete RuntimeBindings it references are compiled; the ordering above denotes the authority dependency for robustness, not a requirement to create an empty alternative set before binding materialization.

---

# 14. Additional permanent invariants

The original v1.0 invariants remain in force. The following are added:

1. `Source ≠ SourceArtifact`.
2. A compiler job binds exact SourceArtifact content, not merely a Source URL/identity.
3. `SourceContext ≠ DerivedKnowledgeContext`.
4. DerivedKnowledge may not silently inherit one arbitrary input SourceContext.
5. `Specification ≠ Implementation ≠ ImplementationConformance`.
6. Registration of an implementation is not conformance qualification.
7. `DerivedKnowledge ≠ CalibrationArtifact`.
8. `CALIBRATION_REQUIRED` cannot be cleared by an undocumented runtime assumption.
9. `KnowledgeRetrievalResult` has replay provenance but no scientific authority.
10. `RuntimePlan ≠ RuntimeAlternativeSet ≠ RuntimeBinding`.
11. Robustness must bind a declared alternative universe and coverage/completeness semantics.
12. Incomplete alternative coverage cannot yield `ROBUST`.
13. `DecisionDisposition ≠ DecisionResult`.
14. Decision robustness compares material action semantics, not only ACT/WAIT/ASK/ABSTAIN labels.
15. RuntimeDatum must preserve epistemic/time/space/uncertainty semantics.
16. Current-binding RuntimeDatum cannot justify its own binding.
17. `Outcome ≠ CausalEffect`.
18. Causal attribution requires explicit evaluation authority and counterfactual/confounding semantics.
19. `RuntimeEnvironment ≠ RolloutStage`.
20. Decision records use `DEC-xxxx`; `ADR` remains the product/contract namespace.

---

# 15. Consistency-review disposition

The final consistency review found no remaining architecture-level reason to merge Control, Runtime or Evaluation authority, no dependency requiring GEOX as host, and no cycle that permits current runtime outputs to self-authorize their own binding.

The substantive seams found in review are closed by Sections 1–10 above.

After this adjudication is part of PR #1, the architecture may be treated as **v1.0 FROZEN** and implementation/version sequencing may proceed without reopening these authority boundaries except through an explicit future architecture decision.
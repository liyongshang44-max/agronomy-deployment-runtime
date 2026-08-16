# ADR v0.1 — Gate A Applicability / Agronomist Escalation Proof

Status: **IMPLEMENTATION CLOSURE / NON-ARCHITECTURE-AUTHORITY**

Baseline: `main @ fe38c6528be8e854ac3a97a6c404a4f6ee443112`

Gate A is an integration closure over existing authority. It introduces no new domain authority object, IAM permission, scientific rule, RuntimeEligibility state or decision authority.

## 1. Frozen predecessor interpretation

Gate A closes the currently exercised non-transform path:

```text
Gate K
+ MTL-A01..A08
+ MTL-A10
+ MTL-A11
```

`MTL-A09` remains conditional and is not required because this proof does not claim `APPLICABLE_WITH_GOVERNED_TRANSFORM` or bind a QualifiedTransformation.

The proof uses the already-frozen minimal RuntimeProfile/Deployment path and does not fabricate unused Model, Policy, Implementation or Calibration authority.

## 2. End-to-end proof

The executable Gate-A fixture must close one exact authority world through:

```text
Source / SourceArtifact
→ Claim + SourceContext
→ ScientificQualificationDecision
→ QualifiedKnowledge
→ KnowledgeRelease
→ RuntimeProfile
→ Deployment
→ DecisionProblem
→ ContextManifest
→ KnowledgeRetrievalResult
→ ApplicabilityAssessment
→ escalation read model
→ Agronomist Workbench case
```

The workbench projection must retain exact references back through the chain rather than copying human-readable values as substitute authority.

## 3. Required dispositions in closure acceptance

Gate-A integration acceptance proves at minimum:

- exact qualified source/target match can reach `DIRECTLY_APPLICABLE` and a non-authority `NO_REVIEW_CANDIDATE` workflow classification;
- missing decision-material context remains `UNRESOLVED` and enters `CONTEXT_GAP` / expert review;
- known hard source/target mismatch remains `CONFLICT` and enters `KNOWLEDGE_CONFLICT` / expert review;
- the core path does not fabricate the conditional governed-transformation path.

The detailed A08 suite remains authoritative for the full frozen transport vocabulary including calibration, bounded extrapolation and not-relevant cases.

## 4. Permanent nonclaims

A successful Gate-A closure proves applicability/escalation workflow composition only.

It must not create or imply:

```text
RuntimeEligibility
RuntimeBinding
DecisionRobustness
DecisionResult
ACT
WAIT
ASK
ABSTAIN
SAFE
recommendation correctness
agronomic effectiveness
causal benefit
commercial success
```

`NO_REVIEW_CANDIDATE` remains a derived product classification. It is not `SAFE`, RuntimeEligibility or a decision.

Gate A also does not prove v0.3 commercial success. Pilot review-volume, false-safe, integration/support burden and paid-continuation metrics remain later empirical product evidence.

## 5. Acceptance wiring

Root CI includes:

```text
npm run test:gate-a
```

with:

- `acceptance/gate-a/run.mjs` — exact end-to-end closure and fail-conservative examples;
- `acceptance/gate-a/integrity.mjs` — downstream-authority/nonclaim isolation.

Gate A may be declared closed only after exact feature-head CI, exact current merge-candidate CI, merge, and exact resulting `main` CI are all green.

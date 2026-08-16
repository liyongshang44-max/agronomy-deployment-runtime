# ADR v0.1 — MTL-A10 Explainable Escalation Classification / Read Model

Status: **IMPLEMENTATION CONTRACT / NON-ARCHITECTURE-AUTHORITY**

Baseline: `main @ 6813e36bac7dfc9421860f167fc669d2bb92d346`

Upstream authority remains Architecture v1.0, Capability Map 01, Master Task Line 01 and Version Slicing 01.

## 1. Scope

A10 projects already-validated applicability/runtime-control provenance into an Agronomist workflow classification.

It is deliberately a **read model**, not a new authority object.

```text
DecisionProblem
+ ContextManifest
+ KnowledgeRetrievalResult
+ ApplicabilityAssessment
+ Deployment / RuntimeProfile / KnowledgeRelease refs
→ deterministic workflow projection
```

A10 calls the existing A08 validator before projecting. It does not `ledger.publish()`, create lineage, mutate ApplicabilityAssessment, or establish RuntimeEligibility/DecisionResult.

## 2. Frozen product taxonomy

Version Slicing 01 freezes the v0.3 pilot output taxonomy as:

```text
NO_REVIEW_CANDIDATE
AGRONOMIST_REVIEW_REQUIRED
CONTEXT_GAP
KNOWLEDGE_CONFLICT
CALIBRATION_NEEDED
GOVERNED_TRANSFORM_NEEDED
```

This implementation uses those exact identifiers.

They are workflow classifications only.

Permanent non-equivalences:

```text
NO_REVIEW_CANDIDATE ≠ SAFE
NO_REVIEW_CANDIDATE ≠ ACT
NO_REVIEW_CANDIDATE ≠ RuntimeEligibility
AGRONOMIST_REVIEW_REQUIRED ≠ ABSTAIN
```

## 3. Classification rules

The projection never changes A08 authority. It maps the exact frozen A08 status conservatively:

- `CONFLICT` → `KNOWLEDGE_CONFLICT`;
- `CALIBRATION_REQUIRED` → `CALIBRATION_NEEDED`;
- `APPLICABLE_WITH_GOVERNED_TRANSFORM` → `GOVERNED_TRANSFORM_NEEDED`;
- `UNRESOLVED` with missing context → `CONTEXT_GAP`;
- other `UNRESOLVED` → `AGRONOMIST_REVIEW_REQUIRED`;
- `BOUNDED_EXTRAPOLATION` → `AGRONOMIST_REVIEW_REQUIRED`;
- `NOT_RELEVANT` → `NO_REVIEW_CANDIDATE` with explicit `NOT_DECISION_RELEVANT` reason;
- `DIRECTLY_APPLICABLE` → `NO_REVIEW_CANDIDATE` only when scientific use is `QUALIFIED`, decision relevance is `MATERIAL`, applicability runtime-use is `ALLOWED`, and no conflict/missing/unsupported/calibration/transform/limitation blocker remains;
- otherwise `DIRECTLY_APPLICABLE` still escalates to `AGRONOMIST_REVIEW_REQUIRED`.

Thus the product cannot lower review volume by hiding blockers.

## 4. Why-chain projection

Every projection carries exact refs sufficient to trace the workflow item back through:

```text
ApplicabilityAssessment
→ DecisionProblem
→ ContextManifest
→ KnowledgeRetrievalResult
→ Deployment
→ RuntimeProfile
→ KnowledgeRelease
→ Knowledge
→ KnowledgeOriginContext
```

The explanation section preserves A08 transport status, scientific-use status, decision relevance, applicability runtime-use disposition, condition results, missing context, calibration/transform requirements, limitations, conflicts and unsupported constraint codes.

## 5. Determinism and replay

The same exact authority world yields the same `projectionHash`.

`projectionHash` identifies this non-authority projection only; it is not an ADR semantic authority hash and is never published to the authority ledger by A10.

Current projection uses current A08/A07/A06 validity. Historical projection is available only through the existing `allowHistorical` validation path and therefore cannot rewrite prior authority after later revocation/suspension.

## 6. C22 boundary

A10 implements the applicability/escalation **read-model subset** needed before A11 and the v0.3 workload pilot.

It does **not** claim that full C22 Workbench capability is closed. C22's later runtime-legality surfaces still depend on C15/RuntimeEligibility, and later decision/evaluation surfaces remain conditional on their own authorities.

## 7. Explicit nonclaims

A10 does not create or alter:

- Knowledge qualification;
- ApplicabilityAssessment;
- CalibrationArtifact;
- QualifiedTransformation;
- RuntimePlan;
- InformationRequirement;
- RuntimeEligibility;
- RuntimeBinding;
- DecisionRobustness;
- DecisionResult;
- ACT / WAIT / ASK / ABSTAIN.

Commercial review-rate metrics are measurements of workflow behavior, never scientific authority.

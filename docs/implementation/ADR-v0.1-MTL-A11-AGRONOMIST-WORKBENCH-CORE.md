# ADR v0.1 — MTL-A11 Agronomist Workbench Core

Status: **IMPLEMENTATION CONTRACT / NON-ARCHITECTURE-AUTHORITY**

Baseline: `main @ d49082e426c55df381be514b888a4f04d2c04034`

Upstream authority remains Architecture v1.0, Capability Map 01 + Final Planning Adjudication, Master Task Line 01, Version Slicing 01 and the already-closed K03/K04/K05/A06/A08/A10 implementation boundaries.

## 1. Purpose and Gate-A boundary

A11 turns the existing governed authority chain into a usable Agronomist backend/workbench surface. It does not introduce another recommendation engine, qualification path or deployment path.

The non-transform Gate-A path is:

```text
K03/K04/K05
+ A01/A04/A05/A06/A07/A08/A10
+ A11
```

A09 remains conditional on actually exercising a governed transformation and is not fabricated merely to make numbering continuous.

A11 closes the applicability/escalation endpoint only. Later Workbench surfaces depending on RuntimePlan/RuntimeEligibility/DecisionResult/Evaluation retain their own predecessors.

## 2. Human evidence access is not runtime entitlement

A07/A08 runtime execution may legally use proprietary Knowledge through runtime/deployment entitlement without granting a human the right to inspect source text.

A11 therefore requires existing F03 human read authority before displaying Source/Claim evidence:

```text
exact workbench Principal
+ exact RoleAssignment carrying BOTH source.read + knowledge.inspect
+ exact KnowledgeGovernancePolicy bound to exact Knowledge ref
+ matching Knowledge ownership
+ replayable KNOWLEDGE_INSPECT AuthorizationDecisionAudit
+ exact Deployment programId frozen into authorization request scope
```

No new IAM permission is invented. The workbench principal must also carry the exact Deployment `programId` in its asserted program membership.

Permanent invariant:

```text
knowledge.runtime.use ≠ knowledge.inspect ≠ source.read
```

A11 v0.1 target-context detail is limited to a workbench principal in the exact DecisionProblem organization/tenant and exact validated Deployment program. There is no invented cross-tenant or cross-program `context.read` authority.

## 3. Workbench case projection

`projectAgronomistWorkbenchCase(...)` validates exact A08 authority and A10 classification, then projects a deterministic non-authority case.

For QualifiedKnowledge the case exposes, subject to exact human inspection authority:

```text
Source
→ SourceArtifact identity/hash/acquisition
→ exact source locator/span
→ Claim
→ SourceContext
→ SourceFaithfulReviewDecision
→ ScientificQualificationDecision(s)
```

When an exact `SourceRegistry` with retained bytes is supplied, A11 verifies SourceArtifact bytes and may produce a bounded text preview for `WHOLE_ARTIFACT` or `BYTE_RANGE`. Without exact retained bytes, it preserves locator/hash identity and explicitly makes no byte-preview claim. `DOCUMENT_COORDINATE` is never fabricated into a byte range.

For DerivedKnowledge the case uses:

```text
DerivedKnowledge
→ DerivedKnowledgeContext
→ DerivationMethod
→ every exact input QualifiedKnowledge
→ every input Source/Claim/SourceContext chain
```

The workbench must hold program-bound inspection authority for the DerivedKnowledge and for each input QualifiedKnowledge whose proprietary evidence is displayed. It never chooses one arbitrary input SourceContext as the derived origin.

Each case freezes the exact inspection AuthorizationDecisionAudit refs used to display its evidence. `validateAgronomistWorkbenchCase(...)` does not trust a case hash as authenticity: it replays A08 plus every embedded human-read authorization and reproduces the complete case projection.

The target side exposes exact DecisionProblem + ContextManifest + ContextDatum/receipt provenance. It never reads an open mutable context pool.

## 4. Escalation and conflict queues

Case/queue hashes prove deterministic projection only; they are not authority or authenticity tokens.

Public queue entrypoints therefore accept validation inputs and replay every exact case through `validateAgronomistWorkbenchCase(...)` before aggregation. The raw hash-only aggregator remains internal and is not exported from the Workbench package.

Default escalation queue behavior:

- every `reviewRequired=true` case remains visible;
- only `NO_REVIEW_CANDIDATE` may be omitted by default;
- including no-review candidates is explicit;
- a forged case remains rejected even if an attacker recomputes a syntactically valid deterministic case hash;
- duplicate exact ApplicabilityAssessment cases are rejected.

The applicability conflict queue is the validated subset classified `KNOWLEDGE_CONFLICT`. It does not resolve conflicts itself.

## 5. Authority actions use the same backend

`AgronomistWorkbenchAuthorityActions` is intentionally thin. It delegates directly to already-governed backend services/functions:

```text
SourceFaithfulReviewService.reviewCandidate
ScientificQualificationService.recordQualificationDecision
ScientificQualificationService.publishQualifiedKnowledge
KnowledgeConflictService.createConflict
KnowledgeConflictService.resolveConflict
publishDeployment
publishDeploymentControlDecision
```

There is no generic:

```text
ACCEPT
OVERRIDE
ACCEPT_APPLICABILITY
SET_SAFE
```

Workbench callers must supply the same exact authorization/policy/audit inputs as any other client. Invalid/missing authorization fails in the underlying authority service; A11 never creates parallel approval semantics.

## 6. Review instrumentation is operational only

A11 measures workflow behavior separately from the authority ledger:

- review start/completion time;
- duration;
- classification at start;
- reviewer outcome;
- reason codes;
- aggregate counts and average review time.

Frozen initial outcomes:

```text
CONFIRMED_CLASSIFICATION
REVIEWER_DISAGREED
CONTEXT_REQUESTED
AUTHORITY_ACTION_PERFORMED
DEFERRED
```

Measurement start first revalidates the exact ledger-backed A11 case. A deterministic case hash alone cannot create commercial KPI evidence. The start-session `measurementId` is itself replay-validated before completion; summary validates both the embedded session hash and completion hash. Thus recomputing only a downstream completion hash cannot launder a modified classification/session into workload metrics.

A disagreement is an observation requiring a separately governed authority action if science/configuration must change. It does not mutate the case, Knowledge, ApplicabilityAssessment or Deployment.

Permanent invariant:

```text
review-rate reduction ≠ scientific correctness
review-time reduction ≠ safety
workflow KPI ≠ authority
```

These measurements support the commercial hypothesis about agronomist throughput; they do not prove PMF, yield uplift or false-safe acceptability.

## 7. Determinism and replay

Case/queue/measurement hashes identify non-authority projections only. They are not published to the authority ledger by A11.

Current case projection uses current K03/K04/K05/A06/A08 validity. Historical case projection uses the existing governed `allowHistorical` replay path and preserves the exact prior evidence/classification world after later revocation/supersession.

## 8. Explicit nonclaims

A11 does not establish or modify:

- source-faithful/scientific/deployment authority outside delegated backend calls;
- QualifiedTransformation or satisfied CalibrationArtifact;
- RuntimePlan;
- InformationRequirement;
- RuntimeEligibility;
- RuntimeBinding;
- RuntimeResult;
- DecisionRobustness;
- DecisionResult;
- ACT / WAIT / ASK / ABSTAIN;
- full frontend/UI implementation;
- commercial PMF or safety proof.

It establishes the governed backend surface required for a real Agronomist review workflow and workload measurement.

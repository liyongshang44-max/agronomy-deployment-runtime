# ADR v0.1 — MTL-A08 Source→Target Applicability Core

Status: **IMPLEMENTATION CONTRACT / NON-ARCHITECTURE-AUTHORITY**

Baseline: `main @ 21e954418c05aad10063797f6ec666378fc59e70`

Upstream authority remains Architecture v1.0, Capability Map 01 + Final Planning Adjudication, Master Task Line 01, Gate K, A01, A04 and A07.

## 1. Authority boundary

A08 creates immutable `ApplicabilityAssessment` transport authority for one exact:

```text
KnowledgeRetrievalResult candidate
+ KnowledgeOriginContext
+ ContextManifest
+ DecisionProblem/use purpose
```

It does not retrieve knowledge, qualify knowledge, create TargetContext truth, establish RuntimeEligibility, or issue ACT/WAIT.

## 2. Materiality is upstream scientific authority

A08 does not infer which source-context dimensions are important.

For `QualifiedKnowledge`, executable transport conditions are taken only from the exact K04 `ScientificQualificationDecision` authority already frozen into:

- `semanticPreconditions`;
- `effectModifiers`;
- `transportConstraints`;
- `limitations`.

For `DerivedKnowledge`, A08 conservatively preserves the exact input QualifiedKnowledge transport conditions plus `DerivedKnowledgeContext.introducedRestrictions`; non-empty `unresolvedContextHeterogeneity` is `UNRESOLVED` in the v0.1 core path.

Therefore:

```text
runtime/LLM field similarity ≠ effect-modifier authority
country/region equality ≠ applicability authority
```

## 3. Frozen v0.1 executable condition subset

A08 v0.1 intentionally interprets only a closed deterministic subset.

### semantic precondition

```json
{
  "semanticId": "crop.code",
  "operator": "EQUALS",
  "value": "maize",
  "unit": "optional"
}
```

Missing target datum → `UNKNOWN` / `UNRESOLVED`.
Multiple target datums for one material semantic → `AMBIGUOUS` / `UNRESOLVED`.
Known EQUALS mismatch → `MISMATCH` / `CONFLICT`.
Explicit unit mismatch without governed transform → `INVALID` / `CONFLICT`.

### effect modifier

Same EQUALS form plus a governed mismatch disposition:

```text
CONFLICT
CALIBRATION_REQUIRED
BOUNDED_EXTRAPOLATION
```

An optional `code` names the calibration/extrapolation requirement. Unsupported modifier grammar is not guessed; it yields `UNRESOLVED`.

### transport constraints

Supported core types:

```text
DECISION_TYPE_IN
CALIBRATION_REQUIRED
BOUNDED_EXTRAPOLATION
```

`APPLICABLE_WITH_GOVERNED_TRANSFORM` is part of the public/frozen status vocabulary but A08 core does not mint it without later QualifiedTransformation authority (A09/S01 path).

## 4. Independent checks

The assessment freezes separately:

- `transportStatus`;
- current/historical `scientificUseStatus`;
- `decisionRelevance`;
- applicability-layer `runtimeUse` disposition.

A source-target match does not silently upgrade prohibited/revoked/unqualified scientific use.
`CALIBRATION_REQUIRED` is detected, never treated as satisfied.
`runtimeUse` here is an applicability-layer disposition only, not C15 RuntimeEligibility.

## 5. Publication authority

A08 does not invent another IAM permission. Publication is a deterministic runtime derivation and must be made by the exact runtime principal already bound to the validated A07 `KnowledgeRetrievalResult`/A06 runtime-use authorization.

Validation replays and closes exact:

- KnowledgeRetrievalResult;
- candidate Knowledge;
- KnowledgeOriginContext;
- ContextManifest;
- DecisionProblem;
- K04 qualification decisions or K05 derivation/input authority as applicable.

Caller-supplied audit vocabulary alone cannot manufacture an ApplicabilityAssessment.

## 6. Current versus historical replay

Current validation uses current A07 Deployment/RuntimeProfile/KnowledgeRelease/runtime-use and current Knowledge qualification/derivation authority.

Historical validation preserves the exact frozen candidate/context/knowledge world and does not rewrite a past assessment because later scientific-use authority changed.

## 7. Explicit nonclaims

A08 does not establish:

- QualifiedTransformation authority;
- satisfied CalibrationArtifact authority;
- RuntimeCandidates;
- RuntimePlan;
- RuntimeEligibility;
- RuntimeBinding;
- DecisionRobustness;
- DecisionResult;
- ACT / WAIT.

Applicability proves governed transport only.

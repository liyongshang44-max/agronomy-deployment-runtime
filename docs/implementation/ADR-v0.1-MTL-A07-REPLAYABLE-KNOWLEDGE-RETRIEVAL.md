# ADR v0.1 — MTL-A07 Replayable Knowledge Retrieval Implementation Contract

Status: **IMPLEMENTATION CONTRACT / NON-ARCHITECTURE-AUTHORITY**

Task: `MTL-A07 — Replayable Knowledge Retrieval`

Baseline: `main @ 14faca3bde6a2fd8bb9f63eb462e84c1f51d85b0`

Upstream authority remains Architecture v1.0, Capability Map 01 C08, Master Task Line 01, Gate F, Gate K, MTL-A01, MTL-A05 and MTL-A06. MTL-A04 is conditional only if retrieval consumes a target-context summary; this minimal slice deliberately does not.

## 1. Purpose

A07 establishes high-recall candidate generation from one exact authorized KnowledgeRelease without granting scientific truth, qualification, applicability, runtime eligibility or action authority.

`KnowledgeRetrievalResult` is immutable replay evidence with authority class:

```text
RETRIEVAL_EVIDENCE_NON_SCIENTIFIC
```

The result answers only: **which exact released knowledge objects did this exact retrieval engine/configuration expose as candidates for this exact DecisionProblem/Deployment world?**

## 2. Frozen v1 retrieval engine

The minimal deterministic engine is:

```text
engine_id: ADR_EXACT_RELEASE_MEMBER_SCAN
engine_version: 1
algorithm_contract: CANONICAL_EXACT_RELEASE_MEMBER_KIND_FILTER
```

It does not query a mutable vector/search database and does not compute relevance or ranking scores.

The corpus snapshot is the exact KnowledgeRelease member set. Replay identity freezes:

- exact KnowledgeRelease ref;
- canonical member-set hash;
- engine identity/version;
- config hash;
- `NO_EXTERNAL_MUTABLE_INDEX` index mode;
- deterministic index snapshot hash derived from the exact release member set.

## 3. Minimal configuration

The only v1 strategy is:

```text
ALL_RELEASE_MEMBERS_BY_KIND
```

with a canonical non-empty subset of:

```text
QualifiedKnowledge
DerivedKnowledge
```

`contextSummaryMode` is fixed to `NONE`. A07 v1 therefore does not inspect ContextManifest or mutable target context. Context-aware retrieval remains an explicit later extension and must bind an exact ContextManifest summary if introduced.

## 4. DecisionProblem query semantics

Every retrieval binds one exact DecisionProblem. The replayable query-semantic summary records:

- decision type;
- use purpose;
- use class;
- decision authority mode;
- objective code.

The exact DecisionProblem ref itself remains the authority source; the summary is deterministic retrieval evidence, not a second DecisionProblem authority.

Before candidate disclosure, A07 verifies that the DecisionProblem:

- matches Deployment organization/tenant;
- uses a deployed decision type;
- uses an authorized use purpose/class;
- uses a Decision authority mode allowed by the exact RuntimeProfile;
- has logical time within the Deployment effective interval.

Region/crop/field contextual applicability is not inferred here; A08 remains responsible for Source→Target transport.

## 5. Runtime-use authorization and private IP semantics

A07 minimal is an **internal runtime-use retrieval path**, not a human inspection/search API.

Candidate disclosure is allowed only after A06 exact runtime retrieval succeeds using:

```text
knowledge.runtime.use
```

for the exact organization/tenant/program/Deployment identity. This closes current Deployment → RuntimeProfile → KnowledgeRelease authority and every K06 member deployment entitlement before candidate refs are emitted.

A07 intentionally does **not** require `knowledge.inspect`, because F03 already distinguishes human visibility/inspection from runtime-use entitlement and permits deploy-entitled private knowledge to be consumed by authorized Runtime Service principals without making it human-visible.

A future human-facing retrieval API must independently enforce F03 inspection/visibility and must not reuse this internal result as a visibility grant.

## 6. Candidate semantics

Candidate entries are exact QualifiedKnowledge/DerivedKnowledge refs only.

A07 v1 emits no relevance score, qualification label, applicability status, scientific truth status, recommendation or action authority. Retrieval rank/score is therefore impossible to misinterpret in this slice.

The default config emits all exact release members. Kind filtering may intentionally return zero candidates.

## 7. Retrieval miss semantics

A zero-candidate result must carry exactly:

```text
code: NO_RELEASE_MEMBERS_OF_CONFIGURED_KIND
scope: RETRIEVAL_ONLY_NON_SCIENTIFIC
```

This is not `NOT_APPLICABLE`, not `SCIENTIFICALLY_FALSE`, and not a qualification decision. Retrieval miss and applicability rejection remain permanently separate.

## 8. Publication audit closure

A valid `KnowledgeRetrievalResult` publication audit binds exactly:

- exact DecisionProblem ref;
- exact Deployment ref;
- exact RuntimeProfile ref;
- exact KnowledgeRelease ref;
- exact Deployment runtime-use AuthorizationDecisionAudit ref.

The audit actor is the exact runtime principal. Unexpected hidden authority inputs fail validation.

## 9. Current-use versus historical replay

For current use, validation replays A06 runtime resolution and therefore requires the Deployment, RuntimeProfile and KnowledgeRelease to remain current-use valid and active at the DecisionProblem logical time.

For historical replay, validation may replay the exact historical Deployment/Profile/Release and the exact runtime-use authorization without allowing later suspend/deprecation/revocation to rewrite the old candidate set.

Historical replay is evidence of what was retrieved, not permission to use that old world again.

## 10. Identity and retry

The semantic result freezes exact world refs, engine/config/query/corpus identity, candidate refs and retrieval-only miss diagnostics. Same semantic inputs produce the same semantic hash regardless of result logical id or operational audit metadata.

F02 exact retry cannot rebind publication governance to a different runtime principal/authorization.

## 11. Explicit nonclaims

A07 does not establish:

- human knowledge visibility/search authorization;
- ranking or relevance truth;
- scientific qualification;
- ApplicabilityAssessment;
- CalibrationArtifact;
- RuntimePlan/RuntimeEligibility/RuntimeBinding;
- runtime execution;
- DecisionRobustness;
- DecisionResult.

`Retrieval miss ≠ scientific false ≠ applicability reject` remains a hard product/authority boundary.

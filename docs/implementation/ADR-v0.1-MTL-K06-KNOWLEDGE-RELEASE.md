# ADR v0.1 — MTL-K06 KnowledgeRelease

Status: **IMPLEMENTATION CONTRACT / NON-ARCHITECTURE-AUTHORITY**

Baseline: `main @ 8d533f39f85a96877edba750ded9dd29c32ea818`

Upstream authority remains Architecture v1.0, Final Adjudication, Capability Map 01, Master Task Line 01 and Version Slicing 01.

---

## 1. Purpose

K06 closes Gate K by turning already governed scientific knowledge into an exact immutable release composition:

```text
QualifiedKnowledge / DerivedKnowledge
        ↓ exact active authority + entitlement
KnowledgeReleasePublicationDecision
        ↓
KnowledgeRelease
```

Permanent separation:

```text
KnowledgeRelease ≠ RuntimeProfile ≠ Deployment
```

A KnowledgeRelease contains scientific knowledge members only. It contains no Transformation, Model, Policy, Implementation or rollout state.

---

## 2. Frozen release semantics

The semantic payload of `KnowledgeRelease` is deliberately exactly:

```text
memberRefs: exact canonical set of
  QualifiedKnowledge@hash
  DerivedKnowledge@hash
```

Publication authorization, target entitlement, conflict-governance observations and release lifecycle remain separate governance authority. They do not enlarge KnowledgeRelease into RuntimeProfile or Deployment.

Runtime code must not replace a member with `latest` knowledge by convention.

---

## 3. Publication authority and entitlement

K06 uses the existing F03 `knowledge.release` permission through a dedicated `KNOWLEDGE_RELEASE` authorization operation over existing F03 authority objects.

Each exact release member requires:

- an exact `KnowledgeGovernancePolicy` bound to that member;
- explicit deployment-scope entitlement for the declared release target;
- an exact publisher role assignment carrying `knowledge.release`;
- an immutable `AuthorizationDecisionAudit` whose decision can be recomputed exactly.

Visibility, ownership and release entitlement remain distinct. K06 v1 permits cross-owner composition only when each owner policy explicitly entitles the declared release target. Member ownership is never transferred to the release publisher.

The release target exists only in publication governance. It is not rollout state and is not stored in `KnowledgeRelease` semantics.

---

## 4. Publication decision

`KnowledgeReleasePublicationDecision` binds:

- exact predicted KnowledgeRelease ref;
- exact publisher principal;
- release target used for entitlement checks;
- exact member entitlement authorization/policy refs;
- exact relevant KnowledgeConflict refs known at publication;
- exact active conflict-resolution refs known at publication;
- optional superseded release ref.

`KnowledgeRelease` itself binds the exact publication decision through direct audit, while keeping its semantic payload limited to the scientific member set.

Known unresolved conflicts do not silently disappear and do not become fake winners. They may remain explicit in publication governance because KnowledgeRelease is scientific composition authority, not Applicability or RuntimeEligibility authority.

A newly discovered relevant conflict makes an old release stale for **new** use until a new release is created; historical replay remains possible against the original exact publication authority.

---

## 5. Member validity

A new release may include only:

```text
QualifiedKnowledge
DerivedKnowledge
```

For QualifiedKnowledge, at least one scientific use must remain active. Revoked/prohibited/superseded-only authority cannot be newly frozen into a release.

For DerivedKnowledge, K05's complete derivation, origin-context, authorization, audit and lineage authority is revalidated.

No raw Claim, SourceContext, Model, Policy, Transformation, Implementation or CalibrationArtifact can become a release member by object-kind convention.

---

## 6. Release lifecycle

The KnowledgeRelease object is immutable.

A successor release uses canonical `supersedes` lineage rather than modifying the old member set.

Additional immutable lifecycle decisions may declare:

```text
DEPRECATED
REVOKED
```

Current-use validation rejects superseded and revoked releases. Historical validation may resolve them exactly for replay.

This lifecycle is not deployment rollout. It must not use `SANDBOX / SHADOW / PILOT / PRODUCTION` states.

---

## 7. Gate K acceptance

K06 must prove:

1. exact qualified/derived knowledge refs are frozen and canonically ordered;
2. semantic payload remains the scientific member set only;
3. Model/Policy/Implementation/non-knowledge members are rejected;
4. release permission and member entitlement are both required;
5. cross-owner composition requires explicit owner entitlement and preserves ownership;
6. revoked QualifiedKnowledge cannot enter a new release;
7. known conflicts are bound in publication governance rather than silently resolved;
8. newly discovered relevant conflict makes a release stale for new use but does not destroy historical replay;
9. release supersession does not rewrite old exact member sets;
10. release lifecycle revocation blocks new use without deleting history;
11. later registry objects do not alter an existing release by `latest` convention.

---

## 8. Explicit nonclaims

K06 does not establish:

- TargetContext / ContextManifest;
- Source→Target Applicability;
- RuntimeProfile;
- Deployment rollout;
- Transformation / Model / Policy / Implementation authority;
- CalibrationArtifact;
- RuntimeEligibility;
- DecisionResult;
- causal truth.

Only after K06 exact-head acceptance and independent authority review may Gate K be declared closed and the implementation frontier move into Applicability-track work.

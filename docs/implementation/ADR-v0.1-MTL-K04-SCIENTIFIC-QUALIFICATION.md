# ADR v0.1 — MTL-K04 Scientific Qualification Authority

Status: **IMPLEMENTATION CONTRACT / NON-ARCHITECTURE-AUTHORITY**

Task: `MTL-K04 — Scientific Qualification Authority`

Baseline: `main @ 30b624bb0b00d9d035281825dc4529fa1d61c9d8`

Upstream authority remains Architecture v1.0, Capability Map 01, Master Task Line 01 and Version Slicing 01.

---

## 1. Purpose

K03 established source-faithful `Claim + SourceContext` authority. K04 adds the next authority transition:

```text
Claim + SourceContext
        +
exact Scientific Approver authorization
        ↓
ScientificQualificationDecision(s)
        ↓
QualifiedKnowledge
```

K04 answers only:

> For which explicit scientific use purposes may ADR recognize this exact Claim, and under what limitations / preconditions / transport constraints?

K04 does **not** answer whether the knowledge applies to a target field, whether a runtime is legal, or what action should be taken.

Permanent invariant:

```text
SOURCE-FAITHFUL ≠ QUALIFIED ≠ APPLICABLE ≠ RUNTIME_ELIGIBLE ≠ DECISION
```

---

## 2. Qualification granularity

A `ScientificQualificationDecision` is scoped to one exact `qualificationTarget`.

Frozen K04 dispositions:

```text
QUALIFY_USE
PROHIBIT_USE
```

This prevents one authorization for use A from silently granting scientific-use authority for use B.

A `QualifiedKnowledge` object is a governed aggregation of exact qualification decisions for the same exact `Claim + SourceContext` pair. It must contain at least one `QUALIFY_USE` decision.

Example:

```text
Claim X

CORN_IRRIGATION_APPLICABILITY  → QUALIFY_USE
AUTONOMOUS_IRRIGATION_ACTION   → PROHIBIT_USE

        ↓
QualifiedKnowledge X@1
```

The two uses remain distinct scientific-use authorities even though they originate from the same source Claim.

---

## 3. Mandatory upstream closure

K04 does not accept `kind == Claim` / `kind == SourceContext` as sufficient proof.

Before qualification it closes the exact K03 chain through:

```text
Claim
+ SourceContext
→ ACCEPT_SOURCE_FAITHFUL SourceFaithfulReviewDecision
→ ClaimCandidate + SourceContextCandidate
→ ScientificCompilationResult
→ ScientificCompilerDefinition (CANDIDATE_ONLY)
→ SourceArtifact@contentHash
→ Source
```

It also reconstructs final SourceContext dimensions from the candidate vocabulary using the frozen K03 semantic contract. A forged final SourceContext that cannot be reconstructed source-faithfully is not qualification-eligible.

---

## 4. Authorization boundary

Scientific qualification requires an exact F03 `AuthorizationDecisionAudit` whose stored decision is reproducible as:

```text
operation = KNOWLEDGE_QUALIFY
allowed   = true
```

The policy resource is bound to the exact:

```text
Claim@hash + SourceContext@hash
```

The service re-resolves:

- exact approver principal;
- exact KnowledgeGovernancePolicy;
- exact RoleAssignment refs;
- exact qualification target;
- exact authorization scope;
- Source ownership.

It then recomputes the F03 qualification authorization and requires the decision hash to match the stored decision.

Therefore:

```text
AGRONOMY_REVIEWER  ≠ SCIENTIFIC_APPROVER
COMPILER_SERVICE   ≠ SCIENTIFIC_APPROVER
public source      ≠ automatically qualified
high extractor confidence ≠ qualified
```

Authentication/SSO remains outside K04; authorization authority does not.

---

## 5. QualifiedKnowledge semantics

`QualifiedKnowledge` binds:

- exact `Claim` ref;
- exact `SourceContext` ref;
- exact `Source` ref;
- exact qualification decision refs;
- explicit allowed uses;
- explicit forbidden uses;
- qualification scope derived from those use targets;
- limitations;
- effect modifiers;
- semantic preconditions;
- transport constraints;
- source ownership;
- optional requalification predecessor.

Constraints/effect modifiers/preconditions/transport constraints retain the exact qualification-decision ref that introduced them.

`QualifiedKnowledge` deliberately contains no:

```text
ApplicabilityAssessment
RuntimeEligibility
DecisionResult
Deployment
rollout stage
field TargetContext
```

Qualification therefore cannot launder scientific-use authority into downstream runtime/action authority.

---

## 6. Requalification and revocation

Authority objects are immutable.

Changed scientific judgment produces a new qualification decision and, where applicable, a new `QualifiedKnowledge` version.

```text
ScientificQualificationDecision v2
  supersedes
ScientificQualificationDecision v1

QualifiedKnowledge v2
  requalifies
QualifiedKnowledge v1
```

Historical objects remain resolvable.

A use-specific revocation produces a separate immutable `ScientificQualificationRevocation` with explicit `revokes` lineage to the historical QualifiedKnowledge. Revocation does not mutate the old object.

Current use status is therefore one of:

```text
QUALIFIED
PROHIBITED
REVOKED
UNQUALIFIED
```

These are scientific-use lifecycle states only. They are not applicability or runtime statuses.

---

## 7. Merge-blocking negative acceptance

K04 must fail when:

1. source-faithful review exists but no scientific qualification decision exists;
2. an `AGRONOMY_REVIEWER` attempts to qualify;
3. a `COMPILER_SERVICE` attempts to self-qualify;
4. authorization for use A is replayed for use B;
5. policy qualification scope excludes the target use;
6. an AuthorizationDecisionAudit cannot be reproduced from exact F03 authority;
7. a forged Claim/SourceContext pair lacks the exact accepted K03 upstream chain;
8. prohibition-only decisions attempt to mint `QualifiedKnowledge`;
9. conflicting decisions for the same use target are hidden in one QualifiedKnowledge;
10. a published QualifiedKnowledge version is semantically rewritten;
11. revocation targets an unqualified use;
12. denied authorization attempts a revocation.

---

## 8. Explicit nonclaims

K04 does **not** establish:

- `DerivedKnowledge` / `DerivedKnowledgeContext`;
- `KnowledgeConflict`;
- `KnowledgeRelease`;
- Source→Target transport/applicability;
- TargetContext / ContextManifest;
- RuntimeProfile / Deployment;
- RuntimeEligibility;
- DecisionResult;
- scientific truth or causal truth;
- deployment entitlement merely because a scientific use is qualified.

Next only after K04 is independently reviewed and exact-head acceptance is green:

`MTL-K05 — DerivedKnowledge / DerivedKnowledgeContext / Conflict`.

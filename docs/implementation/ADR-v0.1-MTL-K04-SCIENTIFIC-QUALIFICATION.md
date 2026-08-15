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

A `ScientificQualificationDecision` is scoped to one exact scientific-use target.

K04 v1 freezes that target shape narrowly as:

```yaml
use: CORN_IRRIGATION_APPLICABILITY
```

No arbitrary target fields may be added to silently broaden or narrow authority. Scientific context limitations belong in explicit preconditions, limitations, effect modifiers or transport constraints, not in ad-hoc target keys.

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
→ exact K03 reviewer AuthorizationDecisionAudit
→ ClaimCandidate + SourceContextCandidate
→ ScientificCompilationResult
→ ScientificCompilerDefinition (CANDIDATE_ONLY)
→ SourceArtifact@contentHash
→ Source
```

The K03 authorization is recomputed from exact F03 policy/role authority; an `ACCEPT_SOURCE_FAITHFUL` record with forged or missing reviewer authorization is not qualification-eligible.

K04 also reconstructs final SourceContext dimensions from the candidate vocabulary using the frozen K03 semantic contract. A forged final SourceContext that cannot be reconstructed source-faithfully is not qualification-eligible.

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

These payloads are **qualified scientific payloads, not automatically executable runtime predicates**. K04 permits canonical governed objects to preserve scientific judgment, but no later Applicability/Runtime component may silently interpret an arbitrary field. A later typed semantic capability must explicitly support a constraint shape; otherwise it remains an unsupported limitation/information requirement rather than becoming executable authority by convention.

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

Omitting a different use target from one QualifiedKnowledge snapshot does not grant it. Absence means `UNQUALIFIED`, never implicitly allowed.

---

## 6. Competing judgments and branch convergence

K04 allows multiple independently authorized scientific judgments for the same exact:

```text
Claim + SourceContext + use
```

to coexist temporarily. This is deliberate: disagreement must not be suppressed at write time.

However, while more than one active branch exists:

```text
QualifiedKnowledge publication for that use → FAIL
```

The caller may not cherry-pick the convenient `QUALIFY_USE` branch and hide an active `PROHIBIT_USE` branch.

Conflict resolution is explicit multi-parent supersession:

```text
Decision A  QUALIFY_USE ─┐
                         ├─→ Decision C
Decision B  PROHIBIT_USE ┘    supersedesDecisionRefs = [A, B]
```

For a new resolving judgment, the supplied `supersedesDecisionRefs` must equal the **complete currently-active branch set** for that exact Claim/SourceContext/use target. Superseding only one branch while silently leaving another active is rejected.

A normal one-parent requalification is simply the same mechanism with an array of length one.

Thus:

```text
independent disagreement is representable
→ unresolved disagreement blocks QualifiedKnowledge
→ explicit adjudication closes every active branch
→ one new active scientific-use judgment remains
```

This prevents both silent conflict laundering and an unrecoverable authority fork.

---

## 7. Requalification and revocation

Authority objects are immutable.

Changed scientific judgment produces a new qualification decision and, where applicable, a new `QualifiedKnowledge` version.

```text
ScientificQualificationDecision v2
  supersedesDecisionRefs = [v1]

QualifiedKnowledge v2
  requalifies
QualifiedKnowledge v1
```

Historical objects remain resolvable.

A use-specific revocation is not implemented as a cosmetic flag on one QualifiedKnowledge snapshot. It creates:

```text
active QUALIFY_USE decision
        ↓ superseded by
PROHIBIT_USE decision
        +
ScientificQualificationRevocation audit authority
```

The revocation record retains the exact historical QualifiedKnowledge and the exact allow/prohibit decision transition. This matters because otherwise a caller could revoke `QualifiedKnowledge v1` and immediately mint `QualifiedKnowledge v2` from the still-active old allow decision.

After revocation:

- the historical QualifiedKnowledge remains immutable and resolves exactly;
- its current use status is `REVOKED`;
- the old allow decision is stale and cannot mint another QualifiedKnowledge;
- later requalification requires a new authorized `QUALIFY_USE` decision that supersedes the active prohibition decision.

Current snapshot/lifecycle status is one of:

```text
QUALIFIED
PROHIBITED
REVOKED
UNQUALIFIED
```

These are scientific-use lifecycle states only. They are not applicability or runtime statuses.

Revocation currently uses the same exact `KNOWLEDGE_QUALIFY` scientific authority because it is a qualification-lifecycle judgment; K04 does not invent a new frozen IAM permission.

---

## 8. Merge-blocking negative acceptance

K04 must fail when:

1. source-faithful review exists but no scientific qualification decision exists;
2. an `AGRONOMY_REVIEWER` attempts to qualify;
3. a `COMPILER_SERVICE` attempts to self-qualify;
4. authorization for use A is replayed for use B;
5. policy qualification scope excludes the target use;
6. an AuthorizationDecisionAudit cannot be reproduced from exact F03 authority;
7. a forged Claim/SourceContext pair lacks the exact accepted K03 upstream chain;
8. a forged K03 accepted review lacks reproducible reviewer authorization;
9. arbitrary scientific-use target fields attempt to alter authority shape;
10. prohibition-only decisions attempt to mint `QualifiedKnowledge`;
11. unresolved competing active decisions are cherry-picked into QualifiedKnowledge;
12. a resolving decision supersedes only a subset of the active conflict branches;
13. a superseded/stale decision attempts to mint new QualifiedKnowledge;
14. a directly forged qualification decision lacks exact approver publication audit;
15. a published QualifiedKnowledge version is semantically rewritten;
16. revocation targets an unqualified use;
17. denied authorization attempts a revocation;
18. a revoked allow decision is reused to resurrect scientific-use authority.

---

## 9. Explicit nonclaims

K04 does **not** establish:

- `DerivedKnowledge` / `DerivedKnowledgeContext`;
- `KnowledgeConflict` across different QualifiedKnowledge assertions (`MTL-K05` owns that domain);
- `KnowledgeRelease`;
- Source→Target transport/applicability;
- TargetContext / ContextManifest;
- executable semantics for arbitrary limitation/effect-modifier/precondition/transport payloads;
- RuntimeProfile / Deployment;
- RuntimeEligibility;
- DecisionResult;
- scientific truth or causal truth;
- deployment entitlement merely because a scientific use is qualified;
- production authentication/SSO/MFA.

K04's same-Claim/use branch disagreement is a qualification-lifecycle seam, not the broader `KnowledgeConflict` capability defined for K05.

Next only after K04 is independently reviewed and exact-head acceptance is green:

`MTL-K05 — DerivedKnowledge / DerivedKnowledgeContext / Conflict`.

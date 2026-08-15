# ADR v0.1 — MTL-K03 Source-Faithful Authority Review Adjudication

Status: **IMPLEMENTATION REVIEW / NON-ARCHITECTURE-AUTHORITY**

Task: `MTL-K03 — Claim / SourceContext Source-Faithful Authority`

Purpose: close the merge-blocking authority seams found during independent review of Draft PR #11. This document does not reopen Architecture v1.0 or C04. Where this review conflicts with the earlier K03 implementation contract/review wording, this review controls the K03 implementation claim only.

---

## 1. Full upstream provenance closure is mandatory

Internal bundle consistency is not enough.

Before a `SourceFaithfulReviewDecision` can mint final source authority, K03 must resolve and verify the full exact chain:

```text
ClaimCandidate
      ↓
ScientificCompilationResult
      ↓
ScientificCompilerDefinition
      ↓
SourceArtifact
      ↓
Source
```

Required invariants:

- every exact authority ref must resolve in the shared authority ledger;
- `SourceArtifact.sourceRef` must equal the exact Source used by the candidate/result;
- candidate/result raw content hash must equal the exact `SourceArtifact.contentHash`;
- candidate/result compiler ref must resolve to the exact `ScientificCompilerDefinition`;
- compiler definition must remain `outputAuthority = CANDIDATE_ONLY`;
- candidate, context candidate and compilation result must all close to the same exact upstream chain.

A self-consistent forged candidate/result bundle with nonexistent or semantically incompatible upstream authority must fail.

---

## 2. Candidate vocabulary cannot become final SourceContext authority

K02 proposal vocabulary remains proposal-only:

```text
semanticHint
valueCandidate
unitCandidate
compiler confidence
```

K03 now introduces only the minimum shared semantic-dimension contract required to materialize final SourceContext authority.

For every `REPORTED` source-context dimension, source-faithful human adjudication must produce:

```text
semanticId
canonical typed value
canonical unit when the source candidate already carries that exact unit
source locator
```

Final `SourceContext` must not persist:

```text
semanticHint
valueCandidate
unitCandidate
compiler confidence
```

`NOT_REPORTED` remains explicit and cannot receive hidden values.

K03 deliberately does **not** invent unit conversions. If the candidate unit and intended canonical unit differ, K03 rejects the mapping. A later governed semantic/Transformation authority must perform that conversion.

This is a task-sequencing clarification, not an Architecture amendment: K03 consumes a minimal shared semantic-dimension contract before the complete A02 Context system exists.

---

## 3. Claim and SourceContext publication is semantically atomic

An accepted review may exist independently.

But final source authority must satisfy:

```text
Claim + SourceContext
= all-or-none publication
```

The F02 reference ledger therefore exposes preflighted `publishBatch(...)` semantics. All batch entries are validated before any new authority record is committed.

If the intended SourceContext identity collides or fails semantic preflight:

```text
accepted review may remain
Claim must not be orphan-published
SourceContext must not be partially published
```

This is semantic atomicity in the reference authority implementation. Durable database/ACID transactionality remains a later production concern and must preserve this invariant.

---

## 4. Source-faithful review must bind exact F03 authorization authority

K03 no longer treats `audit.actor` as sufficient review authority.

Every review requires:

```text
exact review principal
+
exact AuthorizationDecisionAudit
+
exact RoleAssignment refs
+
exact resource policy scoped to the reviewed Source
```

The authorization decision must be allowed, must bind the exact principal, and must be scoped to the exact Source ownership/resource. At least one exact RoleAssignment used by the decision must grant both:

```text
SOURCE_READ
KNOWLEDGE_INSPECT
```

for that Source ownership scope.

The built-in `AGRONOMY_REVIEWER` satisfies this requirement; a principal with only `KNOWLEDGE_INSPECT` does not.

`SourceFaithfulReviewDecision` binds the exact authorization-audit ref and review principal. Authentication remains an explicit nonclaim; authorization authority does not.

---

## 5. Claim authority remains source assertion authority only

Final `Claim` preserves the exact source assertion, claim class and source locator/provenance chain.

Compiler structured proposal vocabulary is not copied into final Claim authority in K03. The exact `ClaimCandidate` remains available by reference for downstream qualification/normalization if needed.

Permanent boundary:

```text
Claim = what the source asserted
Claim ≠ scientific qualification
Claim ≠ target applicability
Claim ≠ decision authority
```

---

## 6. Required negative acceptance before merge

PR #11 cannot merge unless all of the following are executable failures:

```text
1. self-consistent forged upstream bundle
   → FAIL

2. non-canonical semanticHint/valueCandidate proposal vocabulary
   cannot become final SourceContext authority

3. Claim publication succeeds while SourceContext publication fails
   → forbidden; no orphan Claim authority

4. unauthorized reviewer
   → cannot mint SourceFaithfulReviewDecision / Claim / SourceContext
```

Additional retained negative acceptance includes orphan candidate rejection, exact-hash forgery rejection, immutable published versions, `NOT_REPORTED` preservation and no `QualifiedKnowledge` creation.

---

## 7. Review disposition

The K03 architecture direction remains valid:

```text
proposal-only compiler output
      ↓
source-faithful authorized review
      ↓
Claim + SourceContext
      ↓
K04 scientific qualification
```

No `DEC-xxxx` is required.

K04 remains blocked until this corrected K03 exact head is green and independently reviewed.

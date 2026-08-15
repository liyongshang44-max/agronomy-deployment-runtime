# ADR v0.1 — MTL-K03 Claim / SourceContext Source-Faithful Authority

Status: **IMPLEMENTATION CONTRACT / NON-ARCHITECTURE-AUTHORITY**

Task: `MTL-K03 — Claim / SourceContext Source-Faithful Authority`

Baseline: `main @ d614ac6119da818447749d76bfdf52ec7f03f4cb`

Upstream authority remains Architecture v1.0, Capability Map 01, Master Task Line 01 and Version Slicing 01.

---

## 1. Purpose

K02 created proposal-only extraction objects. K03 introduces the first human-reviewed source-assertion authority:

```text
exact completed ScientificCompilationResult
+ exact ClaimCandidate
+ exact SourceContextCandidate
+ explicit source-faithful review
        ↓
Claim
+ SourceContext
```

K03 answers only:

> Does the reviewed material faithfully represent what this exact SourceArtifact asserted and the context it explicitly reported?

It does **not** answer:

```text
Is the assertion scientifically true?
Is it qualified for ADR use?
Does it apply to a target field?
Should a runtime or decision use it?
```

Those are later authorities.

---

## 2. Completed-compilation envelope is mandatory

A candidate cannot be reviewed merely because a `ClaimCandidate` row exists.

K03 requires an exact completed `ScientificCompilationResult` and proves that:

- the exact ClaimCandidate is a member of that result;
- the exact SourceContextCandidate is a member of that result;
- the SourceContextCandidate points to that ClaimCandidate;
- Source, SourceArtifact, raw artifact content hash and ScientificCompilerDefinition provenance are internally consistent.

This closes the K02 nonclaim around orphan proposal rows:

```text
orphan candidate existence
≠ review eligibility
```

---

## 3. SourceFaithfulReviewDecision

K03 creates an immutable `SourceFaithfulReviewDecision` with one of two dispositions:

```text
ACCEPT_SOURCE_FAITHFUL
REJECT_SOURCE_FAITHFUL
```

A rejection requires at least one explicit reason code.

A review binds:

```text
completed compilation result
ClaimCandidate
SourceContextCandidate
Source
SourceArtifact
raw artifact content hash
compiler definition
review disposition
reason codes
optional rationale
review audit actor/time
```

This review is not Scientific Qualification. It grants only source-faithful review authority.

---

## 4. Claim authority

On `ACCEPT_SOURCE_FAITHFUL`, K03 materializes an immutable `Claim`.

The Claim copies the candidate source assertion rather than accepting reviewer rewrite fields. It includes:

```text
claim type
source-faithful assertion
optional structured candidate payload
exact Source ref
exact SourceArtifact ref/content hash
exact source locator
ClaimCandidate ref
completed ScientificCompilationResult ref
SourceFaithfulReviewDecision ref
authorityClass = SOURCE_ASSERTION
```

The Claim deliberately omits:

```text
extraction confidence
qualification status
allowed uses
forbidden uses
qualification scope
transport constraints
runtime eligibility
decision authority
```

A later expert judgment must not rewrite the Claim. If the compiler extraction is wrong, the legal correction path is:

```text
reject candidate
→ correct/recompile/new candidate
→ new review
→ new Claim authority if accepted
```

not “edit the Claim until it looks right.”

---

## 5. SourceContext authority

On acceptance, K03 materializes an immutable `SourceContext` that binds the final Claim.

It preserves the complete six-family context proposal from K02:

```text
BIOLOGICAL
ENVIRONMENTAL
MANAGEMENT
OPERATIONAL
MEASUREMENT
JURISDICTION_ECONOMIC
```

including exact `REPORTED / NOT_REPORTED` states and source locators.

`NOT_REPORTED` remains unknown. Human review may reject a bad candidate, but K03 does not allow a reviewer to fill an unreported source condition from memory, inference, TargetContext or external knowledge.

The final SourceContext carries:

```text
Claim ref
Source ref
SourceArtifact ref/content hash
context families
SourceContextCandidate ref
completed compilation result ref
SourceFaithfulReviewDecision ref
authorityClass = SOURCE_CONTEXT
```

SourceContext remains a scientific/source-context object, not PDF metadata and not TargetContext.

---

## 6. Lineage

K03 records explicit candidate→authority lineage through the shared F02 substrate:

```text
Claim
  derived_from
ClaimCandidate

SourceContext
  derived_from
SourceContextCandidate
```

The lineage detail records that these are authority transitions:

```text
CANDIDATE_TO_SOURCE_ASSERTION
CANDIDATE_TO_SOURCE_CONTEXT
```

The original proposal objects remain immutable and proposal-only.

---

## 7. Audit

K03 publishes separate audit events for:

```text
review decision
Claim publication
SourceContext publication
Claim candidate→Claim lineage
SourceContextCandidate→SourceContext lineage
```

The Claim publication audit binds the exact review, completed compilation result and ClaimCandidate.

The SourceContext publication audit additionally binds the final Claim and exact SourceContextCandidate.

This makes it possible to reconstruct:

> which exact compiler proposal and exact source material a reviewed Claim/SourceContext came from, and who accepted/rejected source faithfulness.

---

## 8. Authorization boundary

F03 already defines who may inspect knowledge and who may later qualify it. K03 core does not duplicate IAM logic inside scientific domain code.

A production API/Workbench action that invokes source-faithful review must enforce the relevant F03 role/authorization policy and record authorization audit before mutation.

K03 itself guarantees a stronger domain rule independent of caller identity:

```text
source-faithful review
cannot create QualifiedKnowledge,
Deployment,
ApplicabilityAssessment,
RuntimeEligibility,
or DecisionResult.
```

---

## 9. Publication atomicity nonclaim

K03 currently uses the F02 in-memory reference ledger.

An accepted review decision is a legitimate immutable human review result even if a later Claim/SourceContext publication attempt encounters an infrastructure or identity collision. Exact retry may complete materialization when inputs are unchanged.

K03 therefore does not yet claim a durable ACID transaction spanning:

```text
SourceFaithfulReviewDecision
+ Claim
+ SourceContext
+ lineage records
```

Downstream scientific qualification must consume an exact materialized Claim + SourceContext pair, not infer final authority from an accepted review decision alone.

Durable transaction/recovery belongs to later persistence/productization work and must preserve these semantics.

---

## 10. Explicit nonclaims

K03 does not establish:

```text
Scientific Qualification
QualifiedKnowledge
DerivedKnowledge
KnowledgeConflict
KnowledgeRelease
TargetContext
Applicability
RuntimeProfile
RuntimeEligibility
Decision
scientific truth
causal truth
production IAM/authentication
production durable persistence
```

A source-faithful Claim means:

> the reviewed assertion faithfully represents what the exact source material asserted.

It does not mean:

> ADR believes the assertion is true or safe to deploy.

---

## 11. K03 acceptance contract

K03 closes only when executable acceptance proves:

```text
completed ScientificCompilationResult is mandatory
orphan candidates cannot be reviewed
ClaimCandidate/SourceContextCandidate pair must match
forged refs are rejected
rejection requires reason and creates no final Claim/SourceContext
accepted Claim copies source assertion exactly
reviewer override fields do not rewrite Claim/SourceContext
final SourceContext preserves all six families and NOT_REPORTED
Claim/SourceContext contain no qualification authority
same published final version cannot be silently rewritten
Claim and SourceContext audits bind exact proposal/review provenance
candidate→authority lineage is explicit
proposal objects remain immutable/proposal-only
```

Passing K03 unlocks:

```text
MTL-K04 — Scientific Qualification Authority
```

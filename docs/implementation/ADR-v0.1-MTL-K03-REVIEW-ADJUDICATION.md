# ADR v0.1 — MTL-K03 Source-Faithful Authority Review Adjudication

Status: **IMPLEMENTATION REVIEW / NON-ARCHITECTURE-AUTHORITY**

Task: `MTL-K03 — Claim / SourceContext Source-Faithful Authority`

Purpose: record the independent implementation review performed after the first green K03 acceptance run and close authority-semantics seams without reopening Architecture v1.0 or C04.

---

## 1. Compilation provenance is checked across the entire review envelope

K03 originally checked candidate-pair provenance and the completed compilation's SourceArtifact/compiler refs. The review identified that the completed `ScientificCompilationResult` must also agree with the selected candidate on:

```text
Source ref
SourceArtifact ref
SourceArtifact raw content hash
ScientificCompilerDefinition ref
```

K03 now rejects any exact compilation result whose source provenance differs from the selected candidate, even when its candidate refs were otherwise constructed to appear valid.

This prevents a generic AuthorityLedger caller or future buggy job runner from laundering a candidate under a different logical source/result envelope.

---

## 2. Compiler extraction confidence is not SourceContext authority

K02 permits optional extraction-confidence metadata on proposed context dimensions. That number describes the compiler's extraction confidence; it is not something asserted by the scientific source.

K03 therefore strips candidate dimension `confidence` when materializing final `SourceContext`.

The following remains preserved:

```text
semantic hint
candidate value representation
unit candidate where present
EXPLICIT_SOURCE support class
exact source locator
REPORTED / NOT_REPORTED state
```

The following does not become final source authority:

```text
compiler extraction confidence
```

This mirrors the existing Claim rule that candidate-level `extractionConfidence` does not enter final Claim authority.

If a scientific source itself reports a statistical confidence/uncertainty quantity, that must be represented as an explicit source-supported claim/context value under an appropriate semantic contract, not confused with compiler confidence.

---

## 3. Review/materialization transactionality remains an explicit nonclaim

The accepted review decision is a legitimate immutable review authority even if later final-object materialization fails due to an infrastructure or identity collision. Downstream K04 qualification must require exact materialized `Claim + SourceContext` authority and must not scan accepted review decisions as a substitute.

This is intentionally unchanged until durable persistence/transaction semantics are introduced later.

---

## 4. Review disposition

After these corrections, K03 preserves:

```text
Claim = reviewed source assertion
SourceContext = reviewed source-reported context
review ≠ qualification
compiler confidence ≠ source authority
accepted review ≠ QualifiedKnowledge
orphan proposal ≠ review-eligible authority
```

No Architecture v1.0 amendment is required.

The next task remains:

```text
MTL-K04 — Scientific Qualification Authority
```

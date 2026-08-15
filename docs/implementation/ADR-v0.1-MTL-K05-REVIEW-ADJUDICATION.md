# ADR v0.1 — MTL-K05 Independent Review Adjudication

Status: **IMPLEMENTATION REVIEW / NON-ARCHITECTURE-AUTHORITY**

Task: `MTL-K05 — DerivedKnowledge / DerivedKnowledgeContext / Conflict`

Upstream baseline: `main @ e353666080dadb21d4a0d4ecb84182f5c3175cb6`

This review does not amend Architecture v1.0. It records merge-blocking implementation seams found while independently re-reading the K05 branch after the first green functional path.

---

## 1. Review conclusion

K05's core direction is consistent with frozen architecture:

```text
QualifiedKnowledge(s)
→ governed derivation
→ DerivedKnowledge + DerivedKnowledgeContext
→ explicit KnowledgeConflict
→ governed conflict resolution
```

No architecture contradiction was found and no `DEC-xxxx` is required.

The first implementation was **not** merged when its happy path became green. Independent review identified additional authority-integrity seams. Those seams are closed below and are merge-blocking acceptance.

---

## 2. Canonical lineage vocabulary seam

### Finding

The first K05 implementation attempted new lineage relation names such as:

```text
DERIVED_FROM
ORIGIN_CONTEXT_FROM
DERIVED_BY
RESOLVES
```

F02 already freezes a small canonical lineage vocabulary. Creating a parallel K05 vocabulary would have weakened the common replay substrate.

### Adjudication

Do not widen F02 lineage taxonomy for K05 convenience.

K05 uses canonical:

```text
relation = derived_from
```

and distinguishes semantics through `details.lineageRole`:

```text
QUALIFIED_KNOWLEDGE_INPUT
ORIGIN_SOURCE_CONTEXT
DERIVATION_METHOD
KNOWLEDGE_CONFLICT_RESOLUTION
```

Revision remains canonical `supersedes`.

---

## 3. Authority publication versus lineage atomicity seam

### Finding

Publishing `DerivedKnowledge + DerivedKnowledgeContext` first and appending required lineage afterward could leave formally published authority with incomplete mandatory lineage if lineage publication failed.

The same issue applied to conflict-resolution authority plus its required conflict/supersession lineage.

### Adjudication

F02 reference ledger gains a backwards-compatible atomic primitive:

```text
publishBatchWithLineage({ entries, lineages })
```

All authority and lineage entries are preflighted before any mutation. K05 uses it for:

```text
DerivedKnowledgeContext
+ DerivedKnowledge
+ complete input/context/method lineage
```

and for:

```text
KnowledgeConflictResolutionDecision
+ conflict lineage
+ optional supersession lineage
```

A failed lineage preflight leaves no staged authority, lineage or audit record.

This is an implementation strengthening of F02 semantics, not a new architecture boundary.

---

## 4. Generic-ledger DerivationMethod laundering seam

### Finding

A raw ledger caller could construct a syntactically valid `DerivationMethod` that copied a real authorization ref. If synthesis trusted `kind=DerivationMethod` plus payload fields, the forged method could mint DerivedKnowledge.

### Adjudication

Before synthesis, K05 revalidates:

- exact method authority class;
- exact method semantics and mandatory forbidden shortcuts;
- exact F03 `KNOWLEDGE_QUALIFY` decision;
- exact policy resource and ownership;
- reproducible authorization decision hash;
- direct method publication audit by the exact Scientific Approver over authorization and policy refs.

A generic-ledger method with copied authorization but incorrect direct publication audit cannot mint DerivedKnowledge.

---

## 5. Derivation result epistemic overclaim seam

### Finding

`DerivedKnowledge` can contain a derived value, but K05 does not yet own Model/Implementation/ImplementationConformance authority. A derived value must therefore not imply that an executable statistical/model implementation actually ran.

### Adjudication

K05 DerivedKnowledge freezes:

```text
derivationEvidenceClass = SCIENTIFIC_ADJUDICATION_RECORD
```

This means the result is a governed scientific derivation/adjudication authority. Computational execution proof remains a later, separate authority concern.

---

## 6. QualifiedKnowledge semantic-role assignment seam

### Finding

K04 `QualifiedKnowledge` does not intrinsically carry the K05 conflict `semanticRole`. Simply copying a caller-provided role into each member would retroactively claim K04 minted authority it did not mint.

### Adjudication

For a plain QualifiedKnowledge member:

```text
semanticRoleAuthority = CONFLICT_ASSESSMENT
```

The role is explicitly part of the scientifically approved KnowledgeConflict assessment.

For DerivedKnowledge, its own derivation semantic role must already equal the conflict role.

No authority is backfilled into historical K04 objects.

---

## 7. Conflict assessment executable-semantics seam

### Finding

`overlapAssessment` and `incompatibilityAssessment` are intentionally flexible scientific review payloads in K05. Without a boundary marker, downstream code could later treat arbitrary object fields as executable predicates by convention.

### Adjudication

KnowledgeConflict freezes:

```text
assessmentSemantics = DECLARATIVE_SCIENTIFIC_JUDGMENT_ONLY
```

Downstream executable semantics require a future explicit typed contract; K05 payload shape alone is not executable authority.

---

## 8. Generic-ledger KnowledgeConflict laundering seam

### Finding

A plausible `KnowledgeConflict` payload could otherwise be used as resolution input without proving the conflict itself was legitimately established.

### Adjudication

Downstream conflict handling revalidates:

- every exact member authority;
- every exact origin context;
- assertion hash closure;
- same-owner K05 boundary;
- scientific-use target;
- semantic-role authority class;
- exact F03 Scientific Approver authorization;
- direct conflict publication audit binding every member and origin context.

A forged conflict cannot enter governed resolution merely by using the correct object kind.

---

## 9. Generic-ledger resolution/current-state laundering seam

### Finding

A read model that scans `KnowledgeConflictResolutionDecision` records by kind/ref can be fooled by a generic-ledger record unless each candidate resolution is fully revalidated.

A second seam existed if the resolution payload selected one knowledge member but the direct publication audit did not bind that selected authority.

### Adjudication

`currentResolution` validates every candidate resolution before classifying current state.

Validation requires:

- exact conflict authority validation;
- exact F03 resolution authorization;
- direct publication audit;
- exact selected/derived/predecessor refs in that audit when applicable;
- legal resolution-type-specific semantics;
- exact conflict lineage;
- exact `supersedes` lineage when a predecessor is declared.

Invalid records fail closed; they are not silently ignored or promoted into current authority.

---

## 10. Calibration boundary

K05 preserves Final Adjudication:

```text
DerivedKnowledge ≠ CalibrationArtifact
```

`CALIBRATION_REQUIRED` is only a governed disposition:

```text
REQUIRE_SEPARATE_CALIBRATION_ARTIFACT
```

It creates no DerivedKnowledge or CalibrationArtifact by implication.

---

## 11. Final merge blockers

Before K05 can merge, exact-head acceptance must prove at least:

1. all normal K05 synthesis/conflict cases;
2. all previous F/K acceptance remains green;
3. authority+lineage atomicity;
4. forged DerivationMethod cannot mint DerivedKnowledge;
5. forged KnowledgeConflict cannot become resolution input;
6. forged resolution cannot become current by copying payload/lineage;
7. selected/derived/predecessor authority refs are direct-audit bound;
8. resolution supersession requires exact supersedes lineage;
9. declarative conflict assessments cannot masquerade as executable runtime semantics;
10. calibration is not laundered into DerivedKnowledge.

Only after these pass may PR #15 leave Draft and be merged. Next frontier then becomes `MTL-K06 — KnowledgeRelease`.

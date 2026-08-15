# ADR v0.1 — MTL-K05 DerivedKnowledge / DerivedKnowledgeContext / Conflict

Status: **IMPLEMENTATION CONTRACT / NON-ARCHITECTURE-AUTHORITY**

Baseline: `main @ e353666080dadb21d4a0d4ecb84182f5c3175cb6`

Upstream authority remains Architecture v1.0, Final Adjudication, Capability Map 01, Master Task Line 01 and Version Slicing 01.

---

## 1. Purpose

K05 closes the Control-plane authority between `QualifiedKnowledge` and `KnowledgeRelease`:

```text
QualifiedKnowledge(s)
        +
exact DerivationMethod authority
        +
Scientific Approver authorization
        ↓
DerivedKnowledge
+
DerivedKnowledgeContext

Qualified / Derived Knowledge
        ↓
KnowledgeConflict
        ↓
explicit governed resolution
```

K05 does not evaluate any target field and does not establish runtime legality or action authority.

Permanent invariants:

```text
SourceContext ≠ DerivedKnowledgeContext
DerivedKnowledge ≠ CalibrationArtifact
KnowledgeConflict ≠ automatic winner selection
```

---

## 2. DerivationMethod authority

A `DerivationMethod` is an immutable scientific synthesis-method authority. It binds method type, semantic role, minimum exact input count, context policy, method specification, explicit forbidden shortcuts, ownership, Scientific Approver identity and exact F03 qualification authorization/policy refs.

K05 v1 explicitly prohibits:

```text
NEWEST_WINS
LLM_PREFERENCE
SIMPLE_AVERAGE
LOCAL_CALIBRATION_AS_KNOWLEDGE
```

Those shortcuts are rejected both as missing prohibitions and when embedded in the method specification. A method registration does not itself produce DerivedKnowledge, and downstream synthesis revalidates the exact method publication audit rather than trusting `kind=DerivationMethod` alone.

---

## 3. Qualified input closure

Every synthesis input must be an exact active `QualifiedKnowledge` authority for the synthesis scientific-use target.

K05 revalidates:

```text
QualifiedKnowledge
→ ScientificQualificationDecision(s)
→ exact F03 qualification authorization
→ Claim + SourceContext
→ accepted K03 source-faithful review
→ exact K03 reviewer authorization
```

Historical superseded, prohibited or revoked use authority is not silently accepted as a new synthesis input.

K05 v1 deliberately refuses cross-owner synthesis. Cross-organization/private-IP federation requires later explicit authority rather than implicit sharing.

---

## 4. DerivedKnowledgeContext

`DerivedKnowledgeContext` is not copied from one convenient SourceContext. It binds every material input:

```text
QualifiedKnowledge A → SourceContext A
QualifiedKnowledge B → SourceContext B
...
```

and retains exact input QualifiedKnowledge refs, every origin SourceContext ref, exact DerivationMethod ref, context policy, synthesis-introduced restrictions and unresolved context heterogeneity.

K05 does not silently average or erase heterogeneous source contexts.

---

## 5. DerivedKnowledge

`DerivedKnowledge` binds the governed derived assertion, semantic role, exact scientific-use target, exact input QualifiedKnowledge refs, exact DerivationMethod ref, exact DerivedKnowledgeContext ref, limitations, exact synthesis Scientific Approver authorization and ownership.

Its evidence class is explicitly:

```text
derivationEvidenceClass = SCIENTIFIC_ADJUDICATION_RECORD
```

Therefore K05 does **not** claim that a model, executable implementation or statistical program actually executed merely because a DerivedKnowledge record exists. Later executable-model/conformance authority remains separate.

F02 canonical lineage vocabulary is preserved. K05 uses:

```text
relation = derived_from
```

with explicit `lineageRole` values:

```text
QUALIFIED_KNOWLEDGE_INPUT
ORIGIN_SOURCE_CONTEXT
DERIVATION_METHOD
```

`DerivedKnowledge + DerivedKnowledgeContext + required lineage` are published all-or-none through the shared F02 atomic authority+lineage batch. A lineage preflight failure cannot leave an orphan DerivedKnowledge authority.

Authority remains scientific derivation authority only. It contains no TargetContext, ApplicabilityAssessment, CalibrationArtifact, RuntimeEligibility or DecisionResult.

---

## 6. KnowledgeConflict

A `KnowledgeConflict` represents explicit scientific incompatibility between at least two active qualified/derived knowledge authorities under one declared semantic role, one exact scientific-use target, explicit overlap assessment, explicit incompatibility/materiality assessment, and exact member/origin-context refs.

For a plain `QualifiedKnowledge`, semantic-role membership is explicitly authority of the conflict assessment; K05 does not pretend that K04 already minted a semantic role that does not exist there. For `DerivedKnowledge`, the role must match its own derivation authority.

`overlapAssessment` and `incompatibilityAssessment` are marked:

```text
assessmentSemantics = DECLARATIVE_SCIENTIFIC_JUDGMENT_ONLY
```

They are not executable runtime predicates by convention. Conflict creation is itself governed by Scientific Approver authorization and is revalidated downstream from exact member authority, F03 authorization and direct audit.

K05 v1 does not infer cross-owner conflicts and does not silently synthesize them.

---

## 7. Conflict resolution

K05 v1 legal resolution dispositions are:

```text
PRESERVE_ALTERNATIVES
DERIVED_SYNTHESIS
EXPLICIT_PRECEDENCE
CALIBRATION_REQUIRED
```

Rules:

- `PRESERVE_ALTERNATIVES` keeps all exact members and creates no winner.
- `DERIVED_SYNTHESIS` binds a valid DerivedKnowledge whose exact inputs close the complete all-QualifiedKnowledge conflict member set.
- `EXPLICIT_PRECEDENCE` requires one exact conflict member plus explicit precedence authority; `NEWEST_WINS` and `LLM_PREFERENCE` are forbidden.
- `CALIBRATION_REQUIRED` only records the need for separate calibration authority; it creates neither `CalibrationArtifact` nor DerivedKnowledge.

Resolution publication and its required conflict/supersession lineage are atomic. A resolution audit must bind every selected/derived/predecessor authority used by its semantics. Generic-ledger records that merely copy a plausible payload cannot become `currentResolution` unless the full authority chain validates.

Resolution revisions are immutable and must explicitly supersede the current active resolution with exact `supersedes` lineage.

---

## 8. Merge-blocking acceptance

K05 must prove:

1. every derived assertion retains all exact input QualifiedKnowledge refs;
2. every DerivedKnowledgeContext retains every input SourceContext;
3. derivation-method approval requires exact Scientific Approver authorization;
4. forbidden derivation shortcuts cannot hide inside method specifications;
5. insufficient-input pseudo-synthesis fails;
6. revoked QualifiedKnowledge cannot become a new synthesis input;
7. cross-owner synthesis fails in K05 v1;
8. scientific-use targets cannot be mixed silently;
9. forged DerivedKnowledge without exact synthesis audit/lineage fails validation;
10. KnowledgeConflict freezes exact members/context/overlap/incompatibility;
11. duplicate/single-member pseudo-conflicts fail;
12. precedence cannot use newest-wins or LLM preference;
13. preserve-alternatives does not invent a winner;
14. DerivedKnowledge resolution must cover the exact conflict member set;
15. CALIBRATION_REQUIRED creates no calibration/derived authority by implication;
16. conflict-resolution revisions require explicit supersession;
17. generic-ledger forged QualifiedKnowledge summaries fail downstream validation;
18. authority+lineage publication is all-or-none;
19. forged DerivationMethod cannot mint DerivedKnowledge;
20. forged KnowledgeConflict cannot become resolution input;
21. forged resolution cannot become current by copying payload/lineage while omitting selected authority audit;
22. declared resolution supersession without exact supersedes lineage cannot become current.

---

## 9. Explicit nonclaims

K05 does not establish KnowledgeRelease, cross-tenant/private-IP synthesis authority, automatic semantic conflict discovery, executable semantics for arbitrary assessment/limitation payloads, TargetContext / ContextManifest, Source→Target Applicability, CalibrationArtifact, Model/Policy/Implementation authority, runtime legality, DecisionResult, or causal truth.

Next only after exact-head acceptance and independent authority review: `MTL-K06 — KnowledgeRelease`.

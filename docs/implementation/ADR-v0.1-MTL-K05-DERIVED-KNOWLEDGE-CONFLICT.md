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

A `DerivationMethod` is an immutable scientific synthesis-method authority. It binds:

- method type;
- semantic role;
- minimum exact input count;
- context derivation policy;
- method specification;
- explicit forbidden shortcuts;
- ownership;
- Scientific Approver identity;
- exact F03 qualification authorization/policy refs.

K05 v1 explicitly prohibits:

```text
NEWEST_WINS
LLM_PREFERENCE
SIMPLE_AVERAGE
LOCAL_CALIBRATION_AS_KNOWLEDGE
```

A method registration does not itself produce DerivedKnowledge.

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

K05 v1 deliberately refuses cross-owner synthesis. Cross-organization/private-IP federation requires a later explicit authority design rather than implicit sharing.

---

## 4. DerivedKnowledgeContext

`DerivedKnowledgeContext` is not copied from one convenient SourceContext.

It binds every material input:

```text
QualifiedKnowledge A → SourceContext A
QualifiedKnowledge B → SourceContext B
...
```

and retains:

- exact input QualifiedKnowledge refs;
- every exact origin SourceContext ref;
- exact DerivationMethod ref;
- context derivation policy;
- synthesis-introduced restrictions;
- unresolved context heterogeneity.

K05 does not silently average or erase heterogeneous source contexts.

---

## 5. DerivedKnowledge

`DerivedKnowledge` binds:

- governed derived assertion;
- semantic role;
- exact scientific-use target;
- exact input QualifiedKnowledge refs;
- exact DerivationMethod ref;
- exact DerivedKnowledgeContext ref;
- limitations;
- exact synthesis Scientific Approver authorization;
- ownership;
- complete `DERIVED_FROM` / `DERIVED_BY` lineage.

`DerivedKnowledge + DerivedKnowledgeContext` are published atomically through the shared F02 ledger.

Authority: scientific derivation authority only.

It contains no TargetContext, ApplicabilityAssessment, CalibrationArtifact, RuntimeEligibility or DecisionResult.

---

## 6. KnowledgeConflict

A `KnowledgeConflict` represents explicit scientific incompatibility between at least two active qualified/derived knowledge authorities under:

- one declared semantic role;
- one exact scientific-use target;
- an explicit overlap assessment;
- an explicit incompatibility/materiality assessment;
- exact member and origin-context refs.

Conflict creation is itself governed by Scientific Approver authorization.

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

- `PRESERVE_ALTERNATIVES` keeps all exact members; it does not create a winner.
- `DERIVED_SYNTHESIS` must bind a valid DerivedKnowledge whose exact inputs close the complete all-QualifiedKnowledge conflict member set.
- `EXPLICIT_PRECEDENCE` requires one exact conflict member plus explicit precedence authority; `NEWEST_WINS` and `LLM_PREFERENCE` are forbidden.
- `CALIBRATION_REQUIRED` only records the need for separate calibration authority. It does not create a `CalibrationArtifact` or DerivedKnowledge.

Resolution revisions are immutable and must explicitly supersede the current active resolution.

---

## 8. Merge-blocking acceptance

K05 must prove:

1. every derived assertion retains all exact input QualifiedKnowledge refs;
2. every DerivedKnowledgeContext retains every input SourceContext;
3. derivation-method approval requires exact Scientific Approver authorization;
4. insufficient-input pseudo-synthesis fails;
5. revoked QualifiedKnowledge cannot become a new synthesis input;
6. cross-owner synthesis fails in K05 v1;
7. scientific-use targets cannot be mixed silently;
8. forged DerivedKnowledge without exact synthesis audit/lineage fails validation;
9. KnowledgeConflict freezes exact members/context/overlap/incompatibility;
10. duplicate/single-member pseudo-conflicts fail;
11. precedence cannot use newest-wins or LLM preference;
12. preserve-alternatives does not invent a winner;
13. DerivedKnowledge resolution must cover the exact conflict member set;
14. CALIBRATION_REQUIRED creates no calibration/derived authority by implication;
15. conflict-resolution revisions require explicit supersession;
16. generic-ledger forged QualifiedKnowledge summaries fail downstream validation.

---

## 9. Explicit nonclaims

K05 does not establish:

- KnowledgeRelease;
- cross-tenant/private-IP synthesis authority;
- automatic semantic conflict discovery from arbitrary corpus values;
- TargetContext / ContextManifest;
- Source→Target Applicability;
- CalibrationArtifact;
- Model/Policy/Implementation authority;
- runtime legality;
- DecisionResult;
- causal truth.

Next only after exact-head acceptance and independent authority review: `MTL-K06 — KnowledgeRelease`.

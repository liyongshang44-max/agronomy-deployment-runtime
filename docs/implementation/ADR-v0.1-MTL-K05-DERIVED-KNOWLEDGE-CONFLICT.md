# ADR v0.1 — MTL-K05 DerivedKnowledge / DerivedKnowledgeContext / Conflict

Status: **IMPLEMENTATION CONTRACT / NON-ARCHITECTURE-AUTHORITY**

Task: `MTL-K05 — DerivedKnowledge / DerivedKnowledgeContext / Conflict`

Baseline: `main @ e353666080dadb21d4a0d4ecb84182f5c3175cb6`

Upstream authority remains Architecture v1.0, Capability Map 01, Master Task Line 01 and Version Slicing 01.

---

## 1. Purpose

K04 established exact scientific-use authority for source-faithful knowledge. K05 introduces governed synthesis and explicit knowledge disagreement without collapsing either back into source Claim semantics.

Core transition:

```text
QualifiedKnowledge A
QualifiedKnowledge B
        +
exact KnowledgeDerivationMethod
        +
exact Scientific Approver authority
        ↓
DerivedKnowledge
+
DerivedKnowledgeContext
```

Separately:

```text
QualifiedKnowledge / DerivedKnowledge assertions
competing for the same semantic role
under overlapping scientific-use/origin conditions
        ↓
KnowledgeConflict
        ↓
explicit resolution authority or preserved alternatives
```

Permanent invariants:

```text
Claim ≠ QualifiedKnowledge ≠ DerivedKnowledge
SourceContext ≠ DerivedKnowledgeContext
DerivedKnowledge ≠ CalibrationArtifact
Conflict ≠ newest-wins selection
Conflict ≠ LLM preference
```

---

## 2. K05 conservative scope

K05 does not attempt to build a universal automated meta-analysis engine.

The first implementation supports governed derivation authority with these constraints:

1. every material input is an exact `QualifiedKnowledge` or already-governed `DerivedKnowledge` ref;
2. every input declares the exact scientific-use target under which it is being consumed;
3. source QualifiedKnowledge inputs must still have valid current `QUALIFIED` use authority at derivation time;
4. the derivation binds one exact immutable `KnowledgeDerivationMethod` specification;
5. final derived assertion/context materialization requires exact Scientific Approver authority;
6. the method and approval do not manufacture SourceContext provenance;
7. local/model calibration cannot enter this path as DerivedKnowledge merely because it produced a useful number.

This is sufficient to establish correct authority semantics before later automated synthesis implementations exist.

---

## 3. KnowledgeDerivationMethod

`KnowledgeDerivationMethod` is a first-class immutable semantic specification for a scientific synthesis/derivation operation.

It binds at least:

- method identity/version/hash;
- method class;
- accepted input knowledge classes;
- scientific-use contract;
- output semantic role/type contract;
- context-derivation contract;
- required evidence/metadata where applicable;
- limitations;
- whether human adjudication is mandatory;
- authority/provenance of method publication.

K05 v0.1 method classes may include:

```text
HUMAN_GOVERNED_SYNTHESIS
DETERMINISTIC_PARAMETER_SYNTHESIS
EXPLICIT_PRECEDENCE_SYNTHESIS
```

Registration of a method does not establish an executable implementation and does not create `ImplementationConformance`.

A future executor may implement the method, but K05 does not collapse:

```text
DerivationMethod specification
≠ executable implementation
```

---

## 4. DerivedKnowledge input binding

Each material input is represented as an exact binding:

```text
KnowledgeInputBinding
  knowledge_ref
  scientific_use_target
  role_in_derivation
```

The derivation service must resolve and validate each exact input authority.

For `QualifiedKnowledge` input:

- exact Claim/SourceContext/qualification lineage remains valid;
- requested scientific-use target must be explicitly `QUALIFIED`, not merely absent from forbidden uses;
- revoked/stale scientific-use authority is not derivation-eligible.

For `DerivedKnowledge` input:

- its own exact derivation lineage and DerivedKnowledgeContext must resolve;
- recursive provenance remains explicit;
- cycles are forbidden.

A derivation may not accept a bare Claim, compiler candidate, calibration artifact or runtime result as if it were QualifiedKnowledge.

---

## 5. DerivedKnowledge

`DerivedKnowledge` is a new governed scientific assertion.

It must bind:

- exact input knowledge bindings;
- exact derivation method ref;
- derived assertion / structured scientific payload;
- output semantic role;
- recognized scientific-use target(s) explicitly granted by the derivation authority;
- exact DerivedKnowledgeContext ref;
- limitations / unresolved heterogeneity;
- Scientific Approver identity/authorization;
- full derivation lineage;
- semantic hash.

It must never copy an arbitrary input `SourceContext` and label it as its own origin context.

K05 v0.1 will not allow a derivation to silently broaden scientific-use authority beyond what the method and exact approval state. An input qualified only for use A cannot become output authority for use B by omission or naming convention.

---

## 6. DerivedKnowledgeContext

`DerivedKnowledgeContext` is the governed source-side/origin applicability domain of the new DerivedKnowledge assertion.

It binds at least:

- exact DerivedKnowledge ref;
- all material input knowledge refs;
- every material input origin-context ref;
- exact derivation method ref;
- context restrictions introduced by the method/adjudication;
- preserved context dimensions;
- unresolved context heterogeneity;
- limitations;
- semantic hash.

For transport purposes:

```text
QualifiedKnowledge → SourceContext
DerivedKnowledge   → DerivedKnowledgeContext
```

K05 does **not** define TargetContext or perform Source→Target applicability.

### 6.1 No automatic context laundering

K05 v0.1 does not implement a generic `INTERSECTION`, `UNION` or averaging rule over source contexts merely because those operations are computationally convenient.

The derivation method must state how context is handled, and the final DerivedKnowledgeContext must be explicitly adjudicated/approved.

If source contexts remain materially heterogeneous, that heterogeneity is preserved as authority data rather than silently collapsed.

---

## 7. KnowledgeConflict

`KnowledgeConflict` represents incompatible governed assertions competing for the same semantic role under overlapping scientific-use/origin conditions.

It binds:

- exact competing knowledge refs;
- exact scientific-use target;
- exact semantic role;
- origin-context refs;
- conflict class/reason;
- overlap/competition basis;
- limitations / unresolved dimensions;
- detection/adjudication authority;
- lifecycle status;
- semantic hash.

K05 does not require that every conflict be discovered by a universal automated detector. It requires that a detected/material conflict become an explicit immutable authority object rather than being hidden by selection order.

Forbidden resolution shortcuts:

```text
latest version wins
highest confidence wins
LLM chooses one
simple average of incompatible contexts
first retrieved wins
tenant preference masquerades as scientific precedence
```

---

## 8. Conflict resolution

A conflict may remain unresolved. Unresolved conflict is a legal scientific state.

K05 v0.1 resolution authority distinguishes at least:

```text
RESOLVED_BY_DERIVED_KNOWLEDGE
RESOLVED_BY_EXPLICIT_PRECEDENCE
PRESERVE_AS_ALTERNATIVES
REQUIRES_CALIBRATION
DEFER_UNRESOLVED
```

Rules:

- `RESOLVED_BY_DERIVED_KNOWLEDGE` must bind an exact DerivedKnowledge ref whose input lineage covers the material competing knowledge refs;
- `RESOLVED_BY_EXPLICIT_PRECEDENCE` requires explicit Scientific Approver authority and a stated scientific precedence rationale; commercial preference is not scientific precedence;
- `PRESERVE_AS_ALTERNATIVES` does not choose a winner and leaves both knowledge objects available for later RuntimeAlternativeSet handling;
- `REQUIRES_CALIBRATION` does not create CalibrationArtifact and does not mark the conflict scientifically resolved;
- `DEFER_UNRESOLVED` remains unresolved by definition.

Only resolution modes that actually establish a governed scientific resolution may transition conflict lifecycle to `RESOLVED`.

---

## 9. Authorization

Creating final DerivedKnowledge/DerivedKnowledgeContext or resolving scientific conflict requires exact F03 scientific qualification authority.

K05 reuses the existing `KNOWLEDGE_QUALIFY` permission for scientific-control-plane judgments; it does not invent a new IAM permission outside frozen architecture/planning authority.

The exact policy resource must bind the authority being exercised:

```text
knowledge-derivation:<exact inputs + method + use>
knowledge-conflict:<exact competing refs + semantic role + use>
```

Compiler, runtime service, ordinary agronomy reviewer or adapter authority is insufficient.

---

## 10. Atomicity

Final `DerivedKnowledge + DerivedKnowledgeContext` publication is semantically all-or-none.

A derivation review/adjudication record may exist independently, but ADR must not persist a final DerivedKnowledge authority without its exact DerivedKnowledgeContext or vice versa.

Durable database ACID remains an operational implementation concern; semantic atomicity is a K05 authority requirement.

---

## 11. Merge-blocking acceptance targets

K05 implementation must prove at least:

1. exact qualified inputs + exact governed method + exact approver can mint DerivedKnowledge + DerivedKnowledgeContext;
2. revoked/unqualified input use cannot participate in derivation;
3. bare Claim / compiler candidate / CalibrationArtifact cannot masquerade as qualified input;
4. DerivedKnowledgeContext cannot equal/copy an arbitrary input SourceContext by shortcut;
5. every material input origin context remains in lineage;
6. derivation cannot broaden scientific-use authority silently;
7. final DerivedKnowledge/Context publication is all-or-none;
8. cyclic derived-knowledge lineage is rejected;
9. materially competing governed knowledge can create explicit KnowledgeConflict;
10. retrieval/version order cannot auto-resolve conflict;
11. LLM preference/newest-wins/simple averaging cannot become resolution authority;
12. conflict resolution by DerivedKnowledge requires full material-input coverage;
13. explicit precedence requires exact Scientific Approver authorization;
14. `REQUIRES_CALIBRATION` remains unresolved until separate CalibrationArtifact authority exists;
15. preserving alternatives does not create a scientific winner;
16. conflict resolution cannot mutate historical knowledge objects.

---

## 12. Explicit nonclaims

K05 does **not** establish:

- KnowledgeRelease (`MTL-K06`);
- automatic discovery of every scientific conflict;
- general-purpose statistical meta-analysis correctness;
- Model/Policy/Transformation implementation authority;
- CalibrationArtifact;
- Source→Target Applicability;
- RuntimeAlternativeSet;
- RuntimeEligibility;
- DecisionResult;
- causal truth;
- commercial precedence as scientific precedence.

Next after K05 acceptance:

`MTL-K06 — KnowledgeRelease`.

# Agronomy Deployment Runtime — Capability Map 01 Final Planning Adjudication

Status: **PLANNING FINAL / NON-ARCHITECTURE-AUTHORITY**

Architecture baseline: `main @ 4852912699741e9491f4e92611251b561108488e`

Capability Map baseline: `docs/planning/ADR-CAPABILITY-MAP-01.md`

Purpose: close the final planning-only dependency and commercial-closure seams found while cross-reviewing the two independently derived capability maps. This document does **not** amend Architecture v1.0, add any new domain authority object, or reopen any `DEC-xxxx` architecture decision.

Where this document conflicts with `ADR-CAPABILITY-MAP-01.md`, this document controls that planning seam only. All non-conflicting Capability Map 01 content remains unchanged.

---

## 1. Canonical capability-map line

The canonical planning line is:

```text
PR #2
branch: docs/capability-map-01
file: docs/planning/ADR-CAPABILITY-MAP-01.md
```

The independently derived PR #3 capability map is superseded as a duplicate planning derivation. It discovered no Architecture v1.0 authority capability absent from Capability Map 01 that requires an architecture amendment.

Capability Map 01 remains C00–C23. No renumbering is introduced by this adjudication.

---

## 2. C06 requires C07 before full capability acceptance

`C06 — Agronomic Context Contract, Reference Resolution and Immutable ContextManifest` includes the ability to freeze a complete `ContextManifest`.

Architecture v1.0 requires a ContextManifest to bind the exact `DecisionProblem` used for the runtime compilation. Therefore C06 as a **complete capability** cannot pass before C07 exists.

Corrected dependency:

```text
C06 hard predecessors:
- C00
- C01
- C02
- C07
```

This does not imply that the ContextDatum schema, reference-ingress contract, or reference-resolution implementation must wait for C07. Those implementation parts may be developed earlier or in parallel. The rule is only:

> C06 must not be declared capability-complete until a ContextManifest can freeze an exact DecisionProblem reference.

Invariant:

```text
Context contract may precede DecisionProblem implementation,
but complete ContextManifest authority may not.
```

---

## 3. C09 has conditional, not universal, dependencies on Transformation and Calibration authority

The original C09 wording listed C10 in a way that could be read as a universal hard predecessor even though the text itself limited it to governed-transform paths.

Corrected dependency:

```text
C09 hard predecessors:
- C04
- C05
- C06
- C07
- C08

C09 conditional predecessors:
- C10 when APPLICABLE_WITH_GOVERNED_TRANSFORM or another governed transformation path is exercised
- C12 when a pre-existing qualified CalibrationArtifact is required to close a path beyond CALIBRATION_REQUIRED
```

Important distinction:

```text
Detect CALIBRATION_REQUIRED
≠
Satisfy CALIBRATION_REQUIRED
```

C09 may legitimately return `CALIBRATION_REQUIRED` without C12 being implemented. C12 becomes necessary only when ADR claims that calibration authority has been satisfied and uses that authority downstream.

Likewise, C09 may adjudicate `DIRECTLY_APPLICABLE`, `UNRESOLVED`, `CONFLICT`, `BOUNDED_EXTRAPOLATION` or `NOT_RELEVANT` without requiring a Transformation registry path that is not actually exercised.

---

## 4. C13 must support a minimal RuntimeProfile without forcing the full specification stack

The original C13 predecessor set could be read as forcing C10 before any RuntimeProfile/Deployment authority exists.

That would unnecessarily block the early applicability/escalation product, even though Architecture v1.0 permits a RuntimeProfile whose current use does not exercise Model/Policy/Transformation execution.

Corrected dependency:

```text
C13 hard predecessors:
- C01
- C02
- C05

C13 conditional predecessors:
- C10 when Transformation / Model / Policy constraints are exercised
- C11 when Implementation / ImplementationConformance constraints are exercised
- C12 when Calibration constraints or qualified calibration authority are exercised
```

A minimal RuntimeProfile may therefore freeze, where valid for the active product path:

```text
KnowledgeRelease
context requirements
replay requirements
runtime governance
allowed use / deployment constraints
```

without pretending that unexercised Model/Policy/Implementation/Calibration authorities already exist.

This does not weaken later Decision Runtime requirements. Any path that actually binds or executes those authority types must satisfy their corresponding capability predecessors.

---

## 5. Gate A is narrowed to the minimum commercial Applicability / Escalation proof

The original Gate A included C14/C15 RuntimePlan/RuntimeEligibility reasoning and was therefore heavier than the smallest commercially useful applicability product.

To keep the planning map aligned with the first commercial wedge, Gate A is redefined as:

## Gate A — Applicability / Agronomist Escalation Proof

Requires:

```text
Gate K
+ C06
+ C07
+ C13-min
+ C08
+ C09
+ the C22 applicability/escalation surface
```

where `C13-min` means a valid minimal RuntimeProfile/Deployment that does not exercise absent Model/Policy/Implementation/Calibration authorities.

Gate A proves that ADR can take:

```text
Exact company agronomy
        ↓
Qualified KnowledgeRelease
        ↓
Exact DecisionProblem
        ↓
Immutable ContextManifest
        ↓
Replayable KnowledgeRetrievalResult
        ↓
Source→Target Applicability
        ↓
Explainable expert escalation classification
```

and distinguish at least:

```text
DIRECTLY_APPLICABLE
APPLICABLE_WITH_GOVERNED_TRANSFORM where supported
CALIBRATION_REQUIRED
BOUNDED_EXTRAPOLATION
UNRESOLVED
CONFLICT
NOT_RELEVANT
```

Gate A does **not** claim:

```text
RUNTIME_ELIGIBLE
ACT
WAIT
agronomic effectiveness
causal benefit
```

`NO_REVIEW_REQUIRED` remains a product/read-model classification only. It is not a scientific qualification state, a RuntimeEligibility value, or a DecisionResult.

---

## 6. New planning closure: Gate R — Runtime Legality Proof

A distinct planning gate is introduced to keep three product statements separate:

```text
Applicability
≠ Runtime Legality
≠ Decision
```

Gate R is a planning closure only; it is not a new Architecture v1.0 authority object.

## Gate R — Runtime Legality Proof

Requires:

```text
Gate A
+ C10 as exercised
+ C14
+ C15
+ C11/C12 conditionally as required by the exercised runtime path
```

Gate R proves that ADR can compile explicit runtime alternatives/requirements and answer whether a legal runtime world exists:

```text
RUNTIME_ELIGIBLE
RUNTIME_ELIGIBLE_WITH_LIMITATIONS
INFORMATION_REQUIRED
NO_LEGAL_RUNTIME
```

Gate R still does not authorize an action.

Forbidden claim:

```text
RuntimeEligibility
→ ACT / WAIT
```

---

## 7. Gate D now depends on Gate R

Gate D remains the full Decision Runtime proof, but its dependency is clarified:

```text
Gate D
=
Gate R
+ C16
+ C17
+ C18
+ C19
+ C11/C12 as exercised
```

It proves exact RuntimeBinding, executable/conformant runtime paths, RuntimeDatum semantics, RuntimeAlternativeSet coverage, DecisionRobustness and structured DecisionResult where decision authority mode permits.

The permanent separation remains:

```text
Gate A: Is the agronomy applicable here?
Gate R: Is there a legal runtime world?
Gate D: Is there an authorized, sufficiently robust decision?
```

---

## 8. Corrected principal dependency interpretation

The planning dependency graph is normatively interpreted as:

```text
C00
 ↓
C01 ─────► C02
 │          │
 │          ├──────────────► C07 DecisionProblem
 │          │                    │
 │          │                    ▼
 │          ├──────────────► C06 Context / Manifest
 │          │
 │          ├──────────────► C03 Source / Compile
 │          │                    ↓
 │          │                   C04
 │          │                    ↓
 │          │                   C05 KnowledgeRelease
 │          │
 │          └──────────────► C10 Specs (parallel authority family)
 │
C05 + C07 + C13-min
        ↓
       C08 Retrieval
        ↓
C06 + C08 + C07
        ↓
       C09 Applicability
        ↓
     Gate A
        ↓
C10 as used + C14
        ↓
       C15 Information / RuntimeEligibility
        ↓
     Gate R
        ↓
       C16 RuntimeBinding
        ↓
C11 as used → C17 Runtime execution
        ↓
       C18 AlternativeSet / Robustness
        ↓
       C19 DecisionResult
        ↓
     Gate D
        ↓
       C20 Evaluation / Effect attribution
```

C12 Calibration enters only when the exercised path requires qualified calibration authority.

---

## 9. Duplicate-map disposition

The separate Chinese Capability Map PR #3 is a superseded duplicate planning derivation.

Its useful conclusions have been cross-checked against Capability Map 01. The comparison increased confidence in capability coverage but did not justify maintaining two canonical maps.

From this adjudication onward:

```text
Canonical Capability Map:
ADR-CAPABILITY-MAP-01 + this Final Planning Adjudication

Superseded duplicate:
PR #3 / ADR-CAPABILITY-MAP-v0.1-zh-CN.md
```

No Master Task Line may derive simultaneously from both maps.

---

## 10. Architecture contradiction disposition

These corrections are planning dependency/closure corrections only.

They do not create any Architecture v1.0 contradiction and do not require a `DEC-xxxx` amendment.

Architecture v1.0 remains closed.

The next planning frontier after Capability Map 01 is frozen is:

```text
ADR-MASTER-TASK-LINE-01
```

The Master Task Line must derive from the corrected hard/conditional predecessor graph above and must not infer implementation order merely from C-number order.

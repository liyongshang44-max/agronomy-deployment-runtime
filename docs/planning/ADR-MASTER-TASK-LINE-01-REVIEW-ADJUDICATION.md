# Agronomy Deployment Runtime — Master Task Line 01 Review Adjudication

Status: **PLANNING REVIEW / NON-ARCHITECTURE-AUTHORITY**

Master Task Line baseline: `docs/planning/ADR-MASTER-TASK-LINE-01.md`

Repository baseline used for derivation: `main @ e689d837f4ec6dfd3dc6b4714345256fbae2a900`

Purpose: record the independent cross-check of Master Task Line 01 against the frozen Capability Map 01 and correct task-planning seams without reopening Architecture v1.0 or changing C00–C23 semantics.

Where this document conflicts with Master Task Line 01, this document controls that task-planning seam only.

---

## 1. MTL-S01 does not inherit C06/C07 as a capability-level hard dependency

Capability C10 (`Transformation / Model / Policy Specification Authority`) has hard predecessors C01 and C02. Master Task Line 01 scheduled `MTL-S01` after the shared context semantic basis in `MTL-A02` so that specifications reuse the same public semantic vocabulary.

That sequencing is useful, but it must not be misread as a new capability dependency.

Normative task interpretation:

```text
MTL-S01 hard capability predecessors:
- Gate F (C01/C02 available)

Shared implementation coordination:
- reuse the canonical semantic primitives established by the public context-contract work;
- MTL-S01 and the semantic-contract portion of MTL-A02 may proceed in parallel if both consume one shared canonical semantic contract rather than defining competing vocabularies.
```

Therefore the Master Task Line must not claim:

```text
C10 requires complete C06
or
C10 requires DecisionProblem/C07
```

The implementation objective is a **single semantic vocabulary**, not an artificial serial dependency.

---

## 2. Gate A escalation labels must not reuse RuntimeEligibility authority values

Gate A is intentionally before Gate R. Therefore its product/read-model classifications must not use a label that could be confused with the frozen `RuntimeEligibility` enum.

In particular, any Gate A wording resembling:

```text
INFORMATION_REQUIRED
```

must be interpreted/replaced at the product read-model layer by a non-authority classification such as:

```text
CONTEXT_GAP
EVIDENCE_NEEDED_CANDIDATE
AGRONOMIST_REVIEW_REQUIRED
KNOWLEDGE_CONFLICT
CALIBRATION_NEEDED
GOVERNED_TRANSFORM_NEEDED
NO_REVIEW_CANDIDATE
```

The exact UI taxonomy may be frozen later, but the invariant is immediate:

```text
Gate A workflow classification
≠ InformationRequirement authority
≠ RuntimeEligibility.INFORMATION_REQUIRED
```

A true `InformationRequirement` and `RuntimeEligibility.INFORMATION_REQUIRED` can only be created after MTL-R01/R02/R03 on the Gate R path.

Likewise:

```text
DIRECTLY_APPLICABLE
≠ NO_REVIEW_CANDIDATE automatically
```

A no-review candidate may additionally depend on deployment/workflow policy, unresolved conflicts, required human gates or other governed product rules. The read model cannot weaken scientific/runtime authority merely to reduce review volume.

---

## 3. Full Gate E requires EffectAttribution capability even when a particular evaluation is non-causal

Master Task Line 01 correctly allows ordinary OutcomeEvaluation to remain descriptive/associational and forbids causal laundering. However, a distinction is required between:

```text
a product slice that intentionally exposes no causal/effect-attribution capability
```

and:

```text
claiming full Gate E / C20 capability closure.
```

Corrected interpretation:

```text
Descriptive evaluation slice:
MTL-E01 + MTL-E02 + MTL-E04
and no causal/effect attribution API/UI claim.

Full Gate E / C20 closure:
MTL-E01 + MTL-E02 + MTL-E03 + MTL-E04.
```

`MTL-E03` therefore becomes mandatory before the project claims full Gate E capability, even though any individual OutcomeEvaluation may legitimately state that no causal attribution is supported.

This preserves:

```text
Outcome ≠ CausalEffect
```

without requiring every outcome to have a causal estimate.

---

## 4. Gate A remains the first commercial wedge; Gate R remains a separate technical claim

Cross-checking task dependencies did not reveal a reason to move RuntimePlan or RuntimeEligibility back into Gate A.

The frozen planning separation remains:

```text
Gate A:
Is this agronomy applicable/transportable here, and does an expert need to inspect the case?

Gate R:
Is there a legal runtime world?

Gate D:
Is there an authorized and sufficiently robust structured decision?
```

No Master Task Line implementation may merge these gates for convenience.

---

## 5. Non-GEOX reference acceptance remains before GEOX first-party adapter

`MTL-P03` before `MTL-P04` is retained as an implementation-order guardrail, even though it is not a new Architecture v1.0 dependency.

Reason:

> The earliest external integration proof should demonstrate that public ADR contracts work without inheriting GEOX schemas or runtime assumptions before GEOX becomes the first-party reference consumer.

This strengthens C00 constitutional acceptance and reduces the risk of accidental GEOX-shaped public contracts.

It does not make GEOX a second-class integration; GEOX remains the first-party reference consumer and field-validation substrate after independence has been demonstrated.

---

## 6. Review result

After these task-planning clarifications:

- all C00–C23 capability families remain covered;
- no current-binding self-authorization cycle is introduced;
- no Evaluation→Control mutation is introduced;
- no Adapter scientific authority is introduced;
- no new Architecture v1.0 object is required;
- Gate A / Gate R / Gate D remain cleanly separated;
- no `DEC-xxxx` amendment is required.

The remaining review question before freezing Master Task Line 01 is therefore not architecture correctness, but **task granularity and version-slicing usefulness**: whether the Task units are small enough to produce exact acceptance evidence while large enough not to turn the Master Task Line into a package-by-package backlog.

If accepted, the next planning frontier remains:

```text
ADR-VERSION-SLICING-01
```

# ADR v0.1 — MTL-K04 Independent Review Adjudication

Status: **IMPLEMENTATION REVIEW / NON-ARCHITECTURE-AUTHORITY**

Baseline under review: `main @ 30b624bb0b00d9d035281825dc4529fa1d61c9d8`

This review does not reopen Architecture v1.0 or planning authority. It records merge-blocking implementation seams found while reviewing K04 and the exact closure required before merge.

## 1. Review conclusion

K04's core transition is accepted in principle:

```text
source-faithful Claim + SourceContext
+ exact F03 Scientific Approver authority
→ ScientificQualificationDecision
→ QualifiedKnowledge
```

The following seams were treated as substantive rather than deferred operational work.

## 2. Closed seam — arbitrary qualification target semantics

A free-form qualification target could create authority whose meaning later consumers interpret inconsistently.

Closure:

```text
qualificationTarget v1 = { use }
```

Context-specific scientific conditions remain explicit limitations / semantic preconditions / effect modifiers / transport constraints. They are not hidden in ad-hoc target fields.

## 3. Closed seam — K03 accepted-review laundering

K04 must not trust `ACCEPT_SOURCE_FAITHFUL` vocabulary alone.

Closure: K04 re-resolves and recomputes the exact K03 reviewer authorization chain, including source-scoped policy, exact principal, role assignments and `SOURCE_READ + KNOWLEDGE_INSPECT` capability.

## 4. Closed seam — direct ScientificQualificationDecision forgery

A generic ledger record with the right field names is not sufficient qualification authority.

Closure: QualifiedKnowledge publication revalidates exact F03 qualification authorization and requires direct decision-publication audit by the exact scientific approver binding Claim, SourceContext, authorization and policy refs.

## 5. Closed seam — active-branch cherry picking

Two independently authorized scientific judgments can legitimately disagree. QualifiedKnowledge must not select only the convenient branch.

Closure: publication checks the complete active decision set for each exact Claim/SourceContext/use target. Multiple active branches block publication.

## 6. Closed seam — unrecoverable conflict fork

Representing disagreement is insufficient if the model cannot later converge it.

Closure: `ScientificQualificationDecision` persists plural `supersedesDecisionRefs`. A resolving judgment must supersede the complete currently-active branch set for that exact use. Partial branch closure fails. One-parent requalification is the same mechanism with one predecessor.

## 7. Closed seam — revocation resurrection

Revoking only a QualifiedKnowledge snapshot while leaving its underlying `QUALIFY_USE` decision active would allow the same decision to mint a new QualifiedKnowledge and silently restore authority.

Closure: use-specific revocation creates an authorized `PROHIBIT_USE` decision that supersedes the active allow decision, plus a `ScientificQualificationRevocation` audit authority bound to the historical QualifiedKnowledge and exact decision transition. The old allow decision becomes stale and cannot mint another QualifiedKnowledge. Later requalification must supersede the active prohibition decision.

## 8. Constraint payload boundary

K04 preserves limitations, effect modifiers, semantic preconditions and transport constraints as exact qualified scientific payloads. This review explicitly does **not** grant those arbitrary objects executable runtime semantics.

Future Applicability/Runtime work must support a constraint vocabulary explicitly. Unsupported shapes remain limitations/information gaps; they cannot be silently interpreted by convention.

## 9. Remaining nonclaims, not merge blockers

- production authentication/SSO/MFA is not established;
- durable database transactionality is not established;
- K04 does not implement broader K05 `KnowledgeConflict` across different QualifiedKnowledge assertions;
- K04 does not establish Source→Target Applicability;
- mechanical QualifiedKnowledge assembly does not itself create a new scientific judgment beyond its exact authorized decision refs;
- deployment entitlement remains independent from scientific qualification.

Subject to exact-head merge-ref acceptance remaining green, no substantive K04 authority seam identified by this review requires reopening Architecture v1.0 or blocking progression to K05.

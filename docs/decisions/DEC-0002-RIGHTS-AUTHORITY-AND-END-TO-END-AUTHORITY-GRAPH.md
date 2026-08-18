# DEC-0002 — Rights Authority and End-to-End Authority Graph

Status: **PROPOSED — NORMATIVE ON MERGE**

Date: 2026-08-18

## Decision

ADR is governed as an **Authority DAG**, not as a transformation pipeline. An edge means that downstream authority cannot legally be produced or consumed without the exact upstream authority required by that operation.

The end-to-end product graph is interpreted as:

```text
Source
  ↓
SourceArtifact
  ├──────────── RightsPolicy / RightsGrant / RightsDecision
  ↓
Scientific Compile → ClaimCandidate + SourceContextCandidate
  ↓
Source-faithful Review
  ↓
Scientific Qualification
  ↓
QualifiedKnowledge / DerivedKnowledge
  ↓
Applicability against exact Target Context
  ↓
KnowledgeRelease
  ↓
KnowledgeRetrievalResult
  ↓
RuntimePlan → InformationRequirements → RuntimeEligibility
  ↓
RuntimeBinding → RuntimeAlternativeSet → RuntimeResult
  ↓
DecisionRobustness
  ↓
DecisionResult, when decision authority mode permits
  ↓
Decision evidence projection / audit traversal
```

`Rights Authority` is an orthogonal prerequisite graph that gates use of Source/SourceArtifact and downstream source-derived knowledge. It does not replace scientific qualification, applicability, release governance, runtime legality, decision authority, or principal authorization.

## 1. Rights and Authorization are separate authority families

ADR already has principal authorization answering:

> Is this principal authorized to perform this platform action in this scope?

Rights Authority answers a different question:

> May this exact source material or source-derived material be used for this operation, purpose, jurisdiction and time?

Both may be required at the same enforcement point.

Invariant:

```text
PrincipalAuthorization ≠ RightsAuthority
```

A principal with `source.read` or compiler permissions does not thereby obtain content-use rights. Conversely, a valid content-use grant does not grant the principal a platform role.

## 2. Existing Source rights metadata is not executable Rights Authority

`Source.rights` and `SourceArtifact.rightsSnapshot` remain provenance metadata. They may inform policy creation and audit, but they do not themselves authorize retention, model egress, derived retention, redistribution or production use.

Invariant:

```text
rights metadata ≠ RightsDecision
```

## 3. RA01 authority objects and administration root

RA01 defines four immutable authority kinds:

- `RightsPolicy` — the scoped platform rights policy root and basis;
- `RightsGrant` — positive authorization for an exact Source or SourceArtifact subject, grantee scope, operation set and validity interval;
- `RightsDecision` — deterministic point-in-time `ALLOW | DENY` evaluation for one exact requested use;
- `RightsRevocation` — immutable revocation authority over an exact RightsGrant.

All four use normal `AuthorityLedger` identity, semantic hashing, audit and lineage rules.

`RightsRevocation` must create explicit `revokes` lineage to the exact `RightsGrant`.

RA01 deliberately has **no implicit rights-administration delegation**. Until a later explicit `rights.manage`-style authorization authority is designed and accepted:

```text
RightsGrant.grantorPrincipal   == exact RightsPolicy.ownerPrincipal
RightsRevocation.revokerPrincipal == exact RightsPolicy.ownerPrincipal
```

Being in the same organization or tenant is insufficient to create or revoke rights authority. Future delegation must be explicit authority; it may not be inferred from tenancy, UI role, or possession of the source.

The `RightsPolicy` is the ADR on-platform trust root for the recorded rights basis. A recorded contract/license/customer assertion is not itself an independent legal opinion by ADR.

## 4. Frozen v1 operation vocabulary

```text
ACQUIRE
RETAIN_FULLTEXT
READ_FOR_EXTRACTION
EXTRACT_CLAIM
CREATE_EMBEDDING
MODEL_EGRESS
RETAIN_DERIVED
DISPLAY_EXCERPT
REDISTRIBUTE
EXPORT
TRAIN_MODEL
USE_FOR_PRODUCTION_DECISION
```

Unknown operations fail closed.

## 5. Default deny and conditional semantics

The v1 constitutional default is:

```text
NO APPLICABLE GRANT = DENY
UNKNOWN = DENY
```

Execution-facing `RightsDecision` has only:

```text
ALLOW | DENY
```

A future policy language may express conditions, but unresolved conditions cannot surface as an executable `CONDITIONAL` allow. Conditions must be satisfied by governed evidence or the use remains denied.

## 6. Exact subjects; no silent inheritance

RA01 accepts exact subjects only:

```text
Source@version/hash
SourceArtifact@version/hash
```

A grant to a Source does **not** silently grant the same operation on a SourceArtifact, and a grant to one SourceArtifact does not transfer to another materialization. Any inheritance or derivation introduced later must be explicit authority with exact lineage.

This prevents rights expansion through implementation convenience.

## 7. Time semantics and historical replay

Rights authority is bi-temporal enough to preserve historical explanation:

- a RightsGrant records `issuedAt` and `validFrom/validUntil`;
- a RightsRevocation records `recordedAt` and `effectiveAt`;
- a RightsDecision records the exact `evaluatedAt`.

The semantic publication timestamp is bound to the direct AuthorityLedger audit timestamp for Policy, Grant, Revocation and Decision publication. A caller may not backdate the semantic authority time independently of its recorded publication audit.

Historical evaluation considers only grant/revocation authority that had been issued/recorded by the evaluation time. Therefore a later-entered grant or later-recorded revocation cannot silently rewrite the authority world the system actually knew when an earlier decision was made.

A historical RightsDecision may remain replay-valid after grant expiry or later revocation.

However, a RightsDecision is **point-in-time only**. It cannot authorize a later production action. New use must evaluate current rights at the exact action time.

Invariant:

```text
historical replay validity ≠ current-use eligibility
```

## 8. Rights obligations are mandatory enforcement requirements

An ALLOW may carry mandatory obligations such as:

```text
NO_MODEL_TRAINING
DELETE_PROVIDER_COPY
NO_REDISTRIBUTION
```

RA01 preserves these obligations in RightsDecision authority. They are not advisory labels.

Before a consumer may treat an ALLOW as executable, it must explicitly declare that it can enforce every obligation attached to that exact RightsDecision. If any obligation is unsupported, use fails closed.

```text
RightsDecision = ALLOW
+ unsupported mandatory obligation
= NOT EXECUTABLE
```

Declaring an enforcement capability does **not** prove that the obligation was actually fulfilled. Later enforcement slices must retain execution evidence where an obligation requires an observable action, such as deletion of a provider copy.

## 9. Closed semantic shapes

Every RA01 authority payload is a closed contract. Unknown semantic fields at the policy, grant, revocation, decision, principal, ownership, basis, grantee or rule level are rejected.

This is required because `AuthorityLedger` is intentionally generic. A caller may not publish a typed Rights object with additional hashed-but-ignored semantics and then rely on a permissive validator to launder it into effective authority.

Invariant:

```text
hashed hidden field ≠ ignored extension
hashed hidden field = invalid Rights authority
```

## 10. Planned enforcement order

After RA01 is accepted, integration proceeds without reopening the established scientific/runtime architecture:

```text
RA01 Rights Authority Contract + Engine
  ↓
RA02 Source retention / read / model-egress enforcement
  ↓
RA03 Scientific Qualification rights binding
  ↓
RA04 KnowledgeRelease current-rights gate
  ↓
RA05 DecisionEvidenceBundle deterministic projection
  ↓
RA06 Workbench + Public API exposure
  ↓
RA07 adversarial commercial acceptance
  ↓
RA08 15-minute customer demonstration
```

The `RAxx` namespace is used because `R01/R02/R03` already identify existing Runtime Plan / Information Requirement / Runtime Eligibility milestones.

## 11. Enforcement points

Later integration must evaluate Rights Authority **before** the dangerous side effect.

Examples:

```text
RETAIN_FULLTEXT
  -> decide before bytes enter retained content storage

MODEL_EGRESS
  -> decide before SourceArtifact bytes are handed to an external provider

RETAIN_DERIVED
  -> decide before derived source material is persisted as reusable knowledge material

USE_FOR_PRODUCTION_DECISION
  -> decide in the current KnowledgeRelease/runtime authority world before new production use
```

A UI warning or post-hoc audit is not enforcement.

## 12. Qualification and Release remain separate

Scientific Qualification continues to answer scientific-use qualification. Rights does not certify scientific truth.

```text
Rights ALLOW + Scientific PROHIBIT_USE = no qualified use
Rights DENY  + Scientific QUALIFY_USE  = no legal source-derived use
```

`Qualified ≠ Applicable` remains unchanged.

KnowledgeRelease keeps its frozen exact `memberRefs` semantics. Current rights validation must be added beside existing publication, entitlement, conflict and lifecycle validation; it must not mutate a historical release in place.

Expected future behavior:

```text
historical KnowledgeRelease replay: may remain valid
new production use after rights expiry/revocation: BLOCK
required remediation: publish a new legal release/world, never mutate the old release
```

## 13. Decision path remains non-RAG authority

This decision does not weaken the existing runtime chain. Retrieval may discover candidates, but it does not become decision authority.

The established chain remains:

```text
DecisionProblem
→ ContextManifest
→ KnowledgeRetrievalResult
→ ApplicabilityAssessment
→ RuntimePlan
→ InformationRequirement
→ RuntimeEligibility
→ RuntimeBinding
→ RuntimeAlternativeSet
→ RuntimeResult
→ DecisionRobustness
→ DecisionResult
```

`RuntimeEligibility` remains explicitly non-decision authority, and DecisionResult callers remain unable to self-author disposition/action semantics.

## 14. Decision evidence

The final `DecisionEvidenceBundle` should be a deterministic projection/read model over exact AuthorityLedger refs and audit/lineage, not a parallel mutable fact store and not a new source of scientific or decision authority.

It should make traversal possible from:

```text
DecisionResult
→ KnowledgeRelease
→ QualifiedKnowledge
→ Claim / SourceContext
→ SourceArtifact locator
→ exact SourceArtifact content hash
```

and include the exact RightsDecision refs that legalized the source/material use relevant to the decision.

## 15. Non-goals of RA01

RA01 does not yet:

- intercept SourceRegistry storage;
- intercept external model network egress;
- bind rights into ScientificQualificationDecision;
- bind current rights into KnowledgeRelease validation;
- alter Claim or SourceContext schema;
- add multi-locator evidence authority;
- alter RuntimeEligibility or DecisionResult semantics;
- implement delegated rights administration;
- claim that a customer assertion or recorded license basis is independently verified legal advice.

Those are later explicit integration slices.

## Acceptance principle

The foundation is acceptable only if absence, ambiguity, expiry, revocation, scope mismatch, unknown operation, hidden semantic fields, unauthorized administration, unsupported obligations and stale-decision reuse fail closed while historical authority remains replayable.

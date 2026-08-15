# ADR v0.1 — MTL-A04 ContextManifest Implementation Contract

Status: **IMPLEMENTATION CONTRACT / NON-ARCHITECTURE-AUTHORITY**

Task: `MTL-A04 — Immutable ContextManifest`

Baseline: `main @ 9eeb69dad9c11905eb6251337e6dc29e40f6116c`

Upstream authority remains Frozen Architecture, Capability C06, Master Task Line A04, A01 DecisionProblem, A02 ContextDatum, A03 reference-resolution authority and Gate F/F03.

## 1. Authority boundary

A04 establishes `ContextManifest` as the immutable target-context world used for one exact DecisionProblem.

It freezes:

```text
exact DecisionProblem ref
DecisionProblem-derived targetRef
DecisionProblem-derived logicalTime
evidenceCutoff
exact ContextDatum membership
exact ResolvedContextDatumReceipt membership
conservative manifest ReplayClass
```

`TargetContext` remains conceptual. `targetContextSnapshot(...)` is only a read view derived from validated ContextManifest authority; it is not a second mutable truth store or a new authority object.

## 2. DecisionProblem binding

Callers do not supply a second target scope or logical time to ContextManifest publication.

Both are derived from the exact validated DecisionProblem ref:

```text
manifest.targetRef   = DecisionProblem.targetRef
manifest.logicalTime = DecisionProblem.logicalTime
```

Changing the material DecisionProblem version changes the manifest semantic identity even when the context members are unchanged.

## 3. Exact context membership

A04 accepts only:

```text
ContextDatum refs
ResolvedContextDatumReceipt refs
```

Both lists are canonical order-independent exact sets and reject duplicate exact refs.

At least one exact ContextDatum is required.

An `AuthorizedContextReference` cannot substitute for a resolved receipt. Every receipt's exact `resolvedContextDatumRef` must also be present in the same manifest's datum membership. This closes the reference → receipt → normalized datum world explicitly.

No latest-version convention is used. Publishing a newer ContextDatum, reference or receipt does not rewrite or redirect an old manifest.

## 4. Evidence cutoff

`evidenceCutoff` is part of manifest semantic identity.

A datum is eligible only when:

```text
datum.availableAt <= evidenceCutoff
```

A resolved receipt is eligible only when:

```text
receipt.resolvedAt <= evidenceCutoff
```

Manifest publication audit time must not precede its own evidence cutoff.

A04 does not reinterpret event/effective time as availability. It preserves the chronology already frozen in A02/A03.

## 5. Target and tenant closure

The manifest publisher organization/tenant must equal the DecisionProblem target organization/tenant.

Every ContextDatum and receipt must also resolve to that same organization/tenant authority.

A04 does not invent field/zone geometry containment or scientific equivalence rules that do not yet have upstream authority. More detailed target relations belong to explicit later capabilities rather than implicit adapter inference.

## 6. Replay classification

Manifest replay classification is derived, never caller-selected.

Inline ContextDatum authority is exactly retained in ADR's immutable authority ledger, so an inline-only manifest begins at `EXACT` normalized-context replay.

For manifests containing resolved receipts, the manifest is conservatively classified by the weakest exact receipt chain:

```text
EXACT
  > CONTENT_ADDRESSED_EXTERNAL
  > PROVIDER_DEPENDENT
  > NON_REPLAYABLE
```

This is a v0.1 implementation rule for truthful manifest replay classification; it does not change the Frozen ReplayClass vocabulary.

If an `EXACT` receipt can no longer prove access to its retained provider bytes, manifest validation fails closed rather than silently downgrading or pretending exact replay.

## 7. Publication authority and exact audit inputs

ContextManifest publication requires the existing F03 `context.write` permission scoped to:

```text
resourceType = CONTEXT_MANIFEST
resourceId   = exact ContextManifest logicalId
```

See `ADR-v0.1-MTL-A04-F03-CONTEXT-WRITE-SEAM.md`.

The direct publication audit input set must be exactly:

```text
DecisionProblem ref
+ every exact ContextDatum ref
+ every exact ResolvedContextDatumReceipt ref
+ exact context.write AuthorizationDecisionAudit ref
```

No hidden RuntimeResult, mutable provider handle, later output or arbitrary extra ref may be smuggled into the manifest world through audit metadata.

## 8. Immutability and historical replay

The same ContextManifest logical/version identity cannot be rebound to changed membership, cutoff, DecisionProblem or replay semantics.

A new upstream datum/receipt or a changed evidence cutoff requires a new manifest version/identity. Historical validation follows the exact refs frozen in the old manifest and never follows current/latest upstream versions.

## 9. Operational metadata

`created_at` comes from the direct publication audit event. It is operational provenance and is not part of the ContextManifest semantic hash.

The semantic hash covers the target world itself, not incidental publication timestamp metadata.

## 10. Public surface

A validated public manifest materializes the frozen contract fields:

```text
contract_version
context_manifest_id
decision_problem_ref
target_ref
logical_time
evidence_cutoff
datum_refs
resolved_reference_receipts
replay_class
created_at
manifest_semantic_hash
```

Decision-critical downstream code must consume validated ContextManifest authority rather than directly querying mutable context pools.

## 11. Explicit nonclaims

A04 does not establish:

```text
KnowledgeRetrievalResult
ApplicabilityAssessment
RuntimeProfile
Deployment
RuntimePlan
RuntimeEligibility
RuntimeBinding
DecisionRobustness
DecisionResult
```

A04 also does not permit later runtime output to retroactively enter the current manifest. New evidence requires a new immutable context world.

## 12. Acceptance authority boundary

A04 closure requires machine evidence for the world-identity and historical-binding properties that are easy to fake with shallow schema tests.

The accepted A04 suite must prove all of the following against exact authority refs:

```text
changed exact datum membership
  -> changed ContextManifest semantic hash

changed publication created_at only
  -> unchanged ContextManifest semantic hash

same DecisionProblem logical id, material v1 -> v2 objective change
  -> changed ContextManifest semantic hash

same ContextDatum logical id, materially changed later version
  -> historical manifest still resolves the exact old ContextDatum ref

same reference/datum/receipt logical ids, materially changed later versions
  -> historical manifest still resolves the exact old receipt and datum refs

hidden extra publication audit input
  -> invalid ContextManifest authority
```

Acceptance identities must be deterministic. Random identifiers are not permitted as a substitute for proving immutable authority behavior.

These tests are authority evidence, not examples. A green suite that changes logical ids instead of exercising same-lineage version drift, silently repairs missing authority data in fixtures, or omits the exact historical receipt path is insufficient to close A04.

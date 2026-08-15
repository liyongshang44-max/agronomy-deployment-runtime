# ADR v0.1 — MTL-K06 Independent Review Adjudication

Status: **IMPLEMENTATION REVIEW / NON-ARCHITECTURE-AUTHORITY**

Task: `MTL-K06 — KnowledgeRelease`

Baseline: `main @ 8d533f39f85a96877edba750ded9dd29c32ea818`

This review does not reopen Architecture v1.0. It records implementation-level authority seams found after the first K06 functional path and the required closure before Gate K may be declared complete.

---

## 1. Review conclusion

The K06 core boundary remains correct:

```text
QualifiedKnowledge / DerivedKnowledge
        ↓
exact immutable KnowledgeRelease
```

with publication / entitlement / lifecycle governance outside the release's scientific member-set semantics.

No Architecture contradiction was found and no new `DEC-xxxx` is required.

The first green path was not treated as sufficient for merge. Independent review found the following merge-blocking seams.

---

## 2. Publication authority laundering

### Finding

A generic ledger record with `kind = KnowledgeRelease` must not become legal merely because its member refs resolve.

### Closure

Every release must bind exactly one `KnowledgeReleasePublicationDecision` through direct release audit. The publication decision is itself directly audited by the exact publisher and must bind all exact member-entitlement authorization / policy refs, relevant conflict / resolution refs and any predecessor-control refs.

A copied payload with the wrong actor / incomplete audit chain fails closed.

---

## 3. Ambiguous publication retry

### Finding

Because the frozen semantic payload is intentionally only `{ memberRefs }`, the same release logical id/version/member set could otherwise be reused under a different publisher, release target or entitlement world while preserving the same release semantic hash.

### Closure

Once a release identity is bound to a publication authority, an exact retry is accepted only when the **entire publication governance payload is identical**. Otherwise K06 requires a new release version / identity and fails with publication-retry mismatch.

---

## 4. Conflict state drift

### Finding

Checking only whether a new `KnowledgeConflict` appeared is insufficient. The active resolution of an already known conflict can change without changing the conflict object itself.

### Closure

Publication freezes both conflict refs and active resolution refs. New-use validation requires exact equality with the current governed conflict / resolution state. Either dimension drifting makes the old release stale for new use.

Historical replay continues against the frozen publication state.

---

## 5. Historical replay versus later knowledge lifecycle

### Finding

A release is supposed to make a past scientific world replayable. Reusing only current QK/DK validators would make an old release unreplayable after later qualification revocation / requalification.

### Closure

K06 adds explicit historical-validation mode through the authority chain:

```text
QualifiedKnowledge
DerivedKnowledge
KnowledgeConflict
ConflictResolution
KnowledgeRelease
```

Historical mode still validates immutable source / qualification / derivation / authorization / audit / lineage authority, but does not let later lifecycle decisions rewrite the historical meaning of the exact frozen objects.

Current mode remains strict and rejects no-longer-active knowledge.

---

## 6. Release lifecycle hijack

### Finding

KnowledgeRelease intentionally does not carry an owner field. Without an external controller boundary, another organization could attempt to publish a policy over the release ref and manufacture a lifecycle decision.

### Closure

Release lifecycle authority is anchored to:

- original publication publisher organization / tenant;
- original release target;
- exact release-control policy;
- exact F03 `KNOWLEDGE_RELEASE` authorization;
- direct manager audit.

A foreign organization cannot revoke / deprecate a release merely by naming the release ref.

---

## 7. Release supersession hijack

### Finding

A publisher with authority over a new member set does not automatically have authority to supersede an old release.

### Closure

A successor publication that declares `supersedesReleaseRef` must also bind exact control authorization over the predecessor release. The canonical `supersedes` lineage is published atomically with the successor.

Read-side status does not trust a lineage edge alone; it revalidates successor publication and predecessor-control authority.

---

## 8. Cross-owner entitlement persistence

### Finding

Explicit deployment entitlement makes cross-owner release composition possible, but a one-time grant cannot become an irrevocable future license. Otherwise a tenant could retain another organization's private agronomy indefinitely after the owner intended to withdraw future use.

### Closure

K06 adds owner-side entitlement control:

```text
KNOWLEDGE_RELEASE_ENTITLEMENT_CONTROL
→ KnowledgeReleaseMemberEntitlementRevocation
```

The control decision is authorized against the exact member policy **ownership scope**, not the target publisher's program scope.

The revocation freezes exact release, exact member, exact original entitlement authorization / policy, exact owner principal, exact control authorization and reasons.

Current use then fails. Historical replay remains legal.

The target publisher cannot impersonate the member owner to create this revocation.

---

## 9. Generic lifecycle / successor poisoning

### Finding

Scanning ledger object kinds or lineage edges without revalidation would allow a forged `REVOKED` lifecycle object or forged successor lineage to poison release current state.

### Closure

Every lifecycle candidate is revalidated against exact controller authorization and direct audit. Every superseding edge must resolve to a successor with exact publication + predecessor-control authority.

Invalid records fail closed rather than silently becoming current state.

---

## 10. Final merge blockers

Before PR #16 may leave Draft, exact-head acceptance must prove:

1. KnowledgeRelease is exactly a canonical set of Qualified / Derived refs;
2. non-knowledge membership fails;
3. publisher release permission and owner deployment entitlement both close exactly;
4. cross-owner ownership is preserved;
5. owner-side entitlement revocation blocks future use and preserves historical replay;
6. target publisher cannot impersonate owner-side control;
7. conflict and active-resolution drift stale current use;
8. supersession requires predecessor control authority;
9. foreign release lifecycle control fails;
10. generic lifecycle / successor / publication laundering fails;
11. current validation rejects later QK / DK-input revocation while historical replay remains valid;
12. same release identity cannot be rebound to another governance world;
13. all F01–K05 acceptance remains green.

Only after these pass may Gate K be declared closed and the frontier move to Applicability-track implementation.

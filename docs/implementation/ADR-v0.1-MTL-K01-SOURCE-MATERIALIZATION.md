# ADR v0.1 — MTL-K01 Source / SourceArtifact Exact Materialization Implementation Contract

Status: **IMPLEMENTATION CONTRACT / NON-ARCHITECTURE-AUTHORITY**

Task: `MTL-K01 — Source / SourceArtifact Exact Materialization`

Baseline: `main @ 5b7bb13bbed6602fc6c06d010d0460257f00b762`

Upstream authority remains Architecture v1.0, Capability Map 01, Master Task Line 01 and Version Slicing 01.

---

## 1. Permanent object separation

K01 implements the frozen invariant:

```text
Source ≠ SourceArtifact ≠ Claim
```

### Source

`Source` is logical provenance/source-version identity. It may carry:

```text
source type
title
bibliographic identity
edition/version label
origin locator
ownership
rights/license metadata
```

It does not contain or stand in for the exact bytes later compiled.

### SourceArtifact

`SourceArtifact` is an immutable exact materialization of a Source version/edition. It binds:

```text
exact Source ref
media type
materialization identity
raw content hash
byte length
retention identity
acquisition/retrieval metadata
rights snapshot where supplied
semantic hash
```

A mutable URL alone is never SourceArtifact authority.

---

## 2. Exact-byte boundary

Artifact materialization accepts only an explicit byte container:

```text
Buffer
Uint8Array
```

Text callers must choose and apply their own encoding before materialization. K01 intentionally does not accept JavaScript strings as artifact content because implicit text encoding would weaken exact-byte identity.

Exact content identity is:

```text
sha256:<SHA-256 of raw retained bytes>
```

This raw content hash is distinct from the F02 semantic hash of the SourceArtifact authority object.

Therefore:

```text
contentHash
=
identity of exact retained bytes

SourceArtifact semanticHash
=
identity of the governed artifact record including Source ref,
content hash, media/acquisition/retention semantics, etc.
```

---

## 3. Retention reference implementation

K01 includes an in-memory content-addressable `ExactArtifactStore` solely to prove retention semantics in acceptance.

The reference store:

- keys content by exact raw-byte SHA-256;
- deduplicates identical bytes;
- stores a defensive copy;
- returns a defensive copy;
- never lets caller mutation alter retained content;
- provides a retention ID equal to the content hash for the reference implementation.

This is not the final production object store, blob database, S3/R2 implementation or retention policy. Future durable retention must preserve the same exact-content and immutability semantics.

---

## 4. One Source may have multiple SourceArtifacts

A logical Source/version may have multiple retained materializations, for example:

```text
PDF
HTML snapshot
scan
structured export
```

and may also be materialized more than once as an external locator changes over time.

The same locator returning different bytes must produce different content hashes and different immutable artifact versions/materializations.

Identical bytes from different Source authorities may share one retained content object while remaining different SourceArtifact authority objects because their exact Source provenance differs.

---

## 5. Acquisition metadata

SourceArtifact acquisition metadata is part of the governed artifact record and includes at least:

```text
method
acquiredAt
optional locator
optional exact acquisition metadata
```

`acquiredAt` is normalized to an exact ISO timestamp.

Provider URLs/locators remain provenance metadata. They do not replace content identity.

---

## 6. Source version lineage

Source version/edition ordering does not implicitly mean supersession.

If one Source version supersedes another, K01 records explicit `supersedes` lineage between exact Source references through the shared F02 lineage substrate.

This prevents version labels, timestamps or lexical order from being treated as authority.

---

## 7. Audit

Source and SourceArtifact publication use the shared F02 audit substrate.

Artifact publication audit binds the exact Source authority reference as an input, so later compilation/evaluation can distinguish:

```text
logical source provenance
from
exact materialization provenance
```

K02 will later require the Scientific Compiler to bind the exact `SourceArtifact@contentHash`, not Source or URL alone.

---

## 8. Ownership and rights boundary

K01 preserves source ownership and rights/license metadata because they are part of source provenance/governance.

K01 does not yet claim full source-access product enforcement or customer source-library UI. F03 already provides the shared authorization/entitlement substrate; later Source/Compiler APIs must enforce tenant/IP policy rather than expose proprietary artifacts merely because their hashes are known.

A content hash is an integrity identifier, not an access token.

---

## 9. Explicit nonclaims

K01 does not establish:

```text
Scientific Compiler
Claim / SourceContext
scientific qualification
KnowledgeRelease
field applicability
runtime legality
Decision
production object-store durability
cross-region retention/backup
source discovery/crawling
copyright/license interpretation
```

The rights metadata stored by K01 is asserted governance metadata; ADR does not infer legal permission merely from a license string.

---

## 10. K01 closure statement

K01 is accepted only when executable tests prove:

```text
Source is logical identity without exact bytes
SourceArtifact requires exact bytes
raw-byte content hash is deterministic
mutable locator changes cannot rewrite old artifacts
one Source can own multiple exact artifacts
identical bytes can dedupe without provenance collapse
artifact reads preserve retained bytes against caller mutation
same published artifact version cannot be repointed
forged Source refs are rejected
Source supersession is explicit lineage
artifact audit binds exact Source input
```

Passing K01 does not imply Gate K. The next task remains:

```text
MTL-K02 — Scientific Compiler Candidate Pipeline
```

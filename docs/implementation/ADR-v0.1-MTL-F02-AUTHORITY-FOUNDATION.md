# ADR v0.1 — MTL-F02 Authority Foundation Implementation Contract

Status: **IMPLEMENTATION CONTRACT / NON-ARCHITECTURE-AUTHORITY**

Task: `MTL-F02 — Canonical Identity / Immutability / Lineage / Replay / Audit Foundation`

Upstream authority remains Architecture v1.0, Capability Map 01, Master Task Line 01 and Version Slicing 01.

This file records the exact implementation semantics used by the first authority substrate so later persistence layers and SDKs do not silently create incompatible identity rules.

## 1. Authority reference

Every published authority object is referenced by:

```text
kind
logicalId
version
semanticHash
```

`version` is an opaque non-empty string at this layer. MTL-F02 does not impose integer or SemVer meaning on domain objects.

The tuple `(kind, logicalId, version)` selects one published authority version. `semanticHash` verifies that the selected version has the expected semantics.

A selected tuple with a different semantic hash is an integrity failure, not a request for “latest”.

## 2. Semantic hash boundary

`semanticHash` is computed from:

```text
object kind
+
semantic payload
```

It deliberately excludes:

```text
logicalId
version
operational metadata
queue attempt
worker identity
storage identity
created/updated timestamps unless the domain explicitly places time inside semantic payload
```

Therefore two versions may legitimately have the same semantic hash when their governed semantics are unchanged.

A semantic change under an already published `(kind, logicalId, version)` is prohibited.

## 3. ADR Canonical JSON v1

The first canonicalization contract accepts JSON-domain semantic values only:

```text
null
boolean
string
finite IEEE-754 number
array
plain object
```

It rejects:

```text
undefined
NaN / ±Infinity
bigint
function
symbol / symbol keys
sparse arrays
cyclic graphs
class/Date/Map/Set/non-plain objects
accessor properties
hidden non-enumerable properties
```

Rules:

- object keys are sorted using deterministic UTF-16 lexical ordering;
- array order is semantic and preserved;
- object insertion order is non-semantic;
- `-0` canonicalizes to `0`;
- strings are hashed as exact Unicode strings and are not silently normalized;
- exact decimal/scientific quantities that cannot tolerate binary-number representation should be represented explicitly by the relevant domain contract, commonly as decimal strings plus units.

Canonicalization identifier:

```text
adr-canonical-json-v1
```

## 4. Semantic hash preimage

The v1 hash is SHA-256 over UTF-8 bytes of:

```text
adr-semantic-hash-v1
kind:<KIND>
<CANONICAL_JSON_PAYLOAD>
```

Serialized identity:

```text
sha256:<64 lowercase hexadecimal characters>
```

Object kind is domain-separated so identical JSON payloads under different authority kinds do not share a semantic hash.

## 5. Publication and immutability

The reference ledger used for v0.1 acceptance is append-only in semantics:

- first publication freezes semantic payload and operational metadata;
- an exact retry of the same `(kind, logicalId, version, semanticHash)` is idempotent;
- an exact retry cannot replace operational metadata on the original record;
- a different semantic hash for the same `(kind, logicalId, version)` fails with `SEMANTIC_MUTATION_FORBIDDEN`;
- newer versions do not change resolution of historical references.

The in-memory ledger is a reference semantic implementation, not the final persistence architecture. Future PostgreSQL or other persistence must preserve these semantics rather than redefining them.

## 6. Lineage

The initial allowed generic lineage vocabulary follows the Repository Constitution:

```text
supersedes
superseded_by
revokes
derived_from
requalifies
replaces
```

Lineage is an explicit immutable relation between exact authority references. It is not inferred from timestamps or version-number ordering.

## 7. Audit

Publishing authority and creating lineage require explicit audit metadata.

An audit event records at least:

```text
eventId
occurredAt
actor { type, id }
action
objectRef
inputRefs
details
eventHash
```

Audit input references are exact authority references. This allows reconstruction of who/what created an authority object and which exact authority inputs were used.

Audit metadata does not become part of the scientific/domain object semantic hash unless a domain contract explicitly places a value inside the semantic payload.

## 8. Replay claim at MTL-F02

MTL-F02 establishes identity-level replay foundations:

- deterministic semantic hashing;
- exact historical reference resolution;
- explicit lineage;
- immutable audit inputs;
- exportable reference-ledger snapshot for acceptance.

It does **not** yet claim:

- durable production database replay;
- tenant/IP isolation (`MTL-F03`);
- Source/Knowledge domain semantics (`MTL-K01+`);
- scientific validity;
- runtime replay;
- product-level disaster recovery.

Those are later tasks/gates.

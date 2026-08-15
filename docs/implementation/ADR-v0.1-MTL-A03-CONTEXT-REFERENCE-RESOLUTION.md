# ADR v0.1 — MTL-A03 Context Reference Resolution Implementation Contract

Status: **IMPLEMENTATION CONTRACT / NON-ARCHITECTURE-AUTHORITY**

Task: `MTL-A03 — AuthorizedContextReference / Resolution Receipt`

Baseline: `main @ c4eaa97ccab27e64ba697bafbc34e2e447d47575`

Upstream authority remains Frozen Architecture, Capability C06, Master Task Line A03, the frozen Agronomic Context & Public Runtime Contract, Gate F/F03 and A02 ContextDatum authority.

## 1. Authority boundary

A03 establishes two immutable/versioned runtime-plane authority objects:

```text
AuthorizedContextReference
ResolvedContextDatumReceipt
```

An AuthorizedContextReference states which provider-side context location ADR is authorized to resolve, for which semantic dimension, under which non-secret authorization context.

A ResolvedContextDatumReceipt states what ADR actually read at resolution time and binds:

```text
exact AuthorizedContextReference ref/hash
exact normalized ContextDatum ref/hash
resolved/effective/available chronology
provider authorization-context hash
exact provider-response SHA-256
retention evidence
ReplayClass
```

A reference alone is not decision-critical resolved context. A03 requires a receipt before a reference may satisfy later ContextManifest construction.

## 2. Provider boundary

ADR core does not perform provider network calls.

The adapter/provider boundary obtains bytes using credentials outside semantic authority, then passes **exact provider response bytes** to A03 core. Core computes the provider-response hash itself and never accepts a caller-declared response hash as proof of what was read.

Bearer tokens, API keys, passwords, signed URL credential parameters and comparable secret material must not enter:

```text
AuthorizedContextReference semantic payload
provider authorization-context hash
receipt semantic identity
```

## 3. Non-secret authorization context

`authorization_hash` is the canonical semantic hash of:

```text
connectionId
+ principalScope
```

It is **not** a token hash.

A03 v0.1 intentionally closes `principalScope` to a platform-neutral non-secret envelope:

```text
organizationId
tenantId?
subjectId?
fieldIds[]?
resourceIds[]?
semanticIds[]?
```

Identifier sets are canonicalized as order-independent exact sets and reject duplicates.

Unknown scope fields fail closed. Credential-shaped fields such as token/secret/password/credential/API-key/session-key are specifically rejected as secret material.

This is an implementation restriction that preserves the frozen public principle that authorization context is semantic/governance identity rather than credential material.

## 4. Reference addressing and ReplayClass

The frozen ReplayClass values are:

```text
EXACT
CONTENT_ADDRESSED_EXTERNAL
PROVIDER_DEPENDENT
NON_REPLAYABLE
```

A03 v0.1 uses the following internal/public implementation discriminator to derive these classes rather than letting callers choose a ReplayClass string:

```text
MUTABLE_LOCATOR
VERSIONED_LOCATOR
CONTENT_ADDRESSED
```

`addressingMode` is an **implementation extension used to prove replay truth**, not a new Architecture authority object.

### EXACT

`EXACT` is emitted only when exact provider response bytes are actually retained in an ADR-controlled content-addressed snapshot store at resolution time.

Validation must be able to retrieve those bytes and re-prove:

```text
retention_ref == provider_response_hash
SHA256(retained bytes) == provider_response_hash
actual byteLength == frozen byteLength
storeKind == ADR_CONTROLLED_CONTENT_ADDRESSABLE_SNAPSHOT
```

### CONTENT_ADDRESSED_EXTERNAL

`CONTENT_ADDRESSED_EXTERNAL` is emitted only when:

```text
addressingMode == CONTENT_ADDRESSED
expectedContentHash == observed provider-response hash
locator itself binds that exact SHA-256
```

A mutable locator cannot self-assert `CONTENT_ADDRESSED` merely by carrying a caller-provided expected hash.

### PROVIDER_DEPENDENT

A non-retained `VERSIONED_LOCATOR` with an explicit version token is `PROVIDER_DEPENDENT`. Replay still depends on the provider continuing to serve the historical version.

### NON_REPLAYABLE

A mutable non-retained locator is `NON_REPLAYABLE`.

Provider-dependent data is never upgraded to `EXACT` without actual retained bytes.

## 5. Receipt chronology and semantic binding

Resolution requires exact provider bytes and exact A02 ContextDatum authority.

The normalized ContextDatum must bind:

```text
semanticId == reference semanticId
source.providerId == reference providerId
source.contentHash == SHA256(exact provider response bytes)
organization/tenant == reference target organization/tenant
```

Receipt chronology must satisfy:

```text
receipt.availableAt == ContextDatum.availableAt
ContextDatum.effectiveInterval.start <= receipt.effectiveAt <= ContextDatum.effectiveInterval.end
receipt.resolvedAt >= receipt.availableAt
```

A later provider response, reference version or ContextDatum version creates new authority. Historical exact refs are never rewritten or followed by a latest-version convention.

## 6. Retention shape is exact

Replay retention is semantic evidence, not an open metadata bag.

Accepted v0.1 shapes are exact:

```text
EXACT:
  mode + retentionRef + storeKind + byteLength

CONTENT_ADDRESSED_EXTERNAL:
  mode + retentionRef + providerId + locator

PROVIDER_DEPENDENT:
  mode + providerId + locator + versionToken

NON_REPLAYABLE:
  mode only
```

Extra retention fields fail closed so a receipt cannot hide a second locator or alternate replay meaning outside the frozen evidence shape.

## 7. Exact snapshot store nonclaim

`ExactContextSnapshotStore` is the v0.1 controlled content-addressed reference implementation used by acceptance to prove exact-byte identity, deduplication and defensive reads.

It does **not** claim that ADR already ships a durable production object-store backend.

A production deployment may claim `EXACT` only when the snapshot-store interface is backed by a controlled retention system that continues to make the exact bytes available for the required replay horizon. Losing retained bytes causes exact replay validation to fail closed.

## 8. Public implementation surface

The supported A03 package surface is:

```text
packages/reference-resolution/src/index.mjs
```

`core.mjs`, `hardening.mjs` and `retention.mjs` are implementation-internal modules. Downstream A04+ authority code must consume the hardened `index.mjs` exports rather than importing `core.mjs` directly to bypass public validation.

## 9. Write authority

AuthorizedContextReference and ResolvedContextDatumReceipt publication both consume the existing F03 `context.write` permission through exact resource-scoped AuthorizationDecisionAudit authority.

See:

`docs/implementation/ADR-v0.1-MTL-A03-F03-CONTEXT-WRITE-SEAM.md`

## 10. Explicit nonclaims

A03 does not establish:

```text
ContextManifest
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

A03 also does not grant scientific truth, target applicability or final decision authority to provider data. It preserves what was read and how replayable that evidence is.

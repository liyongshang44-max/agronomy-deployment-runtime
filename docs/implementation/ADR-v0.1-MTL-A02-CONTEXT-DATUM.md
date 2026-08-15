# ADR v0.1 — MTL-A02 ContextDatum Implementation Contract

Status: **IMPLEMENTATION CONTRACT / NON-ARCHITECTURE-AUTHORITY**

Task: `MTL-A02 — Agronomic Context Contract 与 ContextDatum`

Baseline: `main @ 5a84999af1e1ce1c540e9d9938df4965980f90fe`

Upstream authority remains the Frozen Architecture, Capability C06, Master Task Line A02, and `ADR-AGRONOMIC-CONTEXT-AND-PUBLIC-RUNTIME-CONTRACT-v1.0`.

## 1. Authority boundary

A02 establishes `ContextDatum` as the minimal immutable/versioned semantic atom for target agronomic context.

A ContextDatum freezes:

```text
semantic_id
value + unit
epistemic_class
provenance_class
effective interval
available_at
spatial support
vertical support
temporal support
uncertainty
source identity
```

It does not establish target applicability, scientific truth, runtime legality, final decision authority, or a mutable TargetContext mega-object.

A02 implements only resolved `INLINE` ContextDatum authority. `AUTHORIZED_REFERENCE` is a distinct value mode, but the actual AuthorizedContextReference and ResolvedContextDatumReceipt authority chain belongs to A03 and cannot masquerade as an inline datum.

## 2. Frozen epistemic/provenance vocabulary

Exact `EpistemicClass` values:

```text
OBSERVATION
ASSERTION
DERIVED
STATE_ESTIMATE
FORECAST
CONFIGURATION
MODEL_PRIOR
```

Exact `ProvenanceClass` values:

```text
USER
AGRONOMIST
SENSOR
MACHINERY
REMOTE_SENSING
EXTERNAL_PROVIDER
CUSTOMER_SYSTEM
LABORATORY
MODEL
PLATFORM
```

The two axes are orthogonal. Provenance never upgrades epistemic authority. In particular:

```text
CUSTOMER_SYSTEM != OBSERVATION
MODEL           != STATE_ESTIMATE
MACHINERY       != OBSERVATION
```

unless the datum explicitly carries that epistemic class under the frozen contract.

## 3. Typed value contract

Exact v1 value types:

```text
DECIMAL
INTEGER
BOOLEAN
STRING
CATEGORY
DATE
TIMESTAMP
INTERVAL
SET
UNKNOWN
```

Authority-critical numeric values use canonical base-10 strings. JavaScript floating-point numbers, exponent notation, and ambiguous leading-zero forms are not accepted as numeric identity.

`INTERVAL` v1 only establishes ordering over types with explicit intrinsic ordering:

```text
DECIMAL
INTEGER
DATE
TIMESTAMP
```

A STRING or CATEGORY pair is not silently treated as an ordered range. Such alternatives require `SET` or a future governed ordering authority.

`SET` is canonicalized as an order-independent exact set of one atomic value type and rejects duplicate canonical members.

## 4. Temporal identity

Authority timestamps require deterministic RFC3339 timestamps with:

```text
full date
T separator
hours/minutes/seconds
explicit Z or numeric offset
0-3 fractional second digits
```

Impossible dates/times, timezone-less timestamps, date-only strings, offsets outside the RFC3339 range, and precision beyond milliseconds fail closed.

Accepted timestamps are normalized to UTC millisecond ISO representation before semantic hashing, so equivalent offsets produce one semantic identity.

## 5. Support and uncertainty

Spatial, vertical and temporal support remain explicit semantic payload, not adapter metadata.

A vertical range is canonical decimal millimetres and must satisfy `from_mm <= to_mm` when present.

Uncertainty is structural and retains its form:

```text
NONE
INTERVAL
CATEGORICAL_SET
DISTRIBUTION_REFERENCE
UNKNOWN
```

It is not collapsed to a universal confidence percentage.

The public wire materialization uses the Frozen Contract vocabulary and snake_case keys; internal camelCase representation is not exposed as a competing public contract.

## 6. Write authority

Publishing ContextDatum requires the A02/F03 scoped `CONTEXT_WRITE` authorization seam documented in:

`docs/implementation/ADR-v0.1-MTL-A02-F03-CONTEXT-WRITE-SEAM.md`

Publication consumes an exact replayable `AuthorizationDecisionAudit`, re-resolves every exact RoleAssignment ref, recomputes the decision, and requires the exact decision hash to match.

Caller-supplied audit labels are not authority.

## 7. Replay and immutability

The AuthorityLedger ref freezes exact logical id, opaque version and semantic hash. The same logical/version identity cannot be rebound to different ContextDatum semantics.

A later ContextDatum version does not rewrite an earlier exact ref; historical replay resolves the exact old semantic payload and its exact write-authorization audit chain.

## 8. Explicit nonclaims

A02 does not implement or claim:

```text
AuthorizedContextReference
ResolvedContextDatumReceipt
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

A02 also does not infer missing epistemic semantics from source reputation, provider class, adapter identity, or field-name similarity.

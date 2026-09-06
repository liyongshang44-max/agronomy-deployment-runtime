# GEOX Historical Decision Basis Projection Sink v1

Status: productization transport contract; not architecture authority.

## Purpose

Expose ADR-2 Historical Decision Basis reconstruction to a GEOX-compatible downstream consumer without inventing a new authority object or relabeling `DecisionResult`, `basisDigest`, or the derived `authorityGraph` as authority.

Public consumer subpath:

```text
@adr/geox-adapter/historical-decision-basis-projection-sink
```

Generic transport role remains the existing outbound `RESULT_SINK` contract. No new integration role is introduced.

## Wire identity

The wire event is:

```text
contract_version = adr.result-sink-event.v1
event_type       = HISTORICAL_DECISION_BASIS_PROJECTED
identity         = projection_hash
```

`authority_ref` is forbidden on this transport. The `projection_hash` is a canonical SHA-256 integrity identity over the complete v1 projection payload. It is not an ADR `AuthorityRef` and grants no publication, approval, dispatch, execution, outcome, or causal authority.

The payload contains:

```text
projection_version = adr.geox-historical-decision-basis-projection.v1
historical_basis   = adr.historical-decision-basis.read-model.v1
authority_claim    = NONE_HISTORICAL_DECISION_BASIS_IS_NON_AUTHORITY_REPRODUCIBILITY_PROJECTION
```

The historical read model retains its exact `DecisionResult.ref`, predecessor authority refs, frozen `basisDigest`, and non-authority `authorityGraph` for inspection. Those embedded refs remain references to already-governed ADR authorities; they do not become the transport identity.

## Verification boundary

The sink verifies:

- exact result-event contract and event type;
- projection-only transport identity;
- canonical projection hash integrity;
- historical read-model version and non-authority class;
- `basisDigest` shape and explicit non-authority digest classification;
- exact DecisionResult entry-ref shape and graph-entry consistency;
- non-authority graph class;
- all frozen nonclaims remain false.

The sink does **not** possess an ADR ledger or snapshot store and therefore does not independently replay upstream authority history. Its returned verification classification is:

```text
PROJECTION_HASH_INTEGRITY_ONLY_UPSTREAM_AUTHORITY_REPLAY_NOT_REPERFORMED
```

Authoritative historical reconstruction remains the responsibility of ADR's `reconstructHistoricalDecisionBasis(...)` read model before transport creation.

## GEOX consumer ceiling

The v1 consumer projection is always:

```text
consumer_disposition = HISTORICAL_AUDIT_DISPLAY_ONLY_NON_ACTIONABLE
field_actionable      = false
dispatch_authorized   = false
```

It creates no:

- human approval authority;
- dispatch authority;
- machine-execution authority;
- execution receipt authority;
- Outcome authority;
- causal-attribution authority.

## Compatibility boundary

This subpath is an explicit public API surface addition to the private `@adr/geox-adapter` consumer artifact. Therefore `consumer-api-surface.v1.json`, its canonical surface hash, and `consumer-artifact.manifest.json` must move together under the existing exact compatibility review policy.

The existing `@adr/geox-adapter/decision-result-sink` remains unchanged and continues to require exact `DecisionResult` `authority_ref` identity. It must reject historical-basis `projection_hash` events.

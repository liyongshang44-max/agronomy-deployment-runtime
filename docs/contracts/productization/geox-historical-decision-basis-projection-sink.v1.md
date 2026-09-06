# GEOX Historical Decision Basis Projection Sink v1

Status: productization transport contract; not architecture authority.

## Purpose

Expose ADR-2 Historical Decision Basis reconstruction to a GEOX-compatible downstream consumer without inventing a new authority object or relabeling `DecisionResult`, `basisDigest`, or the derived inspection projections as authority.

The projection preserves:

- exact D06 decision semantics across ACT / WAIT / ASK / ABSTAIN;
- exact D04 / R03 historical runtime-alternative provenance even when a non-ACT decision has zero `RuntimeBinding` authorities; and
- the exact hash-valid D06 publication AuditEvent that satisfied ADR's existing DecisionResult publication-authority validation.

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

The historical read model retains its exact `DecisionResult.ref`, predecessor authority refs, frozen `basisDigest`, and non-authority inspection projections. Those embedded refs remain references to already-governed ADR authorities; they do not become the transport identity.

## Exact D06 decision-semantics projection

The read model carries a derived, non-authoritative exact D06 semantics projection:

```text
decisionSemantics.projectionClass =
  NONE_NON_AUTHORITY_EXACT_DECISION_RESULT_SEMANTICS_PROJECTION

decisionSemantics.decisionResultRef = exact historical DecisionResult.ref
decisionSemantics.semanticPayload   = exact validated adr.decision-result.v1 payload
```

This preserves material D06 semantics including:

- `waitSemantics`;
- `informationRequirementRefs`;
- `abstentionReasonAuthority`;
- `humanGate`;
- `policyResultRefs`.

`decisionSemantics` is intentionally outside the frozen `basisDigest`. Adding it does not rewrite the original HistoricalDecisionBasisReadModel digest identity.

## Exact D04 / R03 runtime-alternative provenance projection

A non-ACT D06 result can legitimately contain:

```text
runtimeBindingRefs = []
```

That does not mean the historical runtime world had no governed provenance. D04 `RuntimeAlternativeSet` still freezes the path universe and binds the exact R03 `RuntimeEligibility`, which in turn binds the frozen RuntimePlan identity, DecisionProblem, Deployment, RuntimeProfile, ContextManifest, KnowledgeRetrievalResult, and ApplicabilityAssessment authorities.

The read model therefore also carries a derived, non-authoritative projection:

```text
runtimeAlternativeProvenance.projectionClass =
  NONE_NON_AUTHORITY_EXACT_RUNTIME_ALTERNATIVE_PROVENANCE_PROJECTION

runtimeAlternativeProvenance.runtimeAlternativeSetRef
runtimeAlternativeProvenance.runtimeAlternativeSetSemanticPayload
runtimeAlternativeProvenance.runtimeEligibilityRef
runtimeAlternativeProvenance.runtimeEligibilitySemanticPayload
runtimeAlternativeProvenance.runtimePlanCompilerVersion
runtimeAlternativeProvenance.runtimeAlternativeSetReplayMode
runtimeAlternativeProvenance.pathWorlds
```

The projection is reconstructed only after ADR validates the exact D04 and R03 authorities and their historical predecessors. It preserves both included and excluded D04 paths. An excluded non-ACT path retains its exact `knowledgeRef`, `applicabilityAssessmentRef`, R03 path disposition, and exclusion/reason semantics without fabricating a `RuntimeBinding`.

The projection requires:

- D04 `runtimeAlternativeSetRef` to equal the exact D06 `runtimeAlternativeSetRef`;
- D04 `runtimeEligibilityRef` to resolve the exact R03 authority;
- D04 and R03 DecisionProblem / Deployment / RuntimeProfile / ContextManifest refs to match exactly;
- D04 `runtimePlanRef` to equal the exact R03 `planRef`;
- D04 generation compiler version to equal the R03 RuntimePlan compiler version;
- D04 included `RuntimeBinding` refs to equal the exact D06 `runtimeBindingRefs` set;
- every D04 included or excluded path to correspond to the exact R03 alternative evaluation and retain the same knowledge/applicability lineage.

`runtimeAlternativeProvenance` is also intentionally outside the frozen `basisDigest`. The original v1 digest basis remains binding-driven and byte-for-byte compatible. The derived `authorityGraph` may contain additional exact refs needed to make non-ACT provenance inspectable; this graph remains a non-authority projection.

## Exact DecisionResult publication audit closure projection

D06 publication authority already requires an exact `PUBLISH_DECISION_RESULT` AuditEvent. The accepted D06 validator checks that the event closes over the exact DecisionResult, exact runtime principal, exact D06 predecessor refs, DecisionRobustness, RuntimeAlternativeSet, decision authority/disposition, InformationRequirement refs, Policy-result hashes, and the explicit nonclaims for human approval and machine execution.

ADR-2 does not create a second publication authority. Instead the publication-aware reconstruction composes the existing read model with the exact event that already satisfies those D06 rules:

```text
publicationAuditClosure.projectionClass =
  NONE_NON_AUTHORITY_EXACT_DECISION_RESULT_PUBLICATION_AUDIT_PROJECTION

publicationAuditClosure.decisionResultRef = exact historical DecisionResult.ref
publicationAuditClosure.auditEvent        = exact validated PUBLISH_DECISION_RESULT AuditEvent
```

The producer-side reconstruction:

```text
reconstructHistoricalDecisionBasisWithPublicationAudit(...)
```

first performs the existing historical basis reconstruction and D06 validation, then requires the selected AuditEvent to satisfy the same D06 publication closure and to reproduce:

```text
eventHash = semanticHash('AuditEvent', audit payload)
```

The projected event is evidence of the already-validated publication. `eventHash` is not an `AuthorityRef`, and `publicationAuditClosure` is not publication authority.

The clean npm-offline GEOX consumer can independently verify, without an ADR ledger or snapshot store:

- `AuditEvent.eventHash` from the transported event bytes using ADR semantic-hash v1 domain separation;
- `AuditEvent.objectRef` equals the transported exact DecisionResult ref;
- `action = PUBLISH_DECISION_RESULT`;
- event actor identity equals the event's `decisionResultPrincipal` detail;
- `inputRefs` equal the exact predecessor-ref set deterministically derived from the transported D06 payload;
- DecisionRobustness, RuntimeAlternativeSet, decision authority/disposition, InformationRequirement refs, Policy-result hashes, and downstream nonauthority details match the transported D06 semantics.

The clean consumer does **not** possess the D05 authority bytes needed to independently re-prove that the event actor is the historical DecisionRobustness runtime principal. That upstream principal check remains part of ADR's governed D06 validation before the projection is created. This distinction prevents audit-hash verification from being overstated as full upstream authority replay.

`publicationAuditClosure` is intentionally outside the frozen `basisDigest`; adding it does not rewrite the original HistoricalDecisionBasisReadModel digest identity.

## Verification boundary

The sink verifies:

- exact result-event contract and event type;
- projection-only transport identity;
- canonical projection hash integrity;
- historical read-model version and non-authority class;
- `basisDigest` shape and explicit non-authority digest classification;
- exact DecisionResult entry-ref shape and graph-entry consistency;
- non-authority graph class;
- all frozen nonclaims remain false;
- `decisionSemantics` remains a non-authority exact-D06 projection;
- the complete frozen D06 semantic field set is present;
- the transported D06 payload recomputes the exact `DecisionResult.ref.semanticHash` using ADR semantic-hash v1 domain separation;
- duplicated legacy basis summary fields and exact D06 semantics do not conflict;
- DecisionResult still explicitly carries no human-approval or machine-execution authority;
- `runtimeAlternativeProvenance` remains a non-authority exact D04/R03 projection;
- the transported D04 payload recomputes the exact `RuntimeAlternativeSet.ref.semanticHash`;
- the transported R03 payload recomputes the exact `RuntimeEligibility.ref.semanticHash`;
- D04, R03, D06, RuntimePlan compiler identity, and included-binding sets remain mutually consistent;
- every D04 path is accounted for exactly once against the R03 path universe;
- the derived authority graph retains all exact AuthorityRefs required by the D04/R03 provenance projection.

The sink's projection hash covers `publicationAuditClosure` when it is present. The clean independent consumer additionally performs the AuditEvent/D06 closure checks listed above. The public sink does not claim that this local hash/ref verification replays the upstream ADR publication authority graph.

The sink does **not** possess an ADR ledger or snapshot store and therefore does not independently replay upstream authority history. Its returned verification classification remains:

```text
PROJECTION_HASH_INTEGRITY_ONLY_UPSTREAM_AUTHORITY_REPLAY_NOT_REPERFORMED
```

The additive sink result facts:

```text
decision_result_semantic_hash_verified   = true
runtime_alternative_provenance_verified  = true
```

mean only that the transported D06/D04/R03 semantic payloads were verified against their exact identities and checked for internal lineage consistency. Separately, qualification requires the clean consumer to prove the publication AuditEvent hash and exact D06 ref closure. None of these checks means the consumer replayed provider snapshots, D05 publication-principal authority, or acquired ADR authority.

## GEOX consumer ceiling

The v1 consumer projection is always:

```text
consumer_disposition = HISTORICAL_AUDIT_DISPLAY_ONLY_NON_ACTIONABLE
field_actionable      = false
dispatch_authorized   = false
```

It creates no:

- synthetic `RuntimeBinding` for excluded or non-ACT paths;
- human approval authority;
- dispatch authority;
- machine-execution authority;
- execution receipt authority;
- Outcome authority;
- causal-attribution authority.

## Compatibility boundary

This subpath is an explicit public API surface already present in the private `@adr/geox-adapter` consumer artifact. Its public module/export inventory remains governed by `consumer-api-surface.v1.json` and the existing exact compatibility review policy.

The D06 semantics, D04/R03 provenance, and publication-audit closures do not add or remove any public module path or exported symbol. They extend the transported historical basis with derived non-authority inspection evidence; the existing public surface inventory therefore remains unchanged.

The existing `@adr/geox-adapter/decision-result-sink` remains unchanged and continues to require exact `DecisionResult` `authority_ref` identity. It must reject historical-basis `projection_hash` events.

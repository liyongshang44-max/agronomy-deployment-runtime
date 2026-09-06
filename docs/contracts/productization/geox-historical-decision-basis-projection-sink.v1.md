# GEOX Historical Decision Basis Projection Sink v1

Status: productization transport contract; not architecture authority.

## Purpose

Expose ADR-2 Historical Decision Basis reconstruction to a GEOX-compatible downstream consumer without inventing a new authority object or relabeling `DecisionResult`, `basisDigest`, or the derived inspection projections as authority.

The projection preserves:

- exact D06 decision semantics across ACT / WAIT / ASK / ABSTAIN;
- exact D04 / R03 historical runtime-alternative provenance even when a non-ACT decision has zero `RuntimeBinding` authorities;
- the exact hash-valid D06 publication AuditEvent that satisfied ADR's existing DecisionResult publication-authority validation; and
- an ADR-2 exit-gate inspection projection that exposes the exact validated historical authority semantics needed to inspect the decision scope, context, knowledge provenance, applicability, runtime profile/binding, robustness, and material implementation world from one exact DecisionResult ref.

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

The clean consumer does **not** independently re-prove the upstream D05 runtime-principal publication authority. That governed principal check remains part of ADR's D06 validation before the projection is created. This distinction prevents audit-hash verification from being overstated as full upstream authority replay.

`publicationAuditClosure` is intentionally outside the frozen `basisDigest`; adding it does not rewrite the original HistoricalDecisionBasisReadModel digest identity.

## ADR-2 exit-gate inspection projection

The historical reconstruction also exposes the validated authority semantics required to inspect the frozen decision-time world without replacing any authority with a new object:

```text
exitGateClosure.projectionClass =
  NONE_NON_AUTHORITY_ADR2_EXIT_GATE_INSPECTION_PROJECTION

exitGateClosure.reconstructionClassification =
  EXACT_FROZEN_AUTHORITY_WORLD_WITH_CONTEXT_REPLAY_CLASS_PRESERVED_NO_LATEST_LOOKUP

exitGateClosure.authorityClaim =
  NONE_EXIT_GATE_PROJECTION_IS_INSPECTION_EVIDENCE_NOT_AUTHORITY
```

Producer construction uses:

```text
reconstructHistoricalDecisionBasisExitGate(...)
```

which first performs the accepted historical basis, D06, D04/R03, and publication-audit reconstruction, then reuses the existing historical validators for the exact refs reachable from that world. It does not perform a latest/current lookup and it does not publish any authority record.

The exit-gate projection exposes, where present in the exact historical world:

- `decisionProblemWorld`: exact A01 `DecisionProblem` semantic payload, including `decisionAuthorityMode`, `targetRef`, logical time, horizon, objective, action space, constraints, use purpose/class, and decision deadline, plus its exact creation authorization decision;
- `contextEvidenceWorlds`: exact `ContextManifest` semantic payload, exact `ContextDatum` membership, exact resolved-receipt/reference/datum semantic payloads, evidence cutoff, logical time, and replay classification;
- `knowledgeReleaseWorlds`: exact K06 `KnowledgeRelease`, publication decision, the complete exact release-member set, and historical lifecycle result;
- `knowledgeWorlds`: historical provenance for every exact KnowledgeRelease member as well as every knowledge authority present on the D04/R03/D01 decision paths. Qualified knowledge carries exact Claim, SourceContext, Source, SourceFaithfulReviewDecision, and ScientificQualificationDecision semantics. Derived knowledge carries exact DerivedKnowledgeContext, DerivationMethod, and input QualifiedKnowledge provenance;
- `knowledgeRetrievalWorlds`: exact A07 `KnowledgeRetrievalResult`, Deployment semantics, and retained runtime authorization decision;
- `applicabilityAssessmentWorlds`: exact A08 `ApplicabilityAssessment` semantic payload, preserving the frozen transport/scientific-use/runtime-use basis;
- `runtimeProfileWorld`: exact historical `RuntimeProfile` semantic payload already validated through the D05/D04 decision world;
- `runtimeBindingWorlds`: exact D01 `RuntimeBinding` semantic payload, selected alternative, and every frozen binding class. Unused binding classes remain explicit empty arrays rather than disappearing from the historical representation;
- `executionArtifactWorlds`: exact `Specification`, `Implementation`, and `ImplementationConformance` semantic payloads when material to an included D01 execution binding;
- `decisionRobustnessWorld`: exact D05 `DecisionRobustness` semantic payload, including coverage assessment, action evaluations, signature groups, action-changing diagnostics, robustness class, and historical replay mode;
- `policyWorld`: exact Policy semantic payload when the D06 decision authority is ADR policy-backed.

All exact AuthorityRefs carried by `exitGateClosure` are added only to the derived `authorityGraph.allAuthorityRefs` inspection set. They are not added to the original v1 digest basis.

The frozen v1 identity remains:

```text
basisDigest = semanticHash('HistoricalDecisionBasisReadModel', original v1 basis)
```

For the qualified World P used by ADR-2 acceptance, the unchanged digest remains:

```text
sha256:103e0136fa7d0d3ad3ef8ff0e2746369a3b294a428d68e54b741dbeec8c50d45
```

The clean npm-offline consumer independently recomputes semantic hashes from transported bytes for the exact DecisionProblem, ContextManifest/ContextDatum/receipt/reference records, KnowledgeRelease, scientific knowledge provenance chain, KnowledgeRetrievalResult, ApplicabilityAssessment, RuntimeBinding, DecisionRobustness, Policy, Specification, Implementation, and ImplementationConformance evidence. It also verifies that every exact AuthorityRef carried by the exit-gate projection is present in the transported derived authority graph. Producer-side qualification additionally verifies the exact RuntimeProfile semantic identity and complete KnowledgeRelease-member provenance coverage.

That independent verification does **not** mean the consumer has re-executed all upstream authorization, provider-retention, conflict-governance, qualification, or publication validators. In particular, the consumer does not possess the ADR snapshot store needed to replay retained provider bytes, and transported semantic-hash verification does not confer any authority role. Full governed replay remains the responsibility of ADR before transport construction.

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

The projection hash covers `publicationAuditClosure` and `exitGateClosure` when they are present. Qualification additionally requires the clean independent consumer to verify the publication AuditEvent/D06 closure and the transported exit-gate semantic hashes/ref graph described above. The public sink does not claim that these local hash/ref checks replay the upstream ADR authority graph.

The sink does **not** possess an ADR ledger or snapshot store and therefore does not independently replay upstream authority history. Its returned verification classification remains:

```text
PROJECTION_HASH_INTEGRITY_ONLY_UPSTREAM_AUTHORITY_REPLAY_NOT_REPERFORMED
```

The additive sink result facts remain:

```text
decision_result_semantic_hash_verified   = true
runtime_alternative_provenance_verified  = true
```

They mean only that the transported D06/D04/R03 semantic payloads were verified against their exact identities and checked for internal lineage consistency. Publication-audit and exit-gate verification performed by qualification are additional evidence; they do not mean the consumer replayed provider snapshots or publication/authorization decisions, and they do not grant ADR authority to GEOX.

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

The D06 semantics, D04/R03 provenance, publication-audit, and ADR-2 exit-gate closures do not add or remove any public module path or exported symbol. They extend the transported historical basis with derived non-authority inspection evidence; the existing public surface inventory therefore remains unchanged.

The existing `@adr/geox-adapter/decision-result-sink` remains unchanged and continues to require exact `DecisionResult` `authority_ref` identity. It must reject historical-basis `projection_hash` events.
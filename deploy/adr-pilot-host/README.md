# ADR v0.3 Thin Pilot Host

Status: deployment packaging only. This directory is not architecture authority and does not create domain authority.

## Purpose

This host binds the frozen ADR v0.3 transport contract to existing governed backend services.

It does not implement recommendation, RuntimeEligibility, RuntimeBinding, DecisionResult, autonomous execution, new scientific semantics, or generic ledger publication.

## Public surface

The domain routes are exactly the frozen P01 v0.3 surface:

- POST /v1/decision-problems
- POST /v1/context-data
- POST /v1/context-references
- POST /v1/context-references/{reference_id}/resolutions
- POST /v1/context-manifests
- POST /v1/knowledge-retrieval-results
- POST /v1/applicability-assessments
- GET /v1/workbench/cases/{assessment_id}
- GET /v1/workbench/escalations

Deployment-only informational endpoints:

- GET /healthz
- GET /ready
- GET /openapi.json

There is no /recommend, /runtime-eligibility, /runtime-bindings, or /decision-results route.

## Authority boundary

The host never calls generic ledger.publish for customer requests.

Every write delegates to the existing governed backend seam:

- publishDecisionProblem
- publishContextDatum
- publishAuthorizedContextReference
- publishResolvedContextDatumReceipt
- publishContextManifest
- executeKnowledgeRetrieval
- assessKnowledgeApplicability

Bearer identity is bound exactly to the request principal before backend execution.

AuthorizationDecisionAudit refs remain replay evidence. They are not treated as bearer capabilities.

## Persistence

AuthorityLedger persistence uses the existing P08 recovery contract:

- createAuthorityRecoveryCheckpoint
- restoreAuthorityRecoveryCheckpoint

The host atomically persists one validated checkpoint and retains the immediately previous checkpoint on the same mounted storage.

Context-reference retained bytes use a content-addressed filesystem store with the same exact SHA-256 identity used by the existing reference-resolution contract.

This is pilot persistence. It is not a claim of multi-region backup, offsite disaster recovery, or production database durability.

## Bootstrap

Preferred customer mode:

ADR_PILOT_BOOTSTRAP_PACKAGE_B64

The package must contain:

- a checkpoint accepted by restoreAuthorityRecoveryCheckpoint;
- deployment-only metadata such as exact Workbench inspection-authorization mappings.

The host does not expose an admin endpoint that bypasses ADR governance to manufacture bootstrap authority.

Synthetic bootstrap:

ADR_PILOT_SYNTHETIC_BOOTSTRAP=true

This is smoke-test only. It reuses the existing non-GEOX v0.3 release acceptance fixture and must never be represented as customer or production authority.

## Authentication

ADR_PILOT_TOKEN_BINDINGS_JSON binds opaque bearer tokens to exact ADR principals.

The host requires exact equality between:

- authenticated token principal;
- request body principal.

Token values must be supplied through deployment secrets and must not be committed.

## Required persistent paths

Default:

- ADR_PILOT_STATE_PATH=/data/adr-pilot-state.json
- ADR_PILOT_SNAPSHOT_DIR=/data/context-snapshots

A real deployment must mount persistent storage at /data or override both variables to another durable mount.

## Context-reference resolution transport representation

P01 freezes the resource contract and forbids semantic reinterpretation but does not select an HTTP framework or byte encoding.

For POST /v1/context-references/{reference_id}/resolutions the thin host mechanically maps:

- reference_ref -> exact AuthorizedContextReference ref
- normalized_context_datum_ref -> exact ContextDatum ref
- resolution -> existing resolution timestamps
- retain_snapshot -> existing retention switch
- provider_response_base64 OR provider_response_utf8 -> exact provider-response bytes

Those bytes enter the existing publishResolvedContextDatumReceipt service. The host does not parse them into agronomic meaning.

## Browser UI

This package does not claim an existing browser Workbench application. It exposes the frozen Workbench read-model API.

A later browser shell may consume that API without widening ADR authority, but its existence is not required for this host acceptance.

## Acceptance

Run:

node deploy/adr-pilot-host/acceptance.mjs

The acceptance proves:

- health and readiness;
- frozen OpenAPI surface;
- bearer/principal fail-closed behavior;
- one real governed ContextDatum write;
- persisted transport idempotency;
- one Workbench case read;
- escalation read;
- recovery-checkpoint restart and replay.

It does not claim commercial validation.

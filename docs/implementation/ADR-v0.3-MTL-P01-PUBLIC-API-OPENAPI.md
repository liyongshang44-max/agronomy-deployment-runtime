# ADR v0.3 — MTL-P01 Public API / OpenAPI Authority Surface

Status: **IMPLEMENTATION CONTRACT / NON-ARCHITECTURE-AUTHORITY**

Baseline: `main @ 2a3fba201e9f1f41911abc053ebda424aedca092`

## 1. Purpose

P01 exposes the already-implemented Gate-A product slice through a stable platform-neutral public contract. It does not create new scientific, runtime-legality or decision authority and it does not choose an HTTP framework, persistence technology or deployment topology.

The P01 surface is the contract predecessor for P02 SDK/Generic Integration and P03 Non-GEOX Reference Integration Acceptance.

## 2. Pilot public operations

The pilot surface contains governed resource writes for:

- DecisionProblem;
- ContextDatum;
- AuthorizedContextReference;
- ResolvedContextDatumReceipt;
- ContextManifest;
- KnowledgeRetrievalResult;
- ApplicabilityAssessment.

It also exposes the existing A11 non-authority workbench projections:

- one Agronomist Workbench case;
- escalation queue.

Each authority write is explicitly mapped to one existing governed backend authority service. No operation may call a generic ledger publish/mutation path.

## 3. Public transport envelope

Every authority write requires:

```text
logical_id
version
principal
authorization_decision_ref
resource.contract_version
Idempotency-Key
Bearer authentication
```

`Idempotency-Key` is transport retry identity only. It does not replace ADR logical id, version, semantic hash or authority idempotence semantics.

The authenticated bearer identity is authoritative for caller identity. The transport/gateway MUST derive the authenticated subject and require exact identity equality with the declared `principal` before invoking any backend service. A caller cannot self-select another ADR Principal merely by placing it in the request body.

`authorization_decision_ref` is replayable authority evidence, not a bearer capability. The backend MUST resolve and replay-validate the exact AuthorizationDecisionAudit against the authenticated principal, operation and resource scope. Possession or submission of an allowed decision ref cannot authorize a different principal/scope/operation.

These rules are exposed machine-readably on every operation as:

```text
x-adr-authenticated-principal-binding = BEARER_SUBJECT_MUST_EQUAL_REQUEST_PRINCIPAL
x-adr-authorization-ref-semantics = REPLAY_VALIDATED_EVIDENCE_NOT_CAPABILITY
```

Each operation freezes an `x-adr-resource-contract` value. P02 may map representation, but it may not reinterpret or flatten the frozen resource semantics.

Authority responses retain an exact authority reference:

```text
kind
logical_id
version
semantic_hash
```

and the normalized public resource payload.

## 4. Read-security boundary

P01 deliberately does **not** expose a generic:

```text
GET /authority/{kind}/...
```

Exact addressability is not read entitlement. ADR does not yet have one universal cross-resource public read-authorization seam, and such an endpoint could bypass tenant visibility / proprietary Knowledge controls.

Workbench reads reuse the already-closed A11 human evidence boundary:

```text
knowledge.inspect + source.read
```

Runtime-use entitlement cannot substitute for human evidence visibility.

Resource-specific public reads may be added later only when their exact authorization contract is frozen and executable.

## 5. No-bypass boundary

The pilot API contains no:

```text
/recommend
/runtime-eligibility
/runtime-bindings
/decision-results
/qualified-knowledge mutation
/generic authority publish
```

P01 does not expose unimplemented Gate-R/D/E authority.

Successful HTTP/API creation means only that the governed resource operation succeeded. It does not mean agronomically valid, safe, recommended or runtime eligible.

## 6. Platform independence

The public contract must contain no GEOX, MCFT, KBS, T3R1, customer DB/table or provider-specific core schema concepts.

GEOX and future customer adapters are downstream representation/protocol mappings only. P03 must prove a non-GEOX integration against this same surface before v0.3 commercial pilot readiness.

## 7. OpenAPI source of truth

Executable source:

- `packages/public-api/src/surface.mjs`
- `packages/public-api/src/openapi.mjs`

The OpenAPI document is OpenAPI 3.1 and is versioned independently as the pilot transport contract while each authority resource retains its own frozen ADR contract version.

## 8. Acceptance

Root CI includes:

```text
npm run test:public-api
```

Acceptance proves:

- every registry operation exists in OpenAPI;
- every write maps to a known governed backend seam;
- every write requires bearer authentication and transport idempotency;
- bearer identity must bind exactly to declared ADR principal;
- authorization-decision refs are replay-validated evidence, never bearer capabilities;
- every authority write pins a frozen resource contract version;
- templated paths declare exact path parameters;
- exact AuthorityRef preserves kind/logical-id/version/semantic-hash identity;
- Workbench remains explicitly non-authority;
- no generic arbitrary authority read is exposed;
- no recommendation/RuntimeEligibility/Binding/DecisionResult shortcut exists;
- no GEOX/provider-specific public schema authority leaks into P01;
- unimplemented Gate-R/D/E operations remain absent.

P01 may be declared closed only after exact feature-head CI, current merge-ref CI, merge, actual main verification and exact-main CI are all green.

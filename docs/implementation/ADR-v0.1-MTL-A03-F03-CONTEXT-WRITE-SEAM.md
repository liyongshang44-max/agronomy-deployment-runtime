# ADR v0.1 — A03 / F03 Context Write Resource Extension

Status: **IMPLEMENTATION AUTHORITY EXTENSION — F03 → A03**

Baseline: `main @ c4eaa97ccab27e64ba697bafbc34e2e447d47575`

> **A04 extension notice.** The three-type resource vocabulary below is the exact A03-stage vocabulary. MTL-A04 subsequently extends the current `context.write` resource vocabulary with `CONTEXT_MANIFEST`. That later extension does not alter A03 reference/receipt semantics or weaken A03 resource-type isolation. See `ADR-v0.1-MTL-A04-F03-CONTEXT-WRITE-SEAM.md`.

## 1. Reused permission

A03 does not introduce a new IAM permission. It reuses the F03 permission already frozen before A03:

```text
context.write
```

The A02 seam used that permission for `CONTEXT_DATUM`. At the A03 stage, the exact resource-type vocabulary is:

```text
CONTEXT_DATUM
AUTHORIZED_CONTEXT_REFERENCE
RESOLVED_CONTEXT_DATUM_RECEIPT
```

No other resource type is authorized **by the A03 extension itself**. Later task-line capabilities may explicitly extend the shared F03 resource vocabulary under their own implementation authority without retroactively changing A03 semantics.

## 2. Exact request scope

Every non-knowledge context-write AuthorizationDecision freezes:

```text
exact Principal
+ exact immutable RoleAssignment refs
+ organizationId
+ tenantId?
+ exact resourceType
+ exact resourceId/logicalId
```

A RoleAssignment may be broader than one object, but the AuthorizationDecision for publication is always bound to the exact requested logical id.

A grant scoped to `AUTHORIZED_CONTEXT_REFERENCE` cannot authorize a receipt. A grant scoped to `RESOLVED_CONTEXT_DATUM_RECEIPT` cannot authorize a ContextDatum. Resource-type substitution fails closed.

## 3. No permission substitution

`decision.problem.create` cannot substitute for `context.write`.

Likewise, possession of a reference does not authorize creation of a receipt. Reference and receipt publication each require their own exact `CONTEXT_WRITE` AuthorizationDecisionAudit.

## 4. Tenant isolation

Only exact RoleAssignments for the exact Principal identity may contribute authority:

```text
principalId
type
organizationId
tenantId?
```

The publishing Principal organization/tenant must also match the target reference/receipt organization/tenant. Same textual principal id/type in another tenant is not transferable authority.

## 5. Replayable authorization

A03 publication validation must:

1. resolve the exact AuthorizationDecisionAudit;
2. reproduce its AuthorizationDecision hash;
3. require `operation = CONTEXT_WRITE` and `allowed = true`;
4. require the exact A03 resource type and exact logical id;
5. resolve every exact RoleAssignment ref;
6. recompute `authorizeContextWrite(...)`;
7. require the recomputed decision hash to equal the stored decision hash;
8. require direct audit inputs for the exact RoleAssignment refs.

Caller-supplied audit action names are not authorization authority.

## 6. Knowledge authorization remains unchanged

A03 references and receipts are Runtime Plane context authority, not Knowledge Control Plane objects.

No fake `KnowledgeGovernancePolicy` is created for A03 context writes. The original F03 knowledge double gate remains unchanged for knowledge operations, and the A01 `decision.problem.create` scoped seam remains unchanged.

## 7. Built-in roles

This extension does not silently change any built-in role permission set.

`INTEGRATION_SERVICE` already carried `context.write` before A03. A03 only makes the resource-type interpretation explicit and exact for reference-resolution authority.

## 8. A03 nonclaims

At the A03 stage this extension did not establish:

```text
ContextManifest publication
ApplicabilityAssessment
RuntimeProfile or Deployment
RuntimeBinding
DecisionResult
```

A04 later establishes ContextManifest publication under its own explicit `CONTEXT_MANIFEST` resource extension. Applicability, deployment, binding and decision authority remain separate later capabilities and cannot be smuggled into `context.write` through an unrecognized resource type.

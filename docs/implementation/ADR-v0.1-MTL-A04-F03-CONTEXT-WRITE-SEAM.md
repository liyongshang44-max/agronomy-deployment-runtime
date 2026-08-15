# ADR v0.1 — A04 / F03 ContextManifest Write Resource Extension

Status: **IMPLEMENTATION AUTHORITY EXTENSION — F03 → A04**

Baseline: `main @ 9eeb69dad9c11905eb6251337e6dc29e40f6116c`

## 1. Reused permission

A04 introduces no new IAM permission. It reuses:

```text
context.write
```

The current exact context-write resource vocabulary becomes:

```text
CONTEXT_DATUM
AUTHORIZED_CONTEXT_REFERENCE
RESOLVED_CONTEXT_DATUM_RECEIPT
CONTEXT_MANIFEST
```

This explicitly supersedes the A03-stage three-type vocabulary while preserving all A02/A03 resource isolation semantics.

## 2. Exact ContextManifest request scope

Every ContextManifest publication AuthorizationDecision freezes:

```text
exact Principal
+ exact immutable RoleAssignment refs
+ organizationId
+ tenantId?
+ resourceType = CONTEXT_MANIFEST
+ resourceId = exact ContextManifest logicalId
```

A broad RoleAssignment may cover multiple manifests, but the recorded AuthorizationDecision for one publication is bound to the exact manifest logical id.

## 3. Permission and resource isolation

`decision.problem.create` cannot substitute for `context.write`.

A `CONTEXT_DATUM`, `AUTHORIZED_CONTEXT_REFERENCE`, or `RESOLVED_CONTEXT_DATUM_RECEIPT` scoped RoleAssignment cannot authorize ContextManifest publication merely because it carries the same permission string.

Likewise, a `CONTEXT_MANIFEST` grant does not authorize any later `RUNTIME_BINDING`, `ApplicabilityAssessment` or other future object type.

Unrecognized resource types fail closed.

## 4. Identity and tenant isolation

Only RoleAssignments for the exact Principal identity may contribute authority:

```text
principalId
type
organizationId
tenantId?
```

The publishing principal organization/tenant must equal the DecisionProblem target organization/tenant used by the manifest.

Same principal id/type text from another tenant contributes no ContextManifest write authority.

## 5. Replayable authorization

Publication and validation must:

1. resolve the exact AuthorizationDecisionAudit;
2. reproduce the stored AuthorizationDecision hash;
3. require `operation = CONTEXT_WRITE` and `allowed = true`;
4. require exact `resourceType = CONTEXT_MANIFEST` and exact logical id;
5. resolve every exact RoleAssignment ref;
6. recompute `authorizeContextWrite(...)`;
7. require the recomputed decision hash to equal the stored hash;
8. require direct audit input refs for the exact RoleAssignments.

Caller-supplied action names do not constitute authorization.

## 6. No fake KnowledgeGovernancePolicy

ContextManifest is Runtime Plane context authority, not Knowledge Control Plane authority.

The scoped AuthorizationDecision therefore contains exact RoleAssignment refs and no fake `KnowledgeGovernancePolicy`/`policyRef`.

Existing knowledge authorization double-gate semantics and A01 `decision.problem.create` semantics remain unchanged.

## 7. Built-in roles

This extension does not silently change any built-in role permission set.

`INTEGRATION_SERVICE` already carried `context.write`; A04 only makes the ContextManifest resource interpretation explicit and exact.

## 8. Nonclaims

This seam does not authorize:

```text
Knowledge retrieval
Applicability adjudication
RuntimeProfile or Deployment
RuntimeBinding
DecisionResult
```

Those remain explicit later authority surfaces and cannot be introduced through generic context-write scope.

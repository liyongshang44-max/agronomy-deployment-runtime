# ADR v0.1 — A02 / F03 Context Write Scoped Authorization Seam

Status: **IMPLEMENTATION AUTHORITY EXTENSION — F03 → A02**

Baseline: `main @ 5a84999af1e1ce1c540e9d9938df4965980f90fe`

## 1. Why this seam exists

MTL-A02 has hard predecessor Gate F. ContextDatum publication therefore cannot be authorized merely by organization/tenant equality or caller-supplied audit vocabulary.

A02 reuses the already frozen F03 permission:

```text
context.write
```

No new permission is introduced.

The frozen `INTEGRATION_SERVICE` built-in role already carries `context.write`; other principals may receive it through explicit immutable/versioned RoleAssignment authority.

## 2. Scoped decision

A02 is a non-knowledge scoped operation under the F03 extension already established by A01.

The decision form is:

```text
exact Principal
+ exact RoleAssignment refs
+ exact authorization scope
-> AuthorizationDecision
```

Frozen operation:

```text
CONTEXT_WRITE
```

Frozen request scope for A02:

```text
organizationId
tenantId?
resourceType = CONTEXT_DATUM
resourceId   = exact ContextDatum logicalId
```

A broad RoleAssignment may cover multiple ContextDatum resources, but each AuthorizationDecision freezes the exact resourceId actually requested.

## 3. No fake knowledge policy

ContextDatum is not Knowledge and A02 does not invent a `KnowledgeGovernancePolicy` merely to satisfy the historical knowledge-authorization shape.

The original F03 knowledge double gate remains unchanged for knowledge operations:

```text
RoleAssignment
+ KnowledgeGovernancePolicy
+ request
```

A02 scoped context-write decisions contain exact RoleAssignment refs and no fake `policyRef`.

## 4. Identity and tenant isolation

Only RoleAssignments for the exact principal identity may contribute authority:

```text
principalId
type
organizationId
tenantId?
```

The principal organization/tenant must also exactly equal the target ContextDatum organization/tenant.

A RoleAssignment from another tenant cannot contribute authority even when principal id/type strings are identical.

`decision.problem.create` is not interchangeable with `context.write`.

## 5. Replayable authorization

A02 publication requires an exact content-addressed `AuthorizationDecisionAudit`.

Validation must:

1. resolve the exact AuthorizationDecisionAudit;
2. verify its decision hash;
3. require `operation = CONTEXT_WRITE` and `allowed = true`;
4. bind the exact principal and exact ContextDatum resourceId;
5. resolve every exact RoleAssignment ref;
6. recompute `authorizeContextWrite(...)` from those RoleAssignments;
7. require the recomputed decision hash to equal the stored decision hash;
8. require direct audit input refs for the exact RoleAssignments.

Copying `AUTHORIZATION_CONTEXT_WRITE_ALLOW` or `PUBLISH_CONTEXT_DATUM` strings without the authority chain cannot manufacture ContextDatum authority.

## 6. Trust root

This seam follows the frozen F03 model established before A02: RoleAssignment is the immutable/versioned IAM authority root consumed by AuthorizationDecision evaluation.

A future administrative capability governing who may issue/revoke RoleAssignments is separate work and is not invented inside A02.

## 7. Non-regression boundary

This seam does not change:

- existing F03 knowledge authorization semantics;
- the A01 `decision.problem.create` semantics;
- built-in role permission sets;
- KnowledgeGovernancePolicy semantics;
- scientific qualification, applicability, deployment or final-decision authority.

# ADR v0.1 — MTL-F03 Review Adjudication

Status: **IMPLEMENTATION REVIEW / NON-ARCHITECTURE-AUTHORITY**

Task: `MTL-F03 — IAM / Tenant / Knowledge-IP / Entitlement`

Purpose: close two implementation seams found after the first green F03 acceptance run, without changing Architecture v1.0 or C02 semantics.

## 1. Principal identity binding

A RoleAssignment must not be reusable merely because a caller presents the same `principalId` and principal type under a different organization/tenant identity.

F03 therefore treats stable principal identity for role-assignment matching as:

```text
principalId
+ principal type
+ organizationId
+ tenantId where present
```

Program memberships are contextual authorization claims rather than stable principal identity and are intentionally not part of this equality test. Program-specific authority remains governed by RoleAssignment scope, visibility audience and deployment scope.

A same-ID cross-organization/tenant impersonation attempt must fail role matching.

## 2. Authorization audit recording

An `AuthorizationDecision` already freezes exact policy and RoleAssignment references plus a decision hash. F03 additionally provides an explicit audit-recording path that materializes an `AuthorizationDecisionAudit` governance/audit record through the shared F02 authority/audit substrate.

The audit record binds:

```text
AuthorizationDecision hash
exact KnowledgeGovernancePolicy ref
exact RoleAssignment refs
ALLOW/DENY action
reason codes
actor/time audit metadata
```

`AuthorizationDecisionAudit` is operational governance/audit material. It does not become scientific, applicability, runtime or decision authority.

Future API/runtime enforcement surfaces that execute an authorization decision are required to record the corresponding audit event; pure evaluation may be used for deterministic tests/read-only preflight but cannot be used as a production mutation/deployment bypass.

## 3. Review result

With these corrections F03 can claim executable authorization/entitlement semantics while retaining explicit nonclaims for authentication/SSO and durable production IAM persistence.

No architecture amendment is required.

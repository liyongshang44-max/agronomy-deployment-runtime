# ADR v0.1 — A01 / F03 Scoped Authorization Seam

Status: **IMPLEMENTATION AUTHORITY EXTENSION — F03 → A01**

Baseline: `main @ 4455a23e3c785137ee8da29938484e416768a666`

## 1. Why this seam exists

MTL-A01 has hard predecessor Gate F. During independent A01 authority review, organization/tenant identity plus a caller-supplied audit vocabulary was proven insufficient to establish `DecisionProblem` creation authority because the shared `AuthorityLedger` intentionally accepts caller-supplied audit metadata.

Therefore A01 must consume a recomputable F03 authorization decision rather than treating audit labels as authorization.

## 2. F03 extension

F03 permission vocabulary gains exactly one permission:

```text
decision.problem.create
```

No existing built-in role receives this permission.

In particular:

```text
INTEGRATION_SERVICE context.write != decision.problem.create
AGRONOMIST knowledge.inspect        != decision.problem.create
```

A principal receives A01 creation authority only through an explicit immutable/versioned `RoleAssignment` carrying `decision.problem.create` over a scope that contains the exact creation request.

## 3. Scoped AuthorizationDecision

Existing knowledge operations remain unchanged:

```text
RoleAssignment
+ exact KnowledgeGovernancePolicy
+ exact request
-> AuthorizationDecision
```

A01 uses a second F03 decision form for a non-knowledge resource creation operation:

```text
exact Principal
+ exact RoleAssignment refs
+ exact authorization scope
-> AuthorizationDecision
```

Frozen operation:

```text
DECISION_PROBLEM_CREATE
```

Frozen request scope:

```text
organizationId
tenantId? 
resourceType = DECISION_PROBLEM
resourceId   = exact DecisionProblem logicalId
```

This scoped decision has no `policyRef`; introducing a fake KnowledgeGovernancePolicy merely to satisfy an old knowledge-only shape would create the wrong authority model.

The content-addressed `decisionHash` still uses the shared `AuthorizationDecision` hash domain and therefore freezes the exact principal, assignment refs, request, allow/deny result and reason set.

## 4. Identity and scope invariants

The public F03 wrapper filters RoleAssignments by exact principal identity:

```text
principalId
type
organizationId
tenantId?
```

The decision additionally requires the request organization/tenant to equal the principal organization/tenant.

Role scope may be broad, for example organization + tenant + `DECISION_PROBLEM`, but every decision freezes the actual exact `resourceId`. A decision for `dp-A` cannot authorize publication of `dp-B`.

## 5. Audit / replay

`recordAuthorizationDecision()` accepts both:

```text
knowledge decision: policyRef + assignmentRefs
scoped decision:    assignmentRefs only
```

For both forms, all authority refs are direct immutable audit inputs.

A01 must resolve the exact `AuthorizationDecisionAudit`, resolve its exact RoleAssignment refs, recompute `authorizeDecisionProblemCreation(...)`, and require the recomputed decisionHash to equal the stored decisionHash.

A caller who copies `AUTHORIZATION_DECISION_PROBLEM_CREATE_ALLOW` or `PUBLISH_DECISION_PROBLEM` audit strings without a valid RoleAssignment cannot manufacture A01 authority.

## 6. Trust root

This seam does not create a recursive authorization hierarchy for RoleAssignment publication. Under the frozen F03 model, `RoleAssignment` is itself an immutable/versioned IAM authority record and is the root authority consumed by AuthorizationDecision evaluation.

Any future administrative workflow governing who may issue/revoke RoleAssignments is a separate IAM capability and must not be invented implicitly inside A01.

## 7. Non-regression boundary

The extension does not change the semantics of existing F03 knowledge authorization operations, built-in roles, KnowledgeGovernancePolicy, four-dimensional governance, or tenant-isolation wrappers.

Dedicated acceptance must prove:

- no built-in role silently receives `decision.problem.create`;
- explicit permission grants exact scoped creation;
- `context.write` does not substitute for it;
- exact resource scope is enforced;
- same principal id/type in another tenant cannot contribute authority;
- scoped AuthorizationDecisionAudit records exact RoleAssignment inputs and no fake `policyRef`.

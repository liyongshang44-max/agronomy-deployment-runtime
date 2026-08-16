# ADR v0.1 — A05 F03 RuntimeProfile Management Authorization Seam

Status: **IMPLEMENTATION CONTRACT / NON-ARCHITECTURE-AUTHORITY**

Baseline: `main @ d1cba02413126afe32fef5c2ba02113184367567`

A05 adds one explicit non-knowledge scoped F03 operation for RuntimeProfile control-plane publication:

```text
permission: runtime.profile.manage
operation: RUNTIME_PROFILE_MANAGE
resourceType: RUNTIME_PROFILE
```

## Invariants

- no existing built-in role is silently amended;
- `knowledge.deploy`, `deployment.production`, `context.write`, and `decision.problem.create` are not interchangeable with `runtime.profile.manage`;
- an allow decision requires exact Principal identity plus one or more exact immutable RoleAssignment authorities containing the permission and covering the exact profile scope;
- request scope binds organization, optional tenant, `RUNTIME_PROFILE`, and exact profile logical ID;
- same principal id/type in another tenant contributes no authority;
- the decision is content-addressed under the existing `AuthorizationDecision` hash domain;
- the recorded `AuthorizationDecisionAudit` directly binds every contributing RoleAssignment ref;
- no fake `KnowledgeGovernancePolicy`/`policyRef` is created because RuntimeProfile management is not a knowledge-governance operation;
- all existing knowledge double-gate semantics remain unchanged.

This seam authorizes RuntimeProfile management only. It does not grant Deployment activation, production rollout, runtime knowledge use, scientific qualification, or final decision authority.

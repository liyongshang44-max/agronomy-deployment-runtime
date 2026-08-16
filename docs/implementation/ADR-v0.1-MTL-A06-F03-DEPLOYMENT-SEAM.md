# ADR v0.1 — A06 F03 Deployment Authorization Seam

Status: **IMPLEMENTATION CONTRACT / NON-ARCHITECTURE-AUTHORITY**

Baseline: `main @ 3ec95727608520994994cfec1f2d4f775e54eaff`

A06 deliberately reuses the existing F03 deployment/runtime permissions rather than introducing a parallel `deployment.manage` vocabulary.

## Control publication and lifecycle

```text
knowledge.deploy
```

is required for Deployment publication and lifecycle control.

If either the Deployment technical runtime environment or operational rollout stage is `PRODUCTION`, the same authorization decision additionally requires:

```text
deployment.production
```

The decision scope freezes exact organization, optional tenant, program, `resourceType=DEPLOYMENT`, exact Deployment logical id, control action, and production requirement.

## Runtime retrieval

Runtime-side exact Deployment retrieval is separately authorized by:

```text
knowledge.runtime.use
```

It is not implied by `knowledge.deploy` or `deployment.production`.

## Permanent separation

```text
Knowledge owner deployment entitlement
!= Deployment controller authority
!= Runtime read authority
```

Knowledge owner entitlement is preserved through the exact RuntimeProfile → KnowledgeRelease authority chain. Deployment control uses RoleAssignment-based F03 operational authority. Runtime retrieval uses the Runtime Service entitlement.

No fake KnowledgeGovernancePolicy is created for these non-knowledge control decisions. Existing knowledge-policy double-gate semantics are unchanged.

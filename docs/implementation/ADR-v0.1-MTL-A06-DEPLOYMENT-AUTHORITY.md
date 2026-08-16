# ADR v0.1 — MTL-A06 Deployment Authority Implementation Contract

Status: **IMPLEMENTATION CONTRACT / NON-ARCHITECTURE-AUTHORITY**

Task: `MTL-A06 — Deployment Authority (Applicability-Safe Minimal Path)`

Baseline: `main @ 3ec95727608520994994cfec1f2d4f775e54eaff`

Upstream authority remains Architecture v1.0 + Final Adjudication, Capability Map 01 + Final Planning Adjudication, Master Task Line 01, Gate F, Gate K, and MTL-A05.

## 1. Scope

A06 establishes the immutable operational authority that applies one exact RuntimeProfile to one authorized organization/tenant/program/target/use/time scope.

Deployment is Control Plane authority. It does not qualify Knowledge, alter RuntimeProfile semantics, establish ApplicabilityAssessment, prove RuntimeEligibility, execute a runtime, or create a DecisionResult.

## 2. Normative environment/stage supersession

The early public-contract illustrative field:

```text
environment: PILOT
```

is superseded by Architecture v1.0 Final Adjudication section 10. A06 therefore accepts only the normative orthogonal fields:

```text
runtimeEnvironment:
  DEVELOPMENT | STAGING | PRODUCTION

rolloutStage:
  DRAFT | SANDBOX | SHADOW | PILOT | PRODUCTION | SUSPENDED | DEPRECATED
```

`PILOT` is never a technical runtime environment. `STAGING` is never a rollout stage. The legacy `environment` alias fails closed.

Initial Deployment publication accepts only non-lifecycle rollout stages. `SUSPENDED` and `DEPRECATED` are reached through separately authorized immutable lifecycle control decisions.

## 3. Deployment semantic payload

A06 freezes:

- exact RuntimeProfile ref;
- organization/tenant/program scope;
- canonical region set;
- canonical crop set;
- canonical decision-type set;
- authorized use-purpose set;
- authorized use-class set;
- exact effective interval;
- runtime environment;
- rollout stage.

All material fields participate in Deployment semantic identity. Same logical-id/version semantic mutation is forbidden by F02.

Deployment contains no KnowledgeRelease/Model/Policy/Implementation/Calibration/RuntimeBinding mutation payload. Those authorities remain behind the exact RuntimeProfile/KnowledgeRelease refs or later runtime objects.

## 4. Exact RuntimeProfile and KnowledgeRelease entitlement closure

A06 validates the exact RuntimeProfile under current-use semantics before new Deployment publication.

The Deployment organization/tenant must equal RuntimeProfile control scope. The exact KnowledgeRelease underlying that RuntimeProfile must have been published to the same organization/tenant and an exact programId. A06 minimal Deployment must use that exact programId.

Deployment may narrow the authorized target/use/time world, but it may not broaden RuntimeProfile constraints:

- use purposes must be a subset of RuntimeProfile allowed use purposes;
- use classes must be a subset of RuntimeProfile allowed use classes;
- runtime environment must be allowed by RuntimeProfile;
- rollout stage must be allowed by RuntimeProfile.

Regions/crops/decision types are A06 deployment scope dimensions. A05 minimal RuntimeProfile does not yet claim constraints over these dimensions.

## 5. F03 Deployment control authority

A06 introduces no new IAM permission vocabulary.

Operational Deployment control intentionally activates existing F03 permissions:

```text
knowledge.deploy
```

and, whenever either runtime environment or rollout stage is `PRODUCTION`:

```text
deployment.production
```

The frozen `DEPLOYMENT_MANAGER` role already carries both permissions.

Publication and lifecycle control AuthorizationDecisionAudit records bind:

- exact Principal identity;
- exact RoleAssignment refs;
- exact organization/tenant/program;
- `resourceType=DEPLOYMENT`;
- exact Deployment logical id;
- exact control action;
- production/non-production requirement.

No fake KnowledgeGovernancePolicy is created. Knowledge owner entitlement remains independently closed through RuntimeProfile → exact KnowledgeRelease.

## 6. Runtime retrieval authority

Runtime-side Deployment retrieval is separate from Deployment control. It uses the existing:

```text
knowledge.runtime.use
```

permission and exact organization/tenant/program/Deployment identity.

A Deployment controller does not gain runtime-read authority merely by carrying `knowledge.deploy`. Unauthorized tenant/program runtime retrieval fails closed.

Runtime resolution additionally requires:

- current valid Deployment/RuntimeProfile/KnowledgeRelease authority;
- current rollout state not SUSPENDED/DEPRECATED;
- runtime time inside the Deployment effective interval.

## 7. Lifecycle authority

Suspend/resume/deprecate semantics are represented as immutable `DeploymentControlDecision` authority records rather than mutation of Deployment.

Frozen transitions for this slice:

- active base stage → `SUSPEND` → `SUSPENDED`;
- `SUSPENDED` → `RESUME` → original base rollout stage;
- any non-deprecated state → `DEPRECATE` → `DEPRECATED`;
- `DEPRECATED` is terminal.

Each control binds the exact Deployment, exact predecessor control tip when present, exact scoped authorization, reason codes, and direct controller audit.

Valid competing control branches/cycles fail closed. Generic or copied-ledger control records without replayable authority do not gain lifecycle effect.

Lifecycle state never changes Deployment, RuntimeProfile, KnowledgeRelease, or scientific semantic hashes.

## 8. Current-use and historical replay

Current Deployment validation recursively requires current RuntimeProfile and KnowledgeRelease authority. If later Knowledge lifecycle changes invalidate the exact release for new use, the Deployment is no longer current-use valid.

Historical validation may still replay the exact Deployment → RuntimeProfile → KnowledgeRelease world. Historical replay does not make that world newly deployable.

## 9. Explicit nonclaims

A06 does not establish:

- KnowledgeRetrievalResult;
- ApplicabilityAssessment;
- Transformation/Model/Policy/Implementation/Calibration authority not already present in the RuntimeProfile;
- RuntimePlan;
- RuntimeEligibility;
- RuntimeBinding;
- runtime execution;
- DecisionRobustness;
- DecisionResult.

A06 proves deployment control/entitlement semantics only. It does not prove that the deployed knowledge is applicable to any exact field context; A07/A08 remain required for that commercial applicability path.

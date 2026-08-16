# ADR v0.1 — MTL-A05 Minimal RuntimeProfile Implementation Contract

Status: **IMPLEMENTATION CONTRACT / NON-ARCHITECTURE-AUTHORITY**

Task: `MTL-A05 — Minimal RuntimeProfile`

Baseline: `main @ d1cba02413126afe32fef5c2ba02113184367567`

Upstream authority remains Architecture v1.0, Capability Map 01, Master Task Line 01, the public Runtime Contract, Gate F, and Gate K.

## 1. Scope

A05 establishes the smallest legal reusable `RuntimeProfile` composition authority. It does not execute a runtime and it does not establish a Deployment.

The minimal semantic payload freezes exactly:

- one exact `KnowledgeRelease` ref;
- control-plane organization/tenant scope;
- context requirements;
- replay minimum;
- runtime governance;
- allowed use/deployment constraints.

`RuntimeProfile` remains distinct from `KnowledgeRelease`, `Deployment`, `ContextManifest`, `RuntimePlan`, `RuntimeBinding`, and `DecisionResult`.

## 2. Minimal profile and conditional specification predecessors

Master Task Line A05 makes specification predecessors conditional on whether the profile actually constrains those authorities. Therefore this v0.1 minimal slice deliberately carries no Transformation/Model/Policy/Implementation/Calibration refs or constraint blocks.

The following fields are rejected rather than filled with fake authority:

```text
transformationConstraints / transformationRefs
modelConstraints / modelRefs
policyConstraints / policyRefs
implementationConstraints / implementationRefs
calibrationConstraints / calibrationRefs
```

This does not amend C13. It implements the A05 minimal slice before the conditional S-track authorities are used. A later RuntimeProfile version may add those constraints only after their required authority exists.

## 3. Exact KnowledgeRelease binding

Publication and current-use validation require an exact current `KnowledgeRelease` authority. No `latest` lookup or dynamic membership substitution is permitted. Historical validation may replay the exact release after later lifecycle changes without making it eligible for new use.

The minimal profile control organization/tenant must equal the KnowledgeRelease publication target organization/tenant. Program/field/decision rollout scope is intentionally not frozen here; that belongs to A06 Deployment.

## 4. Context requirements

The profile freezes a canonical set of required semantic IDs and optional per-semantic allowed `EpistemicClass` values. An epistemic constraint may only refer to a semantic ID that is itself required.

This is a requirement policy only. It does not contain a current TargetContext, ContextDatum, AuthorizedContextReference, ContextManifest, or runtime output.

## 5. Replay requirement

Frozen minima use the existing replay vocabulary:

```text
EXACT
CONTENT_ADDRESSED_EXTERNAL
PROVIDER_DEPENDENT
NON_REPLAYABLE
```

A05 only declares the minimum. Enforcement against an actual ContextManifest/Deployment/RuntimeBinding occurs downstream.

## 6. Runtime governance

The minimal profile freezes allowed DecisionProblem authority modes plus hard selection/binding invariants:

```text
knowledgeSelectionMode = EXACT_KNOWLEDGE_RELEASE
contextBindingMode = EXACT_CONTEXT_MANIFEST
applicabilityMode = EXACT_APPLICABILITY_ASSESSMENTS
```

This forbids dynamic latest-knowledge selection, mutable context-pool binding, and applicability bypass. `allowedDecisionAuthorityModes` limits admissible DecisionProblem modes; it does not create or bind a Policy specification.

## 7. Allowed use/deployment constraints

The profile freezes canonical sets for:

- use purposes;
- use classes;
- runtime environments: `DEVELOPMENT / STAGING / PRODUCTION`;
- rollout stages: `DRAFT / SANDBOX / SHADOW / PILOT / PRODUCTION / SUSPENDED / DEPRECATED`.

Runtime environment and rollout stage are orthogonal. `PILOT` is never accepted as a runtime environment and `STAGING` is never accepted as a rollout stage.

These are reusable profile constraints, not an actual Deployment target/effective interval.

## 8. Publication authority

RuntimeProfile publication requires the explicit F03 non-knowledge scoped permission:

```text
runtime.profile.manage
```

The authorization decision freezes exact Principal identity, exact RoleAssignment refs, organization/tenant, `resourceType=RUNTIME_PROFILE`, and exact RuntimeProfile logical ID. No KnowledgeGovernancePolicy is fabricated. No existing built-in role receives this permission implicitly.

The RuntimeProfile publication audit must bind exactly:

```text
exact KnowledgeRelease ref
+ exact RuntimeProfile management AuthorizationDecisionAudit ref
```

Unexpected hidden Model/Policy/Implementation/Deployment/runtime refs invalidate authority.

## 9. Identity / immutability / replay

All material profile semantics participate in the `RuntimeProfile` semantic hash. Reusing one logical-id/version with a different semantic payload fails under F02 immutability. Later profile versions do not rewrite historical exact refs. Operational audit metadata does not enter semantic identity.

## 10. Explicit nonclaims

A05 does not establish:

- Transformation/Model/Policy/Implementation/Calibration authority;
- Deployment scope/effective interval;
- target applicability;
- KnowledgeRetrievalResult;
- RuntimePlan/RuntimeEligibility/RuntimeBinding;
- runtime execution;
- DecisionResult.

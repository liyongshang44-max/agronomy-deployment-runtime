# DEC-0032 — Agronomic DecisionProblem FARM Target Binding and Deployment-Intent Separation

Status: **ACCEPTED**

Date: 2026-09-03

## Decision statement

For the exact first Sustainable Corn planting-date target world, ADR may construct a
standard A01 `DecisionProblem` through a source-specific bridge only when:

1. the `farmId` target component is injected from the exact accepted DEC-0027
   `AgronomicContextTargetRefFarmInstanceProjectionCompilation`;
2. `organizationId` and optional `tenantId` remain explicit deployment-owned scope
   supplied by the authorized A01 creator;
3. all non-target DecisionProblem fields remain explicit A01 decision-intent authority
   supplied by that creator;
4. caller-supplied `farmId`, `fieldId`, `seasonId`, `zoneId`, geometry, or any
   finer target component are rejected;
5. publication still passes the unchanged A01
   `decision.problem.create` authorization path;
6. the resulting object is the standard frozen A01 `DecisionProblem`, not a second
   public DecisionProblem type;
7. a specialized validator requires direct DEC-0032 target-binding proof and therefore
   does not treat an ordinary A01 DecisionProblem with coincidentally matching visible
   fields as source-backed target authority.

DEC-0032 does not create a ContextManifest and does not choose a real deployment
decision on behalf of a user, operator, product, policy, or runtime.

## Why this DEC exists

DEC-0031 completed the first governed real-source ContextDatum.

The next downstream A04 ContextManifest seam was re-audited after that closure.

A04 itself already has the required immutable-manifest mechanics:

- exact validated DecisionProblem ref;
- targetRef and logicalTime derived from that DecisionProblem;
- explicit evidenceCutoff;
- exact ContextDatum membership;
- exact ResolvedContextDatumReceipt membership;
- scoped CONTEXT_WRITE authorization;
- historical exact-ref replay.

The missing authority is earlier.

The frozen A01 DecisionProblem contract accepts:

```text
targetRef.organizationId
targetRef.tenantId?
targetRef.farmId?
targetRef.fieldId?
targetRef.seasonId?
targetRef.zoneId?
```

and generic `publishDecisionProblem(...)` correctly treats those fields as caller
DecisionProblem input under A01 creation authority.

But generic A01 does not know that the first Sustainable Corn `farmId` has already
been established by DEC-0027.

Therefore a caller with valid A01 creation authority could currently submit an
arbitrary farmId string and still produce a valid generic A01 DecisionProblem.

That is acceptable for generic A01.

It is not sufficient for the first evidence-faithful Sustainable Corn target world.

The exact missing seam is:

```text
DEC-0027 source-backed FARM target component
        +
deployment-owned organization/tenant
        +
A01-authorized decision intent
        ↓
one standard DecisionProblem
with exact source-backed farmId
```

## Fresh A01/A04 audit result

The live post-DEC-0031 audit established the following.

### A01 already owns decision-scope authority

A01 owns:

- decisionType;
- targetRef;
- logicalTime;
- decisionHorizon;
- objective;
- actionSpace;
- constraints;
- usePurpose;
- useClass;
- decisionAuthorityMode;
- decisionDeadline.

Publication requires explicit `decision.problem.create` authority scoped to the exact
DecisionProblem logical id and exact organization/tenant.

The creator organization/tenant must equal the target organization/tenant.

DEC-0032 must not weaken, duplicate or replace that authority.

### DEC-0027 owns only one target component

DEC-0027 establishes exactly:

```text
targetRef.farmId =
exact sourceBackedTargetIdentity.targetId
```

for the exact first Sustainable Corn FARM identity lineage.

It does not establish:

- organizationId;
- tenantId;
- fieldId;
- seasonId;
- zoneId;
- geometry;
- a complete targetRef;
- a DecisionProblem;
- a decision purpose or action space.

### A04 derives target from DecisionProblem

A04 does not accept a second independently supplied targetRef.

It derives:

```text
manifest.targetRef   = DecisionProblem.targetRef
manifest.logicalTime = DecisionProblem.logicalTime
```

Therefore a wrong farmId admitted into A01 would become the manifest farmId.

A04 is not the correct layer to repair that error after the fact.

### A04 ContextDatum membership checks organization/tenant only

A02 ContextDatum intentionally has no public targetRef.

A04 validates inline ContextDatum membership against the DecisionProblem
organization/tenant using the datum's scoped write authorization.

It does not infer farm containment from `spatialSupport.type = FARM`.

Therefore DEC-0032 must establish source-backed farm target identity before A04, and a
later manifest-binding DEC must prove the exact DecisionProblem/ContextDatum target
world convergence without pretending the A02 datum itself contains farmId.

## Authority ownership split

DEC-0032 freezes three independent authority classes.

### Source-backed FARM target authority

Owned by DEC-0027:

```text
farmId
```

The exact value must be replayed from the DEC-0027 compilation.

The caller may not override it.

### Deployment scope authority

Owned by the authorized A01 creator:

```text
organizationId
tenantId?
```

These fields identify the ADR deployment/tenancy scope.

They are not claimed to come from Sustainable Corn source evidence.

### Decision-intent authority

Owned by the authorized A01 creator through the existing A01 contract:

```text
decisionType
logicalTime
decisionHorizon
objective
actionSpace
constraints
usePurpose
useClass
decisionAuthorityMode
decisionDeadline
```

DEC-0032 does not infer, optimize, recommend, validate agronomic correctness of, or
source-attribute these values.

The A01 creator is explicitly choosing the decision scope.

## Proposed binding authority

Implementation should establish a reviewed content-addressed authority equivalent to:

```text
AgronomicDecisionProblemFarmTargetBindingCompilation {
  contractVersion

  authorityClass =
    AGRONOMIC_DECISION_PROBLEM_FARM_TARGET_BINDING_COMPILATION_AUTHORITY

  binding {
    parentTargetRefFarmInstanceProjectionCompilationRef

    sourceBackedTargetComponent {
      field = farmId
      value = exact DEC-0027 projected farmId
    }

    deploymentOwnedTargetFields {
      required = [organizationId]
      optional = [tenantId]
    }

    forbiddenUnestablishedTargetFields {
      fields = [fieldId, seasonId, zoneId]
    }

    decisionIntentAuthority =
      A01_AUTHORIZED_CREATOR

    targetBindingRule =
      INJECT_EXACT_PARENT_FARM_ID
  }

  bindingHash
  bindingReviewRef
  losslessCoverage
  limitations
}
```

Exact implementation names remain implementation-level after architecture acceptance.

## Binding review

Publication requires a governed review authority equivalent to:

`AgronomicDecisionProblemFarmTargetBindingReviewDecision`.

The review must bind:

- exact DEC-0027 compilation ref;
- exact DEC-0027 source-backed target identity;
- exact FARM granularity;
- exact DEC-0027 projected targetRef field `farmId`;
- exact projected farmId value;
- classification of organizationId/tenantId as deployment-owned scope;
- classification of all A01 non-target fields as A01 creator-owned decision intent;
- prohibition on fieldId/seasonId/zoneId/geometry inference;
- prohibition on caller farmId override;
- prohibition on ContextManifest creation.

The binding review is not a review of whether a particular decision objective or action
space is agronomically wise.

## Proposed A01 publication bridge

Implementation should expose an additive source-specific bridge equivalent to:

```text
publishAgronomicDecisionProblemWithFarmTargetBinding({
  ledger,
  sourceRegistry,

  farmTargetBindingCompilationRef,

  logicalId,
  version,

  deploymentScope {
    organizationId
    tenantId?
  }

  decisionIntent {
    decisionType
    logicalTime
    decisionHorizon
    objective
    actionSpace
    constraints
    usePurpose
    useClass
    decisionAuthorityMode
    decisionDeadline
  }

  principal,
  authorizationDecisionAuditRef,
  audit
})
```

The caller must not supply `targetRef` or `farmId`.

The bridge constructs exactly:

```text
targetRef = {
  organizationId = deploymentScope.organizationId
  tenantId?      = deploymentScope.tenantId
  farmId         = exact DEC-0027 farmId
}
```

No other target fields are admitted in the first binding.

The bridge then calls the existing A01 `publishDecisionProblem(...)` unchanged.

## No generic A01 mutation

DEC-0032 must not modify the frozen generic A01 contract merely to make one source
special.

Generic A01 remains allowed to publish ordinary DecisionProblems according to its own
authority rules.

DEC-0032 adds a specialized source-backed path for the first Sustainable Corn target
world.

## Specialized publication proof

A standard DecisionProblem created through DEC-0032 must carry direct immutable audit
proof that includes the exact binding compilation ref.

A validator equivalent to:

`validateAgronomicDecisionProblemFarmTargetPublicationAuthority(...)`

must require:

1. normal A01 DecisionProblem validation;
2. normal A01 creation-authorization replay;
3. exact DEC-0032 binding compilation validation;
4. exact farmId equality to the DEC-0027 projection;
5. exact organization/tenant equality to creator deployment scope;
6. absence of fieldId/seasonId/zoneId;
7. direct publication audit binding the exact DEC-0032 compilation.

A generic A01 DecisionProblem with identical visible targetRef and decision fields but
without direct DEC-0032 proof is not source-backed DEC-0032 publication authority.

## Exact-ref rule

Where DEC-0032 claims source-backed target convergence, semantic similarity is not
enough.

The exact accepted DEC-0027 AuthorityRef is mandatory.

A semantically equal but separately published farm projection cannot silently replace
the reviewed predecessor.

## No raw SERF substitution

The source-native identifier:

```text
SERF
```

must not be inserted into A01 as `farmId`.

The only accepted first-world FARM component is the exact DEC-0027
`target_src_<64hex>` value.

## No display-name substitution

The following are evidence context, not DecisionProblem farm identifiers:

- Southeast Research and Demonstration Farm;
- Iowa State University;
- SERF.

None may substitute for the exact DEC-0027 farmId.

## No organization/tenant inference

The Sustainable Corn source and DEC-0027 do not establish ADR deployment tenancy.

DEC-0032 must not infer organizationId or tenantId from:

- provider identity;
- repository ownership;
- Iowa State University;
- source display names;
- source paths;
- target_src namespace;
- scientific reviewer identity;
- ContextDatum writer scope;
- current host/user account.

Deployment scope must be explicit caller-owned A01 authority.

## No use-purpose inference

The source event is a recorded planting occurrence.

It does not prove that a later ADR caller wants to solve:

- irrigation;
- fertilization;
- planting;
- harvest;
- risk management;
- recommendation;
- optimization;
- compliance;
- any other decision problem.

DEC-0032 must not derive decisionType, objective, actionSpace, usePurpose or
decisionAuthorityMode from the existence of `crop.planting_date`.

## No logical-time inference

The source planting date and ContextDatum effective interval are evidence semantics.

They do not automatically become A01 `logicalTime`, `decisionDeadline` or
`decisionHorizon`.

Those remain decision-intent fields.

## No field/season/zone inference

The first Sustainable Corn target authority is FARM only.

The bridge must reject attempts to supply or derive:

- fieldId;
- seasonId;
- zoneId.

A later source may independently establish finer target authority under another DEC.

## No geometry inference

Neither DEC-0027 farmId nor DEC-0023 FARM spatial support is geometry.

DEC-0032 must not create:

- geometry;
- geometryRef;
- polygons;
- centroids;
- containment claims.

## No targetRef laundering through constraints

A caller cannot smuggle unsupported target identity into A01 constraints or other
decision fields and then claim DEC-0032 target authority for it.

DEC-0032 source-backed authority is limited to the explicit top-level farmId component.

A01's existing anti-laundering checks remain in force for downstream result/conclusion
authority.

## Decision-intent fixture versus real deployment intent

The implementation Gold may use a deterministic decision-intent fixture to prove the
mechanism.

Such a fixture is machine-test authority only.

It must not be described as a real Sustainable Corn deployment decision, real operator
request, or source-derived agronomic intent.

A real product DecisionProblem exists only when an actual authorized caller supplies
the decision-intent values.

## First Gold

The first DEC-0032 Gold should replay the exact accepted DEC-0027 real-source target
projection and combine it with deterministic deployment-owned A01 fixture input.

The proof should establish:

```text
DEC-0027:
  farmId = exact target_src_<64hex>

deployment fixture:
  organizationId = explicit
  tenantId? = explicit

A01 decision-intent fixture:
  explicit non-target fields
        ↓
standard A01 DecisionProblem
        ↓
targetRef {
  organizationId = explicit deployment scope
  tenantId? = explicit deployment scope
  farmId = exact DEC-0027 farmId
}
```

Gold classification should remain explicit that only the FARM target component is
real-source authority.

## Mandatory negative Gold

At minimum fail closed for:

- wrong DEC-0027 predecessor kind;
- DEC-0027 predecessor ref drift;
- semantically equal but different DEC-0027 AuthorityRef substitution;
- caller-supplied farmId;
- raw SERF farmId;
- display-name farmId;
- altered target_src farmId;
- fieldId injection;
- seasonId injection;
- zoneId injection;
- geometry/geometryRef injection;
- organizationId inferred from source provider;
- tenantId inferred from source provider;
- organization/tenant mismatch against A01 creator;
- missing decision.problem.create authorization;
- wrong DecisionProblem logical-id authorization;
- denied creation authorization;
- wrong RoleAssignment;
- creation audit actor mismatch;
- source planting date substituted as logicalTime without caller intent;
- ContextDatum effective interval substituted as decision horizon;
- source event converted into decisionType/objective/usePurpose;
- caller targetRef object supplied to the specialized bridge;
- incomplete binding review;
- unauthorized binding reviewer;
- rejected binding review;
- review/publication mismatch;
- generic A01 DecisionProblem with matching visible fields but no DEC-0032 proof;
- ContextManifest creation;
- evidenceCutoff creation;
- Policy/runtime/execution/DecisionResult/Outcome creation.

## Mandatory review checks

An accepted binding review should confirm at least:

1. `DEC_0027_TARGET_REF_FARM_PROJECTION_AUTHORITY_VERIFIED`;
2. `EXACT_DEC_0027_AUTHORITY_REF_VERIFIED`;
3. `SOURCE_BACKED_TARGET_GRANULARITY_FARM_VERIFIED`;
4. `EXACT_SOURCE_BACKED_FARM_ID_VERIFIED`;
5. `TARGET_REF_FIELD_FARM_ID_VERIFIED`;
6. `FARM_ID_INJECTED_ONLY_FROM_DEC_0027`;
7. `NO_CALLER_FARM_ID_AUTHORITY`;
8. `DEPLOYMENT_ORGANIZATION_SCOPE_CALLER_OWNED`;
9. `DEPLOYMENT_TENANT_SCOPE_CALLER_OWNED_IF_PRESENT`;
10. `DECISION_INTENT_A01_CREATOR_OWNED`;
11. `NO_SOURCE_DERIVED_DECISION_TYPE`;
12. `NO_SOURCE_DERIVED_LOGICAL_TIME`;
13. `NO_SOURCE_DERIVED_DECISION_HORIZON`;
14. `NO_SOURCE_DERIVED_OBJECTIVE`;
15. `NO_SOURCE_DERIVED_ACTION_SPACE`;
16. `NO_SOURCE_DERIVED_CONSTRAINTS`;
17. `NO_SOURCE_DERIVED_USE_PURPOSE_OR_USE_CLASS`;
18. `NO_SOURCE_DERIVED_DECISION_AUTHORITY_MODE`;
19. `NO_SOURCE_DERIVED_DECISION_DEADLINE`;
20. `NO_FIELD_SEASON_ZONE_INFERENCE`;
21. `NO_GEOMETRY_INFERENCE`;
22. `NO_RAW_SERF_OR_DISPLAY_NAME_SUBSTITUTION`;
23. `GENERIC_A01_CONTRACT_UNCHANGED`;
24. `A01_CREATION_AUTHORIZATION_REMAINS_MANDATORY`;
25. `NO_CONTEXT_MANIFEST_PUBLICATION`;
26. `NO_EVIDENCE_CUTOFF_AUTHORITY`;
27. `NO_POLICY_RUNTIME_EXECUTION_OR_OUTCOME_AUTHORITY`.

All mandatory checks are required for accepted publication.

## Review dispositions

At minimum:

- `ACCEPT_AGRONOMIC_DECISION_PROBLEM_FARM_TARGET_BINDING`;
- `REJECT_AGRONOMIC_DECISION_PROBLEM_FARM_TARGET_BINDING`.

Rejected review cannot authorize binding compilation publication.

## Content addressing

Changing any material source-backed binding element must change semantic identity or
fail closure, including:

- DEC-0027 predecessor ref;
- target component field;
- projected farmId;
- ownership classification;
- allowed deployment-owned target fields;
- forbidden target fields;
- binding rule;
- review authority.

A particular deployment DecisionProblem's semantic identity remains the normal A01
semantic identity and includes its actual deployment/intent values.

## Publication authorization

DEC-0032 creates no new bypass permission.

Actual DecisionProblem publication still requires the existing A01:

```text
decision.problem.create
```

with exact scoped AuthorizationDecisionAudit and RoleAssignment replay.

The DEC-0032 binding review does not grant DecisionProblem creation permission.

## Consequences

Positive:

- closes arbitrary farmId substitution for the first source-backed target world;
- preserves DEC-0027 exact FARM identity;
- keeps deployment tenancy distinct from source identity;
- keeps decision intent distinct from scientific evidence;
- reuses standard A01 publication and authorization;
- prepares the exact target side needed by a later ContextManifest convergence DEC.

Costs:

- DEC-0032 cannot produce a real product DecisionProblem without explicit deployment
  intent;
- target identity remains source-backed rather than globally canonical;
- field/season/zone remain absent;
- a later A04 binding still needs evidenceCutoff and exact ContextDatum/DecisionProblem
  convergence.

## Local completeness

If DEC-0032 is accepted and implemented:

```text
source-backed FARM target component
        +
authorized deployment-owned A01 decision input
        ↓
standard DecisionProblem
with governed farmId binding
= PUBLISHABLE
```

This is DecisionProblem target-binding completeness only.

It does not mean:

- a real deployment decision has been supplied;
- ContextManifest is publishable without additional binding authority;
- evidenceCutoff is established;
- ContextDatum farm identity is present in the A02 public wire;
- field/season/zone identity exists;
- runtime policy or final decision authority exists.

## Remaining downstream frontier

After DEC-0032 closure, the next expected authority seam is a first
ContextManifest-binding DEC that proves:

```text
DEC-0031 governed ContextDatum
        +
DEC-0032 source-backed DecisionProblem target
        +
explicit evidenceCutoff
        ↓
one immutable A04 ContextManifest
```

That later DEC must revalidate target lineage without pretending ContextDatum has a
public farmId field.

## Architecture acceptance gate

Before implementation may begin:

1. DEC-0032 must receive explicit user acceptance;
2. the accepted documentation head must receive fresh Constitution qualification;
3. accepted docs must close through the normal Draft/successor path;
4. qualified head -> merge must have `files=[]`;
5. post-merge Constitution must succeed.

Only then may an independent DEC-0032 implementation branch start.

## Final decision statement

DEC-0032 proposes exactly one new authority boundary:

> For the first Sustainable Corn target world, a standard A01 DecisionProblem may
> claim source-backed FARM target authority only when its farmId is injected from the
> exact reviewed DEC-0027 projection. Organization/tenant and every non-target
> DecisionProblem field remain explicit deployment/A01-creator authority. The bridge
> cannot accept caller farmId or infer finer target, geometry or decision intent from
> source evidence, and generic A01 publication with matching visible fields does not
> constitute DEC-0032 source-backed proof.

No ContextManifest, evidenceCutoff, real deployment intent, policy, runtime,
DecisionResult, execution or Outcome authority is accepted by this proposal.

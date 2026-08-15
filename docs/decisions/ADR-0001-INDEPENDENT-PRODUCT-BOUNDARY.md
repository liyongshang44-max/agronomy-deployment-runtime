# ADR-0001 — Independent Product Boundary

Status: **ACCEPTED / FROZEN**

## Context

Agronomy Deployment Runtime emerged from work around GEOX, but its product value is not dependent on GEOX Digital Twin, GEOX runtime storage, GEOX recommendation UI, AO-ACT, KBS, MCFT or any specific field-data provider.

The product's independent value is to let an agricultural organization compile, qualify, transport, deploy and govern its agronomic knowledge across heterogeneous target contexts and runtime systems.

Potential consumers include:

- GEOX;
- crop-consulting software;
- seed-company applications;
- agricultural-retailer platforms;
- processor/program platforms;
- customer data lakes and internal agronomy systems;
- third-party model/policy runtimes.

## Decision

Agronomy Deployment Runtime is an **independent product and independent repository** from inception.

Repository:

```text
liyongshang44-max/agronomy-deployment-runtime
```

GEOX is defined as:

- first-party integration;
- reference consumer;
- field-validation substrate.

GEOX is not:

- the repository host;
- domain-model authority;
- scientific authority;
- required build dependency;
- required runtime dependency.

## Dependency rule

The legal direction is:

```text
Agronomy Deployment Runtime public contracts / SDK / API
                         ▲
                         │
                  GEOX adapter/consumer
```

ADR core may not import GEOX packages, reference GEOX database schemas/tables, or make MCFT/CAP/KBS/T3R1 concepts part of its semantics.

## Owned domain

ADR owns:

- Source and Claim provenance;
- SourceContext;
- scientific qualification;
- QualifiedKnowledge and DerivedKnowledge;
- KnowledgeConflict;
- KnowledgeRelease;
- Transformation, Model, Policy and Implementation semantic registries;
- RuntimeProfile and Deployment;
- DecisionProblem;
- Context Contract and ContextManifest;
- Source→Target transport/applicability;
- RuntimePlan compilation;
- InformationRequirement;
- RuntimeEligibility;
- RuntimeBinding;
- RuntimeResult normalization;
- DecisionRobustness;
- OutcomeEvaluation and revision proposals;
- tenant/IP governance, replay, lineage and audit.

ADR does not need to own:

- raw sensor networks;
- satellite processing pipelines;
- weather-provider infrastructure;
- generic Digital Twin state estimation;
- farm ERP/FMIS;
- machine execution/control;
- final human approval workflows.

Those capabilities may be external providers connected through public contracts.

## Core product proposition

Agronomy Deployment Runtime is a governed platform that compiles the valid domain of agronomic knowledge into a specific decision context.

The product asks:

```text
Scientific Compiler:
What does the source actually say?

Qualification:
What may be recognized as usable knowledge?

Transport / Applicability:
Does it survive SourceContext → TargetContext for this purpose?

Runtime Compiler:
What exact computational world is legal here?

Decision Robustness:
Across remaining legal worlds, does the action change?

Evaluation:
What did reality teach us after deployment?
```

## Consequences

### Positive

- ADR can be sold without GEOX.
- Upstream context providers and downstream runtime/workflow systems are replaceable.
- Customer proprietary agronomy becomes a first-class governed asset.
- Product release cadence can diverge from GEOX.
- GEOX can stress-test the strongest epistemic/replay semantics without defining them.
- Other customers may use shallower context/runtime profiles without weakening the core model.

### Costs

- ADR requires its own public contract/versioning discipline.
- Tenant/IP isolation must be designed from the beginning.
- Context integration must avoid customer-specific semantic code becoming core.
- Model/policy/implementation compatibility must be represented explicitly.
- Independent product observability, deployment and API compatibility will eventually be required.

These costs are accepted because independence is a product requirement, not an implementation preference.

## Rejected alternatives

### Keep ADR as a GEOX internal package

Rejected because it would make GEOX data models and release cadence de facto authority and constrain non-GEOX customers.

### Copy GEOX runtime schemas into the new repository

Rejected because portability requires semantic contracts, not database-schema inheritance.

### Build a second complete farm platform

Rejected because ADR should deploy agronomy, not recreate FMIS, Digital Twin, weather, satellite and machine-control infrastructure.

### Treat adapters as scientific semantic owners

Rejected because connector-local semantic inference would create ungoverned authority and destroy transport/replay integrity.

## Constitutional acceptance

The product boundary is considered upheld only when ADR core can build/test without GEOX and when deleting the GEOX adapter does not invalidate standalone core acceptance.

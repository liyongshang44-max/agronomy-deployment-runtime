# Agronomy Deployment Runtime — Agronomic Context & Public Runtime Contract v1.0

Status: **FROZEN**

This document defines the portable semantic contract between Agronomy Deployment Runtime (ADR) and external systems. It intentionally does not inherit GEOX, FieldX, customer-database or provider-specific schemas.

## 1. Contract principles

1. Values must retain semantic and epistemic identity.
2. Provenance channel and epistemic status are orthogonal.
3. TargetContext is a conceptual target world; ContextManifest is the immutable runtime snapshot.
4. Applicability consumes ContextManifest, not mutable external state.
5. Decision-critical external references must be resolved into receipts before use.
6. Replay capability is explicit and truthful.
7. Adapters translate representation only; they do not grant scientific meaning.
8. SourceContext and TargetContext share semantic dimensions but have different authority.
9. Runtime legality is distinct from action authority.
10. Public contracts are platform-neutral.

# 2. EpistemicClass

`EpistemicClass` answers: **what kind of knowing is this datum?**

Frozen values:

- `OBSERVATION`
- `ASSERTION`
- `DERIVED`
- `STATE_ESTIMATE`
- `FORECAST`
- `CONFIGURATION`
- `MODEL_PRIOR`

## OBSERVATION

Direct measurement, sensing, counting or recording of an event/state with observation semantics.

Examples:

- probe VWC;
- rain gauge;
- weighed harvest;
- planter telemetry event.

## ASSERTION

A statement made by a person or external source about reality without direct-measurement semantics.

Example: grower states planting date was May 20.

## DERIVED

A deterministic/statistical value calculated from other inputs without representing a latent-state assimilation estimate.

Examples:

- ET0 derived from meteorological inputs;
- GDD accumulation;
- normalized index derived from source data.

## STATE_ESTIMATE

An estimate of a state that requires modeling, assimilation or inference.

Examples:

- root-zone water storage;
- nitrogen state;
- estimated phenological state when not directly asserted/observed.

## FORECAST

A future forcing or state estimate.

## CONFIGURATION

A governed configuration of a production/runtime system or target.

## MODEL_PRIOR

A prior parameter/distribution supplied to a model before local evidence/calibration.

# 3. ProvenanceClass

`ProvenanceClass` answers: **through which actor/channel did this datum enter ADR?**

Frozen values:

- `USER`
- `AGRONOMIST`
- `SENSOR`
- `MACHINERY`
- `REMOTE_SENSING`
- `EXTERNAL_PROVIDER`
- `CUSTOMER_SYSTEM`
- `LABORATORY`
- `MODEL`
- `PLATFORM`

Examples:

```text
Grower manually states planting date
→ epistemic = ASSERTION
→ provenance = USER

Planter telemetry records planting event
→ epistemic = OBSERVATION
→ provenance = MACHINERY

Customer FMIS stores a grower-entered planting date
→ epistemic = ASSERTION
→ provenance = CUSTOMER_SYSTEM

Twin/model estimates root-zone storage
→ epistemic = STATE_ESTIMATE
→ provenance = MODEL
```

Provenance never silently upgrades epistemic class.

# 4. Semantic dimensions

ADR uses stable semantic IDs rather than customer-specific field names.

Examples:

```text
crop.code
crop.cultivar
crop.stage
crop.planting_date
soil.texture
soil.volumetric_water_content
soil.root_zone_depletion_fraction
weather.reference_et
weather.precipitation
management.irrigation_event
operation.irrigation_capacity
measurement.et_reference_surface
```

The semantic registry may expand over time without changing the core contract.

# 5. ContextDatum

`ContextDatum` is the minimal public semantic atom.

Illustrative structure:

```yaml
contract_version: adr.context-datum.v1

datum_id: CD-...
semantic_id: soil.volumetric_water_content

value:
  type: DECIMAL
  decimal: "0.32"

unit: m3_per_m3

epistemic_class: OBSERVATION
provenance_class: SENSOR

effective_interval:
  start: "2027-06-10T10:00:00Z"
  end: "2027-06-10T10:15:00Z"

available_at: "2027-06-10T10:16:08Z"

spatial_support:
  type: POINT
  geometry_ref: sensor-location-42

vertical_support:
  from_mm: 80
  to_mm: 120

temporal_support:
  type: INTERVAL

uncertainty:
  type: INTERVAL
  lower_decimal: "0.305"
  upper_decimal: "0.335"

source:
  provider_id: customer-x
  source_ref: observation/123
  content_hash: sha256:...

semantic_hash: sha256:...
```

## 5.1 Value shapes

Public contract must support at least:

- `DECIMAL`
- `INTEGER`
- `BOOLEAN`
- `STRING`
- `CATEGORY`
- `DATE`
- `TIMESTAMP`
- `INTERVAL`
- `SET`
- `UNKNOWN`

Authority-critical numeric values should use canonical decimal representations rather than implementation-specific binary floating-point identity.

## 5.2 Uncertainty

Uncertainty is represented structurally, not collapsed to a universal confidence percentage.

Supported forms may include:

- exact/none;
- interval;
- categorical set;
- distribution reference;
- unknown.

DecisionRobustness may reason over legal alternatives/ranges.

# 6. SourceContext

`SourceContext` is the original scientific/empirical context in which a Claim was observed, studied, derived or recommended.

It uses the same semantic-dimension vocabulary as TargetContext where possible, but its authority derives from the SourceArtifact/Claim and source locator.

SourceContext families:

- Biological;
- Environmental;
- Management;
- Operational;
- Measurement;
- Jurisdiction/Economic.

Illustrative source context:

```yaml
crop.code: maize
crop.cultivar: hybrid_x
crop.stage: R1
soil.texture: silt_loam
location.region: Nebraska
irrigation.system: center_pivot
measurement.et_reference_surface: SHORT_GRASS
study.years: [2022, 2023, 2024]
```

If the source does not support a dimension, the value is `NOT_REPORTED`; it must not be filled by model guess or generic background knowledge.

# 7. TargetContext

`TargetContext` is the conceptual real-world target background in which knowledge is proposed for use.

It may include the same six context families as SourceContext, but values may originate from external Reality/Observation/State/Configuration systems.

TargetContext is not itself a mutable mega-object or new truth authority. Runtime uses a frozen `ContextManifest`.

# 8. DecisionProblem

Public contract:

```yaml
contract_version: adr.decision-problem.v1

decision_problem_id: DP-...

decision_type: IRRIGATION_TIMING

target_ref:
  organization_id: ...
  tenant_id: ...
  farm_id: ...
  field_id: ...
  season_id: ...
  zone_id: ...

logical_time: "2027-06-10T11:00:00Z"

decision_horizon:
  duration: PT72H

objective:
  code: AVOID_MATERIAL_CROP_WATER_STRESS

action_space:
  - WAIT
  - IRRIGATE_NOW
  - IRRIGATE_WITHIN_48H

use_class: ADVISORY

decision_authority_mode: ADR_POLICY

decision_deadline: "2027-06-10T14:00:00Z"
```

`decision_authority_mode`:

- `ADR_POLICY`
- `EXTERNAL_POLICY`
- `RUNTIME_ONLY`

`RUNTIME_ONLY` allows ADR to construct a legal runtime world without claiming final decision authority.

# 9. AuthorizedContextReference

ADR supports references so customers are not required to copy all raw field data.

Illustrative contract:

```yaml
contract_version: adr.authorized-context-reference.v1

reference_id: CR-...
semantic_id: soil.root_zone_water_storage

value_mode: AUTHORIZED_REFERENCE

reference:
  provider_id: customer-context-api
  locator: /field/123/state/root-zone-water/2027-06-10T11:00:00Z
  version_token: ...
  expected_content_hash: ...

authorization_context:
  connection_id: ...
  principal_scope: ...
  authorization_hash: ...

semantic_hash: ...
```

The reference itself cannot satisfy a decision-critical ContextManifest until resolved.

# 10. ResolvedContextDatumReceipt

Every decision-critical external reference resolution must produce a receipt.

```yaml
contract_version: adr.context-receipt.v1

receipt_id: RCR-...
reference_id: CR-...
reference_hash: sha256:...

resolved_at: ...
effective_at: ...
available_at: ...

authorization_context_hash: sha256:...
provider_response_hash: sha256:...
normalized_context_datum_hash: sha256:...

retention:
  mode: SNAPSHOT_RETAINED
  retention_ref: ...

replay_class: EXACT

semantic_hash: sha256:...
```

# 11. ReplayClass

Frozen values:

- `EXACT`
- `CONTENT_ADDRESSED_EXTERNAL`
- `PROVIDER_DEPENDENT`
- `NON_REPLAYABLE`

## EXACT

ADR or a controlled authority retains the exact content required for deterministic replay.

## CONTENT_ADDRESSED_EXTERNAL

An external system guarantees immutable retrieval by content address/hash.

## PROVIDER_DEPENDENT

Replay depends on a provider continuing to serve historically equivalent content.

## NON_REPLAYABLE

The original decision-critical value cannot be reconstructed.

RuntimeProfile/Deployment may declare minimum replay requirements. A runtime that does not meet the requirement cannot be mislabeled as exact.

# 12. ContextManifest

`ContextManifest` is the immutable runtime snapshot of the TargetContext used for a DecisionProblem.

```yaml
contract_version: adr.context-manifest.v1

context_manifest_id: CM-...
decision_problem_ref: DP-...

target_ref:
  organization_id: ...
  tenant_id: ...
  farm_id: ...
  field_id: ...
  season_id: ...
  zone_id: ...

logical_time: ...
evidence_cutoff: ...

datum_refs:
  - datum_id: CD-...
    semantic_hash: sha256:...

resolved_reference_receipts:
  - receipt_id: RCR-...
    semantic_hash: sha256:...

created_at: ...
manifest_semantic_hash: sha256:...
```

Once created, datum membership is immutable.

If new evidence/state becomes available, a new ContextManifest is created.

# 13. ApplicabilityAssessment

Applicability is not a property of Knowledge alone. It is a relation between Knowledge, SourceContext, ContextManifest, use purpose and DecisionProblem.

Conceptual function:

```text
Transport(K, SourceContext, ContextManifest, UsePurpose, DecisionProblem)
```

Illustrative public read contract:

```yaml
contract_version: adr.applicability-assessment.v1

assessment_id: AA-...
knowledge_ref: K-...@3
source_context_ref: SC-...
context_manifest_ref: CM-...
decision_problem_ref: DP-...
use_purpose: MODEL_PARAMETER_PRIOR

condition_results:
  - semantic_id: crop.code
    expected: maize
    target: maize
    status: MATCH

transport_status: DIRECTLY_APPLICABLE

required_transformations: []
required_calibrations: []
limitations: []
conflicts: []

decision_relevance: MATERIAL
runtime_use: ALLOWED

assessment_semantic_hash: sha256:...
```

Transport statuses:

- `DIRECTLY_APPLICABLE`
- `APPLICABLE_WITH_GOVERNED_TRANSFORM`
- `CALIBRATION_REQUIRED`
- `BOUNDED_EXTRAPOLATION`
- `UNRESOLVED`
- `CONFLICT`
- `NOT_RELEVANT`

Condition statuses may include:

- `MATCH`
- `MISMATCH`
- `UNKNOWN`
- `AMBIGUOUS`
- `TRANSFORMABLE`
- `INVALID`

# 14. KnowledgeRelease

Public semantic definition:

```text
KnowledgeRelease = frozen set of QualifiedKnowledge / DerivedKnowledge versions
```

It does not include Model, Policy, Implementation or rollout state.

Illustrative contract:

```yaml
contract_version: adr.knowledge-release.v1

knowledge_release_id: KR-17
version: 1

knowledge_refs:
  - K-A@3
  - K-B@2
  - DK-C@1

release_semantic_hash: sha256:...
```

# 15. RuntimeProfile

`RuntimeProfile` is a reusable versioned composition policy, not a runtime execution.

```yaml
contract_version: adr.runtime-profile.v1

runtime_profile_id: RP-31
version: 4

knowledge_release_ref: KR-17@1

transformation_constraints: ...
model_constraints: ...
policy_constraints: ...
implementation_constraints: ...
context_requirements: ...

replay_requirement:
  minimum: EXACT

governance: ...

semantic_hash: sha256:...
```

RuntimeProfile contains no current TargetContext, logical-time ContextManifest or RuntimeBinding.

# 16. Deployment

Deployment applies a RuntimeProfile to an authorized rollout scope.

```yaml
contract_version: adr.deployment.v1

deployment_id: D-44
version: 2
runtime_profile_ref: RP-31@4

environment: PILOT

deployment_scope:
  organization_id: ...
  program_id: ...
  regions: [...]
  crops: [maize]
  decision_types: [IRRIGATION_TIMING]

entitlements: ...
effective_interval: ...

semantic_hash: sha256:...
```

# 17. RuntimePlan public read model

RuntimePlan is primarily compiler IR; external clients receive a stable audit/read model rather than raw internal-edit authority.

Stable fields include:

```text
plan_id
decision_problem_ref
deployment_ref
runtime_profile_ref
context_manifest_ref
candidate_graph_summary
open_information_requirements
candidate_alternatives
blocked_nodes
runtime_eligibility_state
compiler_version
plan_hash
```

External clients may satisfy InformationRequirements or submit new Context data; they may not directly mutate internal DAG edges to bypass authority checks.

# 18. InformationRequirement

```yaml
contract_version: adr.information-requirement.v1

requirement_id: IR-...
plan_ref: ...

semantic_id: crop.stage

required_by:
  - KNOWLEDGE_APPLICABILITY
  - POLICY

reason_code: DECISION_MATERIAL_UNKNOWN

acceptable_epistemic_classes:
  - OBSERVATION
  - ASSERTION
  - STATE_ESTIMATE

acceptable_provenance_classes:
  - AGRONOMIST
  - USER
  - CUSTOMER_SYSTEM
  - MODEL

required_resolution: ...
deadline: ...

status: OPEN
```

Statuses:

- `OPEN`
- `SATISFIED`
- `UNSATISFIABLE`
- `NO_LONGER_DECISION_MATERIAL`

# 19. RuntimeEligibility

Runtime legality is separate from decision output.

Frozen statuses:

- `RUNTIME_ELIGIBLE`
- `RUNTIME_ELIGIBLE_WITH_LIMITATIONS`
- `INFORMATION_REQUIRED`
- `NO_LEGAL_RUNTIME`

Illustrative contract:

```yaml
runtime_eligibility: RUNTIME_ELIGIBLE_WITH_LIMITATIONS
limitations: [...]
information_requirements: []
legal_runtime_candidate_count: 2
reason_codes: [...]
```

# 20. RuntimeBinding

A RuntimeBinding is an immutable, adjudicated runtime world.

```yaml
contract_version: adr.runtime-binding.v1

runtime_binding_id: RB-...

decision_problem_ref: DP-...
deployment_ref: D-44@2
runtime_profile_ref: RP-31@4
knowledge_release_ref: KR-17@1
context_manifest_ref: CM-...

knowledge_bindings: ...
transformation_bindings: ...
model_bindings: ...
policy_bindings: ...
implementation_bindings: ...

logical_time: ...
evidence_cutoff: ...

limitations: ...
assumptions: ...

runtime_binding_semantic_hash: sha256:...
```

A RuntimeBinding cannot contain unresolved alternatives.

# 21. RuntimeResult

All internal/external execution providers return results through the same semantic envelope.

```yaml
contract_version: adr.runtime-result.v1

runtime_result_id: RR-...
runtime_binding_ref: RB-...
runtime_node_ref: node-...
implementation_ref: impl-...

input_semantic_hashes:
  - sha256:...

output:
  semantic_id: ...
  value: ...
  unit: ...

executed_at: ...
output_semantic_hash: sha256:...
```

# 22. DecisionRobustness

DecisionRobustness evaluates the decision across remaining legal runtime worlds.

```yaml
contract_version: adr.decision-robustness.v1

decision_problem_ref: DP-...

evaluated_bindings:
  - RB-1
  - RB-2
  - RB-3

outcomes:
  RB-1: WAIT
  RB-2: WAIT
  RB-3: WAIT

robustness: ROBUST
decision: WAIT
sensitive_dimensions: []
information_requirements: []

semantic_hash: sha256:...
```

Robustness classes:

- `ROBUST`
- `SENSITIVE`
- `UNRESOLVED`

Decision results:

- `ACT`
- `WAIT`
- `ASK`
- `ABSTAIN`

`ASK` must reference decision-material InformationRequirements.

# 23. Outcome and OutcomeEvaluation

Outcome ingress preserves epistemic/provenance semantics and references the relevant RuntimeBinding/decision/execution.

OutcomeEvaluation separates at least:

- knowledge evaluation;
- transport evaluation;
- model evaluation;
- policy evaluation;
- execution evaluation;
- commercial evaluation.

It may create proposals but cannot mutate scientific/runtime authority directly.

# 24. Public API resource model

The product API is organized around authority resources, not a generic `/recommend` endpoint.

Runtime surface:

```text
POST /v1/decision-problems
POST /v1/context-data
POST /v1/context-references
POST /v1/context-manifests
POST /v1/runtime-plans
GET  /v1/runtime-plans/{id}
GET  /v1/information-requirements/{id}
POST /v1/runtime-bindings
GET  /v1/runtime-bindings/{id}
POST /v1/runtime-results
POST /v1/decision-robustness
POST /v1/outcomes
POST /v1/evaluations
```

Control surface:

```text
POST /v1/sources
POST /v1/compiler/jobs
GET  /v1/claims
POST /v1/qualifications
GET  /v1/knowledge
POST /v1/knowledge-releases
POST /v1/runtime-profiles
POST /v1/deployments
```

Concrete HTTP schemas may version over time; the resource and authority semantics above are the v1 contract baseline.

# 25. Public integration roles

External systems may implement one or more of:

- `ContextProvider`
- `StateProvider`
- `ForecastProvider`
- `ModelExecutor`
- `PolicyExecutor`
- `EvidenceAcquisitionProvider`
- `OutcomeProvider`
- `ResultSink`
- `RecommendationSink`

No particular provider is required for ADR core to exist.

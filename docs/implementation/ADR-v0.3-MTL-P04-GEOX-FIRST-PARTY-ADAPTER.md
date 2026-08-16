# ADR v0.3 — MTL-P04 GEOX First-Party Adapter

Status: **IMPLEMENTATION CONTRACT / NON-ARCHITECTURE-AUTHORITY**

ADR baseline: `main @ ca5fc43c78e72d4d8dd183eb9619394124961b3e`

Verified GEOX compatibility baseline: `liyongshang44-max/GEOX @ 6e7b1ac08ca8f79d65d5c6ec0a57e0cbabb8e5c9`

## 1. Purpose and dependency direction

P04 integrates GEOX as a first-party reference ContextProvider/ResultSink while preserving the product boundary established by P03:

```text
GEOX -> adapters/geox -> P02 SDK/public integration contracts -> ADR
```

The dependency direction is one-way. ADR core, public contracts and SDK do not import or understand GEOX schema, MCFT, CAP, KBS or T3R1 semantics.

First-party status grants no scientific, deployment, runtime or decision authority.

## 2. Verified upstream surfaces

P04 is pinned to exact, observed GEOX repository surfaces rather than a remembered schema.

### 2.1 Crop context

Verified source:

```text
apps/server/src/domain/crop/crop_context_v1.ts
```

The `crop_context_v1@1` payload includes:

```text
field_id
season_id
status
crop_code
variety_code
crop_stage
planting_date
confidence
source
allowed_actions
```

P04 consumes an exact `facts` row carrying `record_json.type = crop_context_v1` and `schema_version = 1`.

### 2.2 GEOX facts chronology

Verified source:

```text
docker/postgres/init/001_schema.sql
```

The base `facts` table contains only:

```text
fact_id
occurred_at
source
record_json
```

It does **not** contain `ingested_at`.

Therefore P04 does not fabricate a GEOX ingestion timestamp. The adapter read boundary must attach the actual retrieval time as:

```text
retrieved_at
```

That actual adapter retrieval time becomes ADR `available_at` and is recorded in translation semantics as `adapter.retrieved_at -> available_at`.

### 2.3 Device observation

The verified `device_observation_index_v1` surface contains field/device/metric/time/value/unit/confidence/fact identity but no sensor installation depth. `unit` is nullable.

Therefore a GEOX `soil_moisture` row is not by itself sufficient authority to assert ADR volumetric-water-content semantics or a vertical support interval.

## 3. Crop-context translation

P04 v0.3 maps only:

```text
PLANTED_CONFIRMED crop_context_v1@1
  -> ADR ContextDatum semantic_id = crop.code
```

Unconfirmed/unknown/pre-plant/harvested crop context fails closed for this mapping.

The exact configured target scope binds:

```text
tenant
project
group
GEOX field
optional season
ADR geometry ref
```

Cross-scope rows fail before translation.

### 3.1 Source-to-epistemic mapping

The upstream `source` enum is translated explicitly and conservatively:

```text
USER_DECLARED     -> ASSERTION / USER
SENSOR_INFERRED   -> DERIVED   / SENSOR
REMOTE_SENSING    -> DERIVED   / REMOTE_SENSING
MACHINERY_RECORD  -> ASSERTION / MACHINERY
MANUAL_VERIFIED   -> ASSERTION / CUSTOMER_SYSTEM
```

`SENSOR_INFERRED` is not promoted to `OBSERVATION` merely because sensors contributed to the upstream inference.

`MANUAL_VERIFIED` is not promoted to `AGRONOMIST` provenance because the GEOX record does not itself prove that principal class.

Unknown source enums fail closed.

### 3.2 Deliberately excluded GEOX fields

The adapter deliberately does not map:

```text
confidence      -> ADR uncertainty or scientific qualification
allowed_actions -> RuntimeEligibility / recommendation / decision authority
variety_code    -> crop.code
crop_stage      -> crop.code
```

GEOX confidence is an upstream field, not an ADR scientific-authority score.

## 4. Translation audit

Every translation produces a deterministic, non-authority audit record containing:

- adapter contract version;
- upstream contract and exact GEOX repository baseline;
- exact source fact/ref and content snapshot hash;
- exact source scope;
- target semantic id;
- explicit mapping rules;
- deliberately-not-mapped fields;
- chronology interpretation;
- deterministic audit hash;
- `authority_claim = NONE_TRANSLATION_AUDIT_ONLY`.

The translation audit is evidence of mapping behavior only. It is not ContextDatum, ApplicabilityAssessment or any other ADR authority object.

## 5. Soil-moisture safety boundary

P04 includes an explicit safety probe because the task authority specifically forbids silently upgrading shallow VWC into root-zone state.

A GEOX row with:

```text
metric = soil_moisture
```

cannot become ADR VWC unless explicit installation/measurement metadata supplies all of:

```text
semanticId = soil.volumetric_water_content
unit       = m3_per_m3
fromMm
toMm
actual retrievedAt
```

The adapter then preserves the exact vertical interval. For example, a sensor declared at 100 mm remains:

```text
vertical_support = { from_mm: 100, to_mm: 100 }
```

It is never rewritten as root-zone state.

Additional fail-closed rules:

- missing depth metadata -> reject;
- wrong semantic id/unit -> reject;
- conflicting non-null GEOX unit -> reject;
- invalid/reversed depth -> reject;
- impossible timestamps -> reject;
- retrieval before observation -> reject;
- non-finite or non-numeric value -> reject;
- GEOX confidence is not mapped into ADR uncertainty/qualification.

## 6. SDK and exact authority continuity

The active crop-provider acceptance sends the exact adapter-produced `adr.context-datum.v1` payload through the P02 SDK `createContextDatum` contract and resolves that request through the real ADR ContextDatum authority publication seam.

The exact ContextDatum authority ref returned to the SDK is then the exact ref frozen into ContextManifest and consumed by existing Gate-A applicability/workbench processing.

P04 does not obtain a special publication path for being first-party.

## 7. GEOX ResultSink

The GEOX ResultSink accepts only:

```text
adr.result-sink-event.v1
APPLICABILITY_PUBLISHED
exact ApplicabilityAssessment authority_ref
```

Projection-only identity or another authority kind fails closed.

The GEOX projection carries:

```text
authority_claim = NONE_GEOX_ADAPTER_RESULT_PROJECTION_ONLY
```

Consuming the event creates no ADR authority.

## 8. Independence regression

P04 acceptance enforces:

- `adapters/geox` imports the public SDK layer only, not ADR internal authority packages;
- ADR `packages/*` and public SDK source contain no GEOX/MCFT/CAP/KBS/T3R1 semantics;
- P03 non-GEOX reference adapter and P03 acceptance contain no dependency on `adapters/geox`;
- P03 remains an independent product proof, while P04 is a removable first-party downstream integration.

Deleting the GEOX adapter would remove P04-specific acceptance but does not alter ADR core or the P03 non-GEOX path.

## 9. Acceptance

Root CI includes:

```text
npm run test:geox-adapter
```

Positive acceptance proves:

- exact verified GEOX baseline/contract pin;
- conservative crop source epistemic/provenance mapping;
- confidence and allowed_actions non-consumption;
- P02 SDK -> exact ContextDatum authority continuity;
- exact ContextDatum ref -> ContextManifest -> Gate-A Applicability/Workbench closure;
- exact ApplicabilityAssessment -> GEOX ResultSink projection;
- explicit shallow VWC depth is preserved and never promoted to root-zone state;
- no RuntimeEligibility/RuntimeBinding/DecisionRobustness/DecisionResult fabrication.

Integrity acceptance attacks:

- core/SDK GEOX coupling;
- internal authority imports;
- P03 dependency on GEOX;
- schema-version/type drift;
- crop status/source drift;
- cross-scope records;
- impossible/backwards chronology;
- confidence/allowed_actions authority laundering;
- missing soil depth;
- unit/semantic conflicts;
- reversed/noncanonical depth;
- invalid values;
- ResultSink projection/wrong-kind substitution;
- first-party special-authority claims.

P04 is CLOSED only after exact feature-head full root CI, current merge-ref full root CI, independent adapter/independence/security review, Ready-state merge-candidate revalidation, expected-head merge, actual-main verification and exact-main full root CI are all green.

## 10. Permanent nonclaims

P04 does not establish:

- GEOX schema as ADR public-contract authority;
- GEOX confidence as ADR uncertainty/qualification;
- GEOX allowed_actions as ADR runtime/decision authority;
- root-zone state from shallow point measurements;
- recommendation authority;
- RuntimeEligibility;
- RuntimeBinding;
- DecisionRobustness;
- DecisionResult;
- production network/retry/SLO readiness.

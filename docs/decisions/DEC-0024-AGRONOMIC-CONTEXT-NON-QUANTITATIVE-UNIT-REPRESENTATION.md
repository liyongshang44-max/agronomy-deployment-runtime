# DEC-0024 — Agronomic Context Non-Quantitative Unit Representation

Status: **ACCEPTED**

Date: 2026-09-01

## Context

The Frozen Agronomic Context & Public Runtime Contract v1.0 defines `ContextDatum.unit` as a required non-empty string while its value vocabulary includes non-quantitative typed values such as `BOOLEAN`, `STRING`, `CATEGORY`, `DATE`, `TIMESTAMP`, `SET` and `UNKNOWN`.

DEC-0016 established the first governed recorded-operation context semantic mapping:

```text
crop.planting_date
value.type = DATE
value.date = 2011-05-03
```

DEC-0016 intentionally did not assign a ContextDatum unit. It explicitly recorded that the correct representation for a DATE-valued planting semantic had not been established.

The accepted DEC-0017 through DEC-0023 chain establishes additional epistemic, provenance, provider, source-reference/content-hash, temporal-support, source-native-timezone and spatial-support authorities, but none establishes unit semantics.

Therefore final ContextDatum projection remains blocked on an explicit unit representation for this non-quantitative value.

## Problem

A calendar date is not a duration or scalar quantity.

For the first Gold, assigning:

```text
unit = day
```

would incorrectly assert that the value `2011-05-03` is measured in days.

Likewise, using an empty string would violate the frozen ContextDatum shape and would erase the distinction between an intentionally non-applicable unit and a missing/unresolved unit.

ADR therefore requires a canonical representation for the case:

> the ContextDatum contract requires a unit field, but the semantic value is not a physical or quantitative measurement and unit semantics are not applicable.

## Decision

Introduce a governed canonical ContextDatum unit token:

```text
NOT_APPLICABLE
```

with the following exact meaning:

> the datum's typed semantic value is intentionally non-quantitative for this accepted projection and therefore no measurement unit applies.

For the first accepted mapping only:

```text
semanticId = crop.planting_date
value.type = DATE
```

may project:

```text
unit = NOT_APPLICABLE
```

when and only when the exact accepted DEC-0016 semantic-mapping authority is revalidated and closes to the accepted planting-date value.

This decision does not authorize callers to assign `NOT_APPLICABLE` to arbitrary semantic IDs or value types.

## Why a canonical token instead of schema relaxation

DEC-0024 does not change the frozen ContextDatum shape.

The public contract currently requires a non-empty `unit` field. Changing the field to optional/null would be a broader public-contract revision with compatibility consequences unrelated to the immediate authority seam.

A canonical token preserves the existing wire shape while making the semantic distinction explicit and reviewable.

## Why not `day`

`DATE 2011-05-03` identifies a calendar date.

It is not a quantity whose magnitude is expressed in days.

Therefore:

```text
unit = day
```

would introduce false dimensional semantics.

DEC-0024 forbids this substitution for the first Gold.

## Why not `unitless`

`unitless` commonly means a dimensionless quantitative quantity, such as a ratio.

That is different from a unit being semantically inapplicable to a non-quantitative typed value.

DEC-0024 therefore distinguishes:

```text
NOT_APPLICABLE
```

from any future representation of a dimensionless quantitative value.

This decision does not establish a canonical unit token for dimensionless numeric quantities.

## Why not empty, null or omitted

The frozen contract requires a non-empty `unit` field.

Even apart from shape validity, empty/null/omitted representations cannot distinguish:

```text
unit is intentionally not applicable
```

from:

```text
unit is missing, unknown, unresolved or accidentally absent
```

That distinction is authority-critical.

## Authority shape

Introduce a content-addressed authority:

`AgronomicContextNonQuantitativeUnitRepresentationCompilation`

Conceptually:

```text
AgronomicContextNonQuantitativeUnitRepresentationCompilation {
  contractVersion

  compilationId
  parentContextSemanticMappingCompilationRef

  targetContextSemantic {
    semanticId
    value
  }

  unitRepresentation {
    kind = NOT_APPLICABLE
    wireValue = NOT_APPLICABLE
  }

  rationale
  semanticReviewRef
  compilationHash
  limitations
}
```

Exact implementation field names remain implementation-level after architecture acceptance.

## Mandatory predecessor closure

Publication must require the exact accepted DEC-0016 `AgronomicRecordedOperationContextSemanticMappingCompilation`.

The predecessor must be fully revalidated through its own authority validator.

For the first Gold, the predecessor must close exactly to:

```text
semanticId = crop.planting_date
value.type = DATE
value.date = 2011-05-03
```

A caller cannot substitute another semantic ID, another value type or another parent compilation merely because it appears non-quantitative.

## Finite first vocabulary

The first implementation vocabulary is deliberately finite:

```text
crop.planting_date / DATE
  -> unit = NOT_APPLICABLE
```

No other semantic/value pair is authorized by DEC-0024 merely because the frozen value vocabulary contains other non-quantitative types.

Future additions require explicit reviewed authority expansion.

## No generic type-only inference

The system must not implement:

```text
if value.type == DATE:
  unit = NOT_APPLICABLE
```

as an unrestricted rule.

The first authority binds an exact semantic/value family and exact predecessor world.

Type shape alone does not grant semantic authority.

## No ContextDatum publication

DEC-0024 must not create:

- ContextDatum;
- ContextManifest;
- AuthorizedContextReference;
- ResolvedContextDatumReceipt.

It establishes only the unit representation authority needed by a later ContextDatum projection.

## No uncertainty authority

DEC-0024 must not create or infer:

```text
uncertainty = NONE
```

or any other uncertainty form.

`unit = NOT_APPLICABLE` says nothing about epistemic uncertainty.

## No effectiveInterval authority

DEC-0024 does not create or infer:

- `effectiveInterval.start`;
- `effectiveInterval.end`;
- local civil-day boundaries;
- UTC boundaries;
- timezone offsets;
- historical timezone rules.

## No availableAt authority

DEC-0024 does not establish ContextDatum `availableAt`.

It must not substitute event time, acquisition time, materialization time, review time, publication time or Git metadata.

## No temporal-support mutation

DEC-0021 remains the temporal-support classification authority.

DEC-0024 does not alter temporal-support semantics.

## No timezone mutation

DEC-0022 remains the source-native timezone identity-binding authority.

DEC-0024 does not derive timestamps or offsets from that identity.

## No spatial-support or target-instance authority

DEC-0023 remains the spatial-support classification authority.

DEC-0024 does not create geometry, geometryRef, target-instance binding, ContextManifest targetRef or DecisionProblem targetRef.

## No epistemic or provenance mutation

DEC-0017 and DEC-0018 remain the accepted epistemic/provenance classification authorities.

Unit representation must not upgrade, downgrade or otherwise alter those classifications.

## No source-lineage mutation

DEC-0019 and DEC-0020 remain the accepted provider/source-reference/content-hash authorities.

DEC-0024 does not alter source lineage or source wire projection.

## No quantitative-unit registry claim

DEC-0024 does not establish:

- a general UCUM implementation;
- a physical-unit ontology;
- conversion rules;
- dimensional analysis;
- canonical dimensionless numeric units;
- unit compatibility across providers.

Those remain separate concerns.

## No missing-data substitution

`NOT_APPLICABLE` must not be used to represent:

- unknown unit;
- missing unit metadata;
- source unit not reported;
- unit parsing failure;
- unsupported unit;
- unit conversion failure;
- unresolved semantic mapping.

Those conditions must remain distinguishable and fail closed where required.

## Reviewer authority

Publication requires an explicit:

`AgronomicContextNonQuantitativeUnitRepresentationReviewDecision`

or equivalent governed review authority.

The review must bind the exact:

- parent DEC-0016 compilation ref;
- semantic ID;
- typed value family;
- canonical unit kind;
- canonical wire value.

## Mandatory review checks

An accepted review should confirm at least:

1. `PARENT_CONTEXT_SEMANTIC_MAPPING_AUTHORITY_VERIFIED`;
2. `EXACT_TARGET_CONTEXT_SEMANTIC_VERIFIED`;
3. `EXACT_TARGET_VALUE_TYPE_VERIFIED`;
4. `NON_QUANTITATIVE_UNIT_INAPPLICABILITY_VERIFIED`;
5. `CANONICAL_NOT_APPLICABLE_TOKEN_VERIFIED`;
6. `NO_DAY_DURATION_SEMANTIC_SUBSTITUTION`;
7. `NO_DIMENSIONLESS_QUANTITATIVE_SEMANTIC_SUBSTITUTION`;
8. `NO_EMPTY_NULL_OR_OMITTED_UNIT`;
9. `NO_GENERIC_TYPE_ONLY_INFERENCE`;
10. `NO_CONTEXT_DATUM_PUBLICATION`;
11. `NO_UNCERTAINTY_INFERENCE`;
12. `NO_EFFECTIVE_INTERVAL_OR_AVAILABLE_AT_INFERENCE`;
13. `NO_TEMPORAL_TIMEZONE_OR_SPATIAL_MUTATION`;
14. `NO_TARGET_INSTANCE_OR_GEOMETRY_INFERENCE`;
15. `NO_EPISTEMIC_PROVENANCE_OR_SOURCE_MUTATION`;
16. `NO_GENERAL_UNIT_REGISTRY_OR_CONVERSION_CLAIM`;
17. `NO_MISSING_DATA_SUBSTITUTION`.

All mandatory checks are required for accepted publication.

## Review dispositions

At minimum:

- `ACCEPT_CONTEXT_NON_QUANTITATIVE_UNIT_REPRESENTATION`;
- `REJECT_CONTEXT_NON_QUANTITATIVE_UNIT_REPRESENTATION`.

Rejected review cannot authorize publication.

## Content addressing

Changing any material authority element must change semantic identity or fail review closure, including:

- parent compilation ref;
- semantic ID;
- value type;
- unit representation kind;
- wire value;
- rationale;
- semantic review decision.

## First Gold

The first Gold should replay the exact accepted Sustainable Corn predecessor world and prove only:

```text
crop.planting_date
DATE 2011-05-03
  ->
unit = NOT_APPLICABLE
```

The Gold must also prove fail-closed behavior for at least:

- wrong parent compilation;
- wrong semantic ID;
- wrong value type;
- `unit = day`;
- `unit = unitless`;
- empty unit;
- caller-supplied arbitrary `NOT_APPLICABLE` mapping;
- predecessor drift;
- review mismatch.

## Consequences

Positive:

- closes a real frozen-contract seam without changing ContextDatum wire shape;
- prevents false duration semantics for DATE values;
- distinguishes intentional inapplicability from missing unit metadata;
- remains content-addressed and fail-closed;
- creates a reusable governance pattern for future non-quantitative semantic/value pairs.

Costs:

- introduces an ADR-specific canonical sentinel token;
- future non-quantitative semantics still require explicit reviewed expansion;
- does not by itself make the Sustainable Corn planting-date ContextDatum publishable.

## Explicit remaining blockers after acceptance

Even if DEC-0024 is accepted and implemented, final planting-date ContextDatum projection still requires independent closure for unresolved fields including at least:

- uncertainty representation;
- vertical-support applicability/representation;
- `availableAt` authority;
- effective-interval timestamp projection;
- target-instance/public spatial binding;
- final ContextDatum assembly/publication authority.

DEC-0024 must not be treated as authority for any of those seams.

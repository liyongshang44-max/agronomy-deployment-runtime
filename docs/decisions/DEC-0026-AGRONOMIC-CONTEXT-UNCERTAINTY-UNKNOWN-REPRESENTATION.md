# DEC-0026 — Agronomic Context Uncertainty Unknown Representation

Status: **PROPOSED**

Date: 2026-09-01

## Context

The frozen Agronomic Context & Public Runtime Contract v1.0 requires every
`ContextDatum` to carry an explicit `uncertainty` object.

The executable frozen contract accepts exactly these uncertainty forms:

```text
NONE
INTERVAL
CATEGORICAL_SET
DISTRIBUTION_REFERENCE
UNKNOWN
```

For `UNKNOWN`, the frozen contract requires an explicit non-empty
`reasonCode`.

The exact first planting-date semantic/value was accepted by DEC-0016:

```text
semanticId = crop.planting_date
value.type = DATE
value.date = 2011-05-03
```

The accepted Sustainable Corn predecessor world is grounded in the retained exact
public notebook source and source-scoped semantic normalization.

The retained notebook query material used by the accepted occurrence world selects:

```sql
SELECT uniqueid, operation, to_char(valid, 'Mon dd,YYYY'), cropyear, valid
from operations
ORDER by valid ASC
```

and the persisted planting view used by the Gold contains:

```text
33   2011-05-03  plant_corn  SERF  2011
```

Existing accepted Gold provenance deliberately states that this retained notebook
output does not prove additional operation fields not shown by the selected
persisted evidence, and DEC-0016 explicitly does not establish uncertainty.

DEC-0025 closed the independent `verticalSupport` seam only. It did not create
uncertainty authority.

The planting-date ContextDatum projection therefore still lacks an explicit,
evidence-faithful uncertainty representation.

## Problem

The current accepted evidence establishes the typed planting-date value, but it does
not establish any of the following uncertainty characterizations:

- an assertion that uncertainty is exactly absent;
- a numeric uncertainty interval;
- a categorical alternative set;
- a referenced probability distribution.

The frozen ContextDatum contract does not permit omission of `uncertainty`.

ADR therefore needs an explicit fail-closed representation for the state in which
the accepted evidence establishes the value but does not establish a supported
uncertainty characterization.

## Decision

For the first accepted mapping only, establish:

```text
crop.planting_date
DATE 2011-05-03
  ->
uncertainty.type = UNKNOWN
uncertainty.reasonCode = ACCEPTED_EVIDENCE_UNCERTAINTY_NOT_ESTABLISHED
```

The exact meaning is:

> the current accepted evidence and authority chain establishes the typed
> planting-date value, but does not establish an uncertainty characterization
> eligible for `NONE`, `INTERVAL`, `CATEGORICAL_SET` or
> `DISTRIBUTION_REFERENCE`.

This is a fail-closed uncertainty representation.

It does not make the planting-date value itself unknown.

## Exact reason code

The first canonical reason code is:

```text
ACCEPTED_EVIDENCE_UNCERTAINTY_NOT_ESTABLISHED
```

The reason code refers specifically to the current accepted evidence/authority
world.

It does not assert that every upstream Sustainable Corn artifact globally lacks
uncertainty metadata.

It does not assert that the underlying database schema has no uncertainty columns.

It does not assert that a future preferred workbook row could not carry additional
uncertainty information.

If future accepted evidence establishes a more specific uncertainty
characterization, that requires a new governed authority version or successor
decision; it must not silently rewrite this historical compilation.

## Exact predecessor authority

DEC-0026 requires the exact accepted DEC-0016
`AgronomicRecordedOperationContextSemanticMappingCompilation`.

That predecessor must be fully revalidated through its own authority validator and
must close exactly to:

```text
semanticId = crop.planting_date
value.type = DATE
value.date = 2011-05-03
```

The predecessor validation must replay its exact accepted source/evidence chain.

DEC-0026 does not require DEC-0024 or DEC-0025 as parent authorities.

Unit representation, vertical-support representation and uncertainty
representation are independent ContextDatum field-level authority seams. Creating a
serial dependency between them would add authority not required by the frozen
contract.

## Why not `NONE`

The following is forbidden:

```text
uncertainty.type = NONE
```

`NONE` is an affirmative semantic assertion that this datum carries exact/no
uncertainty under the accepted representation.

The current accepted source/evidence chain does not establish that assertion.

A precise calendar date value and DAY precision do not themselves prove
`uncertainty = NONE`.

DEC-0026 must not infer absence of uncertainty merely because a source presents one
date value.

## Why not `INTERVAL`

The accepted evidence does not establish numeric lower/upper uncertainty bounds.

DEC-0026 must not manufacture:

- plus/minus day ranges;
- calendar-date windows;
- probability intervals;
- measurement error bounds;
- timestamp ranges;
- agronomic tolerance windows.

DAY precision is temporal representation precision. It is not numeric uncertainty
authority.

## Why not `CATEGORICAL_SET`

The accepted evidence does not establish a finite set of alternative planting dates
or categories.

DEC-0026 must not generate neighboring dates or plausible alternatives.

## Why not `DISTRIBUTION_REFERENCE`

The accepted evidence does not establish a provider distribution, model
distribution, statistical object or immutable uncertainty artifact.

No distribution reference may be invented from the provider identity, sourceRef,
contentHash or retained notebook.

## Value remains known

DEC-0026 must preserve:

```text
value = {
  type = DATE
  date = 2011-05-03
}
```

It must not convert the ContextDatum value itself to:

```text
value.type = UNKNOWN
```

The uncertainty characterization is unknown; the accepted typed value is not.

These are independent semantic axes.

## No source-global negative claim

DEC-0026 does not publish:

```text
SOURCE_UNCERTAINTY_NOT_REPORTED
```

as a global source fact.

The retained notebook/Gold supports only the narrower governance statement that the
current accepted evidence world does not establish an uncertainty
characterization.

Absence of an uncertainty field in the selected persisted row cannot be generalized
to every upstream artifact, workbook version, database column or provider product.

## No generic DATE inference

DEC-0026 must not establish a rule such as:

```text
if value.type == DATE:
  uncertainty = UNKNOWN
```

Nor may it establish:

```text
if epistemicClass == ASSERTION:
  uncertainty = UNKNOWN
```

The first accepted mapping is finite to the exact revalidated DEC-0016
planting-date semantic/value world.

Future semantic/value families require explicit reviewed expansion.

## Authority shape

Introduce a content-addressed authority:

`AgronomicContextUncertaintyUnknownRepresentationCompilation`

Conceptually:

```text
AgronomicContextUncertaintyUnknownRepresentationCompilation {
  contractVersion

  compilationId
  parentContextSemanticMappingCompilationRef

  targetContextSemantic {
    semanticId
    value
  }

  uncertaintyRepresentation {
    type = UNKNOWN
    reasonCode = ACCEPTED_EVIDENCE_UNCERTAINTY_NOT_ESTABLISHED
  }

  rationale
  semanticReviewRef
  compilationHash
  limitations
}
```

Exact implementation field names remain implementation-level after architecture
acceptance.

The wire representation must remain compatible with the frozen ContextDatum shape:

```text
uncertainty = {
  type: "UNKNOWN",
  reasonCode: "ACCEPTED_EVIDENCE_UNCERTAINTY_NOT_ESTABLISHED"
}
```

DEC-0026 does not alter the frozen ContextDatum contract.

## Reviewer authority

Publication requires an explicit
`AgronomicContextUncertaintyUnknownRepresentationReviewDecision`, or equivalent
governed review authority.

The review must bind the exact:

- DEC-0016 compilation ref;
- semantic ID;
- typed value;
- `UNKNOWN` uncertainty form;
- exact reasonCode;
- accepted-evidence scope used to justify the representation.

## Mandatory review checks

An accepted review should confirm at least:

1. `PARENT_CONTEXT_SEMANTIC_MAPPING_AUTHORITY_VERIFIED`;
2. `EXACT_TARGET_CONTEXT_SEMANTIC_VERIFIED`;
3. `EXACT_TARGET_VALUE_VERIFIED`;
4. `ACCEPTED_EVIDENCE_SCOPE_REVALIDATED`;
5. `UNKNOWN_UNCERTAINTY_REPRESENTATION_VERIFIED`;
6. `EXACT_UNCERTAINTY_REASON_CODE_VERIFIED`;
7. `NO_UNCERTAINTY_NONE_INFERENCE`;
8. `NO_NUMERIC_UNCERTAINTY_INTERVAL_INFERENCE`;
9. `NO_CATEGORICAL_ALTERNATIVES_INFERENCE`;
10. `NO_DISTRIBUTION_REFERENCE_INFERENCE`;
11. `NO_VALUE_UNKNOWN_SUBSTITUTION`;
12. `NO_SOURCE_GLOBAL_NOT_REPORTED_CLAIM`;
13. `NO_GENERIC_DATE_TYPE_INFERENCE`;
14. `NO_GENERIC_EPISTEMIC_CLASS_INFERENCE`;
15. `NO_CONTEXT_DATUM_PUBLICATION`;
16. `NO_EFFECTIVE_INTERVAL_OR_AVAILABLE_AT_INFERENCE`;
17. `NO_TEMPORAL_OR_TIMEZONE_MUTATION`;
18. `NO_SPATIAL_VERTICAL_TARGET_OR_GEOMETRY_MUTATION`;
19. `NO_UNIT_MUTATION`;
20. `NO_EPISTEMIC_PROVENANCE_OR_SOURCE_MUTATION`;
21. `NO_POLICY_RUNTIME_EXECUTION_OR_OUTCOME_INFERENCE`.

All mandatory checks are required for accepted publication.

## Review dispositions

At minimum:

- `ACCEPT_CONTEXT_UNCERTAINTY_UNKNOWN_REPRESENTATION`;
- `REJECT_CONTEXT_UNCERTAINTY_UNKNOWN_REPRESENTATION`.

Rejected review cannot authorize publication.

## Content addressing

Changing any material authority element must change semantic identity or fail review
closure, including:

- parent DEC-0016 compilation ref;
- semantic ID;
- typed value;
- uncertainty type;
- reasonCode;
- accepted-evidence scope;
- rationale;
- semantic review decision.

## No ContextDatum publication

DEC-0026 must not create:

- `ContextDatum`;
- `ContextManifest`;
- `AuthorizedContextReference`;
- `ResolvedContextDatumReceipt`.

It establishes only one field-level uncertainty representation authority for later
ContextDatum assembly.

## No effectiveInterval authority

DEC-0026 does not establish or infer:

- local civil-day interpretation;
- historical UTC offset;
- DST state;
- TZDB basis/version;
- `effectiveInterval.start`;
- `effectiveInterval.end`.

The existing local-civil-time/historical-timezone-rule blocker remains independent.

## No availableAt authority

DEC-0026 does not establish `availableAt`.

It must not substitute:

- planting date;
- notebook execution time;
- source acquisition time unless separately governed;
- review time;
- publication time;
- Git author/commit time;
- ADR materialization time.

## No temporal or timezone mutation

DEC-0021 remains temporal-support classification authority.

DEC-0022 remains source-native timezone identity authority.

DEC-0026 does not mutate them and does not turn uncertainty UNKNOWN into time
ambiguity authority.

## No spatial, vertical-support, target or geometry mutation

DEC-0023 remains spatial-support class authority.

DEC-0025 remains vertical-support non-applicability authority.

DEC-0026 does not:

- alter `spatialSupport.type = FARM`;
- alter `verticalSupport = null`;
- add/remove geometryRef;
- establish exact public target identity;
- infer FIELD/PLOT/ZONE support.

## No unit mutation

DEC-0024 remains unit-representation authority:

```text
unit = NOT_APPLICABLE
```

DEC-0026 does not change or depend on that representation.

## No epistemic/provenance/source mutation

DEC-0017 through DEC-0020 remain the accepted epistemic, provenance and source
lineage authorities.

DEC-0026 must not rewrite them.

In particular, DEC-0017's `epistemicClass = ASSERTION` does not automatically
imply uncertainty `UNKNOWN`; the first mapping remains exact and source-scoped.

## First Gold

The first Gold should replay the exact accepted Sustainable Corn DEC-0016 predecessor
world and prove only:

```text
crop.planting_date
DATE 2011-05-03
  ->
uncertainty.type = UNKNOWN
uncertainty.reasonCode =
  ACCEPTED_EVIDENCE_UNCERTAINTY_NOT_ESTABLISHED
```

The Gold must fail closed for at least:

- wrong predecessor authority;
- predecessor ref drift;
- wrong semantic ID;
- wrong value type;
- wrong DATE value;
- `uncertainty.type = NONE`;
- fabricated numeric interval;
- fabricated categorical set;
- fabricated distribution reference;
- wrong reasonCode;
- empty/null/omitted reasonCode;
- value-level UNKNOWN substitution;
- generic DATE type-only inference;
- generic ASSERTION inference;
- source-global `NOT_REPORTED` claim substitution;
- incomplete review;
- unauthorized reviewer;
- rejected review;
- review/publication mismatch.

## Consequences

Positive:

- fills the frozen ContextDatum uncertainty seam without fabricating precision;
- preserves the accepted date value while explicitly exposing lack of uncertainty
  characterization;
- distinguishes unknown uncertainty from no uncertainty;
- avoids overclaiming global properties of the upstream Sustainable Corn source;
- preserves fail-closed future upgrade when better source evidence becomes accepted;
- remains finite, reviewed and content-addressed.

Costs:

- the first public uncertainty form is deliberately conservative;
- downstream consumers must treat `UNKNOWN` as genuinely unresolved uncertainty
  characterization;
- future evidence may require a new version with a more specific uncertainty form;
- this does not make the planting-date ContextDatum publishable.

## Explicit remaining blockers after acceptance

Even if DEC-0026 is accepted and implemented, final planting-date ContextDatum
projection still requires independent closure for at least:

- local civil-time interpretation / historical timezone rule sufficient for
  concrete effectiveInterval bounds;
- `availableAt` authority;
- exact target-instance/public spatial binding;
- datum logical identity;
- final ContextDatum assembly/publication authority;
- ContextManifest inclusion.

The effectiveInterval blocker must not be bypassed using UTC midnight, current OS
timezone data or generic geography.

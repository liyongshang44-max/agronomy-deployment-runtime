# KBS 2015 Irrigation Gold Protocol Benchmark v1

Status: **REAL-SOURCE BENCHMARK — INTENTIONALLY INCOMPLETE**

Source basis: `2015 LTER Agronomic Protocol`, Kellogg Biological Station, Michigan State University, irrigation scheduling section for the Resource Gradient Experiment (N-rate Study), original PDF page 23.

## Purpose

This benchmark is the first real-source end-to-end exercise of accepted `DEC-0002 — Governed Agronomic Policy Compilation`:

```text
Protocol source
  -> exact retained benchmark artifact
  -> source-faithful Claim + SourceContext
  -> QualifiedKnowledge for AGRONOMIC_POLICY_INPUT
  -> governed Model
  -> governed Policy
  -> AgronomicPolicyCompilation
```

The benchmark is deliberately allowed to finish with `losslessCoverage=INCOMPLETE`. A real protocol must be allowed to expose missing schema vocabulary; ADR must not convert an unsupported `COMPLETE` declaration into apparent authority.

It is intentionally narrower than a production ingest. The committed SourceArtifact is a curated, whitespace-normalized UTF-8 transcription of the decision-material source section, anchored to the user-provided PDF page. It is **not** the original PDF byte stream. The acceptance therefore validates semantic/provenance closure of a real protocol section, not original-PDF retention or rights handling.

## Source-supported protocol semantics

The source section explicitly states that:

1. rainfall and irrigation are credits in the soil-water budget;
2. evapotranspiration is a debit;
3. daily rainfall/irrigation recording starts on May 1;
4. recorded rainfall/irrigation plus modeled daily ETmax are used to calculate daily plant available water;
5. negative values indicate soil water unavailable for plant uptake;
6. two consecutive negative daily values schedule irrigation for the next day;
7. a rainfall event that restores net plant available water is an exception to that schedule;
8. irrigation amount is determined by the previous day's plant available water deficit;
9. scheduled irrigation is communicated by e-mail to named investigators and LTER staff;
10. that communication is coordinated by Joe Simmons;
11. the protocol is for planning and the agronomic field log is the authority for actual field operations.

All eleven source assertions are retained as source-faithful Claim/SourceContext candidates and, in this acceptance fixture, are carried through the scientific qualification mechanics for `AGRONOMIC_POLICY_INPUT`.

## Governed operationalization represented by DEC-0002 v1

The accepted `AgronomicPolicyCompilation` keeps these authorities separate:

- `QualifiedKnowledge` carries source-supported agronomic assertions.
- `Model` carries the daily water-budget computational semantics.
- `Policy` carries the two-day trigger, rainfall override, next-day action, amount expression and notification semantics.
- `AgronomicPolicyCompilation` records how those exact authorities were combined.

The v1 rule successfully structures:

- daily evaluation cadence;
- `plant_available_water_mm < 0` trigger;
- two consecutive daily periods;
- restorative-rainfall exception;
- next-day `IRRIGATE` timing;
- prior-day deficit as the amount basis;
- e-mail notification channel and the named recipients;
- protocol-planning versus actual-field-operation separation.

Two implementation choices are deliberately labelled as ADR operationalization judgments rather than source assertions:

- the action amount expression uses `COPY(previous_day_plant_available_water_deficit_mm)` to make the source phrase “determined by the value” executable;
- `WAIT` is the ADR fallback when the irrigation rule does not produce an irrigation action.

## Real schema gaps found by the first protocol

The source contains two decision/operations semantics that accepted DEC-0002 v1 cannot represent structurally without overloading unrelated fields:

### 1. `EVALUATION_START_DATE`

The source says daily recording begins **May 1**. Rule v1 has `evaluationCadence`, but no structured source-bound temporal boundary for when the represented evaluation/data schedule begins. Encoding May 1 as a cadence, predicate, limitation, or arbitrary text would lose its temporal authority semantics.

### 2. `COORDINATION_COORDINATOR`

The source says communication is **coordinated by Joe Simmons**. The v1 coordination object can retain notification mode, channel, and participants, but has no field expressing the distinct coordinator role. Adding Joe Simmons to the recipient list would not preserve the source meaning that he is the coordinator.

The benchmark therefore requires:

```text
losslessCoverage.status = INCOMPLETE
unrepresentedElements = [
  COORDINATION_COORDINATOR,
  EVALUATION_START_DATE
]
```

The corresponding source knowledge remains present in `knowledgeRefs`; the information is not discarded merely because the accepted Policy vocabulary cannot structure it.

## Source under-specification is separate from schema under-specification

The protocol says the spreadsheet uses rainfall, irrigation and modeled ETmax to calculate daily plant available water, and describes credits/debits. It does **not** publish the complete spreadsheet recurrence, initial state, or all numerical implementation details.

That is a source limitation, not a reason for ADR to invent a formula. The benchmark records this as:

`FULL_SPREADSHEET_RECURRENCE_AND_INITIAL_STATE_NOT_REPORTED_BY_SOURCE`

This must remain distinct from the two actual ADR schema gaps above.

## Acceptance boundaries

The benchmark must fail if the source/knowledge/model/policy/compilation authority chain cannot replay exactly.

It must also fail if the real schema gaps are hidden behind `losslessCoverage=COMPLETE` or if their source authorities disappear from `knowledgeRefs`.

The benchmark also asserts that no `DecisionResult`, `RuntimeBinding`, execution receipt or `Outcome` is created. A protocol plan is not evidence that an irrigation event actually occurred.

The scientific reviewer and approver identities in this acceptance are fixture governance identities. Their use proves ADR authority mechanics; it does not claim that an external KBS/MSU agronomist performed a new review in 2026.

## Explicit remaining work

Three follow-ups are intentionally separated:

1. **Candidate schema follow-up:** `DEC-0003` now proposes a finite source-bound `temporalConstraints` vocabulary plus `coordination.coordinator`. The same page-23 source chain is used by the candidate v2 benchmark to test whether these two v1 gaps can be represented without altering the source meaning. DEC-0003 remains `PROPOSED`; this v1 benchmark remains permanently `INCOMPLETE` as the regression baseline.
2. **Broader protocol follow-up:** the wider 23-page protocol independently exposes explicit prohibition / NO-GO and recurring-action semantics that are not solved by DEC-0003. A page-23 `COMPLETE` result must not be generalized into whole-protocol completeness.
3. **Production source follow-up:** ingest and retain the exact original PDF bytes, subject to rights policy, and bind the same semantic chain to that exact PDF `SourceArtifact`. This benchmark does not claim original-PDF byte retention is complete.

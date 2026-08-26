# KBS 2015 Irrigation Gold Protocol Benchmark v1

Status: implementation benchmark

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

It is intentionally narrower than a production ingest. The committed SourceArtifact is a curated, whitespace-normalized UTF-8 transcription of the decision-material source section, anchored to the user-provided PDF page. It is **not** the original PDF byte stream. The acceptance therefore validates semantic/provenance closure of a real protocol section, not original-PDF retention or rights handling.

## Source-supported protocol semantics represented

The source section explicitly states that:

1. rainfall and irrigation are credits in the soil-water budget;
2. evapotranspiration is a debit;
3. recorded rainfall/irrigation plus modeled daily ETmax are used to calculate daily plant available water;
4. negative values indicate soil water unavailable for plant uptake;
5. two consecutive negative daily values schedule irrigation for the next day;
6. a rainfall event that restores net plant available water is an exception to that schedule;
7. irrigation amount is determined by the previous day's plant available water deficit;
8. scheduled irrigation is communicated by e-mail to key investigators and LTER staff;
9. the protocol is for planning and the agronomic field log is the authority for actual field operations.

## Governed operationalization

The accepted `AgronomicPolicyCompilation` keeps these authorities separate:

- `QualifiedKnowledge` carries source-supported agronomic assertions.
- `Model` carries the daily water-budget computational semantics.
- `Policy` carries the two-day trigger, rainfall override, next-day action, amount expression and notification semantics.
- `AgronomicPolicyCompilation` records how those exact authorities were combined.

Two implementation choices are deliberately labelled as ADR operationalization judgments rather than source assertions:

- the action amount expression uses `COPY(previous_day_plant_available_water_deficit_mm)` to make the source phrase “determined by the value” executable;
- `WAIT` is the ADR fallback when the irrigation rule does not produce an irrigation action.

## Acceptance boundaries

The benchmark must fail if the source/knowledge/model/policy/compilation authority chain cannot replay exactly.

The benchmark also asserts that no `DecisionResult`, `RuntimeBinding`, execution receipt or `Outcome` is created. A protocol plan is not evidence that an irrigation event actually occurred.

The scientific reviewer and approver identities in this acceptance are fixture governance identities. Their use proves ADR authority mechanics; it does not claim that an external KBS/MSU agronomist performed a new review in 2026.

## Explicit remaining gap

A later production-grade benchmark should ingest and retain the exact original PDF bytes (subject to rights policy) and bind this same semantic chain to that exact PDF `SourceArtifact`. This v1 benchmark does not claim that step is complete.

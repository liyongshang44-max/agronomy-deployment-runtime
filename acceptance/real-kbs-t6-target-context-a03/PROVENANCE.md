# Real KBS T6 target-context ingestion via frozen A03/A04

Status: **MACHINE ACCEPTANCE / REAL-SOURCE TARGET CONTEXT / TEST ONLY**

This acceptance proof is an architecture-challenge artifact for the Real-World Heterogeneity Qualification milestone.
It deliberately adds no new ADR core contract or DEC.

## External evidence basis

The retained adapter response is grounded in three public KBS resources:

1. `https://aglog.kbs.msu.edu/observations/3138`
   - observation date: 2015-04-15;
   - area: T6;
   - LTER Main Site;
   - Alfalfa plots;
   - all replications.
2. `https://lter.kbs.msu.edu/treatments/`
   - Main Cropping System Experiment treatment code T6;
   - treatment label Alfalfa.
3. `https://lter.kbs.msu.edu/research/long-term-experiments/main-cropping-system-experiment/`
   - T6 Alfalfa was discontinued after the 2017 harvest;
   - T6 was planted to switchgrass in 2019.

The third item is retained specifically to prevent a 2015 target-context proof from being silently promoted to current-state authority.

## Adapter boundary

`kbs-t6-2015-context-adapter-response.json` is a deterministic acceptance-only provider response.
It normalizes the source evidence into:

```text
treatment.name = Main Site Treatment 6
crop.code      = alfalfa
site.name      = Kellogg Biological Station
```

The adapter also declares a retrospective 2015 evaluation slice.
The UTC slice boundaries and representative effective instant are adapter-level evaluation coordinates.
They are not asserted as exact source operation timestamps.

The exact retained provider response hash is:

```text
sha256:3821a5620b99d0892995fa3ab67241515bba776d80f188641f79ea83e634bc2d
```

## Frozen-core challenge

The proof uses only existing public contracts:

```text
A01 DecisionProblem
A02 ContextDatum
A03 AuthorizedContextReference + ResolvedContextDatumReceipt
A04 ContextManifest
```

For every semantic datum, A03 binds:

```text
exact provider id
+ exact content-addressed adapter response
+ exact retained bytes
+ exact ContextDatum
+ exact resolution chronology
```

All three receipts are `EXACT` replay class and share the same retained response bytes.
A04 then freezes all three ContextDatum refs and all three receipt refs into one `EXACT` ContextManifest.

The A01 targetRef intentionally contains only organization/tenant deployment scope.
This proof does **not** map T6 to ADR `farmId`, `fieldId`, `zoneId`, or another unsupported target granularity.
The treatment-specific target context remains explicit in A02/A03/A04.

## Temporal control

```text
adapter availableAt = 2026-09-04T07:00:00.000Z
A03 resolvedAt      = 2026-09-04T07:10:00.000Z
A04 evidenceCutoff  = 2026-09-04T07:20:00.000Z
A01 logicalTime     = 2026-09-04T07:30:00.000Z
```

Therefore the machine evaluation is no-lookahead with respect to acquisition and resolution.
The agronomic target slice itself is retrospective 2015 context.

## What this proof may establish

If green, it establishes that the frozen generic A01/A02/A03/A04 contracts can ingest and replay the first independently sourced KBS T6 target context without DEC-0034 or source-specific core authority objects.

It does not yet establish:

- positive A08 applicability;
- R03 runtime eligibility;
- D01 RuntimeBinding;
- runtime execution;
- DecisionResult;
- Outcome;
- current T6 crop state;
- exact source operation time;
- causal or agronomic correctness of any action.

Those remain later stages of the Nitrogen world qualification.

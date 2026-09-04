# Real KBS T6 target-context and runtime-composition proof through frozen core

Status: **MACHINE ACCEPTANCE / REAL-SOURCE TARGET + REAL-SOURCE KNOWLEDGE / TEST ONLY**

This acceptance proof is an architecture-challenge artifact for the Real-World Heterogeneity Qualification milestone.
It deliberately adds no new ADR core contract or DEC.

## External target-evidence basis

The retained target-context adapter response is grounded in three public KBS resources:

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

## Real knowledge basis

The knowledge side uses the retained KBS 2015 agronomic-protocol excerpt already governed by the KBS Gold lane:

```text
SourceArtifact content hash =
sha256:55bc293d56f16f7d804c1dd1530937bd9e6b6d3cfbef0e177beb1b971857e196

assertion =
For Main Site Treatment 6 in the 2015 KBS LTER agronomic protocol, nitrogen must not be added.

evidence text =
Do not add any nitrogen to treatment 6.
```

The source is planning/protocol authority, not proof that any historical field operation occurred or did not occur.

## Target adapter boundary

`kbs-t6-2015-context-adapter-response.json` is a deterministic acceptance-only provider response.
It normalizes the independently sourced target evidence into:

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

## Frozen-core path under test

The proof uses existing public contracts only:

```text
A01 DecisionProblem
A02 ContextDatum
A03 AuthorizedContextReference + ResolvedContextDatumReceipt
A04 ContextManifest
K03/K04 source-faithful review and scientific qualification
A05 KnowledgeRetrievalResult
A08 ApplicabilityAssessment
R01 RuntimePlan compiler
R03 RuntimeEligibility
D01 RuntimeBinding
```

No package under `packages/**` is modified by this proof.

For every target semantic datum, A03 binds:

```text
exact provider id
+ exact content-addressed adapter response
+ exact retained bytes
+ exact ContextDatum
+ exact resolution chronology
```

All three receipts are `EXACT` replay class and share the same retained response bytes.
A04 freezes all three ContextDatum refs and all three receipt refs into one `EXACT` ContextManifest.

The A01 targetRef intentionally contains only organization/tenant deployment scope.
The proof does **not** map T6 to ADR `farmId`, `fieldId`, `zoneId`, or another unsupported target granularity.
The treatment-specific target context remains explicit in A02/A03/A04.

A02 uses `spatialSupport.type = EXPERIMENTAL_TREATMENT` only. It deliberately omits `geometryRef`; the KBS treatment identifier is not laundered into geometry authority.

## Scientific qualification boundary

The real T6 no-nitrogen knowledge is qualified for `AGRONOMIC_POLICY_INPUT` with three material semantic preconditions:

```text
crop.code      == alfalfa
site.name      == Kellogg Biological Station
treatment.name == Main Site Treatment 6
```

This intentionally does not exploit the older one-predicate T6 Gold qualification as a shortcut for the positive runtime proof.
The positive proof requires all three target facts to be independently present in the real target ContextManifest.

## Temporal control

```text
adapter availableAt = 2026-09-04T07:00:00.000Z
A03 resolvedAt      = 2026-09-04T07:10:00.000Z
A04 evidenceCutoff  = 2026-09-04T07:20:00.000Z
A01 logicalTime     = 2026-09-04T07:30:00.000Z
```

Therefore the machine evaluation is no-lookahead with respect to retained target evidence acquisition/resolution:

```text
availableAt <= resolvedAt <= evidenceCutoff < logicalTime
```

The agronomic target slice itself is retrospective 2015 context.
This does **not** claim that a 2015 operator possessed the ADR-retained 2026 evidence package.

## Qualified positive result

The exact-head machine-acceptance lane proves the following sequence:

```text
real KBS target evidence
  -> A03 exact replay
  -> A04 exact ContextManifest
  -> real KBS T6 QualifiedKnowledge
  -> A05 exact retrieval
  -> A08 QUALIFIED
  -> A08 DIRECTLY_APPLICABLE
  -> A08 ALLOWED
  -> R01 openRequirements = []
  -> R01 one STRUCTURALLY_COMPLETE path
  -> R03 RUNTIME_ELIGIBLE
  -> one LEGAL alternative
  -> D01 RuntimeBinding
```

The D01 binding freezes the exact real QualifiedKnowledge ref and exact A08 ApplicabilityAssessment ref used by the runtime composition.
Its correctness claim remains:

```text
NONE_BINDING_PROVES_WHAT_WAS_USED_NOT_SCIENTIFIC_CORRECTNESS
```

## Fail-closed mutation controls

The same CI lane also executes three pure A08 predicate-engine negative controls. These are deliberately classified as engine mutation controls, not as second real-source authority publications.

Each mutation changes exactly one material target predicate while leaving the other two matched:

```text
crop.code:      alfalfa -> switchgrass
site.name:      Kellogg Biological Station -> Other Research Site
treatment.name: Main Site Treatment 6 -> Main Site Treatment 7
```

Every mutation must produce:

```text
transportStatus = CONFLICT
runtimeUse      = BLOCKED
conflictCode    = SEMANTIC_PRECONDITION_MISMATCH
```

The mutated predicate must be `MISMATCH / CONFLICT`; both untouched predicates must remain `MATCH`.

This complements the real positive authority path without pretending synthetic mutation values are independently sourced target evidence.

## What this proof establishes

If the exact head is green, it establishes that the frozen existing contracts can carry the first real KBS T6 positive world through target ingestion, applicability, runtime planning, runtime eligibility, and RuntimeBinding without DEC-0034 or a new core abstraction.

In particular:

- A03/A04 can represent and exactly replay independently sourced treatment-scoped target context;
- no unsupported geometry authority is created;
- A08 can match the three material real-world target preconditions;
- A08 fails closed when crop, site, or treatment identity drifts;
- R01 can compile the real compatible world with no open requirements;
- R03 can declare the exact world runtime-eligible;
- D01 can freeze which real knowledge and applicability authority were selected;
- exact provider snapshot authority is preserved across A08, R01, R03, and D01 publication replay.

## Explicit nonclaims

This proof does **not** establish:

- runtime execution;
- an executable fertilizer implementation or device adapter;
- DecisionResult;
- ExecutionReceipt;
- Outcome or OutcomeEvaluation;
- current T6 crop state;
- exact historical source operation time;
- that nitrogen was or was not actually applied in 2015;
- that a 2015 operator had access to the ADR-retained evidence package;
- universal KBS treatment compatibility;
- source-backed plot geometry;
- agronomic recommendation correctness;
- causal effectiveness.

The acceptance explicitly requires zero `RuntimeResult`, `DecisionResult`, `ExecutionReceipt`, `Outcome`, and `OutcomeEvaluation` records.

## Architecture conclusion

For this Nitrogen/T6 stress world, DEC-0034 is not required.
The observed intermediate failures were missing exact-replay wiring in the acceptance harness, while the frozen A03/A08/R01/R03/D01 contracts already exposed the required `snapshotStore` replay seam.

Any future DEC must therefore be justified by a different real world that cannot be represented through these frozen contracts, not by the T6 case already closed here.
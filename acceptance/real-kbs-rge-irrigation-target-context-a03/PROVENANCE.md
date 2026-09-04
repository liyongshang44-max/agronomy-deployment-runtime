# Real KBS Resource Gradient irrigation target and runtime-composition proof

Status: **MACHINE ACCEPTANCE / REAL-SOURCE TARGET + REAL-SOURCE KNOWLEDGE / TEST ONLY**

This is the second Real-World Heterogeneity Qualification world. It challenges the frozen ADR v1 public contracts with an irrigation decision world and deliberately adds no new core contract or DEC.

## Independent target-evidence basis

The retained target adapter is grounded in KBS public target evidence independent of the irrigation protocol used on the knowledge side:

1. `https://aglog.kbs.msu.edu/observations/3187`
   - observation date: 2015-05-21;
   - soybean planting;
   - LTER Main Site N-rate / Fertility Gradient study;
   - areas include `Resource_Gradient-Irrigated` and `Resource_Gradient_Non-Irrigated`.
2. `https://aglog.kbs.msu.edu/observations/3320`
   - observation date: 2015-10-08;
   - soybean harvest;
   - source label explicitly links `LTER N-rate Study` and `Resource Gradient Experiment`;
   - irrigated and non-irrigated areas are both named.
3. `https://lter.kbs.msu.edu/research/long-term-experiments/resource-gradient/`
   - official KBS Resource Gradient Experiment description;
   - the experiment includes rainfed and irrigated management classes.

These sources are used only to establish the target-context identity represented here. They do not establish a soil-water-budget state, a two-day negative-water trigger, or the correctness of any irrigation decision.

## Retained target adapter

`kbs-rge-irrigation-2015-context-adapter-response.json` is a deterministic acceptance-only provider response with exact content hash:

```text
sha256:d2d440c88e5f44ce04f1c89533aa480ca6084e899a8e23d4a6f0e30ceaaecdac
```

It normalizes only:

```text
crop.code       = soybean
experiment.name = Resource Gradient Experiment (N-rate Study)
```

It does **not** create:

- farm, field, or zone identity;
- geometry authority;
- current crop state;
- plant-available-water state;
- two-consecutive-day trigger state;
- rainfall state;
- irrigation execution or correctness authority.

A02 uses:

```text
spatialSupport.type = EXPERIMENT
```

with no `geometryRef`.

## Real knowledge basis

The knowledge side reuses the retained KBS 2015 irrigation protocol page already exercised by the #172 incompatible-target negative control:

```text
SourceArtifact content hash =
sha256:8d18c0fcc5a2b536d675e9b1cdafc16fbeedb19204b67c11ae81f887844f71d9

source locator =
current_agronomic_protocol.pdf#page=23
```

The retained source assertion is:

```text
When a negative plant available water value is observed for two consecutive days, an irrigation event is scheduled for the next day.
```

The source itself identifies the document as a working planning protocol and directs readers to the field log for actual field operations. This acceptance therefore does not treat the protocol as execution evidence.

The source-faithful QualifiedKnowledge is qualified for `AGRONOMIC_POLICY_INPUT` with the same two material semantic preconditions used by the #172 negative control:

```text
crop.code       == soybean
experiment.name == Resource Gradient Experiment (N-rate Study)
```

No additional target predicate is invented in order to make this positive world pass.

## Frozen-core path

The machine proof uses existing contracts only:

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

For each target datum, A03 binds the exact provider id, content-addressed retained provider response, ContextDatum, and resolution chronology. Both receipts are `EXACT`; A04 freezes both datums and receipts in one `EXACT` ContextManifest.

The A01 targetRef intentionally remains organization/tenant scope only. The proof does not promote the RGE evidence to an unsupported ADR farm, field, or zone identity.

## Temporal control

The acceptance uses explicit machine-evaluation chronology:

```text
adapter availableAt = 2026-09-04T08:35:00.000Z
A03 resolvedAt      = 2026-09-04T08:40:00.000Z
A04 evidenceCutoff  = 2026-09-04T08:50:00.000Z
A01 logicalTime     = 2026-09-04T08:55:00.000Z
```

Therefore:

```text
availableAt <= resolvedAt <= evidenceCutoff < logicalTime
```

The agronomic target slice is retrospective 2015 context. The UTC slice coordinates are acceptance coordinates only; they are not asserted as source-native local timestamps. This proof does not claim that a 2015 operator possessed the ADR-retained evidence package.

## Positive runtime-composition requirement

The top-level qualification driver is intentionally fail-closed. A green exact head requires all of the following simultaneously:

```text
A08 scientificUseStatus = QUALIFIED
A08 transportStatus     = DIRECTLY_APPLICABLE
A08 runtimeUse          = ALLOWED
A08 missing context     = []

R01 openRequirements    = []
R01 alternative count   = 1
R01 compiler state      = STRUCTURALLY_COMPLETE

R03 disposition         = RUNTIME_ELIGIBLE
R03 reasonCodes         = []
R03 informationRequirements = []
R03 LEGAL alternatives  = 1

D01 RuntimeBinding      = created
```

The D01 binding must freeze the exact QualifiedKnowledge and ApplicabilityAssessment refs and retain the correctness ceiling:

```text
NONE_BINDING_PROVES_WHAT_WAS_USED_NOT_SCIENTIFIC_CORRECTNESS
```

An earlier diagnostic head (`63a805cf7a6e2b9eb853081eaeed85153942dd2f`) already observed this complete result. Final qualification must reproduce it under the strict assertions above; a non-eligible R03 result or missing D01 binding is now a test failure rather than an acceptable diagnostic outcome.

## Fail-closed mutation controls

Two pure A08 predicate-engine negative controls are executed in the same qualification lane. They are not additional real-source authority publications:

```text
crop.code:
  soybean -> corn

experiment.name:
  Resource Gradient Experiment (N-rate Study) -> Other Experiment
```

For each mutation the frozen engine must produce:

```text
transportStatus = CONFLICT
runtimeUse      = BLOCKED
conflictCode    = SEMANTIC_PRECONDITION_MISMATCH
```

The mutated predicate must be `MISMATCH / CONFLICT`; the untouched predicate must remain `MATCH`.

## Relationship to #172

PR #172 is the negative control for the same real KBS irrigation knowledge. Against the Sustainable Corn target it lacked both material context predicates and correctly produced A08 unresolved/blocking behavior, R03 `INFORMATION_REQUIRED`, zero legal runtime candidates, and no D01 binding.

This world changes the target evidence, not the core runtime semantics. If the strict positive qualification is green, the pair establishes a useful differential:

```text
same real irrigation knowledge
+ incompatible target
  -> fail closed (#172)

same real irrigation knowledge
+ independently sourced compatible target
  -> A08 ALLOWED -> R03 RUNTIME_ELIGIBLE -> D01 binding (#174)
```

## Explicit nonclaims

This proof does **not** establish or create:

- live soil-water-budget input;
- two-day negative plant-available-water observation state;
- rainfall override state;
- runtime execution;
- an executable irrigation controller or device adapter;
- a scheduled irrigation event;
- DecisionResult;
- ExecutionReceipt;
- Outcome or OutcomeEvaluation;
- current RGE crop state;
- exact source operation time;
- source-backed geometry;
- agronomic recommendation correctness;
- causal effectiveness.

The acceptance requires zero `RuntimeResult`, `DecisionResult`, `ExecutionReceipt`, `Outcome`, and `OutcomeEvaluation` records.

## Architecture conclusion

This irrigation world is a challenge to the existing frozen contracts, not a justification for a new architecture layer. No `packages/**` change or DEC is authorized by this proof.

If the final exact head remains green, both Nitrogen/T6 and Irrigation/RGE will have independently reached D01 through the same generic public runtime without DEC-0034. A future core DEC must still be justified by a genuinely repeated inability that these existing contracts cannot safely express.

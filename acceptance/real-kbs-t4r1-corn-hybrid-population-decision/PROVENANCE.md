# GEOX T4/R1 Same-Target Corn Decision Provenance

Status: acceptance evidence only. This file is not architecture authority, GEOX production-adoption authority, human approval authority, dispatch authority, or machine-execution authority.

## Why this world exists

ADR already has:

- real DecisionResult qualification in a soybean planting world; and
- qualified GEOX correspondence for KBS MCSE T4/R1 2026 corn.

Those are different governed targets. This acceptance exists to prove the first **same-target convergence**:

```text
one real KBS T4/R1 2026 corn target
        |
        +-- qualified GEOX correspondence
        |
        +-- real source-backed ADR DecisionResult
```

No crop/domain/target equality is inferred across unrelated worlds.

## Independent normative Knowledge source

Official Albert Lea Seed / Blue River product page:

`https://alseed.com/product/organic-blue-river-43-96p-seed-corn/`

Official 43-96P tech sheet:

`https://alseed.com/wp-content/uploads/2026/08/Tech-Sheet-Blue-River-43-96P-1.pdf`

Retained source-faithful excerpt:

`blue-river-43-96p-population-recommendation-excerpt.txt`

Retained excerpt SHA-256:

`sha256:cf0454506315cc8f5ee4f0939348dc15977e6930f9b4ae0da7b6df93bc18e273`

The retained source evidence explicitly identifies:

- `BLUE RIVER 43-96P`;
- `96-DAY CRM BLUE RIVER ORGANIC CORN HYBRID`;
- `Population Rec: 28-36K`.

The qualified Knowledge therefore uses only these material semantic preconditions:

- `crop.code == corn`;
- `planting.hybrid == 43-96P`.

The recommendation authority is a **range**:

- minimum = `28,000 seed/acre`;
- maximum = `36,000 seed/acre`.

The benchmark does not synthesize a preferred point estimate inside that range.

Limitation:

`RECOMMENDED_RANGE_NOT_HISTORICAL_OPERATION_TRUTH`

The tech-sheet recommendation does not establish what the KBS target historically planted.

## Same independent target authority used by GEOX correspondence

This acceptance reuses, without rewriting, the already-qualified target world:

`acceptance/real-kbs-t4r1-target-correspondence/target-world.mjs`

That target world retains exact/replayable KBS evidence for:

- Main Cropping System Experiment;
- treatment `T4`;
- replicate `R1`;
- crop `corn`;
- hybrid `43-96P`;
- planting observation `6974`.

Its normalized ContextDatum set intentionally does **not** contain a planting-population recommendation or historical population value.

The agronomic DecisionProblem created by this acceptance has the same governed `targetRef` as the existing correspondence DecisionProblem and publishes a new ContextManifest using the exact same target ContextDatum refs and resolved-reference receipt refs.

This is the key same-target invariant. It is stronger than merely observing matching strings in two independent tests.

## Decision path under qualification

```text
Blue River 43-96P tech sheet
        ↓
SourceArtifact
        ↓
source-faithful review
        ↓
QualifiedKnowledge
        ↓
KnowledgeRelease

same KBS T4/R1 target datums + exact receipts
        ↓
new agronomic DecisionProblem + ContextManifest
        ↓
A07 retrieval
        ↓
A08 DIRECTLY_APPLICABLE / ALLOWED
        ↓
R01 no open requirements
        ↓
R03 RUNTIME_ELIGIBLE_WITH_LIMITATIONS
        ↓
D01 RuntimeBinding
        ↓
Policy v3
        ↓
Implementation + Conformance
        ↓
D02 computational execution
        ↓
D04 EXHAUSTIVE_ENUMERATION
        ↓
D05 ROBUST
        ↓
D06 DecisionResult
```

Expected structured action:

`SET_CORN_SEEDING_RATE_RANGE`

with material parameters:

- `minimum_population = 28000 seed/acre`;
- `maximum_population = 36000 seed/acre`.

Policy threshold authority is the exact QualifiedKnowledge ref. Implementation code is not threshold authority.

## GEOX correspondence convergence

The same target is independently represented by the closed correspondence profile:

`CORRESPONDS_TO_SAME_KBS_MCSE_T4_R1_TARGET`

with GEOX target:

- field `field_kbs_mcse_t4r1`;
- season `season_2026_corn`;
- zone `zone_kbs_mcse_t4r1_crop_formal_v1`.

The relation remains correspondence, not identity equality.

## Nonclaims

This acceptance does not claim:

- ADR target identity equals GEOX field identity;
- geometry equality;
- field actionability;
- human approval;
- dispatch authority;
- machine execution authority;
- that KBS historically planted at 28,000, 36,000, or any selected point inside the range;
- that a planter executed the DecisionResult;
- that an ExecutionReceipt exists;
- that an Outcome or causal effect exists;
- that GEOX production runtime has adopted ADR;
- that a new DEC or core abstraction is required.

The intended next step after exact-head qualification is a GEOX-side **shadow-only** adoption proof. It must not promote this DecisionResult into canonical recommendation, approval, operation-plan, task, dispatch, or execution authority.

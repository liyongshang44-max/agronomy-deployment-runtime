# Real-World Heterogeneity — Planting Provenance

Status: acceptance evidence only. This file is not architecture authority and does not create agronomic, execution, or outcome authority.

## World under test

The Planting world deliberately composes two independent public evidence sources:

1. Michigan State University Extension provides the normative soybean planting-population recommendation used to compile QualifiedKnowledge.
2. Kellogg Biological Station public records provide the independent retrospective target context used by A01/A02/A03/A04.

The qualification question is whether the frozen ADR contracts can keep those roles distinct while composing a real quantitative recommendation through applicability and runtime eligibility/binding.

## Knowledge source

Official source locator:

`https://www.canr.msu.edu/news/soybean_planting_populations_affect_soybean_yields_and_profitability_in_mic`

Retained acceptance excerpt:

`msu-soybean-planting-population-recommendation-excerpt.txt`

Retained source artifact hash:

`sha256:fd9d35b3d3dadc5ca1829e792689bb19690ed420efee101ddecf0f0082e3cc4d`

The retained source text explicitly supports:

- soybean planting-population guidance in Michigan;
- a Michigan State University recommendation table;
- `15 inches | 150,000` seeds per acre.

The source-faithful QualifiedKnowledge therefore carries the explicit semantic preconditions:

- `crop.code == soybean`;
- `jurisdiction.region == michigan`;
- `planting.row_spacing_in == 15 inch`.

It also carries the limitation:

`RECOMMENDATION_NOT_HISTORICAL_OPERATION_TRUTH`

That limitation is intentional. The recommendation does not establish that any target field actually planted 150,000 seeds per acre.

## Independent target evidence

KBS public observation:

`https://aglog.kbs.msu.edu/observations/3187`

KBS public site description:

`https://lter.kbs.msu.edu/research/site-description-and-maps/general-description/`

The retained provider-response bytes are:

`kbs-soybean-15in-2015-context-adapter-response.json`

Provider-response hash:

`sha256:5ff980da7a9479bafad43eb47bbb6df71cc6a4a7d00b2eb814f05073a931d5f6`

The target adapter publishes only the independently supported target context needed for this benchmark:

- `crop.code = soybean`;
- `planting.row_spacing_in = 15 inch`;
- `jurisdiction.region = michigan`.

The KBS observation also records a historical operation population of 180,000 seeds per acre. That value is retained inside the provider bytes as evidence of what occurred historically, but it is deliberately not published as a target ContextDatum and is not recommendation authority.

This prevents the benchmark from obtaining the expected 150,000 recommendation by reading a target-side planting-population value.

## Frozen authority path under qualification

The current acceptance path is:

`MSU source -> SourceArtifact -> source-faithful review -> QualifiedKnowledge -> KnowledgeRelease -> KBS A01/A02/A03/A04 target world -> A07 retrieval -> A08 ApplicabilityAssessment -> R01 RuntimePlan -> R03 RuntimeEligibility -> D01 RuntimeBinding`

Expected governance propagation is:

- A08: `QUALIFIED / DIRECTLY_APPLICABLE / ALLOWED`;
- R01: no open information requirements;
- R03: `RUNTIME_ELIGIBLE_WITH_LIMITATIONS`;
- R03 global reason: `LEGAL_RUNTIME_ONLY_WITH_LIMITATIONS`;
- the unique usable runtime path: `LEGAL_WITH_LIMITATIONS`;
- D01: exact binding to that path with the same recommendation-vs-operation limitation preserved.

The limited eligibility is the desired result. Removing the limitation merely to obtain unrestricted `RUNTIME_ELIGIBLE` would weaken source fidelity.

## Nonclaims

This acceptance evidence does not claim:

- that KBS historically planted 150,000 seeds per acre;
- that MSU recommends 180,000 seeds per acre for the benchmark target;
- that a planting machine executed any seeding command;
- that a RuntimeResult or RuntimeDatum exists for planting population;
- that a DecisionResult exists yet;
- that an ExecutionReceipt exists;
- that any agronomic Outcome or OutcomeEvaluation exists;
- that a new core abstraction or DEC is required.

The intended next qualification step, only after exact-head D01 proof is green, is to test whether frozen Policy v3 plus existing implementation/conformance, D02, D05 and D06 can publish a governed advisory DecisionResult for the 150,000 seeds-per-acre recommendation without fabricating physical field execution.
